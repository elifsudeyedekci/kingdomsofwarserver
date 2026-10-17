import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';

export const sha256 = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

/** Only data files the game reads through DataFiles.ReadStreamingText may be managed; never code, never campaign media. */
const PATH_RE = /^Data\/(Balance|Civilizations|Localization|UI|Audio)\/[A-Za-z0-9_\-./]+\.json$/;
export const MAX_FILE_BYTES = 6 * 1024 * 1024;

export function categoryOf(p: string): string {
  const seg = p.split('/')[1]?.toLowerCase();
  return seg === 'balance' ? 'balance' : seg === 'civilizations' ? 'civilization' : seg === 'localization' ? 'localization' : seg === 'ui' ? 'ui' : seg === 'audio' ? 'audio' : 'other';
}

export function assertPath(p: string) {
  if (!PATH_RE.test(p) || p.includes('..') || p.includes('//')) throw new BadRequestException(`Path not allowed: ${p}`);
}

/** Parse + basic safety checks. Returns the parsed value so callers can diff it. */
export function validateJson(content: string): unknown {
  if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) throw new BadRequestException('File is larger than 6 MB');
  let v: unknown;
  try { v = JSON.parse(content.replace(/^﻿/, '')); } catch (e) { throw new BadRequestException(`Invalid JSON: ${(e as Error).message}`); }
  if (v === null || typeof v !== 'object') throw new BadRequestException('Top level must be an object or array');
  return v;
}

/** Flat list of leaf paths that differ between two JSON values (capped), for the panel's diff view. */
export function diffLeaves(a: unknown, b: unknown, limit = 400): { path: string; from: unknown; to: unknown }[] {
  const out: { path: string; from: unknown; to: unknown }[] = [];
  const walk = (x: unknown, y: unknown, p: string) => {
    if (out.length >= limit) return;
    const bothObj = x && y && typeof x === 'object' && typeof y === 'object' && Array.isArray(x) === Array.isArray(y);
    if (!bothObj) { if (JSON.stringify(x) !== JSON.stringify(y)) out.push({ path: p || '$', from: x, to: y }); return; }
    const keys = new Set([...Object.keys(x as object), ...Object.keys(y as object)]);
    for (const k of keys) walk((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k], p ? `${p}.${k}` : k);
  };
  walk(a, b, '');
  return out;
}

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  // ── Draft files ──
  async listFiles() {
    const [files, active] = await Promise.all([
      this.prisma.contentFile.findMany({ orderBy: { path: 'asc' }, select: { path: true, category: true, baseHash: true, updatedAt: true, updatedBy: true, content: true } }),
      this.activeRelease('live'),
    ]);
    const published = new Map<string, string>((active?.files ?? []).map((f) => [f.path, f.hash]));
    return {
      activeVersion: active?.version ?? null,
      files: files.map((f) => { const hash = sha256(f.content); return { path: f.path, category: f.category, size: Buffer.byteLength(f.content), hash, changedFromBuild: hash !== f.baseHash, unpublished: published.size > 0 ? published.get(f.path) !== hash : hash !== f.baseHash, updatedAt: f.updatedAt, updatedBy: f.updatedBy }; }),
    };
  }

  async getFile(p: string) {
    assertPath(p);
    const f = await this.prisma.contentFile.findUnique({ where: { path: p } });
    if (!f) throw new NotFoundException(`No such content file: ${p}`);
    return { path: f.path, category: f.category, content: f.content, hash: sha256(f.content), baseHash: f.baseHash, updatedAt: f.updatedAt, updatedBy: f.updatedBy };
  }

  async saveDraft(p: string, content: string, adminId: string, create = false) {
    assertPath(p);
    validateJson(content);
    const existing = await this.prisma.contentFile.findUnique({ where: { path: p } });
    if (!existing && !create) throw new NotFoundException(`No such content file: ${p} (pass create=true to add a new one)`);
    if (existing) {
      const before = JSON.parse(existing.content), after = JSON.parse(content);
      if (Array.isArray(before) !== Array.isArray(after)) throw new BadRequestException('The top-level type (object/array) of an existing file may not change');
    }
    const row = existing
      ? await this.prisma.contentFile.update({ where: { path: p }, data: { content, updatedBy: adminId } })
      : await this.prisma.contentFile.create({ data: { path: p, category: categoryOf(p), content, baseHash: sha256(content), baseContent: content, updatedBy: adminId } });
    return { path: row.path, hash: sha256(row.content) };
  }

  /** Throw away the draft: restore the active release's copy, or (toBuild) the copy that ships inside the client build. */
  async revertDraft(p: string, toBuild: boolean, adminId: string) {
    assertPath(p);
    const f = await this.prisma.contentFile.findUnique({ where: { path: p } });
    if (!f) throw new NotFoundException();
    let content: string | undefined;
    if (toBuild) content = f.baseContent;
    else content = (await this.activeRelease('live'))?.files.find((x) => x.path === p)?.content;
    if (content === undefined) throw new BadRequestException('No published version of this file exists yet');
    await this.prisma.contentFile.update({ where: { path: p }, data: { content, updatedBy: adminId } });
    return { ok: true };
  }

  async diff(p: string, against: 'active' | 'build') {
    assertPath(p);
    const f = await this.prisma.contentFile.findUnique({ where: { path: p } });
    if (!f) throw new NotFoundException();
    let other: string | undefined;
    if (against === 'active') other = (await this.activeRelease('live'))?.files.find((x) => x.path === p)?.content;
    else other = f.baseContent;
    if (other === undefined) return { path: p, against, available: false, changes: [] };
    return { path: p, against, available: true, changes: diffLeaves(JSON.parse(other), JSON.parse(f.content)) };
  }

  // ── Releases ──
  async activeRelease(channel: string) {
    return this.prisma.contentRelease.findFirst({ where: { channel, isActive: true }, orderBy: { version: 'desc' }, include: { files: true } });
  }

  async releases() {
    const rows = await this.prisma.contentRelease.findMany({ orderBy: { version: 'desc' }, take: 100, include: { _count: { select: { files: true } } } });
    return rows.map((r) => ({ id: r.id, version: r.version, channel: r.channel, note: r.note, manifestHash: r.manifestHash, isActive: r.isActive, createdBy: r.createdBy, createdAt: r.createdAt, activatedAt: r.activatedAt, files: r._count.files }));
  }

  async publish(note: string | undefined, adminId: string, channel = 'live') {
    const drafts = await this.prisma.contentFile.findMany({ orderBy: { path: 'asc' } });
    if (!drafts.length) throw new BadRequestException('There are no content files yet: run "Import from disk" first');
    for (const d of drafts) { try { validateJson(d.content); } catch (e) { throw new BadRequestException(`${d.path}: ${(e as Error).message}`); } }
    const files = drafts.map((d) => ({ path: d.path, hash: sha256(d.content), size: Buffer.byteLength(d.content), content: d.content }));
    const manifestHash = sha256(files.map((f) => `${f.path}:${f.hash}`).join('\n'));
    const prev = await this.activeRelease(channel);
    if (prev && prev.manifestHash === manifestHash) throw new ConflictException('Nothing changed since the active release');
    return this.prisma.$transaction(async (tx) => {
      await tx.contentRelease.updateMany({ where: { channel, isActive: true }, data: { isActive: false } });
      const rel = await tx.contentRelease.create({ data: { channel, note, manifestHash, isActive: true, activatedAt: new Date(), createdBy: adminId, files: { create: files } } });
      this.logger.log(`Content release v${rel.version} published on '${channel}' by ${adminId} (${files.length} files)`);
      return { id: rel.id, version: rel.version, manifestHash, files: files.length };
    });
  }

  async activate(version: number, adminId: string) {
    const rel = await this.prisma.contentRelease.findUnique({ where: { version } });
    if (!rel) throw new NotFoundException();
    await this.prisma.$transaction([
      this.prisma.contentRelease.updateMany({ where: { channel: rel.channel, isActive: true }, data: { isActive: false } }),
      this.prisma.contentRelease.update({ where: { id: rel.id }, data: { isActive: true, activatedAt: new Date() } }),
    ]);
    this.logger.log(`Content release v${version} re-activated by ${adminId} (rollback)`);
    return { ok: true, version };
  }

  async releaseDiff(a: number, b: number) {
    const [ra, rb] = await Promise.all([a, b].map((v) => this.prisma.contentRelease.findUnique({ where: { version: v }, include: { files: true } })));
    if (!ra || !rb) throw new NotFoundException();
    const ma = new Map(ra.files.map((f) => [f.path, f])), mb = new Map(rb.files.map((f) => [f.path, f]));
    const changed: { path: string; changes: number; added?: boolean; removed?: boolean }[] = [];
    for (const [p, fb] of mb) { const fa = ma.get(p); if (!fa) changed.push({ path: p, changes: 0, added: true }); else if (fa.hash !== fb.hash) changed.push({ path: p, changes: diffLeaves(JSON.parse(fa.content), JSON.parse(fb.content), 1000).length }); }
    for (const p of ma.keys()) if (!mb.has(p)) changed.push({ path: p, changes: 0, removed: true });
    return { from: a, to: b, changed };
  }

  // ── Import the files that ship inside the game build (first setup / re-baseline) ──
  async importFromDisk(adminId: string, dirOverride?: string, resetBase = false) {
    const root = dirOverride ?? this.config.get<string>('GAME_DATA_DIR');
    if (!root) throw new BadRequestException('GAME_DATA_DIR is not set (path of the game\'s StreamingAssets folder)');
    const data = path.join(root, 'Data');
    if (!fs.existsSync(data)) throw new BadRequestException(`Folder not found: ${data}`);
    let created = 0, updated = 0, skipped = 0;
    const walk = async (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { if (/^Campaign/i.test(e.name)) continue; await walk(full); continue; }
        if (!e.name.toLowerCase().endsWith('.json')) continue;
        const rel = path.relative(root, full).split(path.sep).join('/');
        if (!PATH_RE.test(rel)) { skipped++; continue; }
        const content = fs.readFileSync(full, 'utf8').replace(/^﻿/, '');
        try { validateJson(content); } catch { skipped++; continue; }
        const existing = await this.prisma.contentFile.findUnique({ where: { path: rel } });
        if (!existing) { await this.prisma.contentFile.create({ data: { path: rel, category: categoryOf(rel), content, baseHash: sha256(content), baseContent: content, updatedBy: adminId } }); created++; }
        else if (resetBase) { await this.prisma.contentFile.update({ where: { path: rel }, data: { baseHash: sha256(content), baseContent: content } }); updated++; }
        else skipped++;
      }
    };
    await walk(data);
    return { created, updated, skipped };
  }
}

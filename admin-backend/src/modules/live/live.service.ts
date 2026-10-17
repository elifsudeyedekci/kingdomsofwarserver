import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { assertPath, sha256 } from '../content/content.service';

export type Platform = 'android' | 'ios' | 'windows';
export interface LiveSettings {
  maintenance: { enabled: boolean; message: Record<string, string>; endsAt: string | null };
  update: Record<Platform, { min: string; latest: string; url: string; notes: Record<string, string> }>;
  services: Record<string, boolean>;
}

export const SERVICE_KEYS = ['online', 'matchmaking', 'ranked', 'store', 'clans', 'friends', 'leaderboards', 'rewards', 'analytics', 'chat'] as const;

export const DEFAULT_SETTINGS = (): LiveSettings => ({
  maintenance: { enabled: false, message: { en: 'The servers are under maintenance. Please try again soon.', tr: 'Sunucular bakımda. Lütfen kısa süre sonra tekrar deneyin.' }, endsAt: null },
  update: {
    android: { min: '0.0.0', latest: '0.0.0', url: '', notes: {} },
    ios: { min: '0.0.0', latest: '0.0.0', url: '', notes: {} },
    windows: { min: '0.0.0', latest: '0.0.0', url: '', notes: {} },
  },
  services: Object.fromEntries(SERVICE_KEYS.map((k) => [k, true])),
});

/** "0.2.10" vs "0.2.9" -> numeric compare of up to 4 dot parts; non numeric parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = String(a ?? '0').split(/[.\-+]/).map((x) => parseInt(x, 10) || 0), pb = String(b ?? '0').split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 4; i++) { const d = (pa[i] ?? 0) - (pb[i] ?? 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
}

const pick = (m: Record<string, string> | null | undefined, locale: string) => (m ? m[locale] ?? m[locale.split('-')[0]] ?? m.en ?? Object.values(m)[0] ?? '' : '');
const SETTING_KEYS = { maintenance: 'live.maintenance', update: 'live.update', services: 'live.services' } as const;

@Injectable()
export class LiveService {
  private cache = new Map<string, { at: number; value: unknown }>();
  constructor(private readonly prisma: PrismaService) {}

  invalidate() { this.cache.clear(); }

  // ── settings (maintenance / update gates / service switches) ──
  async getSettings(): Promise<LiveSettings> {
    const rows = await this.prisma.systemSetting.findMany({ where: { key: { in: Object.values(SETTING_KEYS) } } });
    const d = DEFAULT_SETTINGS(); const by = new Map(rows.map((r) => [r.key, r.value as never]));
    const m = by.get(SETTING_KEYS.maintenance) as Partial<LiveSettings['maintenance']> | undefined, u = by.get(SETTING_KEYS.update) as Partial<LiveSettings['update']> | undefined, s = by.get(SETTING_KEYS.services) as Record<string, boolean> | undefined;
    return {
      maintenance: { ...d.maintenance, ...(m ?? {}) },
      update: { android: { ...d.update.android, ...(u?.android ?? {}) }, ios: { ...d.update.ios, ...(u?.ios ?? {}) }, windows: { ...d.update.windows, ...(u?.windows ?? {}) } },
      services: { ...d.services, ...(s ?? {}) },
    };
  }

  async saveSettings(patch: Partial<LiveSettings>, adminId: string): Promise<LiveSettings> {
    const cur = await this.getSettings();
    const next: LiveSettings = { maintenance: { ...cur.maintenance, ...(patch.maintenance ?? {}) }, update: { ...cur.update }, services: { ...cur.services, ...(patch.services ?? {}) } };
    for (const p of ['android', 'ios', 'windows'] as Platform[]) if (patch.update?.[p]) next.update[p] = { ...cur.update[p], ...patch.update[p] };
    if (next.maintenance.endsAt && Number.isNaN(Date.parse(next.maintenance.endsAt))) throw new BadRequestException('maintenance.endsAt is not a date');
    for (const p of ['android', 'ios', 'windows'] as Platform[]) {
      const u = next.update[p];
      if (!/^\d+(\.\d+){0,3}$/.test(u.min) || !/^\d+(\.\d+){0,3}$/.test(u.latest)) throw new BadRequestException(`${p}: versions must look like 1.2.3`);
      if (compareVersions(u.min, u.latest) > 0) throw new BadRequestException(`${p}: the minimum version cannot be newer than the latest version`);
    }
    for (const k of Object.keys(next.services)) if (typeof next.services[k] !== 'boolean') throw new BadRequestException(`services.${k} must be true/false`);
    const save = (key: string, value: unknown) => this.prisma.systemSetting.upsert({ where: { key }, create: { key, value: value as never, updatedBy: adminId }, update: { value: value as never, updatedBy: adminId } });
    await Promise.all([save(SETTING_KEYS.maintenance, next.maintenance), save(SETTING_KEYS.update, next.update), save(SETTING_KEYS.services, next.services)]);
    this.invalidate();
    return next;
  }

  // ── the one call the game makes at launch ──
  async bootstrap(q: { platform?: string; version?: string; locale?: string; contentVersion?: number }) {
    const platform = (['android', 'ios', 'windows'].includes(String(q.platform)) ? q.platform : 'android') as Platform;
    const version = /^\d+(\.\d+){0,3}/.test(q.version ?? '') ? (q.version as string) : '0.0.0';
    const locale = (q.locale ?? 'en').toLowerCase();
    const key = `${platform}|${version}|${locale}|${q.contentVersion ?? ''}`;
    const hit = this.cache.get(key); if (hit && Date.now() - hit.at < 5000) return hit.value;

    const [settings, flags, configs, anns, release] = await Promise.all([
      this.getSettings(),
      this.prisma.featureFlag.findMany(),
      this.prisma.remoteConfig.findMany({ where: { environment: 'production' } }),
      this.prisma.announcement.findMany({ where: { isActive: true, startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, orderBy: [{ priority: 'desc' }, { startsAt: 'desc' }], take: 30 }),
      this.prisma.contentRelease.findFirst({ where: { channel: 'live', isActive: true }, orderBy: { version: 'desc' }, select: { version: true, manifestHash: true, note: true, files: { select: { path: true, hash: true, size: true }, orderBy: { path: 'asc' } } } }),
    ]);
    const u = settings.update[platform];
    const m = settings.maintenance;
    const maintenanceOn = m.enabled && (!m.endsAt || Date.parse(m.endsAt) > Date.now());
    const value = {
      serverTime: new Date().toISOString(),
      maintenance: { enabled: maintenanceOn, message: pick(m.message, locale), endsAt: m.endsAt },
      update: { required: compareVersions(version, u.min) < 0, available: compareVersions(version, u.latest) < 0, min: u.min, latest: u.latest, url: u.url, notes: pick(u.notes, locale) },
      services: settings.services,
      flags: Object.fromEntries(flags.map((f) => [f.key, f.value])),
      config: Object.fromEntries(configs.map((c) => [c.key, c.value])),
      // Array forms for Unity's JsonUtility (it cannot read dictionaries); every value is a string
      servicesList: Object.entries(settings.services).map(([key, v]) => ({ key, value: String(v) })),
      flagsList: flags.map((f) => ({ key: f.key, value: String(f.value) })),
      configList: configs.map((c) => ({ key: c.key, value: typeof c.value === 'string' ? c.value : JSON.stringify(c.value) })),
      announcements: anns
        .filter((a) => (!a.platforms.length || a.platforms.includes(platform)) && (!a.minVersion || compareVersions(version, a.minVersion) >= 0) && (!a.maxVersion || compareVersions(version, a.maxVersion) <= 0))
        .map((a) => ({ id: a.id, kind: a.kind, title: pick(a.title as Record<string, string>, locale), body: pick(a.body as Record<string, string>, locale), priority: a.priority, startsAt: a.startsAt, endsAt: a.endsAt })),
      content: release ? { version: release.version, hash: release.manifestHash, note: release.note, unchanged: q.contentVersion === release.version, files: q.contentVersion === release.version ? [] : release.files } : { version: 0, hash: '', note: null, unchanged: true, files: [] },
    };
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  /** The published legal texts (privacy policy, terms ...) in the player's language, English as the fallback. Public: the game shows them on first launch. */
  async legal(lang: string) {
    const l = (lang || 'en').toLowerCase().split('-')[0];
    const rows = await this.prisma.legalText.findMany({ where: { isActive: true, language: { in: [l, 'en'] } }, orderBy: { publishedAt: 'desc' } });
    const by = new Map<string, typeof rows[number]>();
    for (const r of rows) { const cur = by.get(r.type); if (!cur || (r.language === l && cur.language !== l)) by.set(r.type, r); }
    return [...by.values()].map((r) => ({ type: r.type, version: r.version, language: r.language, hash: r.hash, content: r.content }));
  }

  /** Raw text of one file of one release (what the client downloads when its local copy differs). */
  async contentFile(version: number, p: string) {
    assertPath(p);
    const f = await this.prisma.contentReleaseFile.findFirst({ where: { path: p, release: { version } }, select: { content: true, hash: true } });
    if (!f) throw new NotFoundException();
    return { content: f.content, hash: f.hash, etag: sha256(f.content) };
  }
}

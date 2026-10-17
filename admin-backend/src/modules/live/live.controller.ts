import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Put, Query, Request, Res, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { ReadThrottle } from '../../common/decorators/throttle.decorator';
import { PrismaService } from '../../database/prisma.service';
import { LiveService, LiveSettings } from './live.service';

/** What the GAME calls (no login): launch gate, maintenance, update prompt, flags, config, news and the content manifest. */
@ApiTags('live')
@Controller('live')
export class LiveController {
  constructor(private readonly live: LiveService) {}

  @Public() @ReadThrottle() @Get('bootstrap')
  @ApiOperation({ summary: 'Launch call: maintenance, update gate, services, flags, config, announcements, content manifest' })
  bootstrap(@Query('platform') platform?: string, @Query('version') version?: string, @Query('locale') locale?: string, @Query('contentVersion') contentVersion?: string) {
    const cv = Number.parseInt(contentVersion ?? '', 10);
    return this.live.bootstrap({ platform, version, locale, contentVersion: Number.isFinite(cv) ? cv : undefined });
  }

  @Public() @ReadThrottle() @Get('legal')
  @ApiOperation({ summary: 'Published legal texts (privacy policy, terms of service...) for ?lang=' })
  legal(@Query('lang') lang?: string) { return this.live.legal(lang ?? 'en'); }

  @Public() @ReadThrottle() @Get('content/:version')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @ApiOperation({ summary: 'Raw text of one data file of one release (?path=Data/Balance/unit_balance.json)' })
  async file(@Param('version') version: string, @Query('path') path: string, @Res({ passthrough: true }) res: { setHeader(k: string, v: string): void }) {
    const v = Number.parseInt(version, 10); if (!Number.isFinite(v)) throw new NotFoundException();
    const f = await this.live.contentFile(v, path);
    res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('ETag', `"${f.hash}"`); res.setHeader('X-Content-Sha256', f.hash);
    return f.content;
  }
}

class AnnouncementDto {
  @IsOptional() @IsIn(['news', 'popup', 'banner']) kind?: string;
  @IsObject() title!: Record<string, string>;
  @IsObject() body!: Record<string, string>;
  @IsOptional() @IsArray() @IsString({ each: true }) platforms?: string[];
  @IsOptional() @IsString() @MaxLength(20) minVersion?: string;
  @IsOptional() @IsString() @MaxLength(20) maxVersion?: string;
  @IsOptional() @IsInt() @Min(-100) @Max(100) priority?: number;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
interface AdminReq { user: { id: string } }

/** Panel side: launch gates (maintenance / update), service switches, announcements. Role access: ROUTE_POLICY['live-admin']. */
@ApiTags('live-admin')
@ApiBearerAuth()
@Controller('live-admin')
export class LiveAdminController {
  constructor(private readonly live: LiveService, private readonly prisma: PrismaService) {}

  @Get('settings') settings() { return this.live.getSettings(); }
  @Put('settings') @ApiOperation({ summary: 'Change maintenance mode, minimum/latest version per platform, service on/off switches' })
  save(@Request() req: AdminReq, @Body() dto: Partial<LiveSettings>) { return this.live.saveSettings(dto, req.user.id); }

  @Get('announcements') list() { return this.prisma.announcement.findMany({ orderBy: [{ isActive: 'desc' }, { startsAt: 'desc' }], take: 200 }); }
  @Post('announcements') async create(@Request() req: AdminReq, @Body() dto: AnnouncementDto) {
    const row = await this.prisma.announcement.create({ data: { kind: dto.kind ?? 'news', title: dto.title, body: dto.body, platforms: dto.platforms ?? [], minVersion: dto.minVersion, maxVersion: dto.maxVersion, priority: dto.priority ?? 0, startsAt: dto.startsAt ? new Date(dto.startsAt) : new Date(), endsAt: dto.endsAt ? new Date(dto.endsAt) : null, isActive: dto.isActive ?? true, createdBy: req.user.id } });
    this.live.invalidate(); return row;
  }
  @Patch('announcements/:id') async update(@Param('id') id: string, @Body() dto: Partial<AnnouncementDto>) {
    const row = await this.prisma.announcement.update({ where: { id }, data: { ...dto, startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined, endsAt: dto.endsAt === undefined ? undefined : dto.endsAt ? new Date(dto.endsAt) : null } as never });
    this.live.invalidate(); return row;
  }
  @Delete('announcements/:id') @HttpCode(200) async remove(@Param('id') id: string) { await this.prisma.announcement.delete({ where: { id } }); this.live.invalidate(); return { ok: true }; }
}

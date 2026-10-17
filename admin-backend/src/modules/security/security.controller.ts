import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsIP, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { SecurityService } from './security.service';
import { AdminSessionService } from '../admin-auth/admin-session.service';

class BlockDto { @IsIP() ip!: string; @IsString() @MaxLength(300) reason!: string; @IsOptional() @IsInt() @Min(1) @Max(24 * 365) hours?: number; @IsOptional() @IsBoolean() permanent?: boolean }
interface AdminReq { user: { id: string; sid: string } }

/** Security centre: event log, IP firewall, signed-in panel sessions. Role access: ROUTE_POLICY['security'] (developer / owner). */
@ApiTags('security')
@ApiBearerAuth()
@Controller('security')
export class SecurityController {
  constructor(private readonly security: SecurityService, private readonly sessions: AdminSessionService) {}

  @Get('events') @ApiOperation({ summary: 'Security event log (logins, lockouts, token theft, attack signatures, blocks)' })
  events(@Query('type') type?: string, @Query('severity') severity?: string, @Query('ip') ip?: string, @Query('take') take?: string, @Query('before') before?: string) {
    return this.security.events({ type, severity, ip, take: take ? Number(take) : undefined, before });
  }
  @Get('stats') stats() { return this.security.stats(); }

  @Get('blocks') blocks() { return this.security.blocks(); }
  @Post('blocks') @HttpCode(200) @ApiOperation({ summary: 'Block an IP address (temporarily or permanently)' })
  block(@Request() req: AdminReq, @Body() dto: BlockDto) { return this.security.block(dto.ip, dto.reason, dto.permanent ? null : dto.hours ?? 24, req.user.id); }
  @Delete('blocks/:id') @HttpCode(200) unblock(@Param('id') id: string) { return this.security.unblock(id); }

  @Get('sessions') @ApiOperation({ summary: 'Panel sessions currently signed in' })
  sessionsList() { return this.sessions.list(); }
  @Delete('sessions/:sid') @HttpCode(200) @ApiOperation({ summary: 'Force-sign-out one panel session' })
  async revoke(@Param('sid') sid: string) { await this.sessions.revoke(sid, 'revoked-by-admin'); return { ok: true }; }
}

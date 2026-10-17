import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PlayerApi } from '../../common/decorators/player-api.decorator';
import { SessionService } from './session.service';

class SyncDto {
  @IsOptional() @IsIn(['menu', 'match', 'loading']) state?: 'menu' | 'match' | 'loading';
  @IsOptional() @IsString() @MaxLength(32) appVersion?: string;
  @IsOptional() @IsString() @MaxLength(16) platform?: string;
  @IsOptional() @IsString() @MaxLength(80) deviceId?: string;
  @IsOptional() @IsString() @MaxLength(64) matchId?: string;
  @IsOptional() @IsInt() @Min(0) @Max(25) waitSeconds?: number;
}
interface PlayerReq { user: { id: string; username: string }; ip?: string }

/** What the running game client talks to: heartbeat + instant command channel. */
@ApiTags('session')
@ApiBearerAuth()
@PlayerApi()
@Controller('session')
export class SessionController {
  constructor(private readonly service: SessionService) {}

  @Post('sync') @HttpCode(200)
  @ApiOperation({ summary: 'Heartbeat + long-poll for commands (kick / ban / message). Pass waitSeconds (0-25) to hold the request until a command arrives.' })
  sync(@Req() req: PlayerReq, @Body() dto: SyncDto) { return this.service.sync(req.user.id, req.user.username, dto, req.ip); }

  @Post('leave') @HttpCode(200)
  leave(@Req() req: PlayerReq) { return this.service.leave(req.user.id); }
}

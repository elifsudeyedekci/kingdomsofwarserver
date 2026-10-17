import { Controller, Get, HttpCode, HttpStatus, Param, Post, Request } from '@nestjs/common';
import { PlayerApi } from '../../common/decorators/player-api.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RewardsService } from './rewards.service';

interface AuthRequest { user: { id: string } }

@ApiTags('rewards')
@ApiBearerAuth()
@PlayerApi()
@Controller('rewards')
export class RewardsController {
  constructor(private readonly service: RewardsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Season rewards of the active season with earned / claimed state' })
  async list(@Request() req: AuthRequest) { return { rewards: await this.service.list(req.user.id) }; }

  @Post('me/:rewardId/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Claim an earned reward (idempotent)' })
  claim(@Request() req: AuthRequest, @Param('rewardId') rewardId: string) { return this.service.claim(req.user.id, rewardId); }
}

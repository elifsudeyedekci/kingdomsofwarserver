import { BadRequestException, Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString } from 'class-validator';
import { PlayerApi } from '../../common/decorators/player-api.decorator';
import { PrivacyService } from './privacy.service';

class DeleteDto { @IsString() confirm!: string }
interface PlayerReq { user: { id: string } }

/** The player's own privacy rights, straight from the game: download everything stored about me, delete my account (App Store requires in-app account deletion). */
@ApiTags('me')
@ApiBearerAuth()
@PlayerApi()
@Controller('me/privacy')
export class PrivacyController {
  constructor(private readonly service: PrivacyService) {}

  @Get('export') @Throttle({ default: { limit: 3, ttl: 3_600_000 } }) @ApiOperation({ summary: 'All data stored about the signed-in player (JSON)' })
  export(@Req() req: PlayerReq) { return this.service.export(req.user.id); }

  @Post('delete') @HttpCode(200) @Throttle({ default: { limit: 3, ttl: 3_600_000 } }) @ApiOperation({ summary: 'Permanently delete the signed-in account (send { "confirm": "DELETE" })' })
  async delete(@Req() req: PlayerReq, @Body() dto: DeleteDto) {
    if (dto.confirm !== 'DELETE') throw new BadRequestException('Send { "confirm": "DELETE" } to confirm');
    return this.service.erase(req.user.id, 'player');
  }
}

import { Body, Controller, Get, HttpCode, Param, Post, Req, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { PlayerApi } from '../../common/decorators/player-api.decorator';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

class PlayerReplyDto { @IsString() @MinLength(1) @MaxLength(5000) body!: string }
interface PlayerReq { user: { id: string } }

/** The player's own support tickets (create, list, reply). Everything is scoped to the signed-in player. */
@ApiTags('me')
@ApiBearerAuth()
@PlayerApi()
@Controller('me/support')
export class PlayerSupportController {
  constructor(private readonly service: SupportService) {}

  @Post() @HttpCode(200) @Throttle({ default: { limit: 5, ttl: 3_600_000 } }) @ApiOperation({ summary: 'Open a support ticket (max 5 per hour)' })
  create(@Req() req: PlayerReq, @Body() dto: CreateTicketDto) { return this.service.createTicket(req.user.id, dto); }

  @Get() list(@Req() req: PlayerReq) { return this.service.getPlayerTickets(req.user.id); }

  @Post(':id/reply') @HttpCode(200) @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  async reply(@Req() req: PlayerReq, @Param('id') id: string, @Body() dto: PlayerReplyDto) {
    const t = await this.service.getTicketById(id);
    if (t.userId !== req.user.id) throw new ForbiddenException('Not your ticket');
    return this.service.replyToTicket(id, { body: dto.body, senderId: req.user.id, isAdminReply: false });
  }
}

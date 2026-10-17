/**
 * SupportController
 *
 * Exposes the Support & Moderation HTTP API consumed by the admin panel.
 * All endpoints require a valid Bearer token (JWT guard applied globally).
 *
 * Route summary:
 *   GET    /support                        — paginated ticket list (admin)
 *   GET    /support/stats                  — ticket aggregate stats
 *   GET    /support/player/:userId         — player's own tickets
 *   GET    /support/:id                    — single ticket with messages
 *   POST   /support                        — create ticket
 *   POST   /support/:id/reply              — add reply message
 *   PATCH  /support/:id/status             — transition ticket status
 *   PATCH  /support/:id/assign             — assign ticket to admin
 *   PATCH  /support/:id/resolve            — resolve ticket with note
 *   GET    /support/reports                — moderation reports list
 *   PATCH  /support/reports/:id/review     — review a moderation report
 *   POST   /support/bans                   — ban a player
 *   PATCH  /support/bans/:id/lift          — lift an active ban
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { ResolveTicketDto } from './dto/resolve-ticket.dto';
import { BanPlayerDto } from './dto/ban-player.dto';
import { LiftBanDto } from './dto/lift-ban.dto';
import { ReviewReportDto } from './dto/review-report.dto';
import { SupportTicketStatus, SupportTicketPriority } from '@prisma/client';

@ApiTags('support')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  constructor(private readonly service: SupportService) {}

  // -------------------------------------------------------------------------
  // Ticket routes — ordered from most-specific to least-specific so NestJS
  // does not accidentally match /support/stats as /support/:id.
  // -------------------------------------------------------------------------

  @Get('stats')
  @ApiOperation({ summary: 'Get support ticket aggregate stats' })
  getTicketStats() {
    return this.service.getTicketStats();
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get moderation reports (admin)' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getModerationReports(
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.service.getModerationReports({
      status,
      page,
      limit: Math.min(limit, 100),
    });
  }

  @Get('player/:userId')
  @ApiOperation({ summary: "Get a player's own support tickets" })
  @ApiParam({ name: 'userId', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getPlayerTickets(
    @Param('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.service.getPlayerTickets(userId, page, Math.min(limit, 100));
  }

  @Get()
  @ApiOperation({ summary: 'Get all support tickets (admin, filterable)' })
  @ApiQuery({ name: 'status', required: false, enum: SupportTicketStatus })
  @ApiQuery({ name: 'priority', required: false, enum: SupportTicketPriority })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getTickets(
    @Query('status') status?: SupportTicketStatus,
    @Query('priority') priority?: SupportTicketPriority,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.service.getTickets({
      status,
      priority,
      page,
      limit: Math.min(limit, 100),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single support ticket by id' })
  @ApiParam({ name: 'id', type: String })
  getTicketById(@Param('id') id: string) {
    return this.service.getTicketById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new support ticket' })
  @ApiQuery({ name: 'userId', required: true, type: String })
  createTicket(
    @Query('userId') userId: string,
    @Body() dto: CreateTicketDto,
  ) {
    return this.service.createTicket(userId, dto);
  }

  @Post(':id/reply')
  @ApiOperation({ summary: 'Add a reply message to a ticket' })
  @ApiParam({ name: 'id', type: String })
  replyToTicket(@Param('id') id: string, @Body() dto: ReplyTicketDto, @Req() req?: { user?: { id?: string; kind?: string } }) {
    // an admin reply is always attributed to the signed-in admin (the sender id in the body is not trusted)
    if (req?.user?.kind === 'admin') return this.service.replyToTicket(id, { ...dto, senderId: req.user.id as string, isAdminReply: true });
    return this.service.replyToTicket(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update the status of a support ticket' })
  @ApiParam({ name: 'id', type: String })
  updateTicketStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.service.updateTicketStatus(id, dto);
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign a ticket to an admin' })
  @ApiParam({ name: 'id', type: String })
  assignTicket(@Param('id') id: string, @Body() dto: AssignTicketDto) {
    return this.service.assignTicket(id, dto);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve a ticket with a resolution note' })
  @ApiParam({ name: 'id', type: String })
  resolveTicket(@Param('id') id: string, @Body() dto: ResolveTicketDto) {
    return this.service.resolveTicket(id, dto);
  }

  // -------------------------------------------------------------------------
  // Moderation report routes
  // -------------------------------------------------------------------------

  @Patch('reports/:id/review')
  @ApiOperation({ summary: 'Review a moderation report' })
  @ApiParam({ name: 'id', type: String })
  reviewModerationReport(
    @Param('id') id: string,
    @Body() dto: ReviewReportDto,
  ) {
    return this.service.reviewModerationReport(id, dto);
  }

  // -------------------------------------------------------------------------
  // Ban routes
  // -------------------------------------------------------------------------

  @Post('bans')
  @ApiOperation({ summary: 'Ban a player' })
  banPlayer(@Body() dto: BanPlayerDto) {
    return this.service.banPlayer(dto);
  }

  @Patch('bans/:id/lift')
  @ApiOperation({ summary: 'Lift an active ban' })
  @ApiParam({ name: 'id', type: String })
  liftBan(@Param('id') id: string, @Body() dto: LiftBanDto) {
    return this.service.liftBan(id, dto);
  }
}

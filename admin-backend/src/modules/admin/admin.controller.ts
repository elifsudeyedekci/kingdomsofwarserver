import {
  Controller, Get, Post, Delete, Patch,
  Param, Query, Body, Request, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { BanPlayerDto } from './dto/ban-player.dto';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { ReviewFlagDto } from './dto/review-flag.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // ─── PLAYERS ──────────────────────────────────────────────────────────────

  @Get('players')
  @ApiOperation({ summary: 'Paginated player list' })
  getPlayers(
    @Query('search') search?: string,
    @Query('page',   new DefaultValuePipe(1),  ParseIntPipe) page  = 1,
    @Query('limit',  new DefaultValuePipe(10), ParseIntPipe) limit = 10,
    @Query('isActive') isActive?: string,
  ) {
    const active = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.admin.getPlayers(search, page, limit, active);
  }

  @Get('players/:id')
  @ApiOperation({ summary: 'Player detail with recent matches' })
  getPlayerById(@Param('id') id: string) { return this.admin.getPlayerById(id); }

  @Post('players/:id/ban')
  @ApiOperation({ summary: 'Ban a player' })
  banPlayer(@Param('id') id: string, @Body() dto: BanPlayerDto, @Request() req: { user: { sub: string } }) {
    return this.admin.banPlayer(id, dto.reason, dto.type, dto.durationDays, req.user.sub);
  }

  @Delete('players/:id/ban')
  @ApiOperation({ summary: 'Unban a player' })
  unbanPlayer(@Param('id') id: string) { return this.admin.unbanPlayer(id); }

  @Get('players/:id/bans')
  @ApiOperation({ summary: 'Full ban history for a player' })
  getBanHistory(@Param('id') id: string) { return this.admin.getBanHistory(id); }

  // ─── MATCHES ──────────────────────────────────────────────────────────────

  @Get('matches')
  @ApiOperation({ summary: 'Paginated match list' })
  getMatches(
    @Query('status') status?: string,
    @Query('mode')   mode?:   string,
    @Query('page',   new DefaultValuePipe(1),  ParseIntPipe) page  = 1,
    @Query('limit',  new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) { return this.admin.getMatches(status, mode, page, limit); }

  @Get('matches/:id')
  @ApiOperation({ summary: 'Match detail with players and result' })
  getMatchById(@Param('id') id: string) { return this.admin.getMatchById(id); }

  @Post('matches/:id/abandon')
  @ApiOperation({ summary: 'Force-abandon an active match' })
  abandonMatch(@Param('id') id: string) { return this.admin.abandonMatch(id); }

  // ─── DASHBOARD ────────────────────────────────────────────────────────────

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Real-time KPI stats' })
  getDashboardStats() { return this.admin.getDashboardStats(); }

  @Get('dashboard/activity')
  @ApiOperation({ summary: 'Hourly player activity for today' })
  getDashboardActivity() { return this.admin.getDashboardActivity(); }

  @Get('dashboard/top-players')
  @ApiOperation({ summary: 'Top players by MMR' })
  getTopPlayers(@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10) { return this.admin.getTopPlayers(limit); }

  // ─── FEATURE FLAGS ────────────────────────────────────────────────────────

  @Get('config/feature-flags')
  @ApiOperation({ summary: 'List all feature flags' })
  getFeatureFlags() { return this.admin.getFeatureFlags(); }

  @Patch('config/feature-flags/:key')
  @ApiOperation({ summary: 'Update a feature flag value' })
  updateFeatureFlag(@Param('key') key: string, @Body('value') value: string) { return this.admin.updateFeatureFlag(key, value); }

  // ─── LEADERBOARD ──────────────────────────────────────────────────────────

  @Get('leaderboard')
  @ApiOperation({ summary: 'Paginated leaderboard entries' })
  getLeaderboard(
    @Query('mode')   mode   = 'ranked_1v1',
    @Query('season', new DefaultValuePipe(0),  ParseIntPipe) season = 0,
    @Query('page',   new DefaultValuePipe(1),  ParseIntPipe) page   = 1,
    @Query('limit',  new DefaultValuePipe(50), ParseIntPipe) limit  = 50,
  ) { return this.admin.getLeaderboard(mode, season, page, limit); }

  @Get('leaderboard/search')
  @ApiOperation({ summary: 'Search leaderboard by username' })
  searchLeaderboard(@Query('username') username: string) { return this.admin.searchLeaderboard(username); }

  @Post('leaderboard/recalculate')
  @ApiOperation({ summary: 'Recalculate all rankings from current MMR' })
  recalculateRankings() { return this.admin.recalculateRankings(); }

  @Post('leaderboard/reset-season')
  @ApiOperation({ summary: 'Reset leaderboard entries for a season' })
  resetSeason(@Body('mode') mode: string, @Body('season') season: number, @Body('reason') reason: string) {
    return this.admin.resetSeason(mode, season, reason);
  }

  // ─── CLANS ────────────────────────────────────────────────────────────────

  @Get('clans')
  @ApiOperation({ summary: 'Paginated clan list' })
  getClans(
    @Query('search') search = '',
    @Query('page',   new DefaultValuePipe(1),  ParseIntPipe) page  = 1,
    @Query('limit',  new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) { return this.admin.getClans(search, page, limit); }

  @Get('clans/:id')
  @ApiOperation({ summary: 'Clan detail with members' })
  getClanById(@Param('id') id: string) { return this.admin.getClanById(id); }

  @Patch('clans/:id/leader')
  @ApiOperation({ summary: 'Change clan leader' })
  changeClanLeader(@Param('id') id: string, @Body('newLeaderProfileId') newLeaderProfileId: string) {
    return this.admin.changeClanLeader(id, newLeaderProfileId);
  }

  @Get('clans/:id/members')
  @ApiOperation({ summary: 'List members of a clan' })
  getClanMembers(@Param('id') id: string) { return this.admin.getClanMembers(id); }

  @Delete('clans/:id')
  @ApiOperation({ summary: 'Disband a clan' })
  disbandClan(@Param('id') id: string) { return this.admin.disbandClan(id); }

  // ─── TOURNAMENTS ──────────────────────────────────────────────────────────

  @Get('tournaments')
  @ApiOperation({ summary: 'Paginated tournament list' })
  getTournaments(
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page  = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) { return this.admin.getTournaments(page, limit); }

  @Post('tournaments')
  @ApiOperation({ summary: 'Create a new tournament' })
  createTournament(@Body() dto: CreateTournamentDto) { return this.admin.createTournament(dto); }

  @Get('tournaments/:id')
  @ApiOperation({ summary: 'Tournament detail' })
  getTournamentById(@Param('id') id: string) { return this.admin.getTournamentById(id); }

  @Post('tournaments/:id/start')
  @ApiOperation({ summary: 'Start a tournament' })
  startTournament(@Param('id') id: string) { return this.admin.startTournament(id); }

  @Post('tournaments/:id/cancel')
  @ApiOperation({ summary: 'Cancel a tournament' })
  cancelTournament(@Param('id') id: string) { return this.admin.cancelTournament(id); }

  @Post('tournaments/:id/complete')
  @ApiOperation({ summary: 'Mark a tournament as completed' })
  completeTournament(@Param('id') id: string) { return this.admin.completeTournament(id); }

  @Post('tournaments/:id/participants')
  @ApiOperation({ summary: 'Register a participant by username' })
  registerParticipant(@Param('id') id: string, @Body('username') username: string) {
    return this.admin.registerParticipant(id, username);
  }

  // ─── SUPPORT TICKETS ──────────────────────────────────────────────────────

  @Get('support')
  @ApiOperation({ summary: 'Paginated support ticket list' })
  getSupportTickets(
    @Query('status')   status?:   string,
    @Query('priority') priority?: string,
    @Query('page',   new DefaultValuePipe(1),  ParseIntPipe) page  = 1,
    @Query('limit',  new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) { return this.admin.getSupportTickets({ status, priority }, page, limit); }

  @Get('support/:id')
  @ApiOperation({ summary: 'Support ticket detail' })
  getSupportTicketById(@Param('id') id: string) { return this.admin.getSupportTicketById(id); }

  @Post('support/:id/reply')
  @ApiOperation({ summary: 'Reply to a support ticket' })
  replyToTicket(@Param('id') id: string, @Body() dto: ReplyTicketDto) { return this.admin.replyToTicket(id, dto); }

  @Patch('support/:id')
  @ApiOperation({ summary: 'Update support ticket status, priority, or assignee' })
  updateTicketStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('priority') priority?: string,
    @Body('assignedTo') assignedTo?: string,
  ) { return this.admin.updateTicketStatus(id, status, priority, assignedTo); }

  // ─── ANTI-CHEAT ───────────────────────────────────────────────────────────

  @Get('anticheat/flags')
  @ApiOperation({ summary: 'Paginated anti-cheat flags' })
  getAntiCheatFlags(
    @Query('severity') severity?: string,
    @Query('status')   status?:   string,
    @Query('page',   new DefaultValuePipe(1),  ParseIntPipe) page  = 1,
    @Query('limit',  new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) { return this.admin.getAntiCheatFlags({ severity, status }, page, limit); }

  @Patch('anticheat/flags/:id/review')
  @ApiOperation({ summary: 'Review a single anti-cheat flag' })
  reviewFlag(@Param('id') id: string, @Body() dto: ReviewFlagDto) { return this.admin.reviewFlag(id, dto); }

  @Post('anticheat/flags/bulk-review')
  @ApiOperation({ summary: 'Bulk-review multiple anti-cheat flags' })
  bulkReviewFlags(@Body('flagIds') flagIds: string[], @Body('action') action: string) {
    return this.admin.bulkReviewFlags(flagIds, action);
  }

  // ─── AUDIT LOGS ───────────────────────────────────────────────────────────

  @Get('audit')
  @ApiOperation({ summary: 'Paginated audit log' })
  getAuditLogs(
    @Query('admin')    admin?:    string,
    @Query('action')   action?:   string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo')   dateTo?:   string,
    @Query('page',   new DefaultValuePipe(1),  ParseIntPipe) page  = 1,
    @Query('limit',  new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) { return this.admin.getAuditLogs({ admin, action, dateFrom, dateTo }, page, limit); }

  // ─── BANS (extended) ──────────────────────────────────────────────────────

  @Get('bans')
  @ApiOperation({ summary: 'Paginated ban list' })
  getBans(
    @Query('type')   type?:   string,
    @Query('status') status?: string,
    @Query('page',   new DefaultValuePipe(1),  ParseIntPipe) page  = 1,
    @Query('limit',  new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) { return this.admin.getBans({ type, status }, page, limit); }

  @Delete('bans/:id')
  @ApiOperation({ summary: 'Revoke a ban by ban ID' })
  revokeBan(@Param('id') id: string, @Body('reason') reason: string) { return this.admin.revokeBan(id, reason); }

  // ─── DASHBOARD (ek) ───────────────────────────────────────────────────────

  @Get('dashboard/revenue')
  @ApiOperation({ summary: 'Daily revenue for the last 30 days' })
  getDashboardRevenue() { return this.admin.getDashboardRevenue(); }

  @Get('dashboard/recent-matches')
  @ApiOperation({ summary: 'Most recent matches' })
  getRecentMatches(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) { return this.admin.getRecentMatches(limit); }

  // ─── OPS ──────────────────────────────────────────────────────────────────

  @Get('ops/servers')
  @ApiOperation({ summary: 'Server list with active match load' })
  getServers() { return this.admin.getServers(); }

  @Get('ops/live-events')
  @ApiOperation({ summary: 'Currently active live events' })
  getLiveEvents() { return this.admin.getLiveEvents(); }

  @Post('ops/flush-cache')
  @ApiOperation({ summary: 'Queue a cache flush' })
  flushCache() { return this.admin.flushCache(); }

  @Post('ops/kick-afk')
  @ApiOperation({ summary: 'Kick AFK players from active matches' })
  kickAfkPlayers() { return this.admin.kickAfkPlayers(); }

  @Post('ops/pause-matchmaking')
  @ApiOperation({ summary: 'Pause the matchmaking queue' })
  pauseMatchmaking() { return this.admin.pauseMatchmaking(); }

  @Post('ops/emergency-shutdown')
  @ApiOperation({ summary: 'Initiate an emergency shutdown sequence' })
  emergencyShutdown() { return this.admin.emergencyShutdown(); }

  // ─── SYSTEM ───────────────────────────────────────────────────────────────

  @Post('broadcast')
  @ApiOperation({ summary: 'Broadcast a message to all online players' })
  broadcastMessage(@Body('message') message: string) {
    return this.admin.broadcastMessage(message);
  }

  @Post('system-message')
  @ApiOperation({ summary: 'Send a system message with severity level' })
  sendSystemMessage(@Body() body: { message: string; severity: string }) {
    return this.admin.sendSystemMessage(body.message, body.severity);
  }

  @Get('system-status')
  @ApiOperation({ summary: 'Current system operational status' })
  getSystemStatus() { return this.admin.getSystemStatus(); }

  @Get('alerts')
  @ApiOperation({ summary: 'Unreviewed anti-cheat alerts' })
  getAlerts(@Query() filter: Record<string, string>) {
    return this.admin.getAlerts(filter);
  }

  @Get('incidents')
  @ApiOperation({ summary: 'Incident list (placeholder for future incident tracking)' })
  getIncidents() { return this.admin.getIncidents(); }

  @Patch('alerts/:id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge (mark reviewed) an alert by ID' })
  acknowledgeAlert(@Param('id') id: string) {
    return this.admin.acknowledgeAlert(id);
  }

  // ─── PLAYERS (ek) ─────────────────────────────────────────────────────────

  @Post('players')
  @ApiOperation({ summary: 'Create a new player account' })
  createPlayer(@Body() dto: Record<string, unknown>) {
    return this.admin.createPlayer(dto);
  }

  @Patch('players/:id/role')
  @ApiOperation({ summary: 'Update the admin role for a player (AdminUser only)' })
  updatePlayerRole(@Param('id') id: string, @Body('role') role: string) {
    return this.admin.updatePlayerRole(id, role);
  }

  // ─── SUPPORT (alias) ──────────────────────────────────────────────────────

  @Get('support/tickets')
  @ApiOperation({ summary: 'Support ticket list (alias for GET /admin/support)' })
  getSupportTicketsAlias(
    @Query('status')   status?:   string,
    @Query('priority') priority?: string,
    @Query('page',   new DefaultValuePipe(1),  ParseIntPipe) page  = 1,
    @Query('limit',  new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) { return this.admin.getSupportTickets({ status, priority }, page, limit); }

  // ─── INVENTORY ────────────────────────────────────────────────────────────

  @Post('inventory/grant')
  @ApiOperation({ summary: 'Grant an item to a player' })
  grantInventoryItem(@Body() body: { userId: string; itemId: string; quantity?: number }) {
    return this.admin.grantInventoryItem(body.userId, body.itemId, body.quantity ?? 1);
  }

  // ─── ECONOMY ──────────────────────────────────────────────────────────────

  @Get('economy/wallet/:userId')
  @ApiOperation({ summary: 'Player in-game wallet (coins, gems, etc.)' })
  getPlayerWallet(@Param('userId') userId: string) {
    return this.admin.getPlayerWallet(userId);
  }

  @Get('economy/stats')
  @ApiOperation({ summary: 'Aggregate economy statistics' })
  getEconomyStats() { return this.admin.getEconomyStats(); }

  @Get('economy/top-products')
  @ApiOperation({ summary: 'Top products by purchase count' })
  getTopProducts(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) { return this.admin.getTopProducts(limit); }

  @Get('economy/platform-revenue')
  @ApiOperation({ summary: 'Revenue broken down by platform' })
  getPlatformRevenue() { return this.admin.getPlatformRevenue(); }

  @Post('economy/credit')
  @ApiOperation({ summary: 'Credit in-game currency to a player wallet' })
  creditPlayer(
    @Body() body: { userId: string; currency: string; amount: number; reason: string },
  ) {
    return this.admin.creditPlayer(body.userId, body.currency, body.amount, body.reason);
  }

  // ─── STORE ────────────────────────────────────────────────────────────────

  @Get('store')
  @ApiOperation({ summary: 'List active store products' })
  getStoreProducts() { return this.admin.getStoreProducts(); }

  @Post('store')
  @ApiOperation({ summary: 'Create a new store product' })
  createStoreProduct(@Body() dto: Record<string, unknown>) {
    return this.admin.createStoreProduct(dto);
  }

  @Patch('store/:id')
  @ApiOperation({ summary: 'Update a store product' })
  updateStoreProduct(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.admin.updateStoreProduct(id, dto);
  }
}

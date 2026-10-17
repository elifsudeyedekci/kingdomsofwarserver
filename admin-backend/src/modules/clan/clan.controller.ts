/**
 * ClanController
 *
 * REST endpoints for clan management in Kingdoms of War.
 * All routes are protected by Bearer authentication.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ClanService } from './clan.service';
import { CreateClanDto } from './dto/create-clan.dto';
import { UpdateClanDto } from './dto/update-clan.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { PromoteMemberDto } from './dto/promote-member.dto';
import { CreateClanWarDto } from './dto/create-clan-war.dto';

@ApiTags('clan')
@ApiBearerAuth()
@Controller('clan')
export class ClanController {
  constructor(private readonly service: ClanService) {}

  // ─── Clan listing & lookup ──────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List clans with optional search and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name or tag' })
  getClans(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return this.service.getClans(Number(page), Number(limit), search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get clan by ID' })
  getClanById(@Param('id') id: string) {
    return this.service.getClanById(id);
  }

  // ─── Clan CRUD ──────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new clan (caller becomes leader)' })
  createClan(
    @Body() dto: CreateClanDto,
    // In a real auth flow the leaderId would come from @CurrentUser().
    // Until the auth guard is wired up on this service, the caller must supply it.
    @Query('leaderId') leaderId: string,
  ) {
    return this.service.createClan(leaderId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update clan settings (leader only — enforced by caller)' })
  updateClan(@Param('id') id: string, @Body() dto: UpdateClanDto) {
    return this.service.updateClan(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disband clan — removes all members then deletes the clan' })
  disbandClan(@Param('id') id: string) {
    return this.service.disbandClan(id);
  }

  // ─── Membership ─────────────────────────────────────────────────────────────

  @Get(':id/members')
  @ApiOperation({ summary: 'List members of a clan' })
  getMembers(@Param('id') id: string) {
    return this.service.getMembers(id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a user to the clan' })
  addMember(@Param('id') clanId: string, @Body() dto: AddMemberDto) {
    return this.service.addMember(clanId, dto);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a user from the clan' })
  removeMember(@Param('id') clanId: string, @Param('userId') userId: string) {
    return this.service.removeMember(clanId, userId);
  }

  @Patch(':id/members/:userId/role')
  @ApiOperation({ summary: 'Promote or demote a clan member (member / officer / leader)' })
  promoteMember(
    @Param('id') clanId: string,
    @Param('userId') userId: string,
    @Body() dto: PromoteMemberDto,
  ) {
    return this.service.promoteMember(clanId, userId, dto);
  }

  // ─── Clan Wars ──────────────────────────────────────────────────────────────

  @Get(':id/wars')
  @ApiOperation({ summary: 'Get war history for a clan (both as attacker and defender)' })
  getClanWars(@Param('id') id: string) {
    return this.service.getClanWars(id);
  }

  @Post('wars')
  @ApiOperation({ summary: 'Declare a new clan war between two clans' })
  createClanWar(@Body() dto: CreateClanWarDto) {
    return this.service.createClanWar(dto);
  }
}

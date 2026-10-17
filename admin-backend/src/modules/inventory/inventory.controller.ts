import { PlayerApi } from '../../common/decorators/player-api.decorator';
import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { AddItemDto } from './dto/add-item.dto';
import { GrantItemDto } from './dto/grant-item.dto';

interface AuthRequest {
  user: { id: string };
}

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  // ---------------------------------------------------------------------------
  // GET /inventory  — paginated inventory for the authenticated player
  // ---------------------------------------------------------------------------
  @PlayerApi()
  @Get()
  @ApiOperation({ summary: 'Get own inventory (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  getInventory(
    @Request() req: AuthRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.service.getInventory(req.user.id, page, Math.min(limit, 100));
  }

  // ---------------------------------------------------------------------------
  // GET /inventory/equipped  — only currently equipped items
  // ---------------------------------------------------------------------------
  @PlayerApi()
  @Get('equipped')
  @ApiOperation({ summary: 'Get all equipped items for the authenticated player' })
  getEquipped(@Request() req: AuthRequest) {
    return this.service.getEquipped(req.user.id);
  }

  // ---------------------------------------------------------------------------
  // GET /inventory/stats  — aggregate statistics
  // ---------------------------------------------------------------------------
  @PlayerApi()
  @Get('stats')
  @ApiOperation({ summary: 'Get inventory statistics for the authenticated player' })
  getInventoryStats(@Request() req: AuthRequest) {
    return this.service.getInventoryStats(req.user.id);
  }

  // ---------------------------------------------------------------------------
  // POST /inventory  — add a new item to own inventory (post-purchase hook)
  // ---------------------------------------------------------------------------
  @Post()
  @ApiOperation({ summary: 'Add an item to own inventory (called after successful purchase)' })
  addItem(@Request() req: AuthRequest, @Body() dto: AddItemDto) {
    return this.service.addItem(req.user.id, dto);
  }

  // ---------------------------------------------------------------------------
  // POST /inventory/grant  — admin: grant an item to any player
  // ---------------------------------------------------------------------------
  @Post('grant')
  @ApiOperation({ summary: '[Admin] Grant an item directly to any player (event reward, admin action)' })
  grantItem(@Body() dto: GrantItemDto) {
    return this.service.grantItem(dto);
  }

  // ---------------------------------------------------------------------------
  // GET /inventory/:id  — single item detail
  // ---------------------------------------------------------------------------
  @Get(':id')
  @ApiOperation({ summary: 'Get a single inventory item by id' })
  @ApiParam({ name: 'id', description: 'PlayerInventory record UUID' })
  getInventoryItem(@Param('id') id: string) {
    return this.service.getInventoryItem(id);
  }

  // ---------------------------------------------------------------------------
  // DELETE /inventory/:id  — remove an item
  // ---------------------------------------------------------------------------
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an item from inventory by id' })
  @ApiParam({ name: 'id', description: 'PlayerInventory record UUID' })
  async removeItem(@Param('id') id: string) {
    await this.service.removeItem(id);
  }

  // ---------------------------------------------------------------------------
  // PATCH /inventory/:id/equip  — equip an item
  // ---------------------------------------------------------------------------
  @PlayerApi()
  @Patch(':id/equip')
  @ApiOperation({ summary: 'Equip an item; automatically unequips other items of the same type' })
  @ApiParam({ name: 'id', description: 'PlayerInventory record UUID' })
  equipItem(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.service.equipItem(req.user.id, id);
  }

  // ---------------------------------------------------------------------------
  // PATCH /inventory/:id/unequip  — unequip an item
  // ---------------------------------------------------------------------------
  @PlayerApi()
  @Patch(':id/unequip')
  @ApiOperation({ summary: 'Unequip an item' })
  @ApiParam({ name: 'id', description: 'PlayerInventory record UUID' })
  unequipItem(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.service.unequipItem(req.user.id, id);
  }
}

import { PlayerApi } from '../../common/decorators/player-api.decorator';
import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Optional,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { StoreService } from './store.service';
import { GrantService } from '../grants/grant.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustWalletDto } from './dto/adjust-wallet.dto';

@ApiTags('store')
@ApiBearerAuth()
@Controller('store')
export class StoreController {
  constructor(private readonly service: StoreService, @Optional() private readonly grants?: GrantService) {}

  // ---------------------------------------------------------------------------
  // Products
  // ---------------------------------------------------------------------------

  @PlayerApi()
  @Get('products')
  @ApiOperation({ summary: 'List store products with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  getProducts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe)
    includeInactive: boolean,
    @Req() req?: { user?: unknown },
  ) {
    return this.service.getProducts({ page, limit: Math.min(limit, 100), includeInactive: includeInactive && (req?.user as { kind?: string } | undefined)?.kind === 'admin' });      // players only ever see active products
  }

  @PlayerApi()
  @Get('products/:id')
  @ApiOperation({ summary: 'Get a single store product by ID' })
  getProductById(@Param('id') id: string) {
    return this.service.getProductById(id);
  }

  @Post('products')
  @ApiOperation({ summary: 'Create a new store product (admin only)' })
  createProduct(@Body() dto: CreateProductDto) {
    return this.service.createProduct(dto);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Partially update a store product' })
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.service.updateProduct(id, dto);
  }

  @Post('products/:id/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle isActive flag of a store product' })
  toggleProduct(@Param('id') id: string) {
    return this.service.toggleProduct(id);
  }

  // ---------------------------------------------------------------------------
  // Wallet
  // ---------------------------------------------------------------------------

  @Get('wallet/:userId')
  @ApiOperation({ summary: 'Get the currency wallet for a player' })
  getWallet(@Param('userId') userId: string) {
    return this.service.getWallet(userId);
  }

  @Post('wallet/:userId/adjust')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Credit or deduct currency from a player wallet (admin only)' })
  async adjustWallet(@Param('userId') userId: string, @Body() dto: AdjustWalletDto, @Req() req?: { user?: { id?: string } }) {
    // goes through the grant system so every change is in the economy ledger with who did it
    if (this.grants) { const wallet: Record<string, number> = {}; for (const k of ['gems', 'coins', 'chestKeys', 'eventTokens', 'bpXp'] as const) if (dto[k]) wallet[k] = dto[k] as number; await this.grants.apply(userId, { wallet }, { source: 'admin_grant', reason: 'wallet adjust', adminId: req?.user?.id }); return this.service.getWallet(userId); }
    return this.service.adjustWallet(userId, dto);
  }
}

import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { PlayerApi } from '../../common/decorators/player-api.decorator';
import { PurchaseService } from './purchase.service';

class PurchaseDto {
  @IsIn(['android', 'ios', 'editor']) platform!: 'android' | 'ios' | 'editor';
  @IsString() @MaxLength(120) sku!: string;
  @IsString() @MaxLength(160) transactionId!: string;
  @IsString() @MaxLength(8000) receipt!: string;
}

/** What the game calls after a store purchase: receipt in, contents out - only when the store itself confirms it. */
@ApiTags('store')
@ApiBearerAuth()
@Controller('store')
export class PurchaseController {
  constructor(private readonly service: PurchaseService) {}

  @PlayerApi() @Throttle({ default: { limit: 20, ttl: 60000 } }) @HttpCode(200) @Post('purchase')
  @ApiOperation({ summary: 'Verify a store purchase server-side and deliver the product (idempotent per transaction id)' })
  purchase(@Req() req: { user: { id: string } }, @Body() dto: PurchaseDto) { return this.service.purchase(req.user.id, dto); }
}

/**
 * FraudController
 * Implements: fraud detection design spec — HTTP endpoints.
 *
 * All routes require a valid JWT (enforced by the global JwtAuthGuard).
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  ParseFloatPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { FraudDetectionService } from './fraud.service';
import { AnalyzeTransactionDto, ReviewTransactionDto } from './dto/fraud.dto';

@ApiTags('fraud')
@ApiBearerAuth()
@Controller('fraud')
export class FraudController {
  constructor(private readonly service: FraudDetectionService) {}

  // POST /fraud/analyze
  @Post('analyze')
  @ApiOperation({ summary: 'Analyze a transaction for fraud risk' })
  analyzeTransaction(@Body() dto: AnalyzeTransactionDto) {
    return this.service.analyzeTransaction(
      dto.playerId,
      dto.amount,
      dto.currency,
      dto.paymentMethod,
    );
  }

  // GET /fraud/flagged
  @Get('flagged')
  @ApiOperation({ summary: 'Paginated list of flagged transactions' })
  @ApiQuery({ name: 'page',    required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit',   required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'minRisk', required: false, type: Number, example: 40,
    description: 'Minimum risk score (0–100) to include in results' })
  getFlaggedTransactions(
    @Query('page',    new DefaultValuePipe(1),  ParseIntPipe)   page: number,
    @Query('limit',   new DefaultValuePipe(20), ParseIntPipe)   limit: number,
    @Query('minRisk', new DefaultValuePipe(0),  ParseFloatPipe) minRisk: number,
  ) {
    return this.service.getFlaggedTransactions(page, Math.min(limit, 100), minRisk);
  }

  // POST /fraud/review/:transactionId
  @Post('review/:transactionId')
  @ApiOperation({ summary: 'Review a flagged transaction (approve or reject)' })
  @ApiParam({ name: 'transactionId', description: 'Transaction ID returned from /analyze' })
  reviewTransaction(
    @Param('transactionId') transactionId: string,
    @Body() dto: ReviewTransactionDto,
  ) {
    return this.service.reviewTransaction(
      transactionId,
      dto.decision,
      dto.reviewerId,
      dto.notes,
    );
  }

  // GET /fraud/player/:playerId/profile
  @Get('player/:playerId/profile')
  @ApiOperation({ summary: 'Get fraud risk profile for a specific player' })
  @ApiParam({ name: 'playerId', description: 'User UUID' })
  getPlayerFraudProfile(@Param('playerId') playerId: string) {
    return this.service.getPlayerFraudProfile(playerId);
  }

  // GET /fraud/stats
  @Get('stats')
  @ApiOperation({ summary: 'Aggregate fraud detection statistics' })
  getFraudStats() {
    return this.service.getFraudStats();
  }
}

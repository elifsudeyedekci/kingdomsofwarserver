/**
 * DTOs for the Fraud Detection module.
 * Implements: fraud detection design spec.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  Min,
  Max,
} from 'class-validator';

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum FraudDecision {
  APPROVED = 'APPROVED',
  REVIEW = 'REVIEW',
  BLOCKED = 'BLOCKED',
}

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export class AnalyzeTransactionDto {
  @ApiProperty({ example: 'player-uuid-1' })
  @IsString()
  playerId: string;

  @ApiProperty({ example: 9.99, description: 'Transaction amount in the given currency' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ example: 'USD' })
  @IsString()
  currency: string;

  @ApiProperty({ example: 'credit_card', description: 'Payment method identifier' })
  @IsString()
  paymentMethod: string;
}

export class ReviewTransactionDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsEnum(['approve', 'reject'])
  decision: 'approve' | 'reject';

  @ApiProperty({ example: 'admin-uuid-1', description: 'Admin performing the review' })
  @IsString()
  reviewerId: string;

  @ApiPropertyOptional({ example: 'Verified via secondary check — legitimate purchase' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdjustBotDifficultyDto {
  @ApiProperty({ example: 'EU-West', description: 'Game server region' })
  @IsString()
  region: string;

  @ApiProperty({ example: 0.5, description: 'Target win rate for bots (0–1)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  targetWinRate: number;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export class FraudAnalysisDTO {
  @ApiProperty({ example: 'txn-uuid-1' })
  transactionId: string;

  @ApiProperty({ example: 'player-uuid-1' })
  playerId: string;

  @ApiProperty({ example: 72, description: 'Risk score from 0 to 100' })
  riskScore: number;

  @ApiProperty({ enum: RiskLevel })
  riskLevel: RiskLevel;

  @ApiProperty({ enum: FraudDecision })
  decision: FraudDecision;

  @ApiProperty({
    type: [String],
    example: ['high_amount', 'velocity_exceeded'],
    description: 'Human-readable factors that contributed to the score',
  })
  factors: string[];

  @ApiProperty()
  createdAt: Date;
}

export class FraudFlagDTO {
  @ApiProperty()
  id: string;

  @ApiProperty()
  playerId: string;

  @ApiProperty()
  transactionId: string;

  @ApiProperty()
  riskScore: number;

  @ApiProperty({ enum: RiskLevel })
  riskLevel: RiskLevel;

  @ApiProperty({ enum: FraudDecision })
  decision: FraudDecision;

  @ApiPropertyOptional()
  reviewedBy?: string;

  @ApiPropertyOptional()
  reviewedAt?: Date;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  createdAt: Date;
}

export class PlayerFraudProfileDTO {
  @ApiProperty()
  playerId: string;

  @ApiProperty()
  totalTransactions: number;

  @ApiProperty()
  flaggedCount: number;

  @ApiProperty()
  blockedCount: number;

  @ApiProperty()
  averageRiskScore: number;

  @ApiPropertyOptional()
  lastTransactionAt?: Date;
}

export class FraudStatsDTO {
  @ApiProperty()
  totalAnalyzed: number;

  @ApiProperty()
  totalFlagged: number;

  @ApiProperty()
  totalBlocked: number;

  @ApiProperty()
  averageRiskScore: number;

  @ApiProperty({ description: 'Ratio of flagged transactions to total (0–1)' })
  flagRate: number;
}

export class PaginatedFraudFlagResponse {
  @ApiProperty({ type: [FraudFlagDTO] })
  @IsArray()
  data: FraudFlagDTO[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

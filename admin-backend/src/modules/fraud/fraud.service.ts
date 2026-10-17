/**
 * FraudDetectionService
 * Implements: fraud detection design spec.
 *
 * Risk scoring algorithm (0–100):
 *   - Velocity check  : +40 if player made >= 3 purchases in the last hour
 *   - Amount threshold: +35 if USD-equivalent amount > $100
 *   - Country mismatch: +25 (mock: simulated for ~30% of transactions via hash)
 *
 * Decision thresholds:
 *   score > 70  → HIGH_RISK  → BLOCKED
 *   score 40-70 → MEDIUM     → REVIEW
 *   score < 40  → LOW        → APPROVED
 *
 * Storage strategy: FraudFlag (@@map "fraud_flags") for flagged/blocked records.
 * Approved-only transactions are not persisted to keep the table focused on
 * actionable entries; analytics can derive totals from purchase records.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdminGateway } from '../../gateway/admin.gateway';
import {
  FraudAnalysisDTO,
  FraudFlagDTO,
  FraudStatsDTO,
  PlayerFraudProfileDTO,
  PaginatedFraudFlagResponse,
  RiskLevel,
  FraudDecision,
} from './dto/fraud.dto';

// ─── Scoring thresholds ───────────────────────────────────────────────────────
// Extracted as constants so a designer can tune without touching logic.
const VELOCITY_WINDOW_MS         = 60 * 60 * 1000; // 1 hour
const VELOCITY_PURCHASE_THRESHOLD = 3;              // purchases within window
const VELOCITY_RISK_POINTS        = 40;
const HIGH_AMOUNT_USD_THRESHOLD   = 100;
const HIGH_AMOUNT_RISK_POINTS     = 35;
const COUNTRY_MISMATCH_RISK_POINTS = 25;
const HIGH_RISK_SCORE_THRESHOLD   = 70;
const REVIEW_SCORE_THRESHOLD      = 40;

// Simple USD conversion approximations for common currencies.
// In production this would be backed by a live FX service.
const CURRENCY_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.09,
  GBP: 1.27,
  TRY: 0.031,
  JPY: 0.0067,
};

@Injectable()
export class FraudDetectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AdminGateway,
  ) {}

  // ─── analyzeTransaction ───────────────────────────────────────────────────

  /**
   * Scores a transaction for fraud risk and stores a FraudFlag when the
   * decision is REVIEW or BLOCKED.  Returns a FraudAnalysisDTO regardless.
   */
  async analyzeTransaction(
    playerId: string,
    amount: number,
    currency: string,
    paymentMethod: string,
    billingCountry?: string,
  ): Promise<FraudAnalysisDTO> {
    // Verify player exists
    const user = await this.prisma.user.findUnique({ where: { id: playerId } });
    if (!user) throw new NotFoundException(`Player with id "${playerId}" not found`);

    let riskScore = 0;
    const factors: string[] = [];

    // ── 1. Velocity check ──────────────────────────────────────────────────
    const windowStart = new Date(Date.now() - VELOCITY_WINDOW_MS);
    const recentCount = await this.prisma.playerPurchase.count({
      where: {
        userId: playerId,
        createdAt: { gte: windowStart },
      },
    });
    if (recentCount >= VELOCITY_PURCHASE_THRESHOLD) {
      riskScore += VELOCITY_RISK_POINTS;
      factors.push(
        `velocity_exceeded: ${recentCount} purchases in last hour (threshold: ${VELOCITY_PURCHASE_THRESHOLD})`,
      );
    }

    // ── 2. Amount threshold ────────────────────────────────────────────────
    const fxRate = CURRENCY_TO_USD[currency.toUpperCase()] ?? 1;
    const amountUsd = amount * fxRate;
    if (amountUsd > HIGH_AMOUNT_USD_THRESHOLD) {
      riskScore += HIGH_AMOUNT_RISK_POINTS;
      factors.push(
        `high_amount: $${amountUsd.toFixed(2)} USD exceeds threshold of $${HIGH_AMOUNT_USD_THRESHOLD}`,
      );
    }

    // ── 3. Country mismatch (real): the country of the payment instrument vs the country the account registered from. Only evaluated when both are known. ──
    if (billingCountry && user.country && billingCountry.toUpperCase() !== user.country.toUpperCase()) {
      riskScore += COUNTRY_MISMATCH_RISK_POINTS;
      factors.push(`country_mismatch: payment country ${billingCountry.toUpperCase()} differs from account country ${user.country.toUpperCase()}`);
    }

    // ── 4. Map score → level & decision ───────────────────────────────────
    const { riskLevel, decision } = this.classifyScore(riskScore);

    // ── 5. Persist flagged / blocked transactions ──────────────────────────
    const transactionId = this.generateId();
    const now = new Date();

    if (decision !== FraudDecision.APPROVED) {
      await this.prisma.fraudFlag.create({
        data: {
          userId: playerId,
          flagType: `transaction_${decision.toLowerCase()}`,
          score: riskScore,
          data: {
            transactionId,
            amount,
            currency,
            amountUsd,
            paymentMethod,
            factors,
            riskLevel,
            decision,
            analyzedAt: now.toISOString(),
          },
          resolved: false,
        },
      });
      this.gateway.emitFraudAlert({
        playerId,
        reason: factors.join('; '),
        severity: riskLevel === RiskLevel.HIGH ? 'HIGH' : 'MEDIUM',
      });
    }

    return {
      transactionId,
      playerId,
      riskScore,
      riskLevel,
      decision,
      factors,
      createdAt: now,
    };
  }

  // ─── getFlaggedTransactions ────────────────────────────────────────────────

  async getFlaggedTransactions(
    page = 1,
    limit = 20,
    minRisk = 0,
  ): Promise<PaginatedFraudFlagResponse> {
    const skip = (page - 1) * limit;

    const [rawFlags, total] = await Promise.all([
      this.prisma.fraudFlag.findMany({
        where: { score: { gte: minRisk } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.fraudFlag.count({
        where: { score: { gte: minRisk } },
      }),
    ]);

    const data: FraudFlagDTO[] = rawFlags.map((f) => this.mapToFraudFlagDTO(f));

    return {
      data,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  // ─── reviewTransaction ────────────────────────────────────────────────────

  async reviewTransaction(
    transactionId: string,
    decision: 'approve' | 'reject',
    reviewerId: string,
    notes?: string,
  ): Promise<FraudFlagDTO> {
    // Find the flag whose data JSON contains the transactionId
    const flag = await this.prisma.fraudFlag.findFirst({
      where: {
        data: {
          path: ['transactionId'],
          equals: transactionId,
        },
      },
    });
    if (!flag) {
      throw new NotFoundException(
        `FraudFlag for transactionId "${transactionId}" not found`,
      );
    }

    const updated = await this.prisma.fraudFlag.update({
      where: { id: flag.id },
      data: {
        resolved: true,
        resolvedBy: reviewerId,
        data: {
          ...(flag.data as Record<string, unknown>),
          reviewDecision: decision,
          reviewNotes: notes ?? null,
          reviewedAt: new Date().toISOString(),
        },
      },
    });

    return this.mapToFraudFlagDTO(updated);
  }

  // ─── getPlayerFraudProfile ────────────────────────────────────────────────

  async getPlayerFraudProfile(playerId: string): Promise<PlayerFraudProfileDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: playerId } });
    if (!user) throw new NotFoundException(`Player with id "${playerId}" not found`);

    const [flags, totalTransactions, lastPurchase] = await Promise.all([
      this.prisma.fraudFlag.findMany({
        where: { userId: playerId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.playerPurchase.count({ where: { userId: playerId } }),
      this.prisma.playerPurchase.findFirst({
        where: { userId: playerId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const flaggedCount = flags.length;
    const blockedCount = flags.filter((f) => {
      const d = (f.data as Record<string, unknown> | null);
      return d?.decision === FraudDecision.BLOCKED;
    }).length;
    const averageRiskScore =
      flaggedCount > 0
        ? Math.round(flags.reduce((sum, f) => sum + f.score, 0) / flaggedCount)
        : 0;

    return {
      playerId,
      totalTransactions,
      flaggedCount,
      blockedCount,
      averageRiskScore,
      lastTransactionAt: lastPurchase?.createdAt ?? undefined,
    };
  }

  // ─── getFraudStats ────────────────────────────────────────────────────────

  async getFraudStats(): Promise<FraudStatsDTO> {
    const [totalFlagged, totalAnalyzed] = await Promise.all([
      this.prisma.fraudFlag.count(),
      this.prisma.playerPurchase.count(),
    ]);

    const blockedFlags = await this.prisma.fraudFlag.count({
      where: {
        data: {
          path: ['decision'],
          equals: FraudDecision.BLOCKED,
        },
      },
    });

    const allScores = await this.prisma.fraudFlag.findMany({
      select: { score: true },
    });
    const averageRiskScore =
      allScores.length > 0
        ? Math.round(
            allScores.reduce((sum, f) => sum + f.score, 0) / allScores.length,
          )
        : 0;

    const effectiveTotal = totalAnalyzed > 0 ? totalAnalyzed : totalFlagged;
    const flagRate =
      effectiveTotal > 0
        ? parseFloat((totalFlagged / effectiveTotal).toFixed(4))
        : 0;

    return {
      totalAnalyzed: effectiveTotal,
      totalFlagged,
      totalBlocked: blockedFlags,
      averageRiskScore,
      flagRate,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private classifyScore(score: number): {
    riskLevel: RiskLevel;
    decision: FraudDecision;
  } {
    if (score > HIGH_RISK_SCORE_THRESHOLD) {
      return { riskLevel: RiskLevel.HIGH, decision: FraudDecision.BLOCKED };
    }
    if (score >= REVIEW_SCORE_THRESHOLD) {
      return { riskLevel: RiskLevel.MEDIUM, decision: FraudDecision.REVIEW };
    }
    return { riskLevel: RiskLevel.LOW, decision: FraudDecision.APPROVED };
  }

  /**
   * Returns a deterministic float [0, 1) derived from the playerId string.
   * Used for the mock country-mismatch check so tests are reproducible.
   */
  private deterministicMismatchScore(playerId: string): number {
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      hash = (hash * 31 + playerId.charCodeAt(i)) >>> 0;
    }
    return (hash % 1000) / 1000;
  }

  /** Generates a simple UUID-style id without external dependencies. */
  private generateId(): string {
    return `txn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private mapToFraudFlagDTO(
    flag: {
      id: string;
      userId: string;
      score: number;
      data: unknown;
      resolved: boolean;
      resolvedBy: string | null;
      createdAt: Date;
    },
  ): FraudFlagDTO {
    const data = (flag.data as Record<string, unknown> | null) ?? {};

    const riskScore = flag.score;
    const { riskLevel, decision } = this.classifyScore(riskScore);

    return {
      id: flag.id,
      playerId: flag.userId,
      transactionId: (data.transactionId as string) ?? flag.id,
      riskScore,
      riskLevel: (data.riskLevel as RiskLevel) ?? riskLevel,
      decision: (data.decision as FraudDecision) ?? decision,
      reviewedBy: flag.resolvedBy ?? undefined,
      reviewedAt: data.reviewedAt ? new Date(data.reviewedAt as string) : undefined,
      notes: (data.reviewNotes as string) ?? undefined,
      createdAt: flag.createdAt,
    };
  }
}

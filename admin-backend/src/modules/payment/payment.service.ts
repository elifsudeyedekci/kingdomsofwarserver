import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { VerifyReceiptDto } from './dto/verify-receipt.dto';
import { PurchaseService } from '../store/purchase.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { LogChargebackDto } from './dto/log-chargeback.dto';
import { GetChargebacksQueryDto } from './dto/get-chargebacks-query.dto';

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly purchases?: PurchaseService) {}

  async createPurchase(userId: string, dto: CreatePurchaseDto) {
    return this.prisma.playerPurchase.create({
      data: {
        userId,
        storeProductId: dto.storeProductId,
        platform: dto.platform,
        transactionId: dto.transactionId,
        receiptData: dto.receiptData,
        amountUsd: dto.amountUsd,
        currencyCode: dto.currencyCode ?? 'USD',
        amountLocal: dto.amountLocal,
        status: 'pending',
      },
    });
  }

  async getPurchases(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = { userId };

    const [items, total] = await Promise.all([
      this.prisma.playerPurchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.playerPurchase.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getAllPurchases(page: number, limit: number, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [items, total] = await Promise.all([
      this.prisma.playerPurchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.playerPurchase.count({ where }),
    ]);

    return { data: items, total, page, limit };
  }

  async getPurchaseById(id: string) {
    const purchase = await this.prisma.playerPurchase.findUnique({
      where: { id },
      include: { receipt: true, refund: true },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    return purchase;
  }

  async verifyReceipt(purchaseId: string, dto: VerifyReceiptDto) {
    const purchase = await this.prisma.playerPurchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    if (purchase.status === 'verified') {
      throw new BadRequestException('Purchase receipt is already verified');
    }

    await this.prisma.purchaseReceipt.create({
      data: {
        purchaseId,
        rawReceipt: dto.rawReceipt,
        validationResponse: (dto.validationResponse as Prisma.InputJsonValue) ?? undefined,
        isValid: dto.isValid,
        validatedAt: new Date(),
      },
    });

    const updated = await this.prisma.playerPurchase.update({
      where: { id: purchaseId },
      data: {
        status: dto.isValid ? 'verified' : 'failed',
        verifiedAt: dto.isValid ? new Date() : undefined,
      },
    });
    // a manually confirmed purchase delivers its contents (once: the 'verified' check above blocks a second confirmation)
    if (dto.isValid) await this.purchases?.deliverManually(purchaseId, 'support');
    return updated;
  }

  async createRefund(purchaseId: string, dto: CreateRefundDto) {
    const purchase = await this.prisma.playerPurchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');

    const existing = await this.prisma.refund.findUnique({
      where: { purchaseId },
    });
    if (existing) {
      throw new BadRequestException('A refund already exists for this purchase');
    }

    const refund = await this.prisma.refund.create({
      data: {
        purchaseId,
        userId: purchase.userId,
        amountUsd: purchase.amountUsd,
        reason: dto.reason,
        status: 'pending',
      },
    });
    if (dto.revokeContents) await this.purchases?.revokeDelivery(purchaseId, 'support', dto.reason ?? 'refund');
    return refund;
  }

  async logChargeback(dto: LogChargebackDto) {
    if (dto.amountUsd <= 0) {
      throw new BadRequestException('amountUsd must be greater than zero');
    }

    return this.prisma.chargeback.create({
      data: {
        userId: dto.userId,
        transactionId: dto.transactionId,
        amountUsd: dto.amountUsd,
        reason: dto.reason,
        status: 'received',
      },
    });
  }

  async getChargebacks(query: GetChargebacksQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = query.status ? { status: query.status } : {};

    const [items, total] = await Promise.all([
      this.prisma.chargeback.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.chargeback.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getRevenueReport(startDate: Date, endDate: Date) {
    const purchases = await this.prisma.playerPurchase.findMany({
      where: {
        status: 'verified',
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { amountUsd: true },
    });

    const totalRevenue = purchases.reduce((sum, p) => sum + p.amountUsd, 0);
    const transactionCount = purchases.length;
    const averageAmount = transactionCount > 0 ? totalRevenue / transactionCount : 0;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      transactionCount,
      averageAmount: Math.round(averageAmount * 100) / 100,
      startDate,
      endDate,
    };
  }
}

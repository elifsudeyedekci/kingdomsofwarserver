import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { GrantService, Rewards } from '../grants/grant.service';
import { PurchaseValidator } from './purchase.validator';

export interface PurchaseInput { platform: 'android' | 'ios' | 'editor'; sku: string; transactionId: string; receipt: string }

/** The player side of the store: a receipt goes in, the store is asked, and only a CONFIRMED purchase hands out the product's contents. Safe to repeat (idempotent per transaction id). */
@Injectable()
export class PurchaseService {
  private readonly logger = new Logger(PurchaseService.name);
  constructor(private readonly prisma: PrismaService, private readonly grants: GrantService, private readonly validator: PurchaseValidator) {}

  async purchase(userId: string, input: PurchaseInput) {
    const product = await this.prisma.storeProduct.findFirst({ where: { isActive: true, OR: input.platform === 'android' ? [{ skuAndroid: input.sku }] : input.platform === 'ios' ? [{ skuIos: input.sku }] : [{ skuAndroid: input.sku }, { skuIos: input.sku }, { id: input.sku }] } });
    if (!product) throw new NotFoundException('Unknown or inactive product');

    const existing = await this.prisma.playerPurchase.findUnique({ where: { transactionId: input.transactionId } });
    if (existing) {
      if (existing.userId !== userId) throw new ConflictException('This transaction already belongs to another account');
      if (existing.status === 'verified') return { ok: true, status: 'already_granted', purchaseId: existing.id, productId: product.id };
    }

    const v = await this.validator.validate(input.platform, input.sku, input.transactionId, input.receipt);
    // The STORE's own transaction id is the idempotency key, never the client's: one purchase token submitted under many made-up ids must not deliver many times.
    const canonical = v.valid && v.transactionId ? v.transactionId : input.transactionId;
    let known = existing;
    if (canonical !== input.transactionId) {
      known = await this.prisma.playerPurchase.findUnique({ where: { transactionId: canonical } });
      if (known) {
        if (known.userId !== userId) throw new ConflictException('This transaction already belongs to another account');
        if (known.status === 'verified') return { ok: true, status: 'already_granted', purchaseId: known.id, productId: product.id };
      }
    }
    const purchase = known ?? (await this.prisma.playerPurchase.create({ data: { userId, storeProductId: product.id, platform: input.platform, transactionId: canonical, receiptData: input.receipt.slice(0, 8000), amountUsd: product.priceUsd, status: 'pending' } }));
    await this.prisma.purchaseReceipt.upsert({ where: { purchaseId: purchase.id }, create: { purchaseId: purchase.id, rawReceipt: input.receipt.slice(0, 8000), validationResponse: v.raw as Prisma.InputJsonValue, isValid: v.valid, validatedAt: new Date() }, update: { validationResponse: v.raw as Prisma.InputJsonValue, isValid: v.valid, validatedAt: new Date() } });
    if (!v.valid) { await this.prisma.playerPurchase.update({ where: { id: purchase.id }, data: { status: 'failed' } }); throw new BadRequestException({ code: 'PURCHASE_NOT_VALID', message: v.reason ?? 'purchase could not be verified' }); }

    // flip pending -> verified exactly once (two parallel requests cannot both grant)
    const flip = await this.prisma.playerPurchase.updateMany({ where: { id: purchase.id, status: { not: 'verified' } }, data: { status: 'verified', verifiedAt: new Date() } });
    if (!flip.count) return { ok: true, status: 'already_granted', purchaseId: purchase.id, productId: product.id };
    try {
      const granted = await this.grants.apply(userId, product.contents as Rewards, { source: 'purchase', refId: purchase.id, reason: `purchase ${input.sku}` });
      return { ok: true, status: 'granted', purchaseId: purchase.id, productId: product.id, granted };
    } catch (e) {
      await this.prisma.playerPurchase.update({ where: { id: purchase.id }, data: { status: 'pending', verifiedAt: null } });     // paid but not delivered: stays visible for support, retry delivers
      this.logger.error(`purchase ${purchase.id} verified but delivery failed: ${(e as Error).message}`); throw e;
    }
  }

  /** Support confirmed a purchase by hand (e.g. a sandbox / manual payment): deliver its contents once. */
  async deliverManually(purchaseId: string, adminId: string) {
    const p = await this.prisma.playerPurchase.findUnique({ where: { id: purchaseId }, include: { storeProduct: true } });
    if (!p) throw new NotFoundException();
    return this.grants.apply(p.userId, p.storeProduct.contents as Rewards, { source: 'purchase', refId: p.id, reason: `manual confirmation of purchase ${p.id}`, adminId });
  }

  /** A refund / chargeback was approved: take back what that purchase delivered (inventory items + packs). Wallet currency already spent is left to a manual correction. */
  async revokeDelivery(purchaseId: string, adminId: string, reason: string) {
    const p = await this.prisma.playerPurchase.findUnique({ where: { id: purchaseId }, include: { storeProduct: true } });
    if (!p) throw new NotFoundException();
    const c = (p.storeProduct.contents ?? {}) as Rewards; let removed = 0;
    const ids = [...(c.items ?? []).map((i) => ({ t: i.type, id: i.id })), ...((c.packs ?? []) as ({ id: string } | string)[]).map((x) => ({ t: 'pack', id: typeof x === 'string' ? x : x.id }))];
    for (const x of ids) { const row = await this.prisma.playerInventory.findFirst({ where: { userId: p.userId, itemType: x.t, itemId: x.id } }); if (row) { await this.grants.revokeItem(p.userId, row.id, undefined, adminId, reason); removed++; } }
    return { ok: true, removed };
  }
}

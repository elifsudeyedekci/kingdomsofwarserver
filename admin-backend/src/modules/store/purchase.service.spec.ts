import { ConflictException } from '@nestjs/common';
import { PurchaseService } from './purchase.service';

/** In-memory prisma double: only what PurchaseService touches. */
function makeService(validResult: { valid: boolean; transactionId: string }) {
  const purchases: Record<string, any> = {};
  const product = { id: 'prod1', priceUsd: 5, contents: { wallet: { gems: 10 } }, isActive: true };
  const prisma: any = {
    storeProduct: { findFirst: async () => product },
    playerPurchase: {
      findUnique: async ({ where }: any) => purchases[where.transactionId] ?? null,
      create: async ({ data }: any) => (purchases[data.transactionId] = { id: 'pur_' + data.transactionId, ...data }),
      update: async ({ where, data }: any) => Object.assign(Object.values(purchases).find((p: any) => p.id === where.id) as any, data),
      updateMany: async ({ where, data }: any) => { const p: any = Object.values(purchases).find((x: any) => x.id === where.id); if (!p || p.status === 'verified') return { count: 0 }; Object.assign(p, data); return { count: 1 }; },
    },
    purchaseReceipt: { upsert: async () => ({}) },
  };
  const grants: any = { apply: jest.fn(async () => ({ gems: 10 })) };
  const validator: any = { validate: jest.fn(async () => ({ ...validResult, raw: {} })) };
  return { svc: new PurchaseService(prisma, grants, validator), grants, purchases, validator };
}
const input = (tx: string) => ({ platform: 'android' as const, sku: 's', transactionId: tx, receipt: 'tok' });

describe('PurchaseService idempotency', () => {
  it('the STORE transaction id is the key: one receipt under two client ids delivers once', async () => {
    const { svc, grants } = makeService({ valid: true, transactionId: 'GPA.real-1' });
    const a = await svc.purchase('u1', input('client-id-A'));
    const b = await svc.purchase('u1', input('client-id-B'));
    expect(a.status).toBe('granted');
    expect(b.status).toBe('already_granted');
    expect(grants.apply).toHaveBeenCalledTimes(1);
  });
  it('another account cannot claim a store transaction already delivered to someone else', async () => {
    const { svc } = makeService({ valid: true, transactionId: 'GPA.real-2' });
    await svc.purchase('u1', input('x'));
    await expect(svc.purchase('u2', input('y'))).rejects.toThrow(ConflictException);
  });
  it('an invalid receipt delivers nothing and is recorded as failed', async () => {
    const { svc, grants, purchases } = makeService({ valid: false, transactionId: 'GPA.bad' });
    await expect(svc.purchase('u1', input('z'))).rejects.toThrow();
    expect(grants.apply).not.toHaveBeenCalled();
    expect(Object.values(purchases)[0].status).toBe('failed');
  });
  it('a delivery failure after a valid receipt stays retryable (no loss, no double grant)', async () => {
    const { svc, grants } = makeService({ valid: true, transactionId: 'GPA.real-3' });
    grants.apply.mockRejectedValueOnce(new Error('db down'));
    await expect(svc.purchase('u1', input('q'))).rejects.toThrow('db down');
    const retry = await svc.purchase('u1', input('q'));
    expect(retry.status).toBe('granted');
    expect(grants.apply).toHaveBeenCalledTimes(2);
  });
});

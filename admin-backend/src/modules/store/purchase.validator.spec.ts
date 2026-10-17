import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PurchaseValidator } from './purchase.validator';

describe('PurchaseValidator', () => {
  const v = new PurchaseValidator();
  const OLD = { ...process.env };
  afterEach(() => { process.env = { ...OLD }; });

  it('extracts the purchase token from a Unity IAP Google receipt', () => {
    const inner = JSON.stringify({ purchaseToken: 'tok-123', productId: 'p' });
    const receipt = JSON.stringify({ Store: 'GooglePlay', TransactionID: 'GPA.1', Payload: JSON.stringify({ json: inner, signature: 'x' }) });
    expect(PurchaseValidator.googleToken(receipt)).toBe('tok-123');
  });
  it('accepts a bare token and rejects a malformed receipt', () => {
    expect(PurchaseValidator.googleToken('abc.def')).toBe('abc.def');
    expect(() => PurchaseValidator.googleToken('{"Payload":"nope"}')).toThrow(BadRequestException);
  });
  it('refuses editor purchases when dev mode is off', async () => {
    process.env.PAYMENTS_DEV_MODE = 'false';
    await expect(v.validate('editor', 's', 't', 'r')).rejects.toThrow(BadRequestException);
  });
  it('fails closed without Google credentials', async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON; delete process.env.GOOGLE_PLAY_PACKAGE;
    await expect(v.validate('android', 's', 't', 'tok')).rejects.toThrow(ServiceUnavailableException);
  });
  it('fails closed without Apple credentials', async () => {
    delete process.env.APPLE_ISSUER_ID; delete process.env.APPLE_KEY_ID; delete process.env.APPLE_PRIVATE_KEY; delete process.env.APPLE_BUNDLE_ID;
    await expect(v.validate('ios', 's', 't', 'r')).rejects.toThrow(ServiceUnavailableException);
  });
  it('turns a store outage into 503 (client keeps the purchase pending)', async () => {
    process.env.GOOGLE_PLAY_PACKAGE = 'com.x'; process.env.GOOGLE_SERVICE_ACCOUNT_JSON = '{"client_email":"a@b","private_key":"not a key"}';
    await expect(v.validate('android', 's', 't', 'tok')).rejects.toThrow(ServiceUnavailableException);
  });
});

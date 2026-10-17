/** Browser half of the encrypted login: fetches the server key, encrypts the credentials with WebCrypto, returns the opaque blob NextAuth submits. */
const b64u = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const utf8 = (s: string) => new TextEncoder().encode(s);

export async function encryptLogin(secrets: { email: string; password: string; otp?: string; captcha?: string }): Promise<string> {
  const { kid, publicKey } = (await (await fetch('/api/secure/key', { cache: 'no-store' })).json()) as { kid: string; publicKey: JsonWebKey };
  const serverKey = await crypto.subtle.importKey('jwk', publicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const mine = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: serverKey }, mine.privateKey, 256);
  const hkdf = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  const aes = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: utf8('kow-admin-login-v1') }, hkdf, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const nonce = b64u(crypto.getRandomValues(new Uint8Array(16)));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, utf8(JSON.stringify({ ...secrets, ts: Date.now(), nonce })));
  const epk = await crypto.subtle.exportKey('jwk', mine.publicKey);
  return b64u(utf8(JSON.stringify({ kid, epk, iv: b64u(iv), ct: b64u(ct) })));
}

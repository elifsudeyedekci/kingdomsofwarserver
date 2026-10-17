/**
 * Cloudflare Turnstile verification (works with the free tier; hCaptcha has the same shape - change URL + field names).
 * Enabled only when TURNSTILE_SECRET is set; in production the panel login then refuses to proceed without a valid token.
 */
export function captchaEnabled(): boolean { return !!process.env.TURNSTILE_SECRET; }

export async function verifyCaptcha(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token }); if (ip) body.set('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    const j = (await r.json()) as { success?: boolean };
    return j.success === true;
  } catch { return false; }
}

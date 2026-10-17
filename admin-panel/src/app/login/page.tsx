'use client';
import { useEffect, useRef, useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { encryptLogin } from '@/lib/secure-login.client';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const MESSAGES: Record<string, string> = {
  INVALID: 'E-posta veya parola hatalı.',
  OTP_REQUIRED: 'İki adımlı doğrulama kodu gerekli.',
  OTP_INVALID: 'Doğrulama kodu hatalı.',
  CAPTCHA: 'Robot doğrulaması başarısız. Tekrar deneyin.',
  TOO_MANY: 'Çok fazla deneme. Biraz bekleyip tekrar deneyin.',
  SERVER_UNREACHABLE: 'Sunucuya ulaşılamadı.',
};

declare global { interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void } } }

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [needOtp, setNeedOtp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const captchaEl = useRef<HTMLDivElement>(null);
  const widget = useRef<string>('');

  useEffect(() => {
    if (!SITE_KEY) return;
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true;
    s.onload = () => { if (captchaEl.current && window.turnstile) widget.current = window.turnstile.render(captchaEl.current, { sitekey: SITE_KEY, theme: 'dark', callback: (t: string) => setCaptcha(t), 'expired-callback': () => setCaptcha('') }); };
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const payload = await encryptLogin({ email, password, otp: otp || undefined, captcha: captcha || undefined });     // nothing readable leaves the browser
      const result = await signIn('credentials', { payload, redirect: false });
      if (result?.error) {
        if (result.error === 'OTP_REQUIRED') setNeedOtp(true);
        setError(MESSAGES[result.error] ?? MESSAGES.INVALID);
        if (SITE_KEY && window.turnstile) { window.turnstile.reset(widget.current); setCaptcha(''); }
        setPassword('');
      } else router.push('/dashboard');
    } catch { setError(MESSAGES.SERVER_UNREACHABLE); }
    finally { setLoading(false); }
  }

  const field = 'w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white focus:border-amber-500 focus:outline-none';
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8">
        <h1 className="mb-2 text-2xl font-bold text-white">Kingdoms of War</h1>
        <p className="mb-8 text-sm text-gray-400">Yönetim Paneli</p>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div>
            <label className="mb-1 block text-sm text-gray-400">E-posta</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" className={field} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Parola</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className={field} />
          </div>
          {needOtp && (
            <div>
              <label className="mb-1 block text-sm text-gray-400">Doğrulama kodu (6 hane) ya da yedek kod</label>
              <input inputMode="text" maxLength={12} value={otp} onChange={(e) => setOtp(e.target.value)} autoFocus autoComplete="one-time-code" className={field} />
            </div>
          )}
          {SITE_KEY && <div ref={captchaEl} />}
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <button type="submit" disabled={loading || (!!SITE_KEY && !captcha)} className="w-full rounded-lg bg-amber-500 py-2.5 font-semibold text-gray-950 hover:bg-amber-400 disabled:opacity-50">
            {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-gray-600">Bu sistemdeki tüm işlemler kaydedilir.</p>
      </div>
    </div>
  );
}

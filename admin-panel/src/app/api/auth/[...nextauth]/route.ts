import NextAuth, { type NextAuthOptions } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import { decryptLogin } from '@/lib/secure-login.server';

const SECURE = (process.env.NEXTAUTH_URL ?? '').startsWith('https://');
const API = process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** exp (ms) of a JWT access token, read without verifying (the backend verifies it on every call). */
function expOf(token: string): number {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).exp * 1000; } catch { return 0; }
}

async function refresh(token: JWT): Promise<JWT> {
  try {
    const res = await fetch(`${API}/admin-auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: token.refreshToken }) });
    if (!res.ok) throw new Error(String(res.status));
    const d = await res.json();
    return { ...token, accessToken: d.accessToken, refreshToken: d.refreshToken, accessExpires: expOf(d.accessToken), role: d.admin?.role ?? token.role, limited: !!d.limited, error: undefined };
  } catch {
    return { ...token, error: 'RefreshFailed' };
  }
}

const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: { payload: { label: 'Encrypted login', type: 'text' } },
      async authorize(credentials, req) {
        // credentials only ever arrive as one encrypted blob (see lib/secure-login.server.ts); plain fields are not accepted
        const secrets = credentials?.payload ? decryptLogin(credentials.payload) : null;
        if (!secrets?.email || !secrets.password) throw new Error('INVALID');
        const fwd = String((req?.headers as Record<string, string> | undefined)?.['x-forwarded-for'] ?? '').split(',')[0].trim();
        const res = await fetch(`${API}/admin-auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(fwd ? { 'X-Forwarded-For': fwd } : {}) }, body: JSON.stringify({ email: secrets.email, password: secrets.password, otp: secrets.otp || undefined, captchaToken: secrets.captcha || undefined }) }).catch(() => null);
        if (!res) throw new Error('SERVER_UNREACHABLE');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message?.code ?? data?.code ?? (res.status === 429 ? 'TOO_MANY' : 'INVALID'));
        return { id: data.admin.id, email: data.admin.email, name: data.admin.name, role: data.admin.role, limited: !!data.limited, accessToken: data.accessToken, refreshToken: data.refreshToken } as never;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { accessToken: string; refreshToken: string; role: string; limited: boolean };
        return { ...token, accessToken: u.accessToken, refreshToken: u.refreshToken, role: u.role, limited: u.limited, accessExpires: expOf(u.accessToken), error: undefined };
      }
      if (token.accessExpires && Date.now() < (token.accessExpires as number) - 60_000) return token;     // still valid (1 min margin)
      return refresh(token);
    },
    async session({ session, token }) {
      const s = session as unknown as { accessToken?: string; role?: string; error?: string; limited?: boolean };
      s.accessToken = token.accessToken as string; s.role = token.role as string; s.limited = !!token.limited; s.error = token.error as string | undefined;
      return session;
    },
  },
  pages: { signIn: '/login', error: '/login' },
  // 12 h absolute (the backend session also ends after 12 h / 30 min idle); the cookie is HttpOnly, SameSite=Strict and, on https, __Host- prefixed (no Domain, Secure, path /)
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60, updateAge: 5 * 60 },
  useSecureCookies: SECURE,
  cookies: SECURE ? {
    sessionToken: { name: '__Host-kow.session', options: { httpOnly: true, sameSite: 'strict', path: '/', secure: true } },
    callbackUrl: { name: '__Secure-kow.callback', options: { sameSite: 'strict', path: '/', secure: true } },
    csrfToken: { name: '__Host-kow.csrf', options: { httpOnly: true, sameSite: 'strict', path: '/', secure: true } },
  } : undefined,
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

import { NextResponse } from 'next/server';
import { currentKey } from '@/lib/secure-login.server';

export const dynamic = 'force-dynamic';

/** Short-lived public key the login form encrypts the credentials with (see secure-login.server.ts). */
export async function GET() {
  return NextResponse.json(currentKey(), { headers: { 'Cache-Control': 'no-store' } });
}

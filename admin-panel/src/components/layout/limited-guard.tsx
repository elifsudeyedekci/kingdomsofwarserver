'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

/** A password-only session (two-factor still to be enrolled) may see nothing but the account page. */
export function LimitedGuard() {
  const { data } = useSession();
  const path = usePathname();
  const router = useRouter();
  const limited = (data as { limited?: boolean } | null)?.limited;
  useEffect(() => { if (limited && path !== '/dashboard/account') router.replace('/dashboard/account?setup2fa=1'); }, [limited, path, router]);
  return null;
}

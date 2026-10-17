'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Game texts are managed as data files (Oyun Verisi & Yamalar -> "Metinler & diller"); this old address just forwards there. */
export default function LocalizationRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/game-data'); }, [router]);
  return <div className="text-gray-400">Metinler, "Oyun Verisi &amp; Yamalar" sayfasındaki "Metinler &amp; diller" grubundan yönetilir. Yönlendiriliyorsunuz…</div>;
}

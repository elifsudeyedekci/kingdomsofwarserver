import type { ReactNode } from 'react';
import '../globals.css';
import { display } from '@/lib/fonts';

export default function Layout({ children }: { children: ReactNode }) {
  return (<html lang="tr" dir="ltr" className={display.variable}><body>{children}</body></html>);
}

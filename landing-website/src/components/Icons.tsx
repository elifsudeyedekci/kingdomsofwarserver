import type { ReactNode } from 'react';

const P: Record<string, ReactNode> = {
  crown: <><path d="M3 18h18l-1.5-9-4.5 4-3-7-3 7-4.5-4z" /><path d="M4 21h16" /></>,
  coins: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
  ages: <><path d="M6 3h12M6 21h12" /><path d="M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" /></>,
  swords: <><path d="M14.5 17.5 3 6V3h3l11.5 11.5" /><path d="m13 19 6-6M16 16l4 4M19 21l2-2" /><path d="M9.5 6.5 21 18v3h-3L6.5 9.5" /><path d="m5 11 6 6M8 8 4 4M5 3 3 5" /></>,
  trophy: <><path d="M8 21h8M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5" /></>,
  brain: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></>,
  gamepad: <><rect x="2" y="7" width="20" height="11" rx="5" /><path d="M7 10v5M4.5 12.5h5M15.5 11h.01M18 14h.01" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7 2.5 7h-17S6 15 6 9z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  map: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  download: <><path d="M12 4v12m-5-5 5 5 5-5" /><path d="M5 20h14" /></>,
  shield: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />,
  play: <path d="M8 5v14l11-7z" />,
  android: <><path d="M6 10h12v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" /><path d="M8 4l1.5 2.5M16 4l-1.5 2.5M6 10a6 6 0 0 1 12 0M10 14h.01M14 14h.01" /></>,
  apple: <><path d="M12 7c-2-2-6-1-6 4 0 4 2 9 4 9 1 0 1.2-.6 2-.6s1 .6 2 .6c2 0 4-5 4-9 0-5-4-6-6-4z" /><path d="M12 7c0-2 1-3 3-4" /></>,
  steam: <><circle cx="12" cy="12" r="9" /><circle cx="15.5" cy="9.5" r="2.5" /><path d="m3.5 14 5 2M9 17.5a2 2 0 1 0 0-3.5" /></>,
};
export function Icon({ name, size = 24, className }: { name: keyof typeof P | string; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{P[name]}</svg>;
}

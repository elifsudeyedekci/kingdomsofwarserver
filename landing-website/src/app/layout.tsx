import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kingdomsofwar.game';
const OG_IMAGE = `${SITE_URL}/og-image.svg`;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0c0a09',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Kingdoms of War — Epic Mobile RTS Strategy Game",
    template: "%s | Kingdoms of War",
  },
  description:
    "Kingdoms of War is a multiplayer mobile RTS inspired by Age of Empires IV. Build your medieval kingdom, command armies, forge alliances, and conquer rivals on iOS & Android.",
  keywords: [
    "kingdoms of war",
    "mobile RTS",
    "real-time strategy",
    "mobile strategy game",
    "multiplayer RTS",
    "base building game",
    "medieval strategy",
    "mobile game iOS Android",
    "PvP strategy",
    "age of empires mobile",
  ],
  authors: [{ name: "Kingdoms of War Team" }],
  creator: "Kingdoms of War Team",
  publisher: "Kingdoms of War",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Kingdoms of War",
    title: "Kingdoms of War — Epic Mobile RTS Strategy Game",
    description:
      "Kingdoms of War is a multiplayer mobile RTS inspired by Age of Empires IV. Build your medieval kingdom, command armies, forge alliances, and conquer rivals on iOS & Android.",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Kingdoms of War — Medieval RTS Strategy Game",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@KoWMobileGame",
    creator: "@KoWMobileGame",
    title: "Kingdoms of War — Epic Mobile RTS Strategy Game",
    description:
      "Kingdoms of War is a multiplayer mobile RTS inspired by Age of Empires IV. Build your medieval kingdom, command armies, and conquer rivals on iOS & Android.",
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} bg-stone-950 text-stone-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}

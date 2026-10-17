import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-stone-800/60 bg-stone-950/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-amber-500 font-bold text-xl tracking-tight">
          Kingdoms of War
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-stone-400">
          <Link href="#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="#civilizations" className="hover:text-white transition-colors">Civilizations</Link>
          <Link href="/support" className="hover:text-white transition-colors">Support</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
        </nav>
        <a
          href="#download"
          className="text-sm bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-full font-semibold transition-colors"
        >
          Download
        </a>
      </div>
    </header>
  );
}

import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-stone-800 bg-stone-950 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm text-stone-400 mb-10">
          <div>
            <p className="font-semibold text-white mb-3">Game</p>
            <ul className="space-y-2">
              <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
              <li><Link href="#civilizations" className="hover:text-white transition-colors">Civilizations</Link></li>
              <li><Link href="#download" className="hover:text-white transition-colors">Download</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white mb-3">Company</p>
            <ul className="space-y-2">
              <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><Link href="/careers" className="hover:text-white transition-colors">Careers</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white mb-3">Legal</p>
            <ul className="space-y-2">
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/cookies" className="hover:text-white transition-colors">Cookie Policy</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white mb-3">Support</p>
            <ul className="space-y-2">
              <li><Link href="/support" className="hover:text-white transition-colors">Help Center</Link></li>
              <li><Link href="/support/report" className="hover:text-white transition-colors">Report a Bug</Link></li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-stone-600">
          <p>© {new Date().getFullYear()} Kingdoms of War. All rights reserved.</p>
          <p>Made with care for mobile strategy fans worldwide.</p>
        </div>
      </div>
    </footer>
  );
}

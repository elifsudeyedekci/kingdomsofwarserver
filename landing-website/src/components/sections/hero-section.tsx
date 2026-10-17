"use client";

import { useState } from "react";

const STATS = [
  { label: "10 Uygarlık" },
  { label: "20v20 Savaşlar" },
  { label: "100% Ücretsiz" },
] as const;

function AppleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
      className="w-5 h-5 flex-shrink-0" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
      className="w-5 h-5 flex-shrink-0" aria-hidden="true">
      <path d="M3.18 23.76c.3.17.64.24.99.2l12.6-11.53L3.17.23C2.82.2 2.48.26 2.18.44 1.6.8 1.25 1.43 1.25 2.13v19.74c0 .7.35 1.33.93 1.69zM15.34 12l2.99 2.73-10.54 6.1L15.34 12zm0 0L7.79 3.17l10.54 6.1L15.34 12zm3.73 2.12L16.5 12l2.57-2.12L21.4 12l-2.33 2.12z" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-6 h-6" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function HeroSection() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-950/30 via-stone-950 to-stone-950 pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <span className="inline-block text-xs font-semibold tracking-widest text-amber-500 uppercase mb-6">
          Coming Soon — Free to Play
        </span>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-none">
          Kingdoms of War
          <br />
          <span className="text-amber-500">Mobile Empires</span>
        </h1>

        <p className="text-lg md:text-xl text-stone-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          10 tarihi medeniyetten birini seç, ordularını kur ve antik dünyayı gerçek zamanlı
          strateji savaşlarında fethederek imparatorluğunu yönet.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center" id="download">
          <a href="https://apps.apple.com/app/kingdoms-of-war/id000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-white px-7 py-3.5 rounded-2xl font-semibold text-sm transition-colors"
            aria-label="App Store — Coming Soon">
            <AppleIcon />
            App Store — Coming Soon
          </a>
          <a href="https://play.google.com/store/apps/details?id=com.kingdomsofwar.mobile"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-white px-7 py-3.5 rounded-2xl font-semibold text-sm transition-colors"
            aria-label="Google Play — Coming Soon">
            <PlayIcon />
            Google Play — Coming Soon
          </a>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-8">
          {STATS.map((stat, i) => (
            <div key={stat.label} className="flex items-center gap-8">
              <span className="text-white font-bold text-base">{stat.label}</span>
              {i < STATS.length - 1 && (
                <span className="w-px h-4 bg-stone-700" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-16">
          <p className="text-stone-400 text-sm mb-4 font-medium uppercase tracking-widest">
            Oyunculara Katıl
          </p>
          {submitted ? (
            <p className="text-amber-500 font-semibold text-sm">
              Ön kaydın alındı! Lansman haberlerini e-postayla ileteceğiz.
            </p>
          ) : (
            <form onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto"
              aria-label="Ön kayıt formu">
              <label htmlFor="newsletter-email" className="sr-only">
                E-posta adresiniz
              </label>
              <input
                id="newsletter-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-posta adresiniz"
                className="flex-1 bg-stone-800 border border-stone-700 text-white placeholder-stone-500 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <button type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm px-6 py-3 rounded-xl transition-colors whitespace-nowrap">
                Ön Kayıt Ol
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-stone-500 animate-bounce">
        <ChevronDownIcon />
      </div>
    </section>
  );
}

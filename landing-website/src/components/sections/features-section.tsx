const FEATURES = [
  {
    title: "Gerçek Zamanlı Strateji",
    description: "20 saniye tikli deterministic lockstep ile gecikme yok, her komut anında işlenir.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8" aria-hidden="true">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: "10 Tarihi Uygarlık",
    description: "İngilizlerden Osmanlılara, her medeniyetin benzersiz bonusları ve özel birimleri var.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8" aria-hidden="true">
        <path d="M3 21h18M3 7v1a3 3 0 006 0V7m0 1a3 3 0 006 0V7m0 1a3 3 0 006 0V7M6 21V12m6 9V12m6 9V12M3 7l9-4 9 4" />
      </svg>
    ),
  },
  {
    title: "Gelişmiş Formasyon",
    description: "Birden fazla birimi aynı anda seçip şekillendirin, savaş düzeni kurun.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8" aria-hidden="true">
        <rect x="2" y="7" width="4" height="4" rx="1" /><rect x="10" y="7" width="4" height="4" rx="1" /><rect x="18" y="7" width="4" height="4" rx="1" />
        <rect x="6" y="13" width="4" height="4" rx="1" /><rect x="14" y="13" width="4" height="4" rx="1" />
      </svg>
    ),
  },
  {
    title: "Denizcilik",
    description: "Deniz kuvvetleri ile kara ve deniz savaşlarını birleştiren tam naval sistem.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8" aria-hidden="true">
        <path d="M2 20a2 2 0 002 2h16a2 2 0 002-2M22 20H2M22 15l-5-5-4 4-4-4-5 5M12 3v9" />
      </svg>
    ),
  },
  {
    title: "Battle Pass",
    description: "Sezonluk savaş geçişi ile yeni içerik ve ödüller. Tamamen kozmetik.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8" aria-hidden="true">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
  {
    title: "Klan Savaşları",
    description: "Klanınızla birleşin, rakip klanlara meydan okuyun, toprak kontrol edin.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-stone-900">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="inline-block text-xs font-semibold tracking-widest text-amber-500 uppercase mb-3">
            Oyun Özellikleri
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Neden Kingdoms of War?
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group bg-stone-950 border border-stone-800 rounded-2xl p-6 hover:border-amber-500/50 hover:bg-stone-900/60 transition-all duration-200"
            >
              <div className="text-amber-500 mb-4">{feature.icon}</div>
              <h3 className="text-white font-bold text-base mb-2">{feature.title}</h3>
              <p className="text-stone-400 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const SCREENSHOTS = [
  {
    title: "Savaş Meydanı",
    description: "Gerçek zamanlı çatışmalar ve taktiksel savaş sistemi",
  },
  {
    title: "Şehir İnşası",
    description: "İmparatorluğunu sıfırdan inşa et, binalarını güçlendir",
  },
  {
    title: "Klan Savaşı",
    description: "İttifak kur, diğer klanlarla büyük savaşlara katıl",
  },
  {
    title: "Uygarlık Ağacı",
    description: "Benzersiz teknoloji ağacınla medeniyetini ilerlet",
  },
] as const;

export function ScreenshotsSection() {
  return (
    <section id="screenshots" className="py-24 bg-stone-900">
      <style>{`
        @keyframes kow-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .kow-shimmer {
          background: linear-gradient(
            90deg,
            #292524 0%,
            #3d3532 40%,
            #44403c 50%,
            #3d3532 60%,
            #292524 100%
          );
          background-size: 200% 100%;
          animation: kow-shimmer 2.4s ease-in-out infinite;
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="inline-block text-xs font-semibold tracking-widest text-amber-500 uppercase mb-3">
            Görseller
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Oyun İçi Görünüm
          </h2>
          <p className="text-stone-400 mt-4 max-w-xl mx-auto">
            Kingdoms of War&apos;ın nefes kesen görsel dünyasına göz atın
          </p>
        </div>

        <div className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory md:grid md:grid-cols-4 md:overflow-x-visible md:pb-0">
          {SCREENSHOTS.map((shot) => (
            <div key={shot.title} className="flex-none w-[220px] md:w-auto snap-start flex flex-col">
              <div className="kow-shimmer aspect-[9/16] w-full rounded-2xl border border-stone-700/60 flex flex-col items-center justify-center gap-3 relative overflow-hidden">
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5 pointer-events-none" />
                <div className="w-14 h-14 rounded-full border-2 border-stone-600 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18M3.75 3h16.5A.75.75 0 0121 3.75v13.5A.75.75 0 0120.25 18H3.75A.75.75 0 013 17.25V3.75A.75.75 0 013.75 3z" />
                  </svg>
                </div>
                <span className="text-stone-500 text-xs tracking-widest uppercase select-none">
                  Yakında
                </span>
              </div>
              <div className="mt-3 px-1">
                <h3 className="text-white font-semibold text-sm">{shot.title}</h3>
                <p className="text-stone-500 text-xs mt-1 leading-relaxed">{shot.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

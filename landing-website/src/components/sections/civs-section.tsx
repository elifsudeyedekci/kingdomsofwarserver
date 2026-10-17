const CIVS = [
  { name: 'İngilizler',   bonus: 'Uzun Yay Hakimiyeti: +20% okçu menzili ve atış hızı' },
  { name: 'Fransızlar',   bonus: 'Şövalye Birliği: +15% ağır süvari gücü' },
  { name: 'Kutsal Roma',  bonus: 'İmparatorluk Ağı: şehirler arası ticaret bonusu' },
  { name: 'Osmanlılar',   bonus: 'Yeniçeri Disiplini: +20% piyade savaş gücü' },
  { name: 'Abbasi',       bonus: 'Altın Çağ: araştırmalar %25 daha hızlı tamamlanır' },
  { name: 'Ruslar',       bonus: 'Bozkır Hamlesi: yük kapasitesi +30% artış' },
  { name: 'Çinliler',     bonus: 'İmparatorluk Bürokrasisi: tüm üretim +10% hızlanır' },
  { name: 'Delhi',        bonus: 'Mistik Alimler: teknolojiler ücretsiz araştırılabilir' },
  { name: 'Malilar',      bonus: 'Sahara Altını: kaynak kapasitesi 2x artış' },
  { name: 'Moğollar',     bonus: 'Göçebe Hakimiyet: süvari hızı +25% artış' },
] as const;

export function CivsSection() {
  return (
    <section id="civilizations" className="py-24 bg-stone-950">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
          10 Eşsiz Medeniyet
        </h2>
        <p className="text-stone-400 text-center mb-16 max-w-xl mx-auto">
          Her medeniyet farklı oynanır. Sana özel oyun tarzını keşfet.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {CIVS.map((civ) => (
            <div
              key={civ.name}
              className="bg-stone-900 border border-stone-800 rounded-xl p-4 text-center hover:border-amber-500/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-amber-900/40 border border-amber-800/40 mx-auto mb-3 flex items-center justify-center text-amber-500 font-bold text-lg">
                {civ.name[0]}
              </div>
              <h3 className="text-white font-semibold text-sm mb-1">{civ.name}</h3>
              <p className="text-stone-500 text-xs leading-relaxed">{civ.bonus}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

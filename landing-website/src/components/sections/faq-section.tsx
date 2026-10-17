"use client";

import { useState } from "react";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  { question: "Kingdoms of War ücretsiz mi?", answer: "Evet, tamamen ücretsiz. Kozmetik item mağazası var." },
  { question: "Hangi cihazlarda çalışır?", answer: "iOS 14+ ve Android 8+ desteklenir." },
  { question: "İnternet bağlantısı gerekli mi?", answer: "Gerçek zamanlı çok oyunculu için evet." },
  { question: "Maç süresi ne kadar?", answer: "Ortalama 15-25 dakika, format ve oyuncu sayısına göre değişir." },
  { question: "Klan nasıl kurulur?", answer: "50. seviyeye ulaştıktan sonra klan kurabilirsiniz." },
  { question: "Pay-to-win var mı?", answer: "Hayır. Tüm güç artışları sadece gameplay ile kazanılır." },
  { question: "Crossplay desteği var mı?", answer: "iOS ve Android oyuncular aynı sunucularda." },
  { question: "Verilerim güvende mi?", answer: "GDPR uyumlu, şifreli sunucular." },
];

function AccordionItem({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border border-stone-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left bg-stone-900 hover:bg-stone-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        <span className="text-sm font-semibold text-white">{item.question}</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
          className={`w-5 h-5 flex-shrink-0 text-amber-500 transition-transform duration-300 ${isOpen ? "rotate-180" : "rotate-0"}`}>
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
        <p className="px-5 py-4 text-sm text-stone-400 bg-stone-950 leading-relaxed">{item.answer}</p>
      </div>
    </div>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <section className="py-24 bg-stone-950">
      <div className="max-w-2xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="inline-block text-xs font-semibold tracking-widest text-amber-500 uppercase mb-3">Sık Sorulan Sorular</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white">Merak Ettiklerin</h2>
        </div>
        <div className="flex flex-col gap-3">
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem
              key={item.question}
              item={item}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(prev => prev === index ? null : index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
    setEmail("");
  }

  return (
    <section className="py-24 bg-gradient-to-b from-stone-950 to-stone-900">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <span className="inline-block text-xs font-semibold tracking-widest text-amber-500 uppercase mb-3">E-Posta Listesi</span>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Haberdar Ol</h2>
        <p className="text-stone-400 mb-10">Erken erişim tarihi ve özel ödüller için e-postanı gir.</p>
        {submitted ? (
          <div className="flex flex-col items-center gap-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-600/20 border border-amber-500/40">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-amber-500" aria-hidden="true">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-white font-semibold">Kaydın alındı, teşekkürler!</p>
            <p className="text-stone-500 text-sm">Seni haberdar edeceğiz.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="ornek@email.com" aria-label="E-posta adresi"
              className="flex-1 bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 transition-colors" />
            <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap">
              Kayıt Ol
            </button>
          </form>
        )}
        <p className="text-stone-600 text-xs mt-6">Spam göndermiyoruz. İstediğin zaman çıkabilirsin.</p>
      </div>
    </section>
  );
}

export function FaqNewsletterSection() {
  return (
    <>
      <FaqSection />
      <NewsletterSection />
    </>
  );
}

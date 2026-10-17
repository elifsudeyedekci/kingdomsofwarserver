/** Legal texts exist in Turkish and English. Other languages show the English text (marked lang="en") under their own translated heading. */
export interface Section { h: string; p: string[] }
export type LegalKey = 'privacy' | 'terms' | 'cookies';

const enLegal: Record<LegalKey, Section[]> = {
  privacy: [
    { h: 'Who we are', p: ['DoSuCan Games ("we", "us") develops Kingdoms of War: Mobile Empires (the "Game") and runs this website. Contact: info@kingdomsofwarworld.com.'] },
    { h: 'This website', p: ['This website does not set cookies, does not use advertising or analytics trackers and does not ask you to create an account. Like every web server, ours may keep short-lived technical logs (IP address, time, requested page) to keep the site secure and working.'] },
    { h: 'Data the Game processes', p: ['When you play online, the Game creates a player account for you (a guest account unless you choose otherwise) and processes: a player identifier, your chosen player name, a device identifier, platform, app version and language, gameplay data such as match results, rating, progress and play time, items and purchases linked to your account, messages we send you, and your IP address.', 'We use this data to run the Game (sign-in, matchmaking, progress, rewards), to deliver purchases you made through the store, to keep matches fair (detecting cheating and abuse, enforcing bans) and to protect our servers.', 'Purchases are handled by Google Play or the App Store. We receive the purchase confirmation and its transaction identifier, never your payment card details.'] },
    { h: 'Sharing', p: ['We do not sell personal data. We share data only with service providers that host or operate the Game (for example server hosting and the multiplayer network provider), with the app stores for purchases, and when the law requires it.'] },
    { h: 'Retention', p: ['We keep account and gameplay data while your account is active and for as long as needed to run the Game, prevent abuse and meet legal obligations. Security logs are kept for a limited period.'] },
    { h: 'Your rights', p: ['You may ask us for access to your data, correction, deletion of your account or a copy of your data. Write to info@kingdomsofwarworld.com from the address you used to contact us and include your player name. Depending on where you live (for example the EEA, the UK or Turkey under KVKK) you may also have the right to object to processing or to complain to your data protection authority.'] },
    { h: 'Children', p: ['The Game is not directed at children under 13 (or the minimum age in your country). If you believe a child has given us personal data, contact us and we will delete it.'] },
    { h: 'Changes', p: ['We may update this policy. The date at the top of the page shows when it was last changed.'] },
  ],
  terms: [
    { h: 'Using the Game and website', p: ['By using Kingdoms of War: Mobile Empires or this website you agree to these terms. If you do not agree, please do not use them.'] },
    { h: 'Your account', p: ['You are responsible for activity on your account. Do not share it, sell it or use it to cheat. We may suspend or ban accounts that use cheats, exploit bugs, harass others or break these terms.'] },
    { h: 'Fair play', p: ['Matches must be played as designed. Modifying the Game, using bots or third-party tools to gain an advantage, and abusing the multiplayer service are not allowed.'] },
    { h: 'Purchases', p: ['Digital content is sold through Google Play or the App Store under their terms, including their refund rules. Content is licensed to you for personal use and is tied to your account.'] },
    { h: 'Intellectual property', p: ['The Game, its logos, art, audio, code and texts belong to DoSuCan Games or its licensors. You may not copy, sell or redistribute them, except the press materials offered on our press kit page for coverage of the Game.'] },
    { h: 'Availability and changes', p: ['The Game is in pre-alpha. Features, data and servers may change, be reset or be discontinued. We provide the Game "as is" without warranties, to the extent the law allows.'] },
    { h: 'Liability', p: ['To the extent the law allows, DoSuCan Games is not liable for indirect or consequential loss arising from use of the Game or website. Nothing in these terms limits liability that cannot be limited by law.'] },
    { h: 'Contact', p: ['Questions about these terms: info@kingdomsofwarworld.com.'] },
  ],
  cookies: [
    { h: 'This website', p: ['This website does not set cookies and does not use similar technologies such as local storage for tracking. We do not use advertising or analytics cookies, so there is no cookie banner to accept.'] },
    { h: 'External links', p: ['Links to stores (Google Play, App Store, Steam) and to other websites lead to services with their own cookie policies. Please read them when you visit those services.'] },
    { h: 'The Game', p: ['The Game is an app, not a website. It stores progress and settings on your device and on our servers as described in the Privacy Policy.'] },
    { h: 'Changes', p: ['If we ever add cookies or analytics to this website we will update this page and ask for your consent where the law requires it.'] },
  ],
};

const trLegal: Record<LegalKey, Section[]> = {
  privacy: [
    { h: 'Biz kimiz', p: ['DoSuCan Games ("biz"), Kingdoms of War: Mobile Empires ("Oyun") oyununu geliştirir ve bu web sitesini işletir. İletişim: info@kingdomsofwarworld.com.'] },
    { h: 'Bu web sitesi', p: ['Bu web sitesi çerez kullanmaz, reklam veya analiz izleyicileri kullanmaz ve hesap oluşturmanı istemez. Her web sunucusu gibi bizimki de siteyi güvenli ve çalışır tutmak için kısa süreli teknik kayıtlar (IP adresi, zaman, istenen sayfa) tutabilir.'] },
    { h: 'Oyunun işlediği veriler', p: ['Çevrimiçi oynadığında Oyun senin için bir oyuncu hesabı (aksi seçmedikçe misafir hesabı) oluşturur ve şunları işler: oyuncu kimliği, seçtiğin oyuncu adı, cihaz kimliği, platform, uygulama sürümü ve dil; maç sonuçları, derece, ilerleme ve oynama süresi gibi oyun verileri; hesabına bağlı eşyalar ve satın alımlar; sana gönderdiğimiz mesajlar ve IP adresin.', 'Bu verileri Oyunu işletmek (giriş, eşleştirme, ilerleme, ödüller), mağaza üzerinden yaptığın satın alımları teslim etmek, maçları adil tutmak (hile ve kötüye kullanımı tespit etmek, yasakları uygulamak) ve sunucularımızı korumak için kullanırız.', 'Satın alımlar Google Play veya App Store tarafından yürütülür. Satın alma onayını ve işlem kimliğini alırız; ödeme kartı bilgilerini asla görmeyiz.'] },
    { h: 'Paylaşım', p: ['Kişisel verileri satmayız. Verileri yalnızca Oyunu barındıran veya işleten hizmet sağlayıcılarla (örneğin sunucu barındırma ve çok oyunculu ağ sağlayıcısı), satın alımlar için uygulama mağazalarıyla ve yasanın gerektirdiği durumlarda paylaşırız.'] },
    { h: 'Saklama', p: ['Hesap ve oyun verilerini hesabın aktif olduğu sürece ve Oyunu işletmek, kötüye kullanımı önlemek ve yasal yükümlülükleri yerine getirmek için gerektiği kadar saklarız. Güvenlik kayıtları sınırlı bir süre tutulur.'] },
    { h: 'Haklarınız', p: ['Verilerine erişim, düzeltme, hesabının silinmesi veya verilerinin bir kopyasını isteyebilirsin. Bize yazdığın adresten oyuncu adınla birlikte info@kingdomsofwarworld.com adresine yaz. Yaşadığın yere göre (örneğin AEA, Birleşik Krallık veya Türkiye’de KVKK kapsamında) işlemeye itiraz etme ya da veri koruma otoritesine şikâyet etme hakkın da olabilir.'] },
    { h: 'Çocuklar', p: ['Oyun 13 yaşın altındaki (veya ülkendeki asgari yaşın altındaki) çocuklara yönelik değildir. Bir çocuğun bize kişisel veri verdiğini düşünüyorsan bizimle iletişime geç, sileriz.'] },
    { h: 'Değişiklikler', p: ['Bu politikayı güncelleyebiliriz. Sayfanın üstündeki tarih en son ne zaman değiştiğini gösterir.'] },
  ],
  terms: [
    { h: 'Oyunu ve web sitesini kullanma', p: ['Kingdoms of War: Mobile Empires’ı veya bu web sitesini kullanarak bu koşulları kabul edersin. Kabul etmiyorsan lütfen kullanma.'] },
    { h: 'Hesabın', p: ['Hesabındaki faaliyetlerden sen sorumlusun. Hesabını paylaşma, satma veya hile için kullanma. Hile kullanan, hataları istismar eden, başkalarını rahatsız eden veya bu koşulları ihlal eden hesapları askıya alabilir veya yasaklayabiliriz.'] },
    { h: 'Adil oyun', p: ['Maçlar tasarlandığı gibi oynanmalıdır. Oyunu değiştirmek, avantaj sağlamak için bot veya üçüncü taraf araç kullanmak ve çok oyunculu hizmeti kötüye kullanmak yasaktır.'] },
    { h: 'Satın alımlar', p: ['Dijital içerik, iade kuralları dahil Google Play veya App Store koşullarına göre onlar üzerinden satılır. İçerik sana kişisel kullanım için lisanslanır ve hesabına bağlıdır.'] },
    { h: 'Fikri mülkiyet', p: ['Oyun; logoları, görselleri, sesleri, kodu ve metinleriyle DoSuCan Games’e veya lisans verenlerine aittir. Oyunu haberleştirmek için basın kiti sayfasında sunulan materyaller dışında bunları kopyalayamaz, satamaz veya yeniden dağıtamazsın.'] },
    { h: 'Erişilebilirlik ve değişiklikler', p: ['Oyun pre-alpha aşamasındadır. Özellikler, veriler ve sunucular değişebilir, sıfırlanabilir veya sonlandırılabilir. Oyunu, yasanın izin verdiği ölçüde "olduğu gibi" ve garantisiz sunarız.'] },
    { h: 'Sorumluluk', p: ['Yasanın izin verdiği ölçüde DoSuCan Games, Oyunun veya web sitesinin kullanımından doğan dolaylı veya sonuç olarak ortaya çıkan zararlardan sorumlu değildir. Bu koşullardaki hiçbir şey yasayla sınırlanamayacak sorumluluğu sınırlamaz.'] },
    { h: 'İletişim', p: ['Bu koşullarla ilgili sorular: info@kingdomsofwarworld.com.'] },
  ],
  cookies: [
    { h: 'Bu web sitesi', p: ['Bu web sitesi çerez kullanmaz ve izleme amaçlı yerel depolama gibi benzer teknolojiler de kullanmaz. Reklam veya analiz çerezi kullanmadığımız için kabul edilecek bir çerez bandı yoktur.'] },
    { h: 'Harici bağlantılar', p: ['Mağazalara (Google Play, App Store, Steam) ve diğer web sitelerine giden bağlantılar kendi çerez politikaları olan hizmetlere çıkar. O hizmetleri ziyaret ederken lütfen onları oku.'] },
    { h: 'Oyun', p: ['Oyun bir web sitesi değil, uygulamadır. İlerlemeyi ve ayarları Gizlilik Politikası’nda anlatıldığı gibi cihazında ve sunucularımızda saklar.'] },
    { h: 'Değişiklikler', p: ['Bu web sitesine bir gün çerez veya analiz eklersek bu sayfayı güncelleriz ve yasanın gerektirdiği yerde onayını isteriz.'] },
  ],
};

export const legalBody = (lang: string, key: LegalKey): { sections: Section[]; lang: 'tr' | 'en' } => (lang === 'tr' ? { sections: trLegal[key], lang: 'tr' } : { sections: enLegal[key], lang: 'en' });

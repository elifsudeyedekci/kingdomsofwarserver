import type { Section } from '@/lib/permissions';

export type Status = 'ready' | 'beta';
export interface GuideItem {
  id: string;
  title: string;
  /** Ne işe yarar */
  what: string;
  /** Neyi değiştirir / neyi görürsünüz */
  changes: string;
  /** Nasıl yapılır (adımlar) */
  how: string[];
  /** Oyunculara ne zaman yansır */
  when: string;
  href: string;
  button: string;
  section?: Section;
  status?: Status;
}
export interface GuideSection { id: string; title: string; intro: string; items: GuideItem[] }

const NOW = 'Anında (oyuncu çevrimiçiyse en geç birkaç saniye içinde).';
const NEXT = 'Oyuncu oyunu açtığında; oyun açıkken en geç 5 dakika içinde. Veri yamalarında yeni veri bir sonraki maçta / yeniden açılışta geçerli olur.';

export const GUIDE: GuideSection[] = [
  {
    id: 'how',
    title: '0 · Sistem nasıl çalışıyor?',
    intro: 'Oyun ile bu panel aynı sunucuya bağlıdır. Panelde yaptığınız değişiklik sunucuya kaydedilir; oyun her açılışta (ve açıkken 5 dakikada bir) sunucuya "durum nedir?" diye sorar ve cevaba göre davranır. Böylece mağaza güncellemesi göndermeden oyunu değiştirebilirsiniz. Sadece YENİ KOD, yeni 3D model/ses/görsel gibi şeyler için mağaza güncellemesi gerekir.',
    items: [
      { id: 'how-patch', title: 'Üç tür değişiklik', what: 'Hangi değişiklik hangi yoldan gider, bunu bilmek en önemli şey.', changes: '1) VERİ YAMASI: birim/bina/ekonomi/medeniyet/metin dosyaları (Oyun Verisi sayfası) → uygulama güncellemesi gerekmez. 2) CANLI AYAR: bakım, zorunlu güncelleme, özellik şalterleri, duyurular, bayraklar → anında. 3) MAĞAZA GÜNCELLEMESİ: yalnızca yeni kod / yeni görsel-ses-model → App Store / Google Play.', how: ['Denge değiştirmek istiyorsanız: Oyun Verisi & Yamalar → dosyayı düzenle → Yayınla.', 'Oyunu geçici kapatmak istiyorsanız: Canlı Kontrol → Bakım modu.', 'Eski sürümü kullanmayı yasaklamak istiyorsanız: Canlı Kontrol → En düşük sürüm.'], when: 'Türüne göre değişir (aşağıdaki her maddede yazıyor).', href: '/dashboard/live-control', button: 'Canlı Kontrol\'e git' },
      { id: 'how-roles', title: 'Roller ve yetkiler', what: 'Herkes her şeyi yapamaz; her yöneticiye rolüne göre yetki verilir.', changes: 'Menüde yalnızca rolünüzün görebildiği sayfalar çıkar; yetkisiz işlem sunucuda reddedilir (tarayıcıyı kurcalamak işe yaramaz).', how: ['Yönetici Hesapları sayfasında roller ve açıklamaları listelenir.', 'Sahip / Süper yönetici her şeyi yapabilir.'], when: NOW, href: '/dashboard/admins', button: 'Yönetici hesapları', section: 'admins' },
    ],
  },
  {
    id: 'liveops',
    title: '1 · Oyunu güncelleme göndermeden değiştirme',
    intro: 'AoE4\'ün "sunucu taraflı yamaları" gibi: denge ve veri değişiklikleri küçük bir yama olarak oyunculara iner. Hatalı yamada tek tıkla eski sürüme dönersiniz.',
    items: [
      { id: 'data-balance', title: 'Birim / bina / teknoloji dengesi', what: 'Her birimin canı, saldırısı, zırhı, hızı, menzili, maliyeti, üretim süresi; binaların canı/maliyeti/inşa süresi; teknolojilerin etkileri.', changes: 'unit_balance, building_balance, tech_balance dosyaları. "Tablo" sekmesinde birimleri satır, istatistikleri sütun olarak görüp hücreye tıklayarak değiştirirsiniz; "Değişiklikler" sekmesi neyi değiştirdiğinizi gösterir.', how: ['Oyun Verisi & Yamalar → soldan "Denge" altındaki dosyayı seçin.', 'Tablo sekmesinde değeri değiştirin → "Taslağı kaydet".', 'Değişiklikler sekmesinde kontrol edin → sağ üstte "Yayınla" → not yazın.'], when: NEXT + ' Çok oyunculu maçlarda herkes aynı veriyle oynar; eski veriyle olan oyuncu yamayı otomatik indirmeden kuyruğa giremez.', href: '/dashboard/game-data', button: 'Denge dosyalarını aç', section: 'content' },
      { id: 'data-econ', title: 'Ekonomi, savaş, çağ ve zafer kuralları', what: 'Kaynak toplama hızları, karşı birim çarpanları, çağ atlama gereksinimleri, zafer koşulları, harita kuralları, paralı askerler.', changes: 'economy_balance, combat_balance, age_rules, victory_conditions, map_rules, mercenaries dosyaları.', how: ['Oyun Verisi & Yamalar → ilgili dosya → "Ağaç" sekmesi ile düzenleyin (arama kutusu ile alan bulun).', 'Taslağı kaydet → Yayınla.'], when: NEXT, href: '/dashboard/game-data', button: 'Dosyaları aç', section: 'content' },
      { id: 'data-civ', title: 'Medeniyetler', what: 'Medeniyetlerin bonusları, özel birimleri, başlangıç kaynakları ve binaları.', changes: 'Data/Civilizations altındaki medeniyet dosyaları ve civ_units / civ_landmarks.', how: ['Oyun Verisi & Yamalar → "Medeniyetler" grubu → dosyayı seçin.', 'Düzenleyip Yayınla.'], when: NEXT, href: '/dashboard/game-data', button: 'Medeniyetleri aç', section: 'content' },
      { id: 'data-text', title: 'Metinler ve diller', what: 'Oyundaki tüm yazılar (menüler, birim adları, ipuçları) tüm dillerde.', changes: 'Data/Localization/<dil>.json dosyaları. Çeviri hatasını ya da yeni metni güncelleme göndermeden düzeltirsiniz.', how: ['Oyun Verisi & Yamalar → "Metinler & diller" → dil dosyasını seçin → Ağaç sekmesinde arayıp değiştirin.', 'Yayınla.'], when: NEXT, href: '/dashboard/game-data', button: 'Dil dosyalarını aç', section: 'content' },
      { id: 'patch-history', title: 'Yama geçmişi ve geri alma', what: 'Her yayın numaralı bir yamadır; hatalı yamayı tek tıkla geri alırsınız.', changes: 'Aktif yama sürümü. Eski yamayı yeniden aktif etmek oyuncuları o sürüme döndürür.', how: ['Oyun Verisi & Yamalar → herhangi bir dosya → "Yama geçmişi" sekmesi → "Bu sürüme dön".'], when: NEXT + ' İstemci ayrıca bir güvenlik ağı taşır: bozuk yama oyunu iki kez üst üste çökertirse otomatik olarak yerleşik veriye döner.', href: '/dashboard/game-data', button: 'Yama geçmişi', section: 'content' },
      { id: 'maint', title: 'Bakım modu', what: 'Sunucuyu güncellerken ya da acil durumda oyunculara "bakımdayız" ekranı gösterir.', changes: 'Oyuncular açılışta bakım ekranını görür (çevrimdışı oynamaya devam edebilir). Türkçe/İngilizce mesaj ve otomatik bitiş saati verebilirsiniz.', how: ['Canlı Kontrol → Bakım modu → aç → mesajı yazın → Kaydet.'], when: NOW, href: '/dashboard/live-control', button: 'Bakım moduna git', section: 'live' },
      { id: 'force-update', title: 'Zorunlu / isteğe bağlı mağaza güncellemesi', what: 'Büyük değişiklikte eski sürümü kullananları güncellemeye yönlendirir.', changes: 'Platform başına "en düşük sürüm" (altı oyuna giremez, Güncelle ekranı görür) ve "son sürüm" (altına isteğe bağlı bildirim). Mağaza bağlantısı ve yenilik notu da buradan.', how: ['Canlı Kontrol → Güncelleme kapıları → platformu doldurun → Kaydet.', 'Önizleme kutusundan "0.1.0 sürümündeki oyuncu ne görür?" diye deneyin.'], when: NEXT, href: '/dashboard/live-control', button: 'Güncelleme kapıları', section: 'live' },
      { id: 'switches', title: 'Özellik şalterleri', what: 'Çok oyunculu, dereceli, mağaza, klan, arkadaş, liderlik, ödül, analitik, sohbet özelliklerini tek tek kapatıp açar.', changes: 'Örneğin ödeme sağlayıcısı bozulursa yalnızca mağazayı kapatırsınız; oyun çalışmaya devam eder.', how: ['Canlı Kontrol → Özellik şalterleri → anahtarı çevirin → Kaydet.'], when: NEXT, href: '/dashboard/live-control', button: 'Şalterlere git', section: 'live' },
      { id: 'news', title: 'Haber, açılış penceresi, şerit', what: 'Ana menüdeki "Haberler" kutusu, açılışta çıkan duyuru penceresi, menüde sabit şerit.', changes: 'Platform, sürüm ve tarih aralığına göre hedeflenebilir; Türkçe/İngilizce yazılır.', how: ['Duyurular & Haberler → Yeni duyuru → Yayınla.', 'Süresi dolan duyuru kendiliğinden kalkar.'], when: NEXT, href: '/dashboard/announcements', button: 'Duyuru yayınla', section: 'live' },
      { id: 'flags', title: 'Uzak ayarlar, bayraklar, A/B testi', what: 'Kod içindeki anahtar değerleri (sayılar, açık/kapalı bayraklar) sunucudan değiştirir; yeni özelliği kademeli açma ve A/B testi.', changes: 'Oyun kodunun okuduğu ayar anahtarları.', how: ['Uzak Ayarlar & Bayraklar sayfasında bayrak/ayar ekleyin ya da değiştirin.'], when: NEXT, href: '/dashboard/config', button: 'Uzak ayarlar', section: 'config', status: 'beta' },
      { id: 'seasons', title: 'Sezonlar, etkinlikler, Battle Pass, görevler', what: 'Dereceli sezonları, zamanlı etkinlikleri, Battle Pass ve görevleri yönetir.', changes: 'Sezon başlangıç/bitiş, ödül listeleri, etkinlik takvimi.', how: ['Canlı Etkinlikler menüsünden ilgili sayfayı açın.'], when: NEXT, href: '/dashboard/liveops', button: 'Canlı etkinlikler', section: 'liveops' },
      { id: 'store-catalog', title: 'Mağaza ürünleri ve fiyatlar', what: 'Satışa çıkan paketleri, fiyatlarını, içeriklerini (hangi medeniyet / eşya / para verir) ve görünürlüklerini yönetir.', changes: 'Ürün içeriği (para, içerik paketi, eşya, başlangıç bonusu) oyuncuya verilen şeyin kendisidir. Oyun satın almayı sunucuya bildirir, sunucu mağazaya (Google Play / App Store) sorup doğrulayınca içeriği verir; doğrulanamayan satın alma hiçbir şey vermez.', how: ['Mağaza Ürünleri → ürünü seçin → fiyat/içerik/aktiflik.'], when: NEXT, href: '/dashboard/store', button: 'Mağaza ürünleri', section: 'store' },
    ],
  },
  {
    id: 'grants',
    title: '2 · Oyunculara bir şey verme',
    intro: 'Kaynak, para, ücretli paket, eşya, başlangıç askeri/kaynağı ve XP — hepsi aynı "Ne verilsin?" formuyla. Her verme işlemi gerekçesiyle bakiye defterine ve denetim kaydına yazılır; yanlış verileni geri alabilirsiniz.',
    items: [
      { id: 'grant-direct', title: 'Tek oyuncuya anında verme', what: 'Seçtiğiniz oyuncuya hemen para/eşya/paket/bonus verir.', changes: 'Oyuncunun cüzdanı, envanteri, başlangıç bonusları. Çevrimiçiyse oyunu anında güncellenir.', how: ['Tüm Oyuncular → oyuncuyu açın → "Ekonomi & Verme" sekmesi.', 'Ne verileceğini seçin, gerekçe yazın → "Şimdi ver".'], when: NOW, href: '/dashboard/players', button: 'Oyuncu bul', section: 'grants' },
      { id: 'grant-pack', title: 'Ücretli paketi ücretsiz verme', what: 'Sultans Ascend, Dynasties of the East, Digital Deluxe vb. içerik paketlerini ödeme almadan oyuncuya açar.', changes: 'Oyuncunun envanterine "pack" eklenir; oyun o paketin medeniyetlerini ve kozmetiklerini açar. İsterseniz süreli (örn. 7 gün) verirsiniz.', how: ['Verme formunda "İçerik paketleri" bölümünden işaretleyin; süre boşsa kalıcıdır.'], when: NOW, href: '/dashboard/grants', button: 'Verme sayfası', section: 'grants' },
      { id: 'grant-start', title: 'Başlangıç kaynağı ve askeri', what: 'Oyuncunun kendi maçlarının başında ek yiyecek/odun/altın/taş ve ek asker verir.', changes: 'Oyuncunun "bonus" listesine eklenir; maç başlarken oyun uygular, her kullanımda sayaç azalır (örn. 3 maç). Varsayılan: yalnızca çevrimdışı/normal maçlar; dereceli için ayrıca işaretlemeniz gerekir.', how: ['Verme formu → "Başlangıç kaynakları" / "Başlangıç askerleri".'], when: 'Oyuncunun bir sonraki maçında.', href: '/dashboard/grants', button: 'Verme sayfası', section: 'grants' },
      { id: 'grant-mass', title: 'Kitleye hediye (posta kutusu)', what: 'Herkese ya da seçilen kitleye (platform, seviye, son N günde aktif, N+ gündür gelmeyen, ödeme yapan/yapmayan) hediye gönderir.', changes: 'Oyuncuların posta kutusuna hediye düşer; oyuncu "Al" deyince işlenir. Önizleme kaç kişinin alacağını önceden gösterir. Çift tıklama iki kez vermez.', how: ['Verme & Hediyeler → Kime? → Mesaj → Ne verilsin? → Gönder.'], when: NOW + ' Çevrimiçi olanlar anında bildirim alır.', href: '/dashboard/grants', button: 'Hediye gönder', section: 'grants' },
      { id: 'grant-undo', title: 'Geri alma ve bakiye defteri', what: 'Yanlış verilen eşyayı geri alır; her para hareketini kimin neden yaptığıyla listeler.', changes: 'Envanterden eşya düşer; defterde "revoke" satırı oluşur.', how: ['Oyuncu dosyası → Ekonomi & Verme → Envanter → "Geri al".'], when: NOW, href: '/dashboard/players', button: 'Oyuncu bul', section: 'grants' },
    ],
  },
  {
    id: 'players',
    title: '3 · Oyuncuları görme ve izleme',
    intro: 'Her oyuncunun tam dosyası: ne kadar oynamış, kaç maç, ne harcamış, hangi cihazdan ne zaman girmiş.',
    items: [
      { id: 'player-list', title: 'Oyuncu listesi ve filtreler', what: 'Tüm oyuncuları arama, sıralama ve filtreleme.', changes: 'Kullanıcı adı/e-posta/kimlik, platform, çevrimiçi, yasaklı, ödeme yapan, misafir, en az N saat oynamış; son görülme, oynama süresi, MMR, maç sayısına göre sıralama.', how: ['Tüm Oyuncular sayfası.'], when: 'Canlı veri.', href: '/dashboard/players', button: 'Oyuncular', section: 'players' },
      { id: 'player-file', title: 'Oyuncu dosyası', what: 'Tek oyuncunun her şeyi.', changes: 'Toplam ve oturum başına oynama süresi (menüde/maçta — sunucu ölçer, istemciye güvenilmez), maç geçmişi (mod/medeniyet/harita bazında), cüzdan, envanter, hediyeler, satın almalar, cihazlar, IP\'ler, aynı cihazı kullanan diğer hesaplar, hile bulguları, yasaklar, şikâyetler.', how: ['Listeden oyuncuya tıklayın; üstteki sekmelerde gezinin.'], when: 'Canlı veri.', href: '/dashboard/players', button: 'Oyuncu aç', section: 'players' },
      { id: 'online-now', title: 'Şu an çevrimiçi', what: 'Oyunu şu an açık olan herkes: menüde mi maçta mı, hangi platform, ne kadar süredir.', changes: '5 saniyede bir yenilenir; satırdan anında atabilir, herkese duyuru yapabilirsiniz.', how: ['Şu An Çevrimiçi sayfası.'], when: 'Canlı.', href: '/dashboard/online', button: 'Çevrimiçi oyuncular', section: 'players' },
      { id: 'summary', title: 'Genel özet', what: 'DAU/WAU/MAU, toplam oynama saati, gelir, platform/sürüm dağılımı, en çok seçilen medeniyetler.', changes: 'Yalnızca okunur.', how: ['Ana Sayfa.'], when: 'Canlı.', href: '/dashboard', button: 'Ana sayfa' },
      { id: 'matches-clans', title: 'Maçlar, liderlik, klanlar, arkadaşlıklar', what: 'Oynanan maçlar, sıralama tablosu, klan ve arkadaşlık yönetimi.', changes: 'İlgili listeler ve müdahale araçları.', how: ['Oyuncular menüsündeki ilgili sayfalar.'], when: 'Canlı veri.', href: '/dashboard/matches', button: 'Maç geçmişi', section: 'players', status: 'beta' },
    ],
  },
  {
    id: 'moderation',
    title: '4 · Moderasyon ve hile',
    intro: 'Atma ve yasaklama oyuna anında ulaşır: oyuncunun oyunu saniyeler içinde kapanır. Hile tespiti sunucuda otomatik çalışır, bulgular size canlı düşer.',
    items: [
      { id: 'kick', title: 'Oyundan atma (kick)', what: 'Oyuncuyu o anda oyundan çıkarır ve oturumlarını sonlandırır.', changes: 'İsteğe bağlı bekleme süresi ile kısa süreli yeniden girişi de engeller.', how: ['Şu An Çevrimiçi → satırda "At" ya da Oyuncu dosyası → Moderasyon → Oyundan at.'], when: 'Saniyeler içinde (oyuncu oyundayken anında).', href: '/dashboard/online', button: 'Çevrimiçi oyuncular', section: 'moderation' },
      { id: 'ban', title: 'Yasaklama: süreli, süresiz, yalnızca dereceli', what: 'Oyuncuyu oyundan tamamen engeller; neden ve kanıt kaydedilir, oyuncuya nedeni gösterilir.', changes: 'Giriş, yenileme ve çok oyunculu kuyruk kapanır; çevrimiçiyse oyun anında kapanır. Yalnızca dereceli yasak sadece dereceli kuyruğu kapatır. Yasak yanlışsa "Kaldır".', how: ['Banlar & Kickler → Hızlı işlem ya da Oyuncu dosyası → Moderasyon.'], when: 'Anında.', href: '/dashboard/bans', button: 'Banlar & Kickler', section: 'moderation' },
      { id: 'message', title: 'Oyuncuya / herkese mesaj', what: 'Oyuncunun ekranında açılan uyarı ya da duyuru penceresi.', changes: 'Tek oyuncu ya da şu an çevrimiçi olan herkes.', how: ['Şu An Çevrimiçi → "Herkese duyuru" ya da Oyuncu dosyası → Moderasyon → Mesaj.'], when: 'Anında.', href: '/dashboard/online', button: 'Duyuru yap', section: 'moderation' },
      { id: 'cheat-live', title: 'Hile Merkezi: canlı bulgular', what: 'Sunucunun otomatik hile tespitleri anında düşer (sağ üstte uyarı + burada).', changes: 'Her bulgunun kanıtı, kaynağı (IP, cihaz, sürüm, maç) ve oyuncunun diğer bulguları. Karar: yanlış alarm / uyar / at / süreli-kalıcı-dereceli yasak / cihaz+IP+hesap yasağı.', how: ['Hile Merkezi → bulguya tıklayın → karar → Uygula.'], when: 'Canlı.', href: '/dashboard/cheat-center', button: 'Hile Merkezi', section: 'cheat' },
      { id: 'cheat-what', title: 'Hile motoru neleri yakalar?', what: 'Değiştirilmiş oyun verisi (kesin kanıt), yalan maç sonucu, anormal galibiyet oranı, aşırı hızlı MMR artışı, galibiyet takası, aynı cihazda rakipler, yasak atlatma (yasaklının cihazında yeni hesap), oyunun kendi koruma bildirimleri (bellek değiştirme, kanca, hız hilesi), insan dışı komut hızı.', changes: 'Bulgu kaydı oluşturur; politika izin veriyorsa otomatik yaptırım uygular.', how: ['Politika sekmesinde her tür için önem ve otomatik cezayı değiştirirsiniz.'], when: 'Maç sonuçları geldikçe sürekli.', href: '/dashboard/cheat-center', button: 'Politikayı aç', section: 'cheat' },
      { id: 'cheat-auto', title: 'Otomatik yaptırım politikası', what: 'Hangi tür bulguda kimin otomatik cezalandırılacağı.', changes: 'Varsayılan: değiştirilmiş veri → 3 gün ban; yasak atlatma → kalıcı ban + cihaz engeli; tekrarlayan koruma ihlali → 3 gün ban; istatistiksel şüphelerde yalnızca bulgu (karar sizde). Yanlış alarmı "kapat" derseniz otomatik ceza kalkar.', how: ['Hile Merkezi → "Otomatik yaptırım politikası" sekmesi → değiştir → Kaydet.'], when: 'Yeni bulgulardan itibaren.', href: '/dashboard/cheat-center', button: 'Politika', section: 'cheat' },
      { id: 'device-ban', title: 'Cihaz ve IP yasağı', what: 'Yasaklı oyuncunun yeni hesap açmasını engeller.', changes: 'Engelli cihazdan/IP\'den hiçbir hesap oyuna giremez.', how: ['Hile Merkezi → Cihaz & IP yasakları.'], when: 'Anında.', href: '/dashboard/cheat-center', button: 'Cihaz yasakları', section: 'cheat' },
      { id: 'fraud', title: 'Dolandırıcılık ve şikâyetler', what: 'Ödeme/iade dolandırıcılığı sinyalleri ve oyuncu şikâyetleri.', changes: 'İnceleme kuyrukları.', how: ['Güvenlik & Moderasyon menüsü → Dolandırıcılık.'], when: 'Canlı.', href: '/dashboard/fraud', button: 'Dolandırıcılık', section: 'moderation', status: 'beta' },
    ],
  },
  {
    id: 'security',
    title: '5 · Güvenlik',
    intro: 'Panel ve sunucu sızmaya karşı sertleştirilmiştir. Burası, güvenliği izlediğiniz ve ayarladığınız yerdir.',
    items: [
      { id: 'sec-2fa', title: 'İki adımlı doğrulama ve parola', what: 'Giriş için telefondaki kod; yedek kodlar; parola politikası (≥12 karakter).', changes: 'Üretimde 2FA her yönetici için zorunludur; kurmadan panel açılmaz. Her girişte yeni oturum kimliği üretilir, parola değişince bütün oturumlar kapanır.', how: ['Hesabım → 2FA kur → QR kodu okut → kodu gir → yedek kodları kaydet.'], when: NOW, href: '/dashboard/account', button: 'Hesabım' },
      { id: 'sec-center', title: 'Güvenlik Merkezi', what: 'Girişler, hatalı denemeler, çalıntı oturum alarmları, saldırı imzaları; IP güvenlik duvarı; açık oturumlar.', changes: 'Şüpheli IP\'yi engeller, bir oturumu zorla kapatırsınız. Çok sayıda şüpheli istek gönderen IP otomatik engellenir (oyuncu trafiği etkilenmez).', how: ['Güvenlik Merkezi → Olaylar / IP güvenlik duvarı / Açık oturumlar.'], when: 'Canlı.', href: '/dashboard/security', button: 'Güvenlik Merkezi', section: 'security' },
      { id: 'sec-audit', title: 'Denetim kaydı', what: 'Panelden yapılan her değişikliğin kaydı: kim, ne zaman, hangi IP, hangi içerik (parola/belirteç gizlenir).', changes: 'Yalnızca okunur; silinemez.', how: ['Denetim Kaydı → arama ve alan filtresi.'], when: 'Canlı.', href: '/dashboard/audit', button: 'Denetim kaydı', section: 'security' },
      { id: 'sec-admins', title: 'Yönetici hesapları', what: 'Kimin panele girebildiği ve rolü.', changes: 'Yönetici ekleme, rol değiştirme, kapatma, parola/2FA sıfırlama (değişince o kişinin oturumları anında kapanır).', how: ['Yönetici Hesapları.'], when: NOW, href: '/dashboard/admins', button: 'Yöneticiler', section: 'admins' },
    ],
  },
  {
    id: 'comm',
    title: '6 · Ödemeler, destek, analitik ve operasyon',
    intro: 'Para, oyuncu desteği, raporlar ve sunucunun sağlığı.',
    items: [
      { id: 'pay', title: 'Ödemeler, iade, chargeback', what: 'Mağaza satın almalarının listesi, doğrulama durumu, gelir raporu, iade ve chargeback kayıtları.', changes: 'Doğrulanmamış bir ödemeyi destek ekibi elle onaylayabilir (ürün içeriği bir kez verilir); iade kaydı açarken ürün içeriğini (paket/eşya) oyuncudan geri alabilirsiniz.', how: ['Ödemeler → satın alma satırında "Elle onayla" / "İade".'], when: NOW, href: '/dashboard/payments', button: 'Ödemeler', section: 'payments' },
      { id: 'eco', title: 'Ekonomi', what: 'Dolaşımdaki para, kaynağa göre giren/çıkan miktarlar, en çok mücevheri olanlar.', changes: 'Yalnızca okunur; her hareket bakiye defterinden gelir.', how: ['Ekonomi sayfası.'], when: 'Canlı.', href: '/dashboard/economy', button: 'Ekonomi', section: 'players' },
      { id: 'support', title: 'Destek talepleri ve şikâyetler', what: 'Oyuncuların oyun içinden açtığı talepler ve oyuncu şikâyetleri.', changes: 'Yanıt yazma, kendinize atama, durum değiştirme, çözüldü olarak kapatma. Yanıtınız oyuncunun oyun içi destek ekranında görünür.', how: ['Destek Talepleri → talebi seçin → yanıtlayın.'], when: NOW, href: '/dashboard/support', button: 'Destek', section: 'support' },
      { id: 'legal', title: 'Yasal metinler ve gizlilik talepleri', what: 'Gizlilik politikası / kullanım şartları sürümleri; KVKK-GDPR veri erişim ve silme talepleri.', changes: 'Yayınlanan metin oyunda ilk açılışta gösterilir. "Sil" kişisel verileri gerçekten siler/anonimleştirir; "Dışa aktar" oyuncunun tüm verisini JSON olarak indirir. Oyuncu bunu oyundan da kendisi yapabilir.', how: ['Yasal & Gizlilik menüsü.'], when: NOW, href: '/dashboard/legal/texts', button: 'Yasal metinler', section: 'legal' },
      { id: 'analytics', title: 'Analitik ve raporlar', what: 'DAU, medeniyet seçimi, maç istatistikleri, büyüme, gelir, elde tutma (retention).', changes: 'Yalnızca okunur; hepsi veritabanındaki gerçek kayıtlardan hesaplanır.', how: ['Analitik menüsü.'], when: 'Canlı.', href: '/dashboard/analytics', button: 'Analitik', section: 'analytics' },
      { id: 'health', title: 'Sunucu sağlığı ve acil durum düğmeleri', what: 'CPU, bellek, veritabanı gecikmesi, hata oranı, çevrimiçi oyuncu, son yedek (hepsi ölçülmüş gerçek değerler) ve tek tıkla bakım / eşleştirme duraklatma / çevrimdışı moda alma / herkese mesaj.', changes: 'Bakım ve şalterler oyunculara anında yansır.', how: ['Sunucu Kontrolü & Acil Durum sayfası.'], when: NOW, href: '/dashboard/control', button: 'Sunucu kontrolü', section: 'system' },
      { id: 'backup', title: 'Yedekleme', what: 'Veritabanı yedeklerinin durumu: son yedek ne zaman, boyutu, başarısızlar.', changes: 'Yedeği sunucudaki yedekleme betiği alır ve buraya bildirir; yedek yoksa kırmızı uyarı çıkar.', how: ['Yedekleme sayfası.'], when: 'Betik çalıştıkça.', href: '/dashboard/backup', button: 'Yedekleme', section: 'backup' },
      { id: 'notif', title: 'Bildirimler ve kampanyalar', what: 'E-posta / SMS kampanyaları ve oyuncu bildirimleri.', changes: 'Gönderim ve hedefleme. (Sağlayıcı ayarları sunucuda yapılandırılmadan gerçek gönderim yapılmaz.)', how: ['İletişim & Destek menüsü.'], when: 'Gönderimde.', href: '/dashboard/notifications', button: 'Bildirimler', section: 'notifications', status: 'beta' },
      { id: 'tour', title: 'Turnuvalar', what: 'Turnuva kayıtları (tarih, kontenjan, ödül havuzu, durum).', changes: 'Yalnızca sunucu tarafı; oyun içi turnuva ekranı henüz yok.', how: ['Mağaza & Ekonomi → Turnuvalar.'], when: 'Oyun tarafı eklenince.', href: '/dashboard/tournaments', button: 'Turnuvalar', section: 'tournaments', status: 'beta' },
    ],
  },
];

/** Ideas a live-service strategy game operator usually wants next (honest roadmap, NOT yet built). */
export const ROADMAP = [
  'Eşleştirme ayarları paneli (derece penceresi, bekleme süresi, harita havuzu ve yasaklı haritalar) — şimdilik sunucu kodunda sabit.',
  'Maç tekrarı (replay) inceleme: bir maçı panelden izleme ve hile kanıtı olarak ekleme.',
  'Sohbet moderasyonu: yasaklı kelime listesi, susturma, sohbet kaydı.',
  'Turnuva ve özel oda yönetimi.',
  'Kademeli yayın: bir yamayı önce %5 oyuncuya açıp izleyerek yayma (staging kanalı altyapıda hazır, arayüzü yok).',
  'Oyun içi anket ve geri bildirim toplama.',
];

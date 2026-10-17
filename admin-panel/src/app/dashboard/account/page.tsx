'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { errorMessage, get, post } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/permissions';
import { fmtDate } from '@/lib/format';
import { Btn, Card, flashError, flashOk, Label, Notice, PageHeader, Pill, TextInput } from '@/components/kit/kit';

interface Me { id: string; email: string; name: string; role: string; twoFactorEnabled: boolean; lastLoginAt: string | null }

function Inner() {
  const sp = useSearchParams();
  const { data: session } = useSession();
  const limited = (session as { limited?: boolean } | null)?.limited;
  const me = useQuery({ queryKey: ['me'], queryFn: () => get<Me>('/admin-auth/me') });
  const [pw, setPw] = useState({ current: '', next: '', again: '' });
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [offPw, setOffPw] = useState(''); const [offCode, setOffCode] = useState('');

  useEffect(() => { if (sp.get('setup2fa') && me.data && !me.data.twoFactorEnabled && !setup) void startSetup.mutate(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [me.data]);

  const startSetup = useMutation({
    mutationFn: async () => { const r = await post<{ secret: string; otpauthUrl: string }>('/admin-auth/2fa/setup'); const QR = (await import('qrcode')).default; return { ...r, qr: await QR.toDataURL(r.otpauthUrl, { margin: 1, width: 220 }) }; },
    onSuccess: setSetup, onError: (e) => flashError(errorMessage(e)),
  });
  const enable = useMutation({ mutationFn: () => post<{ recoveryCodes: string[] }>('/admin-auth/2fa/enable', { code }), onSuccess: (r) => { setRecovery(r.recoveryCodes); flashOk('İki adımlı doğrulama açıldı.'); }, onError: (e) => flashError(errorMessage(e)) });
  const disable = useMutation({ mutationFn: () => post('/admin-auth/2fa/disable', { password: offPw, code: offCode }), onSuccess: () => { flashOk('Kapatıldı.'); void signOut({ callbackUrl: '/login' }); }, onError: (e) => flashError(errorMessage(e)) });
  const change = useMutation({ mutationFn: () => post('/admin-auth/change-password', { currentPassword: pw.current, newPassword: pw.next }), onSuccess: () => { flashOk('Parola değişti. Güvenlik için tüm oturumlar kapatıldı; yeniden giriş yapın.'); setTimeout(() => void signOut({ callbackUrl: '/login' }), 1500); }, onError: (e) => flashError(errorMessage(e)) });
  const outAll = useMutation({ mutationFn: () => post('/admin-auth/logout-all'), onSuccess: () => void signOut({ callbackUrl: '/login' }), onError: (e) => flashError(errorMessage(e)) });

  const weak = pw.next.length > 0 && (pw.next.length < 12 || !/[a-z]/.test(pw.next) || !/[A-Z]/.test(pw.next) || !/\d/.test(pw.next));
  return (
    <div className="space-y-6">
      <PageHeader title="Hesabım" subtitle="Parolanızı değiştirin, iki adımlı doğrulamayı (2FA) yönetin ve tüm cihazlardaki oturumlarınızı kapatın. Her giriş yeni bir oturum kimliği üretir; çıkış yapınca ya da parola değişince eski oturumlar anında geçersiz olur." />
      {limited && <Notice kind="warn"><b>İki adımlı doğrulama zorunlu.</b> Devam etmeden önce aşağıdan 2FA'yı etkinleştirmeniz gerekiyor.</Notice>}
      {me.data && <Card title="Profil"><dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm"><dt className="text-gray-500">Ad</dt><dd className="text-gray-200">{me.data.name}</dd><dt className="text-gray-500">E-posta</dt><dd className="text-gray-200">{me.data.email}</dd><dt className="text-gray-500">Rol</dt><dd><Pill tone="amber">{ROLE_LABEL[me.data.role] ?? me.data.role}</Pill></dd><dt className="text-gray-500">Son giriş</dt><dd className="text-gray-200">{fmtDate(me.data.lastLoginAt)}</dd><dt className="text-gray-500">2FA</dt><dd>{me.data.twoFactorEnabled ? <Pill tone="green">açık</Pill> : <Pill tone="red">kapalı</Pill>}</dd></dl></Card>}

      <Card title="İki adımlı doğrulama (2FA)">
        {recovery ? (
          <div className="space-y-3">
            <Notice kind="ok">2FA açıldı. Aşağıdaki <b>yedek kodları şimdi kaydedin</b> — bir daha gösterilmez. Telefonunuzu kaybederseniz her kod yalnızca bir kez kullanılabilir.</Notice>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-950 p-4 font-mono text-sm text-amber-300 md:grid-cols-5">{recovery.map((c) => <span key={c}>{c}</span>)}</div>
            <Btn onClick={() => void signOut({ callbackUrl: '/login' })}>Kodları kaydettim — yeniden giriş yap</Btn>
          </div>
        ) : me.data?.twoFactorEnabled ? (
          <div className="space-y-3"><p className="text-sm text-gray-400">2FA açık. Kapatmak için parolanızı ve güncel kodu girin{limited ? '' : ' (sunucuda zorunluysa kapatılamaz)'}.</p><div className="grid gap-3 md:grid-cols-3"><Label text="Parola"><TextInput type="password" value={offPw} onChange={(e) => setOffPw(e.target.value)} /></Label><Label text="Kod"><TextInput value={offCode} onChange={(e) => setOffCode(e.target.value)} maxLength={8} /></Label><div className="flex items-end"><Btn variant="danger" disabled={!offPw || !offCode || disable.isPending} onClick={() => disable.mutate()}>2FA'yı kapat</Btn></div></div></div>
        ) : setup ? (
          <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="2FA QR kodu" className="rounded-lg bg-white p-2" width={220} height={220} />
            <div className="space-y-3">
              <p className="text-sm text-gray-300">1) Google Authenticator / Authy / 1Password ile QR kodu okutun (ya da gizli anahtarı elle girin). 2) Uygulamadaki 6 haneli kodu aşağıya yazın.</p>
              <div className="break-all rounded bg-gray-950 p-2 font-mono text-xs text-gray-400">{setup.secret}</div>
              <div className="flex gap-3"><TextInput inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} className="w-40" /><Btn disabled={code.length !== 6 || enable.isPending} onClick={() => enable.mutate()}>Etkinleştir</Btn></div>
            </div>
          </div>
        ) : <Btn onClick={() => startSetup.mutate()} disabled={startSetup.isPending}>2FA'yı kur</Btn>}
      </Card>

      <Card title="Parolayı değiştir">
        <div className="grid gap-3 md:grid-cols-3">
          <Label text="Mevcut parola"><TextInput type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Label>
          <Label text="Yeni parola" hint="En az 12 karakter; büyük harf, küçük harf ve rakam içermeli."><TextInput type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Label>
          <Label text="Yeni parola (tekrar)"><TextInput type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} /></Label>
        </div>
        {weak && <p className="mt-2 text-xs text-amber-400">Parola yeterince güçlü değil.</p>}
        {pw.again && pw.again !== pw.next && <p className="mt-2 text-xs text-red-400">Parolalar aynı değil.</p>}
        <div className="mt-4"><Btn disabled={!pw.current || weak || !pw.next || pw.next !== pw.again || change.isPending} onClick={() => change.mutate()}>Parolayı değiştir</Btn></div>
      </Card>

      <Card title="Oturumlar"><p className="mb-3 text-sm text-gray-400">Başka bir cihazda açık kalan oturumlarınız olduğundan şüpheleniyorsanız hepsini kapatın.</p><Btn variant="danger" onClick={() => { if (confirm('Tüm cihazlardaki oturumlarınız kapatılsın mı?')) outAll.mutate(); }}>Tüm cihazlardan çıkış yap</Btn></Card>
    </div>
  );
}
export default function AccountPage() { return <Suspense fallback={<div className="text-gray-400">Yükleniyor…</div>}><Inner /></Suspense>; }

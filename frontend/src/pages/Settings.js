import React, { useEffect, useRef, useState } from 'react';
import { Copy, Sun, Moon, Bell, BellOff, LogOut, Heart, Shield, Sparkles, Check, Camera, Pencil } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import Avatar from '../components/Avatar';
import { api, storage } from '../lib/api';
import { compressImageFile } from '../lib/media';
import { getBatteryInfo } from '../lib/haptics';
import { subscribeToPush, unsubscribeFromPush, getPushSubscription } from '../lib/push';
import { toAccusativeCz } from '../lib/czech';

export default function Settings({ pair, refreshPair }) {
  const [theme, setTheme] = useState(storage.getTheme());
  const [notifyState, setNotifyState] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploadingMine, setUploadingMine] = useState(false);
  const [uploadingHers, setUploadingHers] = useState(false);
  const [battery, setBattery] = useState(null);
  const [serverPushConfigured, setServerPushConfigured] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const mineFileRef = useRef(null);
  const hersFileRef = useRef(null);

  useEffect(() => {
    getBatteryInfo().then(setBattery);
    
    // Check if already subscribed to push
    getPushSubscription().then((sub) => {
      setPushSubscribed(!!sub);
    });

    // Check if backend has VAPID keys configured
    fetch('/api/push/public-key')
      .then(r => r.json())
      .then(data => setServerPushConfigured(!!data?.configured))
      .catch(() => {});
  }, []);

  const role = storage.getRole();
  const isOwner = role === 'owner';
  const myPhoto = isOwner ? pair?.profile_photo_owner : pair?.profile_photo_partner;
  const partnerPhoto = isOwner ? pair?.profile_photo_partner : pair?.profile_photo_owner;
  const myName = isOwner ? pair?.owner_name : pair?.partner_name;
  const partnerName = isOwner ? pair?.partner_name : pair?.owner_name;

  function changeTheme(next) {
    setTheme(next);
    storage.setTheme(next);
    document.documentElement.dataset.theme = next;
  }

  async function copyCode() {
    if (!pair?.code) return;
    try {
      await navigator.clipboard.writeText(pair.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* fallback below */
    }
  }

  async function requestNotifications() {
    if (typeof Notification === 'undefined') return;

    const result = await Notification.requestPermission();
    setNotifyState(result);

    if (result === 'granted') {
      // Try to also subscribe to real push notifications
      try {
        await subscribeToPush();
        setPushSubscribed(true);
        new Notification('Pro Tebe 😍', {
          body: 'Notifikace povoleny. Budete upozorňováni na nové zprávy.',
          icon: '/icon-192.svg',
        });
      } catch (e) {
        // Fallback to simple local notification
        new Notification('Pro Tebe 😍', {
          body: 'Notifikace povoleny (push zatím nepodporován v tomto prohlížeči).',
          icon: '/icon-192.svg',
        });
      }
    }
  }

  async function togglePush() {
    if (pushSubscribed) {
      await unsubscribeFromPush();
      setPushSubscribed(false);
    } else {
      try {
        await subscribeToPush();
        setPushSubscribed(true);
      } catch (e) {
        alert('Push notifikace se nepodařilo zapnout: ' + e.message);
      }
    }
  }

  async function sendTestPush() {
    const token = storage.getToken();
    if (!token) return;

    setTestingPush(true);
    try {
      const res = await api.post('/push/test', { token });
      if (res.data?.success) {
        alert(`Testovací push odeslán! (${res.data.sent} z ${res.data.total_subscriptions})`);
      } else {
        alert(res.data?.message || 'Žádné odběry push notifikací zatím nejsou.');
      }
    } catch (e) {
      alert('Test push se nepodařilo odeslat: ' + (e.response?.data?.detail || e.message));
    } finally {
      setTestingPush(false);
    }
  }

  function unpair() {
    if (!window.confirm('Opravdu chceš odpojit toto zařízení? Data zůstanou na serveru.')) return;
    storage.clear();
    window.location.reload();
  }

  async function patchPair(payload) {
    const token = storage.getToken();
    if (!token) return;
    try {
      await api.patch(`/pair/${token}`, payload);
      if (refreshPair) await refreshPair();
    } catch {
      /* silent */
    }
  }

  async function handleMyPhoto(file) {
    if (!file) return;
    setUploadingMine(true);
    try {
      const dataUrl = await compressImageFile(file, { maxDim: 512, quality: 0.85 });
      const key = isOwner ? 'profile_photo_owner' : 'profile_photo_partner';
      await patchPair({ [key]: dataUrl });
    } finally {
      setUploadingMine(false);
    }
  }

  async function handlePartnerPhoto(file) {
    if (!file) return;
    setUploadingHers(true);
    try {
      const dataUrl = await compressImageFile(file, { maxDim: 512, quality: 0.85 });
      const key = isOwner ? 'profile_photo_partner' : 'profile_photo_owner';
      await patchPair({ [key]: dataUrl });
    } finally {
      setUploadingHers(false);
    }
  }

  async function saveName() {
    if (!draftName.trim()) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      const key = isOwner ? 'owner_name' : 'partner_name';
      await patchPair({ [key]: draftName.trim() });
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="min-h-screen pb-32">
      <PageHeader
        kicker="Nastavení"
        title="Náš prostor"
        subtitle="Vzhled, propojení, soukromí"
        testid="settings-header"
      />

      <div className="space-y-4 px-4">
        {/* Profile photos */}
        <GlassCard className="p-5" testid="profile-card">
          <div className="mb-4 text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--ink-soft)' }}>
            Naše tváře
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Mine */}
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <Avatar src={myPhoto} name={myName} size={76} testid="avatar-mine" />
                <button
                  onClick={() => mineFileRef.current?.click()}
                  data-testid="upload-mine-btn"
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full glass-strong tap"
                  aria-label="Změnit moji fotku"
                >
                  <Camera size={14} style={{ color: 'var(--rose)' }} />
                </button>
                <input
                  ref={mineFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden-file"
                  onChange={(e) => handleMyPhoto(e.target.files?.[0])}
                  data-testid="file-input-mine"
                />
              </div>
              <div className="mt-3 flex items-center gap-1">
                {editingName ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={(e) => e.key === 'Enter' && saveName()}
                    className="w-24 rounded-lg border bg-transparent px-2 py-0.5 text-center text-sm outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
                    data-testid="name-input"
                    disabled={savingName}
                  />
                ) : (
                  <>
                    <span className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
                      {myName || 'Já'}
                    </span>
                    <button
                      onClick={() => {
                        setDraftName(myName || '');
                        setEditingName(true);
                      }}
                      data-testid="edit-name-btn"
                      className="rounded-full p-1 tap"
                      aria-label="Změnit jméno"
                    >
                      <Pencil size={11} style={{ color: 'var(--ink-soft)' }} />
                    </button>
                  </>
                )}
              </div>
              {uploadingMine && (
                <div className="mt-1 text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                  Ukládám…
                </div>
              )}
            </div>

            {/* Hers */}
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <Avatar src={partnerPhoto} name={partnerName} size={76} testid="avatar-hers" />
                <button
                  onClick={() => hersFileRef.current?.click()}
                  data-testid="upload-hers-btn"
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full glass-strong tap"
                  aria-label="Změnit její fotku"
                >
                  <Camera size={14} style={{ color: 'var(--rose)' }} />
                </button>
                <input
                  ref={hersFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden-file"
                  onChange={(e) => handlePartnerPhoto(e.target.files?.[0])}
                  data-testid="file-input-hers"
                />
              </div>
              <div className="mt-3 text-[15px] font-medium" style={{ color: 'var(--rose)' }}>
                {partnerName || 'Michaelka'}
              </div>
              {uploadingHers && (
                <div className="mt-1 text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                  Ukládám…
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Pair info */}
        <GlassCard className="p-5" testid="pair-info-card">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'rgba(229,179,187,0.14)' }}>
              <Heart size={20} fill="currentColor" style={{ color: 'var(--rose)' }} />
            </div>
            <div>
              <div className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
                {pair?.owner_name || 'Já'} <span style={{ color: 'var(--ink-soft)' }}>&</span>{' '}
                <span style={{ color: 'var(--rose)' }}>{pair?.partner_name || 'Michaelka'}</span>
              </div>
              <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                Jsi přihlášen{role === 'partner' ? 'a' : ''} jako {role === 'partner' ? 'partner' : 'majitel'}
              </div>
            </div>
          </div>

          {isOwner && !pair?.partner_token && pair?.code && (
            <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'rgba(229,179,187,0.05)' }}>
              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--ink-soft)' }}>
                <Sparkles size={11} style={{ color: 'var(--rose)' }} />
                Pár kód pro {toAccusativeCz(pair?.partner_name) || 'Michaelku'}
              </div>
              <div className="flex items-center justify-between">
                <div
                  className="font-display text-4xl font-light tracking-[0.25em]"
                  style={{ color: 'var(--ink)' }}
                  data-testid="pair-code-display"
                >
                  {pair.code}
                </div>
                <button
                  onClick={copyCode}
                  data-testid="copy-code-btn"
                  className="flex h-10 w-10 items-center justify-center rounded-full glass tap"
                  aria-label="Kopírovat kód"
                >
                  {copied ? (
                    <Check size={16} style={{ color: 'var(--rose)' }} />
                  ) : (
                    <Copy size={14} style={{ color: 'var(--ink)' }} />
                  )}
                </button>
              </div>
              <div className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                Pošli jí tento kód. Otevře aplikaci, klepne na „Mám pár kód" a zadá ho. Tím se vaše dvě zařízení propojí.
              </div>
            </div>
          )}
          {isOwner && pair?.partner_token && (
            <div className="mt-4 text-xs" style={{ color: 'var(--ink-soft)' }}>
              {pair?.partner_name || 'Michaelka'} už je propojená ♡
            </div>
          )}
        </GlassCard>

        {/* Theme */}
        <GlassCard className="p-2">
          <div className="px-3 pt-3 pb-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--ink-soft)' }}>
            Vzhled
          </div>
          <div className="flex gap-2 p-2">
            <ThemeOption
              label="Tichá noc"
              icon={<Moon size={14} />}
              active={theme === 'dark'}
              onClick={() => changeTheme('dark')}
              testid="theme-dark-btn"
            />
            <ThemeOption
              label="Měkké světlo"
              icon={<Sun size={14} />}
              active={theme === 'light'}
              onClick={() => changeTheme('light')}
              testid="theme-light-btn"
            />
          </div>
        </GlassCard>

        {/* Notifications */}
        <GlassCard className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(229,179,187,0.12)' }}>
              {notifyState === 'granted' ? (
                <Bell size={16} style={{ color: 'var(--rose)' }} />
              ) : (
                <BellOff size={16} style={{ color: 'var(--ink-soft)' }} />
              )}
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
                Notifikace
              </div>
              <div className="text-xs leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {notifyState === 'granted'
                  ? 'Jemně budu připomínat výročí, nové zprávy a vzpomínky.'
                  : notifyState === 'denied'
                  ? 'Notifikace jsi zakázal/a. Můžeš je povolit v nastavení prohlížeče.'
                  : notifyState === 'unsupported'
                  ? 'Tento prohlížeč notifikace nepodporuje.'
                  : 'Povol prosím notifikace, ať tě můžu jemně upozornit.'}
              </div>
            </div>
            {notifyState !== 'granted' && notifyState !== 'unsupported' && notifyState !== 'denied' && (
              <button
                onClick={requestNotifications}
                data-testid="enable-notifications-btn"
                className="rounded-2xl px-3 py-2 text-xs tap"
                style={{ background: 'rgba(229,179,187,0.18)', color: 'var(--ink)' }}
              >
                Povolit
              </button>
            )}
          </div>

          {/* Real Push Notifications toggle */}
          {notifyState === 'granted' && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    Push notifikace
                    {serverPushConfigured ? (
                      <span className="ml-1 text-[10px] text-emerald-400">● server OK</span>
                    ) : (
                      <span className="ml-1 text-[10px] text-amber-400">● server bez klíčů</span>
                    )}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                    {pushSubscribed 
                      ? 'Dostáváte upozornění i mimo aplikaci.' 
                      : 'Zapněte pro upozornění na nové zprávy.'}
                  </div>
                </div>
                <button
                  onClick={togglePush}
                  className="rounded-xl px-4 py-1.5 text-xs font-medium tap"
                  style={{
                    background: pushSubscribed 
                      ? 'rgba(229,179,187,0.2)' 
                      : 'rgba(229,179,187,0.9)',
                    color: pushSubscribed ? 'var(--rose)' : '#1B0E14'
                  }}
                >
                  {pushSubscribed ? 'Vypnout' : 'Zapnout'}
                </button>
              </div>

              {pushSubscribed && serverPushConfigured && (
                <button
                  onClick={sendTestPush}
                  disabled={testingPush}
                  className="mt-3 w-full rounded-xl py-2 text-xs font-medium tap disabled:opacity-60"
                  style={{ background: 'rgba(229,179,187,0.12)', color: 'var(--ink)' }}
                >
                  {testingPush ? 'Odesílám test...' : 'Odeslat testovací push notifikaci'}
                </button>
              )}
            </div>
          )}
        </GlassCard>

        {/* Battery status (native Battery API) */}
        {battery && (
          <GlassCard className="p-4">
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: 'var(--ink-soft)' }}>Baterie zařízení</span>
              <span style={{ color: 'var(--ink)' }}>
                {battery.level}% {battery.charging ? '⚡ nabíjí' : ''}
              </span>
            </div>
          </GlassCard>
        )}

        {/* Privacy info */}
        <GlassCard className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(229,179,187,0.12)' }}>
              <Shield size={16} style={{ color: 'var(--rose)' }} />
            </div>
            <div>
              <div className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
                Soukromí
              </div>
              <div className="text-xs leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                Bez profilů, bez hesel, bez sociálních sítí. Aplikace si pamatuje jen vás dva přes anonymní token v
                tomto zařízení.
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Unpair */}
        <GlassCard className="p-2">
          <button
            onClick={unpair}
            data-testid="unpair-btn"
            className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left tap"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(255,80,100,0.10)' }}>
                <LogOut size={16} style={{ color: '#F5A0AA' }} />
              </div>
              <div>
                <div className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
                  Odpojit zařízení
                </div>
                <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                  Data zůstanou — můžeš se znovu připojit kódem.
                </div>
              </div>
            </div>
          </button>
        </GlassCard>

        <div className="px-1 pt-2 text-center text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--ink-soft)' }}>
          Pro Tebe · v1.2 · ♡
        </div>
      </div>
    </div>
  );
}

function ThemeOption({ label, icon, active, onClick, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm tap"
      style={{
        background: active ? 'rgba(229,179,187,0.18)' : 'rgba(255,255,255,0.04)',
        color: active ? 'var(--ink)' : 'var(--ink-soft)',
        border: `1px solid ${active ? 'rgba(229,179,187,0.32)' : 'transparent'}`,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

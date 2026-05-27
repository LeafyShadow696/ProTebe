import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Sun, Moon, Bell, BellOff, LogOut, Heart, Shield, Sparkles, Check } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import { storage } from '../lib/api';

export default function Settings({ pair, refreshPair }) {
  const [theme, setTheme] = useState(storage.getTheme());
  const [notifyState, setNotifyState] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [copied, setCopied] = useState(false);
  const role = storage.getRole();

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
    if (Notification.permission === 'granted') {
      new Notification('Pro Tebe 😍', { body: 'Notifikace už jsou povolené ♡', icon: '/icon-192.svg' });
      return;
    }
    const result = await Notification.requestPermission();
    setNotifyState(result);
    if (result === 'granted') {
      new Notification('Pro Tebe 😍', {
        body: 'Budu tě jemně upozorňovat na výročí a nové vzkazy.',
        icon: '/icon-192.svg',
      });
    }
  }

  function unpair() {
    if (!window.confirm('Opravdu chceš odpojit toto zařízení? Data zůstanou na serveru.')) return;
    storage.clear();
    window.location.reload();
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

          {role === 'owner' && !pair?.partner_token && pair?.code && (
            <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'rgba(229,179,187,0.05)' }}>
              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--ink-soft)' }}>
                <Sparkles size={11} style={{ color: 'var(--rose)' }} />
                Pár kód pro Michaelku
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
          {role === 'owner' && pair?.partner_token && (
            <div className="mt-4 text-xs" style={{ color: 'var(--ink-soft)' }}>
              Michaelka už je propojená ♡
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
        </GlassCard>

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
          Pro Tebe · v1.1 · ♡
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

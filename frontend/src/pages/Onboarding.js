import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Users, Sparkles, ArrowRight, KeyRound } from 'lucide-react';
import { api, storage } from '../lib/api';
import GlassCard from '../components/GlassCard';

/**
 * First-run experience: choose role (create new pair as owner, or join with code).
 * Anonymous pair-token model — no email, no password.
 */
export default function Onboarding({ onReady }) {
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [ownerName, setOwnerName] = useState('');
  const [partnerName, setPartnerName] = useState('Michaelka');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('Michaelka');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/pair/create', {
        owner_name: ownerName.trim() || 'Já',
        partner_name: partnerName.trim() || 'Michaelka',
        anniversary: '2026-04-03',
      });
      storage.setToken(data.owner_token);
      storage.setPair(data);
      storage.setRole('owner');
      onReady(data);
    } catch (e) {
      setError('Nepodařilo se vytvořit pár. Zkus to prosím znovu.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/pair/join', {
        code: joinCode.trim().toUpperCase(),
        joiner_name: joinName.trim() || 'Michaelka',
      });
      // If pair was already complete and we re-joined, we still get back the pair.
      // We'll trust partner_token. If null (shouldn't happen), fall back to owner_token.
      const token = data.partner_token || data.owner_token;
      storage.setToken(token);
      storage.setPair(data);
      storage.setRole(data.partner_token ? 'partner' : 'owner');
      onReady(data);
    } catch (e) {
      if (e?.response?.status === 404) setError('Tento kód jsem nenašel. Zkontroluj prosím písmena.');
      else setError('Něco se nepovedlo. Zkus to znovu, prosím.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-6 pt-safe pb-safe">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-1 flex-col justify-center"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl glass-strong"
          >
            <Heart size={28} style={{ color: 'var(--rose)' }} fill="currentColor" />
          </motion.div>
          <p
            className="text-[11px] uppercase tracking-[0.32em]"
            style={{ color: 'var(--ink-soft)' }}
          >
            Remix
          </p>
          <h1
            className="mt-2 font-display text-5xl font-light leading-[1.05] tracking-tight"
            style={{ color: 'var(--ink)' }}
          >
            Srdce pro
            <br />
            <em className="not-italic" style={{ color: 'var(--rose)' }}>
              Michaelku
            </em>
          </h1>
          <p
            className="mx-4 mt-4 text-[15px] leading-relaxed"
            style={{ color: 'var(--ink-soft)' }}
          >
            Náš tichý prostor — vzpomínky, slova, místa a chvíle. Bez profilů, bez hesel. Jen my dva.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!mode && (
            <motion.div
              key="choice"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              <button
                data-testid="onboard-create-btn"
                onClick={() => setMode('create')}
                className="group flex w-full items-center justify-between rounded-3xl glass-strong px-5 py-4 text-left tap"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'rgba(229,179,187,0.15)' }}>
                    <Sparkles size={20} style={{ color: 'var(--rose)' }} />
                  </div>
                  <div>
                    <div className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
                      Vytvořit nový pár
                    </div>
                    <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                      Pro tebe — pozveš Michaelku přes kód
                    </div>
                  </div>
                </div>
                <ArrowRight size={18} style={{ color: 'var(--ink-soft)' }} />
              </button>

              <button
                data-testid="onboard-join-btn"
                onClick={() => setMode('join')}
                className="group flex w-full items-center justify-between rounded-3xl glass-strong px-5 py-4 text-left tap"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <KeyRound size={20} style={{ color: 'var(--ink)' }} />
                  </div>
                  <div>
                    <div className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
                      Mám pár kód
                    </div>
                    <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                      Připojit se k existujícímu páru
                    </div>
                  </div>
                </div>
                <ArrowRight size={18} style={{ color: 'var(--ink-soft)' }} />
              </button>
            </motion.div>
          )}

          {mode === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-5">
                <p className="mb-4 text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--ink-soft)' }}>
                  Pojmenuj nás
                </p>
                <Field
                  label="Tvé jméno"
                  value={ownerName}
                  onChange={setOwnerName}
                  placeholder="např. Honza"
                  testid="input-owner-name"
                />
                <Field
                  label="Její jméno"
                  value={partnerName}
                  onChange={setPartnerName}
                  placeholder="Michaelka"
                  testid="input-partner-name"
                />
                <div className="mt-2 mb-4 text-xs" style={{ color: 'var(--ink-soft)' }}>
                  Den seznámení: <span style={{ color: 'var(--ink)' }}>3. dubna 2026</span>
                </div>
                {error && <ErrorText>{error}</ErrorText>}
                <div className="flex gap-2">
                  <SecondaryButton onClick={() => setMode(null)}>Zpět</SecondaryButton>
                  <PrimaryButton onClick={handleCreate} loading={loading} testid="onboard-create-submit">
                    Vytvořit
                  </PrimaryButton>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {mode === 'join' && (
            <motion.div
              key="join"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-5">
                <p className="mb-4 text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--ink-soft)' }}>
                  Pár kód
                </p>
                <Field
                  label="Kód od něj"
                  value={joinCode}
                  onChange={(v) => setJoinCode(v.toUpperCase())}
                  placeholder="6 znaků"
                  testid="input-join-code"
                  uppercase
                />
                <Field
                  label="Tvé jméno"
                  value={joinName}
                  onChange={setJoinName}
                  placeholder="Michaelka"
                  testid="input-join-name"
                />
                {error && <ErrorText>{error}</ErrorText>}
                <div className="flex gap-2">
                  <SecondaryButton onClick={() => setMode(null)}>Zpět</SecondaryButton>
                  <PrimaryButton onClick={handleJoin} loading={loading} testid="onboard-join-submit">
                    Připojit se
                  </PrimaryButton>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-8 text-center text-[11px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          <Users size={11} className="mr-1 inline" /> Anonymní propojení dvou zařízení. Data zůstávají mezi vámi dvěma.
        </p>
      </motion.div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, testid, uppercase }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--ink-soft)' }}>
        {label}
      </span>
      <input
        data-testid={testid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-2xl border bg-transparent px-4 py-3 text-[15px] outline-none ring-rose ${
          uppercase ? 'tracking-[0.3em]' : ''
        }`}
        style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
      />
    </label>
  );
}

function PrimaryButton({ children, onClick, loading, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      disabled={loading}
      className="flex-1 rounded-2xl px-5 py-3 text-[15px] font-medium tap disabled:opacity-60"
      style={{
        background: 'linear-gradient(180deg, #E5B3BB 0%, #C77A8A 100%)',
        color: '#1B0E14',
        boxShadow: '0 6px 24px rgba(229,179,187,0.25)',
      }}
    >
      {loading ? '…' : children}
    </button>
  );
}

function SecondaryButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl px-5 py-3 text-[15px] font-medium tap"
      style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--ink-soft)' }}
    >
      {children}
    </button>
  );
}

function ErrorText({ children }) {
  return (
    <div className="mb-3 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(255,80,100,0.08)', color: '#F5A0AA' }}>
      {children}
    </div>
  );
}

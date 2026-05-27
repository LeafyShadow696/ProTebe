import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Pin, Heart, X, Lock, Unlock, Clock } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { api, storage } from '../lib/api';
import { toAccusativeCz } from '../lib/czech';
import { formatCzechDate } from '../lib/dates';
import { useSheetLock } from '../lib/hooks';

const REACTIONS = ['❤️', '😊', '🥺', '🔥', '🌹'];
const POLL_INTERVAL = 4000;

// Quick presets for Time Capsule unlock dates.
const CAPSULE_PRESETS = [
  { key: 'week', label: 'Za týden', days: 7 },
  { key: 'month', label: 'Za měsíc', days: 30 },
  { key: 'three', label: 'Za 3 měsíce', days: 90 },
  { key: 'half', label: 'Za půl roku', days: 180 },
  { key: 'year', label: 'Za rok', days: 365 },
];

function addDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isLocked(msg, now = new Date()) {
  if (!msg?.unlock_date) return false;
  // unlock_date is YYYY-MM-DD; unlock at start of that day UTC.
  const [y, m, d] = msg.unlock_date.split('-').map(Number);
  if (!y) return false;
  return new Date(Date.UTC(y, m - 1, d)).getTime() > now.getTime();
}

function daysUntil(isoDate, now = new Date()) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1, d));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.max(0, Math.round((target - today) / (1000 * 60 * 60 * 24)));
}

export default function Messages({ pair }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [pickerFor, setPickerFor] = useState(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [tone, setTone] = useState('loving');
  const [capsuleDate, setCapsuleDate] = useState(null);
  const [showCapsule, setShowCapsule] = useState(false);
  // Tick once a minute so locked messages auto-unlock without a reload.
  const [, setMinuteTick] = useState(0);
  const listRef = useRef(null);
  const meToken = storage.getToken();
  const role = storage.getRole();

  // Hide bottom tab bar whenever any inline sheet/popover is open.
  useSheetLock(showSuggest || pickerFor !== null);

  // Realtime polling — simple but reliable.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      if (!pair?.id) return;
      try {
        const { data } = await api.get(`/messages/${pair.id}`);
        if (!cancelled) setMessages(data);
      } catch {
        /* silent */
      }
    }
    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pair?.id]);

  // Re-render once a minute so capsule countdowns stay fresh.
  useEffect(() => {
    const id = setInterval(() => setMinuteTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll on new messages.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const pinned = useMemo(() => messages.filter((m) => m.pinned && !isLocked(m)), [messages]);

  async function sendMessage(content) {
    const t = (content ?? text).trim();
    if (!t || sending) return;
    setSending(true);
    const myName = role === 'partner' ? pair.partner_name : pair.owner_name;
    const optimistic = {
      id: `tmp-${Date.now()}`,
      pair_id: pair.id,
      sender_token: meToken,
      sender_name: myName,
      text: t,
      pinned: false,
      reaction: null,
      unlock_date: capsuleDate,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    const sentCapsule = capsuleDate;
    setCapsuleDate(null);
    try {
      const { data } = await api.post('/messages', {
        pair_id: pair.id,
        sender_token: meToken,
        sender_name: myName,
        text: t,
        unlock_date: sentCapsule,
      });
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? data : m)));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  }

  async function togglePin(msg) {
    const next = !msg.pinned;
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, pinned: next } : m)));
    try {
      await api.patch(`/messages/${msg.id}`, { pinned: next });
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, pinned: !next } : m)));
    }
  }

  async function setReaction(msg, emoji) {
    const next = msg.reaction === emoji ? '' : emoji;
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, reaction: next || null } : m)));
    setPickerFor(null);
    try {
      await api.patch(`/messages/${msg.id}`, { reaction: next });
    } catch {
      /* silent */
    }
  }

  async function fetchSuggestion() {
    setSuggesting(true);
    try {
      const { data } = await api.post('/ai/message', {
        partner_name: pair?.partner_name || 'Michaelka',
        tone,
      });
      setSuggestion((data?.text || '').trim());
    } catch {
      setSuggestion('Nepodařilo se vymyslet odpověď.');
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        kicker="Vzkazovník"
        title="Naše slova"
        subtitle={`Pošli vzkaz pro ${toAccusativeCz(pair?.partner_name) || 'Michaelku'}`}
        testid="messages-header"
      />

      {pinned.length > 0 && (
        <div className="mb-2 px-4">
          <div className="rounded-2xl glass px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--ink-soft)' }}>
              <Pin size={11} /> Připnuto
            </div>
            <div className="space-y-1">
              {pinned.slice(0, 2).map((m) => (
                <div key={m.id} className="line-clamp-2 text-sm" style={{ color: 'var(--ink)' }}>
                  „{m.text}"
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div
        ref={listRef}
        className="scroll-y no-scrollbar flex-1 space-y-2 px-4 pb-4 pt-2"
        style={{ minHeight: 0 }}
        data-testid="messages-list"
      >
        {messages.length === 0 ? (
          <div className="mt-12 text-center" data-testid="messages-empty">
            <Heart size={28} className="mx-auto mb-3 opacity-50" style={{ color: 'var(--rose)' }} />
            <p className="font-display text-2xl font-light" style={{ color: 'var(--ink)' }}>
              Zatím tichá konverzace.
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
              Napiš první slova — ona je uvidí, až se příště podívá.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_token === meToken;
            return (
              <Bubble
                key={m.id}
                mine={mine}
                msg={m}
                onPin={() => togglePin(m)}
                onReact={() => setPickerFor(m.id)}
              />
            );
          })
        )}
      </div>

      <div className="px-4 pb-[110px]">
        {capsuleDate && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-2 flex items-center justify-between rounded-2xl px-3 py-2"
            style={{
              background: 'rgba(229,179,187,0.10)',
              border: '1px solid rgba(229,179,187,0.30)',
            }}
            data-testid="capsule-indicator"
          >
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--ink)' }}>
              <Lock size={12} style={{ color: 'var(--rose)' }} />
              Časová kapsle — otevře se{' '}
              <span style={{ color: 'var(--rose)' }}>{formatCzechDate(capsuleDate)}</span>
            </div>
            <button
              onClick={() => setCapsuleDate(null)}
              className="rounded-full p-1 tap"
              aria-label="Zrušit kapsli"
              data-testid="capsule-clear-btn"
            >
              <X size={12} style={{ color: 'var(--ink-soft)' }} />
            </button>
          </motion.div>
        )}

        <div className="flex items-end gap-2 rounded-3xl glass-strong px-3 py-2.5">
          <button
            onClick={() => setShowSuggest(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full tap"
            style={{ background: 'rgba(229,179,187,0.16)', color: 'var(--rose)' }}
            aria-label="Návrh AI"
            data-testid="ai-suggest-btn"
          >
            <Sparkles size={16} />
          </button>
          <button
            onClick={() => setShowCapsule(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full tap"
            style={{
              background: capsuleDate ? 'rgba(229,179,187,0.28)' : 'rgba(255,255,255,0.06)',
              color: capsuleDate ? 'var(--rose)' : 'var(--ink-soft)',
            }}
            aria-label="Časová kapsle"
            data-testid="capsule-btn"
          >
            <Lock size={15} />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            placeholder={capsuleDate ? 'Napiš zprávu do budoucna…' : 'Napiš něco hezkého…'}
            data-testid="message-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            className="max-h-32 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] outline-none"
            style={{ color: 'var(--ink)' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!text.trim() || sending}
            data-testid="send-btn"
            aria-label="Odeslat"
            className="flex h-9 w-9 items-center justify-center rounded-full tap disabled:opacity-40"
            style={{
              background: 'linear-gradient(180deg, #E5B3BB 0%, #C77A8A 100%)',
              color: '#1B0E14',
            }}
          >
            <Send size={15} />
          </button>
        </div>
      </div>

      {/* Reaction picker */}
      <AnimatePresence>
        {pickerFor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPickerFor(null)}
            className="fixed inset-0 z-40 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="flex gap-2 rounded-full glass-strong px-3 py-2"
              data-testid="reaction-picker"
            >
              {REACTIONS.map((emoji) => {
                const msg = messages.find((m) => m.id === pickerFor);
                return (
                  <button
                    key={emoji}
                    onClick={() => setReaction(msg, emoji)}
                    className="flex h-12 w-12 items-center justify-center rounded-full text-2xl tap"
                    data-testid={`reaction-${emoji}`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI suggestion modal */}
      <AnimatePresence>
        {showSuggest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSuggest(false)}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[480px] rounded-t-3xl glass-strong p-5 pb-safe"
              data-testid="ai-suggest-sheet"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} style={{ color: 'var(--rose)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    Návrh slov
                  </span>
                </div>
                <button onClick={() => setShowSuggest(false)} className="rounded-full p-1 tap" aria-label="Zavřít">
                  <X size={16} style={{ color: 'var(--ink-soft)' }} />
                </button>
              </div>
              <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar">
                {[
                  ['loving', 'Něžně'],
                  ['playful', 'Hravě'],
                  ['reassuring', 'Uklidňuju'],
                  ['thankful', 'Děkuju'],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setTone(k)}
                    className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs tap"
                    style={{
                      background:
                        tone === k ? 'rgba(229,179,187,0.18)' : 'rgba(255,255,255,0.04)',
                      color: tone === k ? 'var(--ink)' : 'var(--ink-soft)',
                      border: `1px solid ${tone === k ? 'rgba(229,179,187,0.3)' : 'transparent'}`,
                    }}
                    data-testid={`tone-${k}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div
                className="min-h-[80px] rounded-2xl px-4 py-3 text-[15px] leading-relaxed"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--ink)' }}
                data-testid="ai-suggestion-text"
              >
                {suggesting ? 'Hledám slova…' : suggestion || 'Klepni níže a já zkusím něco napsat.'}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={fetchSuggestion}
                  disabled={suggesting}
                  className="flex-1 rounded-2xl glass px-4 py-3 text-sm tap"
                  style={{ color: 'var(--ink)' }}
                  data-testid="ai-suggest-generate"
                >
                  {suggesting ? '…' : suggestion ? 'Zkusit jinak' : 'Vymysli něco'}
                </button>
                <button
                  onClick={() => {
                    if (suggestion) setText(suggestion);
                    setShowSuggest(false);
                  }}
                  disabled={!suggestion}
                  className="flex-1 rounded-2xl px-4 py-3 text-sm font-medium tap disabled:opacity-40"
                  style={{
                    background: 'linear-gradient(180deg, #E5B3BB 0%, #C77A8A 100%)',
                    color: '#1B0E14',
                  }}
                  data-testid="ai-suggest-use"
                >
                  Použít
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Time capsule picker */}
      <AnimatePresence>
        {showCapsule && (
          <CapsuleSheet
            current={capsuleDate}
            onClose={() => setShowCapsule(false)}
            onPick={(date) => {
              setCapsuleDate(date);
              setShowCapsule(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Bubble({ mine, msg, onPin, onReact }) {
  const locked = isLocked(msg);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
      data-testid={`message-${msg.id}`}
    >
      <div className={`relative max-w-[78%] ${mine ? 'items-end' : 'items-start'}`}>
        {locked ? (
          <LockedBubble mine={mine} msg={msg} />
        ) : (
          <div
            className="rounded-[22px] px-4 py-2.5 text-[15px] leading-snug"
            style={
              mine
                ? {
                    background: 'linear-gradient(180deg, #E5B3BB 0%, #C77A8A 100%)',
                    color: '#1B0E14',
                    borderTopRightRadius: 8,
                  }
                : {
                    background: 'rgba(255,255,255,0.06)',
                    color: 'var(--ink)',
                    borderTopLeftRadius: 8,
                    border: '1px solid var(--border)',
                  }
            }
          >
            {msg.text}
            {msg.unlock_date && (
              <div
                className="mt-1 flex items-center gap-1 text-[10px] opacity-70"
                style={mine ? { color: '#1B0E14' } : { color: 'var(--ink-soft)' }}
              >
                <Unlock size={10} /> kapsle otevřena {formatCzechDate(msg.unlock_date)}
              </div>
            )}
          </div>
        )}
        {msg.reaction && !locked && (
          <div
            className={`absolute -bottom-2 ${mine ? 'left-1' : 'right-1'} rounded-full px-1.5 py-0.5 text-xs`}
            style={{ background: 'rgba(0,0,0,0.5)' }}
            data-testid={`reaction-shown-${msg.id}`}
          >
            {msg.reaction}
          </div>
        )}
        {!locked && (
          <div className="mt-1 flex gap-2 px-1 text-[10px]" style={{ color: 'var(--ink-soft)' }}>
            <button onClick={onReact} className="tap" data-testid={`react-btn-${msg.id}`}>
              reagovat
            </button>
            <button onClick={onPin} className="tap" data-testid={`pin-btn-${msg.id}`}>
              {msg.pinned ? 'odepnout' : 'připnout'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function LockedBubble({ mine, msg }) {
  const remaining = daysUntil(msg.unlock_date);
  return (
    <div
      className="rounded-[22px] px-4 py-3 text-[14px] leading-snug"
      style={{
        background: mine
          ? 'linear-gradient(180deg, rgba(229,179,187,0.25) 0%, rgba(199,122,138,0.25) 100%)'
          : 'rgba(255,255,255,0.04)',
        border: `1px dashed ${mine ? 'rgba(229,179,187,0.55)' : 'var(--border)'}`,
        color: 'var(--ink-soft)',
        borderTopRightRadius: mine ? 8 : undefined,
        borderTopLeftRadius: mine ? undefined : 8,
      }}
      data-testid={`locked-${msg.id}`}
    >
      <div className="mb-1 flex items-center gap-2">
        <Lock size={13} style={{ color: 'var(--rose)' }} />
        <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--rose)' }}>
          {mine ? 'Tvoje kapsle' : 'Kapsle od tebe'}
        </span>
      </div>
      <div className="font-display text-[20px] font-light" style={{ color: 'var(--ink)' }}>
        {mine ? 'Čeká pro ni' : 'Tajemství'}
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs" style={{ color: 'var(--ink-soft)' }}>
        <Clock size={11} />
        Otevře se {formatCzechDate(msg.unlock_date)} ·{' '}
        {remaining === 0 ? 'dnes' : `za ${remaining} ${remaining === 1 ? 'den' : remaining < 5 ? 'dny' : 'dní'}`}
      </div>
    </div>
  );
}

function CapsuleSheet({ current, onClose, onPick }) {
  const [customDate, setCustomDate] = useState(current || addDaysIso(30));
  useSheetLock(true);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ y: 120 }}
        animate={{ y: 0 }}
        exit={{ y: 120 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-t-3xl glass-strong p-5 pb-safe"
        data-testid="capsule-sheet"
      >
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={16} style={{ color: 'var(--rose)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              Časová kapsle
            </span>
          </div>
          <button onClick={onClose} className="rounded-full p-1 tap" aria-label="Zavřít">
            <X size={16} style={{ color: 'var(--ink-soft)' }} />
          </button>
        </div>
        <p className="mb-4 text-xs leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          Pošli zprávu do budoucna. Otevře se až ve zvolený den — do té doby zůstává tajemstvím.
        </p>

        <div className="mb-3 grid grid-cols-2 gap-2">
          {CAPSULE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => onPick(addDaysIso(p.days))}
              data-testid={`capsule-preset-${p.key}`}
              className="rounded-2xl px-4 py-3 text-left tap"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>
                {p.label}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                {formatCzechDate(addDaysIso(p.days))}
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
          <div className="mb-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--ink-soft)' }}>
            Vlastní datum
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={customDate}
              min={addDaysIso(1)}
              onChange={(e) => setCustomDate(e.target.value)}
              data-testid="capsule-custom-date"
              className="flex-1 rounded-xl border bg-transparent px-3 py-2 text-[14px] outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
            <button
              onClick={() => onPick(customDate)}
              data-testid="capsule-custom-apply"
              className="rounded-xl px-4 py-2 text-sm font-medium tap"
              style={{
                background: 'linear-gradient(180deg, #E5B3BB 0%, #C77A8A 100%)',
                color: '#1B0E14',
              }}
            >
              Nastavit
            </button>
          </div>
        </div>

        {current && (
          <button
            onClick={() => onPick(null)}
            data-testid="capsule-remove"
            className="mt-3 w-full rounded-2xl px-4 py-3 text-sm tap"
            style={{ background: 'rgba(255,80,100,0.08)', color: '#F5A0AA' }}
          >
            Zrušit kapsli (poslat hned)
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

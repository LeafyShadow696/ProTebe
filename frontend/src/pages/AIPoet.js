import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Share2, Download, RefreshCw } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import { api } from '../lib/api';
import { toAccusativeCz } from '../lib/czech';

const MOODS = [
  { key: 'tender', label: 'Něžně', desc: 'jako večerní šepot' },
  { key: 'playful', label: 'Hravě', desc: 's úsměvem' },
  { key: 'nostalgic', label: 'Nostalgicky', desc: 'vzpomínkami plný' },
  { key: 'hopeful', label: 'S nadějí', desc: 'dívající se vpřed' },
  { key: 'passionate', label: 'Vášnivě', desc: 'hluboce a intenzivně' },
];

export default function AIPoet({ pair }) {
  const [mood, setMood] = useState('tender');
  const [hint, setHint] = useState('');
  const [poem, setPoem] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  async function generate() {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await api.post('/ai/poem', {
        pair_id: pair?.id,
        mood,
        partner_name: pair?.partner_name || 'Michaelka',
        hint: hint.trim(),
      });
      const text = (data?.text || '').trim();
      setPoem(text);
      if (text) setHistory((prev) => [{ id: data.id || Date.now(), text, mood }, ...prev].slice(0, 6));
    } catch {
      setPoem('Slova se mi tentokrát schovala. Zkusíme to znovu?');
    } finally {
      setLoading(false);
    }
  }

  async function share() {
    if (!poem) return;
    const shareData = {
      title: 'Pro Tebe 😍',
      text: poem,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* user dismissed */
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(poem);
      // small visual hint via state
      alert('Báseň byla zkopírována.');
    }
  }

  function downloadAsImage() {
    if (!poem) return;
    const canvas = document.createElement('canvas');
    const W = 1080;
    const H = 1350;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createRadialGradient(W / 2, H * 0.4, 50, W / 2, H * 0.4, W);
    grad.addColorStop(0, '#3A1C28');
    grad.addColorStop(0.6, '#1A1A2E');
    grad.addColorStop(1, '#09090B');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle vignette dots
    ctx.fillStyle = 'rgba(229,179,187,0.18)';
    for (let i = 0; i < 60; i += 1) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = Math.random() * 2.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Title
    ctx.fillStyle = '#E5B3BB';
    ctx.font = '300 36px Cormorant Garamond, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`PRO ${(toAccusativeCz(pair?.partner_name) || 'TEBE').toUpperCase()}`, W / 2, 180);

    // Poem text
    ctx.fillStyle = '#FAFAFA';
    ctx.font = '300 52px Cormorant Garamond, Georgia, serif';
    const lines = wrapText(ctx, poem, W - 220);
    const lineHeight = 78;
    let y = H / 2 - (lines.length * lineHeight) / 2 + 40;
    for (const line of lines) {
      ctx.fillText(line, W / 2, y);
      y += lineHeight;
    }

    // Footer
    ctx.fillStyle = 'rgba(250,250,250,0.5)';
    ctx.font = '300 24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Pro Tebe 😍', W / 2, H - 120);

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `pro-tebe-basen-${Date.now()}.png`;
    a.click();
  }

  return (
    <div className="min-h-screen pb-32">
      <PageHeader
        kicker="AI Básník"
        title="Slova pro tebe"
        subtitle="Tichá báseň, jen pro tento okamžik"
        testid="poet-header"
      />

      <div className="space-y-4 px-4">
        <GlassCard className="p-5">
          <div className="mb-3 text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--ink-soft)' }}>
            Nálada
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
            {MOODS.map((m) => {
              const active = mood === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setMood(m.key)}
                  data-testid={`mood-${m.key}`}
                  className="flex-shrink-0 rounded-2xl px-4 py-2.5 text-left tap"
                  style={{
                    background: active ? 'rgba(229,179,187,0.16)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? 'rgba(229,179,187,0.32)' : 'var(--border)'}`,
                    minWidth: 130,
                  }}
                >
                  <div className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
                    {m.label}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                    {m.desc}
                  </div>
                </button>
              );
            })}
          </div>
          <input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder={'Nápověda (volitelné, např. „o moři")'}
            data-testid="poet-hint"
            className="mt-4 w-full rounded-2xl border bg-transparent px-4 py-3 text-[14px] outline-none ring-rose"
            style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
          />
          <button
            onClick={generate}
            disabled={loading}
            data-testid="generate-poem-btn"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-medium tap disabled:opacity-60"
            style={{
              background: 'linear-gradient(180deg, #E5B3BB 0%, #C77A8A 100%)',
              color: '#1B0E14',
              boxShadow: '0 8px 28px rgba(229,179,187,0.22)',
            }}
          >
            <Sparkles size={16} />
            {loading ? 'Píšu báseň…' : poem ? 'Napsat novou' : 'Napsat báseň'}
          </button>
        </GlassCard>

        <AnimatePresence mode="wait">
          {poem && (
            <motion.div
              key={poem}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <GlassCard className="p-6" testid="poem-card">
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className="text-[10px] uppercase tracking-[0.22em]"
                    style={{ color: 'var(--ink-soft)' }}
                  >
                    Pro {toAccusativeCz(pair?.partner_name) || 'Michaelku'}
                  </span>
                  <button
                    onClick={generate}
                    className="rounded-full p-2 tap"
                    aria-label="Znovu"
                    data-testid="poem-refresh"
                  >
                    <RefreshCw size={14} style={{ color: 'var(--ink-soft)' }} />
                  </button>
                </div>
                <p
                  className="whitespace-pre-line font-display text-[26px] font-light leading-snug"
                  style={{ color: 'var(--ink)' }}
                  data-testid="poem-text"
                >
                  {poem}
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    onClick={share}
                    className="flex-1 rounded-2xl glass px-4 py-3 text-sm tap"
                    style={{ color: 'var(--ink)' }}
                    data-testid="poem-share-btn"
                  >
                    <Share2 size={14} className="mr-2 inline" />
                    Sdílet
                  </button>
                  <button
                    onClick={downloadAsImage}
                    className="flex-1 rounded-2xl glass px-4 py-3 text-sm tap"
                    style={{ color: 'var(--ink)' }}
                    data-testid="poem-download-btn"
                  >
                    <Download size={14} className="mr-2 inline" />
                    Uložit obrázek
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {history.length > 1 && (
          <div className="space-y-2">
            <div
              className="mt-2 px-1 text-[10px] uppercase tracking-[0.18em]"
              style={{ color: 'var(--ink-soft)' }}
            >
              Předchozí
            </div>
            {history.slice(1).map((h) => (
              <button
                key={h.id}
                onClick={() => setPoem(h.text)}
                className="block w-full rounded-2xl glass p-4 text-left tap"
                data-testid={`history-${h.id}`}
              >
                <p
                  className="line-clamp-3 font-display text-[17px] font-light leading-snug"
                  style={{ color: 'var(--ink)' }}
                >
                  {h.text}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function wrapText(ctx, text, maxWidth) {
  const paragraphs = text.split('\n');
  const result = [];
  for (const para of paragraphs) {
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        result.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) result.push(line);
    if (paragraphs.length > 1) result.push('');
  }
  return result;
}

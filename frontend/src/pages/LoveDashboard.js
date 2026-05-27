import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Sparkles, RefreshCw, Sun, Moon, CloudMoon, Sunrise } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import { api, storage } from '../lib/api';
import { formatCzechDate, loveDuration, timeOfDayMood } from '../lib/dates';
import { toAccusativeCz } from '../lib/czech';

const MOOD_ICON = {
  morning: Sunrise,
  day: Sun,
  evening: CloudMoon,
  night: Moon,
};

const QUOTE_CACHE_KEY = 'remix.dailyQuote';

function loadCachedQuote() {
  try {
    const raw = localStorage.getItem(QUOTE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) return null;
    return parsed.quote;
  } catch {
    return null;
  }
}

function saveCachedQuote(quote) {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(QUOTE_CACHE_KEY, JSON.stringify({ date: today, quote }));
}

export default function LoveDashboard({ pair }) {
  const [tick, setTick] = useState(0);
  const [quote, setQuote] = useState(loadCachedQuote() || '');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const mood = useMemo(() => timeOfDayMood(), [tick]);
  const MoodIcon = MOOD_ICON[mood.key] || Sun;
  const fetched = useRef(false);

  // Live counter — update once per second.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const duration = useMemo(
    () => loveDuration(pair?.anniversary || '2026-04-03'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pair?.anniversary, tick]
  );

  async function fetchQuote(force = false) {
    if (quoteLoading) return;
    if (!force && quote) return;
    setQuoteLoading(true);
    try {
      const { data } = await api.post('/ai/quote', {
        partner_name: pair?.partner_name || 'Michaelka',
      });
      const text = (data?.quote || '').trim();
      if (text) {
        setQuote(text);
        saveCachedQuote(text);
      }
    } catch {
      /* silent */
    } finally {
      setQuoteLoading(false);
    }
  }

  // Auto-load quote once per day.
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    if (!quote) fetchQuote(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen pb-32">
      <PageHeader
        kicker={mood.label}
        title={
          <>
            <span style={{ color: 'var(--ink)' }}>Pro </span>
            <em className="not-italic" style={{ color: 'var(--rose)' }}>
              {toAccusativeCz(pair?.partner_name) || 'Michaelku'}
            </em>
          </>
        }
        subtitle={`Od ${formatCzechDate(pair?.anniversary || '2026-04-03')}`}
        right={
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full glass"
            style={{ color: 'var(--rose)' }}
          >
            <MoodIcon size={18} />
          </div>
        }
        testid="home-header"
      />

      <div className="space-y-4 px-4">
        {/* Love counter widget */}
        <LoveCounterCard duration={duration} />

        {/* AI Quote of the day */}
        <GlassCard className="overflow-hidden p-6" testid="quote-card">
          <div className="mb-3 flex items-center justify-between">
            <span
              className="text-[10px] uppercase tracking-[0.22em]"
              style={{ color: 'var(--ink-soft)' }}
            >
              Tichá myšlenka dne
            </span>
            <button
              data-testid="refresh-quote-btn"
              onClick={() => fetchQuote(true)}
              className="rounded-full p-2 tap"
              aria-label="Nový citát"
              style={{ color: 'var(--ink-soft)' }}
            >
              <RefreshCw size={14} className={quoteLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={quote || 'placeholder'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-2xl font-light leading-snug"
              style={{ color: 'var(--ink)' }}
            >
              {quote || (quoteLoading ? 'Hledám slova…' : 'Klepnutím obnovím tichou myšlenku.')}
            </motion.p>
          </AnimatePresence>
        </GlassCard>

        {/* Two-up widgets */}
        <div className="grid grid-cols-2 gap-4">
          <Widget
            icon={<Heart size={18} fill="currentColor" style={{ color: 'var(--rose)' }} />}
            kicker="Vzpomínek"
            value={duration.years > 0 ? `${duration.years} r` : `${duration.days} d`}
            sub={
              duration.future
                ? `Začneme za ${duration.days} dní`
                : `${duration.years > 0 ? `${duration.months} m, ` : ''}${duration.days} dnů`
            }
            testid="widget-memories"
          />
          <Widget
            icon={<Sparkles size={18} style={{ color: 'var(--rose)' }} />}
            kicker="Atmosféra"
            value={mood.label}
            sub="Aktualizuje se s denní dobou"
            testid="widget-mood"
          />
        </div>
      </div>
    </div>
  );
}

function LoveCounterCard({ duration }) {
  return (
    <GlassCard className="overflow-hidden p-6" testid="love-counter-card">
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] uppercase tracking-[0.22em]"
          style={{ color: 'var(--ink-soft)' }}
        >
          Náš čas spolu
        </span>
        <Heart size={14} fill="currentColor" style={{ color: 'var(--rose)' }} />
      </div>
      {duration.future ? (
        <div className="mt-3">
          <div
            className="font-display text-5xl font-light leading-none tracking-tight"
            style={{ color: 'var(--ink)' }}
          >
            {duration.days}
          </div>
          <div className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
            dní nás dělí od začátku
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-baseline gap-2">
            <div
              className="font-display text-5xl font-light leading-none tracking-tight"
              style={{ color: 'var(--ink)' }}
              data-testid="counter-days"
            >
              {duration.days}
            </div>
            <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              dní
            </div>
          </div>
          <div
            className="mt-3 grid grid-cols-3 gap-3 border-t pt-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <CounterCell label="hodin" value={duration.hours} testid="counter-hours" />
            <CounterCell label="minut" value={duration.minutes} testid="counter-minutes" />
            <CounterCell label="sekund" value={duration.seconds} testid="counter-seconds" />
          </div>
        </>
      )}
    </GlassCard>
  );
}

function CounterCell({ label, value, testid }) {
  return (
    <div data-testid={testid}>
      <div className="font-display text-2xl font-light leading-none" style={{ color: 'var(--ink)' }}>
        {String(value).padStart(2, '0')}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'var(--ink-soft)' }}>
        {label}
      </div>
    </div>
  );
}

function Widget({ icon, kicker, value, sub, testid }) {
  return (
    <GlassCard className="p-4" testid={testid}>
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'rgba(229,179,187,0.10)' }}>
          {icon}
        </div>
        <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--ink-soft)' }}>
          {kicker}
        </span>
      </div>
      <div
        className="font-display text-[28px] font-light leading-tight tracking-tight"
        style={{ color: 'var(--ink)' }}
      >
        {value}
      </div>
      <div className="mt-1 text-xs leading-snug" style={{ color: 'var(--ink-soft)' }}>
        {sub}
      </div>
    </GlassCard>
  );
}

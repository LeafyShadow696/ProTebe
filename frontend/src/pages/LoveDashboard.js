import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Sparkles, RefreshCw, Sun, Moon, CloudMoon, Sunrise, Lightbulb, Share2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import { CoupleAvatars } from '../components/Avatar';
import { api } from '../lib/api';
import { formatCzechDate, loveDuration, timeOfDayMood } from '../lib/dates';
import { toAccusativeCz } from '../lib/czech';
import { shareOrCopy } from '../lib/media';

const MOOD_ICON = {
  morning: Sunrise,
  day: Sun,
  evening: CloudMoon,
  night: Moon,
};

const QUOTE_CACHE_KEY = 'remix.dailyQuote';
const TIPS_CACHE_KEY = 'remix.dailyTips';

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

function loadCachedTips() {
  try {
    const raw = localStorage.getItem(TIPS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) return null;
    return parsed.tips;
  } catch {
    return null;
  }
}

function saveCachedTips(tips) {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(TIPS_CACHE_KEY, JSON.stringify({ date: today, tips }));
}

function currentSeasonCz() {
  const m = new Date().getMonth() + 1;
  if (m === 12 || m <= 2) return 'zima';
  if (m <= 5) return 'jaro';
  if (m <= 8) return 'léto';
  return 'podzim';
}

function currentTimeOfDayCz() {
  const h = new Date().getHours();
  if (h < 6) return 'noc';
  if (h < 11) return 'ráno';
  if (h < 14) return 'dopoledne';
  if (h < 18) return 'odpoledne';
  if (h < 22) return 'večer';
  return 'noc';
}

export default function LoveDashboard({ pair }) {
  const [tick, setTick] = useState(0);
  const [quote, setQuote] = useState(loadCachedQuote() || '');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [tips, setTips] = useState(loadCachedTips() || []);
  const [tipsLoading, setTipsLoading] = useState(false);

  const showQuoteSkeleton = quoteLoading && !quote;
  const showTipsSkeleton = tipsLoading && tips.length === 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mood = useMemo(() => timeOfDayMood(), [tick]);
  const MoodIcon = MOOD_ICON[mood.key] || Sun;
  const fetched = useRef(false);

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

    if (force) {
      // Clear daily cache so we definitely get something new
      localStorage.removeItem(QUOTE_CACHE_KEY);
    }

    setQuoteLoading(true);
    try {
      const { data } = await api.post('/ai/quote', {
        partner_name: pair?.partner_name || 'Michaelka',
        time_of_day: currentTimeOfDayCz(),
        mood: mood.key,
        force: force, // hint for backend to be more creative
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

  async function fetchTips(force = false) {
    if (tipsLoading) return;
    if (!force && tips.length > 0) return;

    if (force) {
      localStorage.removeItem(TIPS_CACHE_KEY);
    }

    setTipsLoading(true);
    try {
      const { data } = await api.post('/ai/dateidea', {
        partner_name: pair?.partner_name || 'Michaelka',
        season: currentSeasonCz(),
        time_of_day: currentTimeOfDayCz(),
        vibe: 'romantic',
        force: force,
      });
      const ideas = Array.isArray(data?.ideas) ? data.ideas : [];
      if (ideas.length > 0) {
        setTips(ideas);
        saveCachedTips(ideas);
      }
    } catch {
      /* silent */
    } finally {
      setTipsLoading(false);
    }
  }

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    if (!quote) fetchQuote(false);
    if (tips.length === 0) fetchTips(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function shareTip(text) {
    await shareOrCopy({ title: 'Pro Tebe 😍', text });
  }

  // Dynamic time-of-day atmosphere (gradient from timeOfDayMood)
  const timeGradient = mood.gradient || '';

  return (
    <div className="min-h-screen pb-32 relative">
      {/* Time-of-day atmosphere layer - subtle gradient that changes throughout the day */}
      {timeGradient && (
        <div 
          className={`fixed inset-0 pointer-events-none z-0 bg-gradient-to-b ${timeGradient} transition-all duration-1000 ease-out`}
          aria-hidden="true"
        />
      )}

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
        {/* Couple identity */}
        <div className="flex items-center justify-center gap-3 pt-1" data-testid="couple-identity">
          <CoupleAvatars
            ownerSrc={pair?.profile_photo_owner}
            partnerSrc={pair?.profile_photo_partner}
            ownerName={pair?.owner_name}
            partnerName={pair?.partner_name}
            size={34}
          />
          <div className="text-[12px] tracking-wide" style={{ color: 'var(--ink-soft)' }}>
            {pair?.owner_name || 'Já'} <span style={{ color: 'var(--rose)' }}>♡</span>{' '}
            {pair?.partner_name || 'Michaelka'}
          </div>
        </div>

        {/* Love counter widget */}
        <LoveCounterCard duration={duration} />

        {/* AI Quote of the day */}
        <GlassCard 
          className={`overflow-hidden p-6 transition-all duration-700 ${mood.key === 'evening' || mood.key === 'night' ? 'border-rose-900/30' : ''}`}
          testid="quote-card"
        >
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
            {showQuoteSkeleton ? (
              <div className="space-y-2 py-1">
                <div className="h-5 w-11/12 animate-pulse rounded bg-white/10" />
                <div className="h-5 w-8/12 animate-pulse rounded bg-white/10" />
              </div>
            ) : (
              <motion.p
                key={quote}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="font-display text-2xl font-light leading-snug"
                style={{ color: 'var(--ink)' }}
              >
                {quote || 'Klepnutím obnovím tichou myšlenku.'}
              </motion.p>
            )}
          </AnimatePresence>
        </GlassCard>

        {/* AI Date Tips — "Co spolu dnes?" */}
        <GlassCard 
          className={`overflow-hidden p-5 transition-all duration-700 ${mood.key === 'morning' ? 'border-amber-900/20' : ''}`}
          testid="tips-card"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb size={14} style={{ color: 'var(--rose)' }} />
              <span
                className="text-[10px] uppercase tracking-[0.22em]"
                style={{ color: 'var(--ink-soft)' }}
              >
                Co spolu dnes?
              </span>
            </div>
            <button
              onClick={() => fetchTips(true)}
              data-testid="refresh-tips-btn"
              className="rounded-full p-2 tap"
              aria-label="Nové nápady"
              style={{ color: 'var(--ink-soft)' }}
            >
              <RefreshCw size={14} className={tipsLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          <AnimatePresence mode="wait">
            {showTipsSkeleton ? (
              <div className="space-y-3 py-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="mt-1 h-1.5 w-1.5 flex-shrink-0 animate-pulse rounded-full bg-white/15" />
                    <div className="h-4 w-full max-w-[85%] animate-pulse rounded bg-white/10" />
                  </div>
                ))}
              </div>
            ) : tips.length === 0 ? (
              <motion.p
                key="tips-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm"
                style={{ color: 'var(--ink-soft)' }}
              >
                Klepnutím navrhnu, co podniknout.
              </motion.p>
            ) : (
              <motion.ul
                key={tips.join('|')}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.4 }}
                className="space-y-3"
                data-testid="tips-list"
              >
                {tips.map((t, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="flex items-start gap-3"
                    data-testid={`tip-${i}`}
                  >
                    <div
                      className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ background: 'rgba(229,179,187,0.18)' }}
                    >
                      <Heart size={10} fill="currentColor" style={{ color: 'var(--rose)' }} />
                    </div>
                    <div className="flex-1">
                      <p
                        className="font-display text-[18px] font-light leading-snug"
                        style={{ color: 'var(--ink)' }}
                      >
                        {t}
                      </p>
                    </div>
                    <button
                      onClick={() => shareTip(t)}
                      data-testid={`share-tip-${i}`}
                      className="rounded-full p-1.5 tap"
                      aria-label="Sdílet nápad"
                      style={{ color: 'var(--ink-soft)' }}
                    >
                      <Share2 size={13} />
                    </button>
                  </motion.li>
                ))}
              </motion.ul>
            )}
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

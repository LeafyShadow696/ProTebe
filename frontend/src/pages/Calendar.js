import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronLeft, ChevronRight, Heart, Bell, X, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import { api } from '../lib/api';
import { formatCzechDate, shortRelativeCzech } from '../lib/dates';
import { useSheetLock } from '../lib/hooks';

const CZ_DAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const CZ_MONTHS_FULL = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

const TYPES = [
  { key: 'event', label: 'Událost', Icon: CalendarIcon },
  { key: 'anniversary', label: 'Výročí', Icon: Heart },
  { key: 'reminder', label: 'Připomínka', Icon: Bell },
];

function buildMonthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const dayOfWeek = (first.getDay() + 6) % 7; // Monday first
  const cells = [];
  for (let i = 0; i < dayOfWeek; i += 1) cells.push(null);
  for (let d = 1; d <= last.getDate(); d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function ymd(year, month, day) {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export default function Calendar({ pair }) {
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [events, setEvents] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [activeDay, setActiveDay] = useState(today.getDate());

  // Seed virtual anniversary event for 3.4.2026 from pair.anniversary
  const allEvents = useMemo(() => {
    const seed = pair?.anniversary
      ? [
          {
            id: 'seed-anniversary',
            title: 'Den, kdy začalo „my"',
            date: pair.anniversary,
            note: 'Náš první společný den.',
            type: 'anniversary',
            virtual: true,
          },
        ]
      : [];
    return [...seed, ...events];
  }, [events, pair?.anniversary]);

  async function load() {
    if (!pair?.id) return;
    try {
      const { data } = await api.get(`/events/${pair.id}`);
      setEvents(data);
    } catch {
      /* silent */
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair?.id]);

  const cells = useMemo(() => buildMonthGrid(view.year, view.month), [view]);
  const eventsByDate = useMemo(() => {
    const map = {};
    for (const e of allEvents) {
      (map[e.date] ||= []).push(e);
    }
    return map;
  }, [allEvents]);

  const selectedKey = ymd(view.year, view.month, activeDay);
  const dayEvents = eventsByDate[selectedKey] || [];

  function shiftMonth(delta) {
    setView((v) => {
      const m = v.month + delta;
      const year = v.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  }

  const upcoming = useMemo(() => {
    const todayKey = ymd(today.getFullYear(), today.getMonth(), today.getDate());
    return allEvents
      .filter((e) => e.date >= todayKey)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [allEvents, today]);

  return (
    <div className="min-h-screen pb-32">
      <PageHeader
        kicker="Kalendář"
        title="Naše dny"
        subtitle="Společný čas, výročí, malé připomínky"
        right={
          <button
            onClick={() => setShowAdd(true)}
            data-testid="add-event-btn"
            className="flex h-10 w-10 items-center justify-center rounded-full glass-strong tap"
            aria-label="Přidat událost"
          >
            <Plus size={18} style={{ color: 'var(--rose)' }} />
          </button>
        }
        testid="calendar-header"
      />

      <div className="space-y-4 px-4">
        <GlassCard className="p-4" testid="calendar-grid">
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={() => shiftMonth(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full tap"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--ink)' }}
              data-testid="cal-prev"
              aria-label="Předchozí měsíc"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="text-center">
              <div className="font-display text-2xl font-light" style={{ color: 'var(--ink)' }}>
                {CZ_MONTHS_FULL[view.month]}
              </div>
              <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: 'var(--ink-soft)' }}>
                {view.year}
              </div>
            </div>
            <button
              onClick={() => shiftMonth(1)}
              className="flex h-9 w-9 items-center justify-center rounded-full tap"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--ink)' }}
              data-testid="cal-next"
              aria-label="Další měsíc"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {CZ_DAYS.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] uppercase tracking-[0.16em]"
                style={{ color: 'var(--ink-soft)' }}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const key = ymd(view.year, view.month, day);
              const has = !!eventsByDate[key];
              const isToday =
                today.getFullYear() === view.year &&
                today.getMonth() === view.month &&
                today.getDate() === day;
              const isActive = activeDay === day;
              return (
                <button
                  key={i}
                  onClick={() => setActiveDay(day)}
                  data-testid={`day-${key}`}
                  className="relative flex aspect-square items-center justify-center rounded-xl text-[14px] tap"
                  style={{
                    background: isActive
                      ? 'linear-gradient(180deg, #E5B3BB 0%, #C77A8A 100%)'
                      : isToday
                      ? 'rgba(229,179,187,0.10)'
                      : 'transparent',
                    color: isActive ? '#1B0E14' : 'var(--ink)',
                    border: isToday && !isActive ? '1px solid rgba(229,179,187,0.30)' : '1px solid transparent',
                  }}
                >
                  {day}
                  {has && (
                    <span
                      className="absolute bottom-1.5 h-1 w-1 rounded-full"
                      style={{ background: isActive ? '#1B0E14' : 'var(--rose)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </GlassCard>

        {/* Day events */}
        <div>
          <div className="mb-2 px-1 text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--ink-soft)' }}>
            {formatCzechDate(selectedKey)}
          </div>
          {dayEvents.length === 0 ? (
            <GlassCard className="p-4 text-center text-sm" testid="no-events">
              <span style={{ color: 'var(--ink-soft)' }}>V tento den ještě nic nemáme.</span>
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {dayEvents.map((e) => (
                <EventRow
                  key={e.id}
                  event={e}
                  onDelete={async () => {
                    if (e.virtual) return;
                    setEvents((prev) => prev.filter((x) => x.id !== e.id));
                    try {
                      await api.delete(`/events/${e.id}`);
                    } catch {
                      /* silent */
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div>
            <div
              className="mb-2 mt-2 px-1 text-[10px] uppercase tracking-[0.18em]"
              style={{ color: 'var(--ink-soft)' }}
            >
              Nadcházející
            </div>
            <div className="space-y-2">
              {upcoming.map((e) => (
                <UpcomingRow key={e.id} event={e} />
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && (
          <AddEventSheet
            pair={pair}
            initialDate={selectedKey}
            onClose={() => setShowAdd(false)}
            onCreated={(e) => {
              setEvents((prev) => [...prev, e]);
              setShowAdd(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EventRow({ event, onDelete }) {
  const Icon = TYPES.find((t) => t.key === event.type)?.Icon || CalendarIcon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center justify-between rounded-2xl glass px-4 py-3"
      data-testid={`event-${event.id}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(229,179,187,0.12)' }}>
          <Icon size={16} style={{ color: 'var(--rose)' }} />
        </div>
        <div>
          <div className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
            {event.title}
          </div>
          {event.note && (
            <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>
              {event.note}
            </div>
          )}
        </div>
      </div>
      {!event.virtual && (
        <button
          onClick={onDelete}
          className="rounded-full p-2 tap"
          aria-label="Smazat"
          data-testid={`delete-event-${event.id}`}
        >
          <Trash2 size={14} style={{ color: 'var(--ink-soft)' }} />
        </button>
      )}
    </motion.div>
  );
}

function UpcomingRow({ event }) {
  const Icon = TYPES.find((t) => t.key === event.type)?.Icon || CalendarIcon;
  return (
    <div className="flex items-center justify-between rounded-2xl glass px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(229,179,187,0.12)' }}>
          <Icon size={16} style={{ color: 'var(--rose)' }} />
        </div>
        <div>
          <div className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
            {event.title}
          </div>
          <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>
            {formatCzechDate(event.date)} · {shortRelativeCzech(event.date)}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddEventSheet({ pair, initialDate, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [note, setNote] = useState('');
  const [type, setType] = useState('event');
  const [saving, setSaving] = useState(false);
  useSheetLock(true);

  async function save() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const { data } = await api.post('/events', {
        pair_id: pair.id,
        title: title.trim(),
        date,
        note: note.trim(),
        type,
      });
      onCreated(data);
    } catch {
      /* silent */
    } finally {
      setSaving(false);
    }
  }

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
        data-testid="add-event-sheet"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            Nová událost
          </span>
          <button onClick={onClose} className="rounded-full p-1 tap" aria-label="Zavřít">
            <X size={16} style={{ color: 'var(--ink-soft)' }} />
          </button>
        </div>

        <div className="mb-3 flex gap-2">
          {TYPES.map((t) => {
            const active = type === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                data-testid={`type-${t.key}`}
                className="flex-1 rounded-2xl px-3 py-2.5 text-xs tap"
                style={{
                  background: active ? 'rgba(229,179,187,0.18)' : 'rgba(255,255,255,0.04)',
                  color: active ? 'var(--ink)' : 'var(--ink-soft)',
                  border: `1px solid ${active ? 'rgba(229,179,187,0.32)' : 'transparent'}`,
                }}
              >
                <t.Icon size={14} className="mr-1 inline" />
                {t.label}
              </button>
            );
          })}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Název"
          data-testid="event-title-input"
          className="mb-2 w-full rounded-2xl border bg-transparent px-4 py-3 text-[15px] outline-none"
          style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          data-testid="event-date-input"
          className="mb-2 w-full rounded-2xl border bg-transparent px-4 py-3 text-[15px] outline-none"
          style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Poznámka (volitelné)"
          rows={2}
          data-testid="event-note-input"
          className="mb-3 w-full resize-none rounded-2xl border bg-transparent px-4 py-3 text-[14px] outline-none"
          style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
        />

        <button
          onClick={save}
          disabled={!title.trim() || saving}
          data-testid="event-save-btn"
          className="w-full rounded-2xl px-5 py-3 text-[15px] font-medium tap disabled:opacity-50"
          style={{
            background: 'linear-gradient(180deg, #E5B3BB 0%, #C77A8A 100%)',
            color: '#1B0E14',
          }}
        >
          {saving ? '…' : 'Uložit'}
        </button>
      </motion.div>
    </motion.div>
  );
}

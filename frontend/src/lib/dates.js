/**
 * Czech-formatted date / time / duration helpers for the love-counter.
 * All inputs are ISO strings or YYYY-MM-DD.
 */

const CZ_MONTHS = [
  'ledna',
  'února',
  'března',
  'dubna',
  'května',
  'června',
  'července',
  'srpna',
  'září',
  'října',
  'listopadu',
  'prosince',
];

export function formatCzechDate(yyyyMmDd) {
  const [y, m, d] = (yyyyMmDd || '').split('-').map(Number);
  if (!y || !m || !d) return yyyyMmDd;
  return `${d}. ${CZ_MONTHS[m - 1]} ${y}`;
}

export function loveDuration(anniversaryIso, now = new Date()) {
  const [y, m, d] = anniversaryIso.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const diff = now.getTime() - start.getTime();
  const future = diff < 0;
  const abs = Math.abs(diff);

  const days = Math.floor(abs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((abs / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((abs / (1000 * 60)) % 60);
  const seconds = Math.floor((abs / 1000) % 60);

  // Years/months counted from real calendar.
  let years = now.getUTCFullYear() - start.getUTCFullYear();
  let months = now.getUTCMonth() - start.getUTCMonth();
  if (months < 0) {
    months += 12;
    years -= 1;
  }
  if (years < 0) {
    years = 0;
    months = 0;
  }

  return { future, days, hours, minutes, seconds, years, months };
}

export function shortRelativeCzech(yyyyMmDd, now = new Date()) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1, d));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'dnes';
  if (diff === 1) return 'zítra';
  if (diff === -1) return 'včera';
  if (diff > 1 && diff < 7) return `za ${diff} dny`;
  if (diff >= 7) return `za ${diff} dní`;
  if (diff < -1 && diff > -7) return `před ${-diff} dny`;
  return `před ${-diff} dny`;
}

export function timeOfDayMood(now = new Date()) {
  const h = now.getHours();
  if (h < 6) return { key: 'night', label: 'Tichá noc', gradient: 'from-indigo-950 to-black' };
  if (h < 11) return { key: 'morning', label: 'Tiché ráno', gradient: 'from-rose-900/40 to-amber-900/30' };
  if (h < 17) return { key: 'day', label: 'Den s tebou', gradient: 'from-rose-900/40 to-pink-900/30' };
  if (h < 21) return { key: 'evening', label: 'Zlatý večer', gradient: 'from-amber-900/40 to-rose-950/40' };
  return { key: 'night', label: 'Něžná noc', gradient: 'from-indigo-950 to-black' };
}

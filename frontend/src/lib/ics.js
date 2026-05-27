/**
 * Generate a minimal .ics (iCalendar) file for a single event, downloadable
 * so the user can open it in Apple Calendar / Google Calendar / Outlook.
 */

function pad(n) {
  return String(n).padStart(2, '0');
}

function toIcsDate(yyyyMmDd) {
  // All-day event format: YYYYMMDD (no time)
  return yyyyMmDd.replaceAll('-', '');
}

function nextDay(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 1);
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function dtstamp() {
  const d = new Date();
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function escapeIcs(s) {
  return String(s || '')
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\n', '\\n');
}

export function eventToIcs(event) {
  const uid = `${event.id || Math.random().toString(36).slice(2)}@protebe`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pro Tebe//Calendar//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp()}`,
    `DTSTART;VALUE=DATE:${toIcsDate(event.date)}`,
    `DTEND;VALUE=DATE:${nextDay(event.date)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    event.note ? `DESCRIPTION:${escapeIcs(event.note)}` : null,
    event.type === 'anniversary' ? 'CATEGORIES:Výročí' : 'CATEGORIES:Pro Tebe',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(event.title)}`,
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}

export function downloadEventIcs(event) {
  const ics = eventToIcs(event);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safe = (event.title || 'udalost').replace(/[^a-z0-9-_ěščřžýáíéóůúďťňĚŠČŘŽÝÁÍÉÓŮÚĎŤŇ]+/gi, '-');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

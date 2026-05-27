/**
 * Tiny Czech declension helper.
 * Handles common female-name endings for the accusative (4. pád).
 * Not perfect for every name, but covers the common ones:
 *   Michaelka → Michaelku, Anna → Annu, Petra → Petru, Marie → Marii.
 */
export function toAccusativeCz(name) {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  const last = trimmed.slice(-1).toLowerCase();
  if (last === 'a') return trimmed.slice(0, -1) + 'u';
  if (last === 'e') return trimmed.slice(0, -1) + 'i';
  return trimmed;
}

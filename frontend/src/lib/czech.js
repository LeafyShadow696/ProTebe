/**
 * Tiny Czech declension helper for female names ending in -a / -e.
 * Covers the common cases used in the app: accusative + vocative + dative.
 * Examples:
 *   accusative: Michaelka → Michaelku, Anna → Annu
 *   vocative:   Michaelka → Michaelko, Anna → Anno
 *   dative:     Michaelka → Michaelce (k→c palatalisation), Anna → Anně
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

export function toVocativeCz(name) {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  const last = trimmed.slice(-1).toLowerCase();
  if (last === 'a') return trimmed.slice(0, -1) + 'o';
  if (last === 'e') return trimmed;
  return trimmed;
}

export function toDativeCz(name) {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  const last = trimmed.slice(-1).toLowerCase();
  if (last !== 'a') return trimmed;
  const stem = trimmed.slice(0, -1);
  const stemLast = stem.slice(-1).toLowerCase();
  if (stemLast === 'k') return stem.slice(0, -1) + 'ce';
  if (stemLast === 'h' || stemLast === 'g') return stem.slice(0, -1) + 'ze';
  if (stem.slice(-2).toLowerCase() === 'ch') return stem.slice(0, -2) + 'še';
  if (stemLast === 'r') return stem.slice(0, -1) + 'ře';
  return stem + 'ě';
}

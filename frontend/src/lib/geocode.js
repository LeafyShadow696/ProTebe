/**
 * Free reverse geocoding via OpenStreetMap Nominatim.
 * No API key. Be respectful: 1 request per second max.
 * Docs: https://nominatim.org/release-docs/latest/api/Reverse/
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

let lastCall = 0;
let activeController = null;

async function throttle() {
  const now = Date.now();
  const since = now - lastCall;
  if (since < 1100) {
    await new Promise((r) => setTimeout(r, 1100 - since));
  }
  lastCall = Date.now();
}

/** Convert lat/lng to a friendly Czech place label (best-effort). */
export async function reverseGeocode(lat, lng) {
  // Cancel any in-flight call so navigating away doesn't fill stale data.
  if (activeController) activeController.abort();
  activeController = new AbortController();
  const signal = activeController.signal;

  await throttle();
  if (signal.aborted) return null;

  const url = `${NOMINATIM_URL}?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=cs&zoom=16`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return summarize(data);
  } catch {
    return null;
  }
}

function summarize(data) {
  if (!data) return null;
  const a = data.address || {};
  // Prefer specific name (cafe, restaurant) > road > suburb > village/city
  const name =
    data.name ||
    a.amenity ||
    a.shop ||
    a.tourism ||
    a.leisure ||
    a.attraction ||
    null;
  const street = a.road || a.pedestrian || a.path;
  const place = a.suburb || a.neighbourhood || a.village || a.town || a.city;
  const country = a.country_code ? a.country_code.toUpperCase() : null;

  if (name && place) return `${name}, ${place}`;
  if (name) return name;
  if (street && place) return `${street}, ${place}`;
  if (place) return place;
  if (data.display_name) {
    // Trim long display names to first two parts
    const parts = data.display_name.split(',').map((s) => s.trim());
    return parts.slice(0, 2).join(', ');
  }
  return country ? `Souřadnice ${country}` : null;
}

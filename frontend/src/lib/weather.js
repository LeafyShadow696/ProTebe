/**
 * Open-Meteo client — free weather API, no key required.
 * Docs: https://open-meteo.com/en/docs
 */

const WEATHER_CODES = {
  0: { label: 'Jasno', emoji: '☀️', vibe: 'slunečno' },
  1: { label: 'Skoro jasno', emoji: '🌤️', vibe: 'jasno' },
  2: { label: 'Polojasno', emoji: '⛅', vibe: 'polojasno' },
  3: { label: 'Zataženo', emoji: '☁️', vibe: 'zataženo' },
  45: { label: 'Mlha', emoji: '🌫️', vibe: 'mlha' },
  48: { label: 'Mlha s jíním', emoji: '🌫️', vibe: 'mlha' },
  51: { label: 'Mrholení', emoji: '🌦️', vibe: 'mrholení' },
  53: { label: 'Mrholení', emoji: '🌦️', vibe: 'mrholení' },
  55: { label: 'Silné mrholení', emoji: '🌧️', vibe: 'mrholení' },
  61: { label: 'Slabý déšť', emoji: '🌧️', vibe: 'déšť' },
  63: { label: 'Déšť', emoji: '🌧️', vibe: 'déšť' },
  65: { label: 'Silný déšť', emoji: '⛈️', vibe: 'silný déšť' },
  71: { label: 'Slabé sněžení', emoji: '🌨️', vibe: 'sníh' },
  73: { label: 'Sněžení', emoji: '🌨️', vibe: 'sníh' },
  75: { label: 'Silné sněžení', emoji: '❄️', vibe: 'sníh' },
  77: { label: 'Sněhové kroupy', emoji: '🌨️', vibe: 'sníh' },
  80: { label: 'Přeháňky', emoji: '🌦️', vibe: 'přeháňky' },
  81: { label: 'Silné přeháňky', emoji: '🌧️', vibe: 'déšť' },
  82: { label: 'Bouřkové přeháňky', emoji: '⛈️', vibe: 'bouřka' },
  85: { label: 'Sněhové přeháňky', emoji: '🌨️', vibe: 'sníh' },
  86: { label: 'Silné sněhové přeháňky', emoji: '❄️', vibe: 'sníh' },
  95: { label: 'Bouřka', emoji: '⛈️', vibe: 'bouřka' },
  96: { label: 'Bouřka s kroupami', emoji: '⛈️', vibe: 'bouřka' },
  99: { label: 'Silná bouřka', emoji: '⛈️', vibe: 'bouřka' },
};

export function describeWeather(code) {
  return WEATHER_CODES[code] || { label: 'Neznámé počasí', emoji: '🌥️', vibe: '' };
}

/** Fetch current weather for a lat/lng. Throws on network failure. */
export async function fetchWeather(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('weather fetch failed');
  const data = await res.json();
  const current = data?.current || {};
  const code = current.weather_code ?? 0;
  const info = describeWeather(code);
  return {
    temperature: Math.round(current.temperature_2m ?? 0),
    wind: Math.round(current.wind_speed_10m ?? 0),
    code,
    label: info.label,
    emoji: info.emoji,
    vibe: info.vibe,
  };
}

/** Convenience: get current device location via Geolocation API. */
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation API not available'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000, ...options }
    );
  });
}

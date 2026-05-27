import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MapPin, X, Trash2, Locate, Cloud, Share2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import { api } from '../lib/api';
import { useSheetLock } from '../lib/hooks';
import { fetchWeather, getCurrentPosition } from '../lib/weather';
import { shareOrCopy } from '../lib/media';

// Custom marker — rose-accent pin without external image dep.
const heartIcon = L.divIcon({
  className: 'remix-marker',
  html: `<div style="
    width:28px;height:28px;border-radius:50%;
    background:radial-gradient(circle, #E5B3BB 0%, #C77A8A 100%);
    box-shadow:0 0 0 4px rgba(229,179,187,0.25), 0 4px 12px rgba(0,0,0,0.45);
    border:1px solid rgba(255,255,255,0.6);
    display:flex;align-items:center;justify-content:center;
    color:#1B0E14;font-size:14px;">♡</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Default location: Prague, Czech Republic.
const DEFAULT_CENTER = [50.0755, 14.4378];
const DEFAULT_ZOOM = 12;

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng);
    },
  });
  return null;
}

export default function LoveMap({ pair }) {
  const [places, setPlaces] = useState([]);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [mapRef, setMapRef] = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  useSheetLock(showForm);

  async function load() {
    if (!pair?.id) return;
    try {
      const { data } = await api.get(`/places/${pair.id}`);
      setPlaces(data);
    } catch {
      /* silent */
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair?.id]);

  const center = useMemo(() => {
    if (places.length > 0) return [places[0].lat, places[0].lng];
    return DEFAULT_CENTER;
  }, [places]);

  async function handleSave() {
    if (!picked || !title.trim() || saving) return;
    setSaving(true);
    try {
      const { data } = await api.post('/places', {
        pair_id: pair.id,
        title: title.trim(),
        lat: picked.lat,
        lng: picked.lng,
        note: note.trim(),
      });
      setPlaces((prev) => [data, ...prev]);
      setPicked(null);
      setTitle('');
      setNote('');
      setShowForm(false);
      setPicking(false);
    } catch {
      /* silent */
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setPlaces((prev) => prev.filter((p) => p.id !== id));
    try {
      await api.delete(`/places/${id}`);
    } catch {
      /* silent */
    }
  }

  function locateMe() {
    if (!navigator.geolocation || !mapRef) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.flyTo([pos.coords.latitude, pos.coords.longitude], 14);
      },
      () => {
        /* permission denied */
      },
      { timeout: 8000 }
    );
  }

  async function addCurrentLocation() {
    if (locating) return;
    setLocating(true);
    try {
      const { lat, lng } = await getCurrentPosition();
      if (mapRef) mapRef.flyTo([lat, lng], 15);
      setPicked({ lat, lng });
      setShowForm(true);
      setPicking(false);
    } catch (e) {
      window.alert('Nepodařilo se získat polohu. Povol prosím přístup k poloze.');
    } finally {
      setLocating(false);
    }
  }

  async function showWeatherFor(place) {
    if (weatherLoading) return;
    setWeatherLoading(true);
    setWeather({ place, data: null });
    try {
      const data = await fetchWeather(place.lat, place.lng);
      setWeather({ place, data });
    } catch {
      setWeather({ place, data: { error: true } });
    } finally {
      setWeatherLoading(false);
    }
  }

  return (
    <div className="min-h-screen pb-32">
      <PageHeader
        kicker="Love Map"
        title="Naše místa"
        subtitle={picking ? 'Klepni do mapy a vyber místo' : 'Sbírejte koordináty vašich chvil'}
        right={
          <div className="flex gap-2">
            <button
              onClick={addCurrentLocation}
              data-testid="add-current-location-btn"
              disabled={locating}
              className="flex h-10 w-10 items-center justify-center rounded-full glass-strong tap disabled:opacity-60"
              aria-label="Tady jsem"
            >
              <Locate size={16} style={{ color: 'var(--rose)' }} className={locating ? 'animate-pulse' : ''} />
            </button>
            <button
              onClick={() => setPicking((p) => !p)}
              data-testid="toggle-pick-btn"
              className="flex h-10 w-10 items-center justify-center rounded-full glass-strong tap"
              aria-label={picking ? 'Zrušit' : 'Přidat místo'}
              style={picking ? { background: 'rgba(229,179,187,0.2)' } : undefined}
            >
              {picking ? (
                <X size={18} style={{ color: 'var(--rose)' }} />
              ) : (
                <Plus size={18} style={{ color: 'var(--rose)' }} />
              )}
            </button>
          </div>
        }
        testid="map-header"
      />

      <div className="px-4">
        <div
          className="relative overflow-hidden rounded-3xl"
          style={{ height: 'calc(100vh - 320px)', minHeight: 380, border: '1px solid var(--border)' }}
        >
          <MapContainer
            center={center}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom
            zoomControl={false}
            attributionControl
            style={{ height: '100%', width: '100%' }}
            whenCreated={setMapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {picking && <ClickHandler onPick={(latlng) => { setPicked(latlng); setShowForm(true); }} />}
            {places.map((p) => (
              <Marker key={p.id} position={[p.lat, p.lng]} icon={heartIcon}>
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">{p.title}</div>
                    {p.note && <div className="text-xs opacity-70">{p.note}</div>}
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="mt-2 text-xs"
                      style={{ color: '#C77A8A' }}
                    >
                      Smazat
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
            {picked && (
              <Marker position={[picked.lat, picked.lng]} icon={heartIcon} />
            )}
          </MapContainer>

          <button
            onClick={locateMe}
            className="absolute right-3 top-3 z-[400] flex h-10 w-10 items-center justify-center rounded-full glass-strong tap"
            aria-label="Najdi mě"
            data-testid="locate-me-btn"
          >
            <Locate size={16} style={{ color: 'var(--ink)' }} />
          </button>

          {picking && !showForm && (
            <div className="absolute inset-x-3 bottom-3 z-[400] rounded-2xl glass-strong px-4 py-3 text-center text-sm" style={{ color: 'var(--ink)' }}>
              <MapPin size={14} className="mr-2 inline" style={{ color: 'var(--rose)' }} />
              Klepni na místo, kde se ho chceš dotknout.
            </div>
          )}
        </div>

        {/* Places list */}
        {places.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="px-1 text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--ink-soft)' }}>
              Sbírka míst ({places.length})
            </div>
            {places.map((p) => (
              <div
                key={p.id}
                data-testid={`place-${p.id}`}
                className="rounded-2xl glass px-4 py-3"
              >
                <button
                  onClick={() => mapRef?.flyTo([p.lat, p.lng], 15)}
                  className="flex w-full items-center justify-between text-left tap"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(229,179,187,0.12)' }}>
                      <MapPin size={16} style={{ color: 'var(--rose)' }} />
                    </div>
                    <div>
                      <div className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
                        {p.title}
                      </div>
                      {p.note && (
                        <div className="line-clamp-1 text-xs" style={{ color: 'var(--ink-soft)' }}>
                          {p.note}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => showWeatherFor(p)}
                    data-testid={`weather-place-${p.id}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12px] tap"
                    style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--ink)' }}
                  >
                    <Cloud size={12} />
                    Počasí
                  </button>
                  <button
                    onClick={() =>
                      shareOrCopy({
                        title: p.title,
                        text: `${p.title}${p.note ? ` — ${p.note}` : ''}`,
                        url: `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=15/${p.lat}/${p.lng}`,
                      })
                    }
                    data-testid={`share-place-${p.id}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12px] tap"
                    style={{ background: 'rgba(229,179,187,0.10)', color: 'var(--rose)' }}
                  >
                    <Share2 size={12} />
                    Sdílet
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl tap"
                    style={{ background: 'rgba(255,80,100,0.08)' }}
                    aria-label="Smazat"
                    data-testid={`delete-place-${p.id}`}
                  >
                    <Trash2 size={12} style={{ color: '#F5A0AA' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weather popup */}
      <AnimatePresence>
        {weather && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setWeather(null)}
            className="fixed inset-0 z-[600] flex items-center justify-center px-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
            data-testid="weather-popup"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl glass-strong p-6 text-center"
            >
              <div className="mb-1 text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--ink-soft)' }}>
                Počasí · {weather.place.title}
              </div>
              {weather.data?.error ? (
                <div className="py-6 text-sm" style={{ color: 'var(--ink-soft)' }}>
                  Nepovedlo se získat počasí.
                </div>
              ) : weather.data ? (
                <>
                  <div className="my-3 text-7xl">{weather.data.emoji}</div>
                  <div className="font-display text-4xl font-light" style={{ color: 'var(--ink)' }}>
                    {weather.data.temperature}°C
                  </div>
                  <div className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
                    {weather.data.label} · vítr {weather.data.wind} km/h
                  </div>
                </>
              ) : (
                <div className="py-6 text-sm" style={{ color: 'var(--ink-soft)' }}>
                  Sleduji oblohu nad {weather.place.title}…
                </div>
              )}
              <button
                onClick={() => setWeather(null)}
                className="mt-5 w-full rounded-2xl px-4 py-2.5 text-sm tap"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--ink)' }}
                data-testid="weather-close"
              >
                Zavřít
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForm && picked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowForm(false); setPicked(null); }}
            className="fixed inset-0 z-[600] flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
          >
            <motion.div
              initial={{ y: 120 }}
              animate={{ y: 0 }}
              exit={{ y: 120 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[480px] rounded-t-3xl glass-strong p-5 pb-safe"
              data-testid="add-place-sheet"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                  Nové místo
                </span>
                <button
                  onClick={() => { setShowForm(false); setPicked(null); }}
                  className="rounded-full p-1 tap"
                  aria-label="Zavřít"
                >
                  <X size={16} style={{ color: 'var(--ink-soft)' }} />
                </button>
              </div>
              <div className="mb-3 text-xs" style={{ color: 'var(--ink-soft)' }}>
                {picked.lat.toFixed(4)}°, {picked.lng.toFixed(4)}°
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={'Název (např. Naše kavárna)'}
                data-testid="place-title-input"
                className="mb-2 w-full rounded-2xl border bg-transparent px-4 py-3 text-[15px] outline-none"
                style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
              />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Vzpomínka (volitelné)"
                rows={2}
                data-testid="place-note-input"
                className="mb-3 w-full resize-none rounded-2xl border bg-transparent px-4 py-3 text-[14px] outline-none"
                style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
              />
              <button
                onClick={handleSave}
                disabled={!title.trim() || saving}
                data-testid="place-save-btn"
                className="w-full rounded-2xl px-5 py-3 text-[15px] font-medium tap disabled:opacity-50"
                style={{
                  background: 'linear-gradient(180deg, #E5B3BB 0%, #C77A8A 100%)',
                  color: '#1B0E14',
                }}
              >
                {saving ? '…' : 'Uložit místo'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MapPin, X, Trash2, Locate } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import { api } from '../lib/api';
import { useSheetLock } from '../lib/hooks';

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

  return (
    <div className="min-h-screen pb-32">
      <PageHeader
        kicker="Love Map"
        title="Naše místa"
        subtitle={picking ? 'Klepni do mapy a vyber místo' : 'Sbírejte koordináty vašich chvil'}
        right={
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
              <button
                key={p.id}
                onClick={() => mapRef?.flyTo([p.lat, p.lng], 15)}
                data-testid={`place-${p.id}`}
                className="flex w-full items-center justify-between rounded-2xl glass px-4 py-3 text-left tap"
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(p.id);
                  }}
                  className="rounded-full p-2 tap"
                  aria-label="Smazat"
                  data-testid={`delete-place-${p.id}`}
                >
                  <Trash2 size={14} style={{ color: 'var(--ink-soft)' }} />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>

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

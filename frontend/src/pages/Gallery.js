import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Camera, X, Trash2, ImagePlus, Share2, SwitchCamera, Video, Play } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import { api, storage } from '../lib/api';
import { useSheetLock } from '../lib/hooks';
import { shareOrCopy } from '../lib/media';
import { HAPTIC, requestWakeLock, releaseWakeLock } from '../lib/haptics';

const MAX_IMG_DIM = 1280;
const JPEG_QUALITY = 0.82;
const MAX_VIDEO_BYTES = 12 * 1024 * 1024; // 12 MB safe limit for base64 storage

const GALLERY_CACHE_KEY = (pairId) => `gallery:${pairId}`;

function loadCachedPhotos(pairId) {
  try {
    const raw = localStorage.getItem(GALLERY_CACHE_KEY(pairId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.photos) ? parsed.photos : [];
  } catch {
    return [];
  }
}

function saveCachedPhotos(pairId, photos) {
  try {
    localStorage.setItem(GALLERY_CACHE_KEY(pairId), JSON.stringify({
      photos: photos.slice(0, 100), // limit to keep storage reasonable
      savedAt: Date.now(),
    }));
  } catch {
    /* ignore quota */
  }
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, MAX_IMG_DIM / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Read a video File as data URL, with size + duration checks for better UX. */
function readVideo(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_VIDEO_BYTES) {
      reject(new Error(`Video je příliš velké (${Math.round(file.size / 1024 / 1024)} MB). Maximum je 12 MB.`));
      return;
    }

    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(video.src);

      // Warn for very long videos (better than hard block)
      if (duration > 180) {
        reject(new Error('Video je delší než 3 minuty. Zkuste kratší klip pro lepší zážitek.'));
        return;
      }

      // Proceed with reading
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    };

    video.onerror = () => reject(new Error('Nelze načíst video.'));
    video.src = URL.createObjectURL(file);
  });
}

export default function Gallery({ pair }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [showCameraSheet, setShowCameraSheet] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const cameraFallbackRef = useRef(null);
  const libraryRef = useRef(null);
  const cameraBackRef = useRef(null);
  const videoInputRef = useRef(null);

  async function load() {
    if (!pair?.id) return;

    // Instant load from cache for great perceived speed + offline support
    const cached = loadCachedPhotos(pair.id);
    if (cached.length > 0) {
      setPhotos(cached);
      setLoading(false); // hide skeleton immediately if we have cache
    } else {
      setLoading(true);
    }

    try {
      const { data } = await api.get(`/photos/${pair.id}`);
      setPhotos(data);
      saveCachedPhotos(pair.id, data);
    } catch {
      // Network failed — keep showing cached version (offline mode)
      if (cached.length === 0) setLoading(false);
    } finally {
      // only turn off loading if we didn't have cache
      if (cached.length === 0) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair?.id]);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []).slice(0, 8);
    if (files.length === 0) return;
    setUploadError('');
    setUploading(true);
    HAPTIC.light();
    try {
      const token = storage.getToken();
      const sent = [];
      for (const f of files) {
        try {
          const isVideo = f.type.startsWith('video/');
          const dataUrl = isVideo ? await readVideo(f) : await compressImage(f);
          const { data } = await api.post('/photos', {
            pair_id: pair.id,
            sender_token: token,
            data_url: dataUrl,
            caption: '',
          });
          sent.push(data);
        } catch {
          /* skip broken file */
        }
      }
      const newList = [...sent.reverse(), ...photos];
      setPhotos(newList);
      saveCachedPhotos(pair.id, newList);
    } finally {
      setUploading(false);
    }
  }

  async function handleCapturedBlob(blob) {
    if (!blob) return;
    setShowCameraSheet(false);
    setUploading(true);
    try {
      const token = storage.getToken();
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const dataUrl = await compressImage(file);
      const { data } = await api.post('/photos', {
        pair_id: pair.id,
        sender_token: token,
        data_url: dataUrl,
        caption: '',
      });
      const newList = [data, ...photos];
      setPhotos(newList);
      saveCachedPhotos(pair.id, newList);
    } catch {
      /* silent */
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    HAPTIC.warning();
    const newList = photos.filter((p) => p.id !== id);
    setPhotos(newList);
    setViewer(null);
    saveCachedPhotos(pair.id, newList);
    try {
      await api.delete(`/photos/${id}`);
    } catch {
      /* silent */
    }
  }

  function openCamera() {
    // Try native camera sheet first; fallback to file input with capture
    setShowCameraSheet(true);
  }

  return (
    <div className="min-h-screen pb-32">
      <PageHeader
        kicker="Galerie"
        title="Naše vzpomínky"
        subtitle={
          photos.length > 0
            ? `${photos.length} ${photos.length === 1 ? 'vzpomínka' : photos.length < 5 ? 'vzpomínky' : 'vzpomínek'}`
            : 'Začněte sbírat společné chvíle'
        }
        right={
          <button
            onClick={() => libraryRef.current?.click()}
            data-testid="add-photo-btn"
            className="flex h-10 w-10 items-center justify-center rounded-full glass-strong tap"
            aria-label="Přidat z knihovny"
          >
            <Plus size={18} style={{ color: 'var(--rose)' }} />
          </button>
        }
        testid="gallery-header"
      />

      <div className="px-4">
        {/* Capture options — back camera, selfie, video, library */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => cameraBackRef.current?.click()}
            data-testid="capture-back-btn"
            className="flex items-center justify-center gap-2 rounded-2xl glass px-3 py-3 text-[13px] tap"
            style={{ color: 'var(--ink)' }}
          >
            <Camera size={15} style={{ color: 'var(--rose)' }} />
            Zadní fotka
          </button>
          <button
            onClick={openCamera}
            data-testid="upload-from-camera-btn"
            className="flex-1 rounded-2xl glass px-4 py-3 text-sm tap"
            style={{ color: 'var(--ink)' }}
          >
            <SwitchCamera size={15} style={{ color: 'var(--rose)' }} />
            Selfie
          </button>
          <button
            onClick={() => videoInputRef.current?.click()}
            data-testid="capture-video-btn"
            className="flex items-center justify-center gap-2 rounded-2xl glass px-3 py-3 text-[13px] tap"
            style={{ color: 'var(--ink)' }}
          >
            <Video size={15} style={{ color: 'var(--rose)' }} />
            Video
          </button>
          <button
            onClick={() => libraryRef.current?.click()}
            data-testid="upload-from-files-btn"
            className="flex items-center justify-center gap-2 rounded-2xl glass px-3 py-3 text-[13px] tap"
            style={{ color: 'var(--ink)' }}
          >
            <ImagePlus size={15} style={{ color: 'var(--rose)' }} />
            Z knihovny
          </button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={libraryRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden-file"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
          data-testid="file-input-library"
        />
        {/* Back camera photo */}
        <input
          ref={cameraBackRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden-file"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
          data-testid="file-input-back"
        />
        {/* Fallback camera input for devices without getUserMedia */}
        <input
          ref={cameraFallbackRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden-file"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
          data-testid="file-input-front"
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden-file"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
          data-testid="file-input-video"
        />

        {uploading && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 flex items-center gap-3 rounded-2xl glass px-4 py-3 text-sm"
            style={{ color: 'var(--ink-soft)' }}
          >
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Ukládám vzpomínku…
          </motion.div>
        )}
        {uploadError && (
          <div
            className="mb-4 rounded-2xl px-4 py-3 text-sm"
            style={{ background: 'rgba(255,80,100,0.08)', color: '#F5A0AA' }}
          >
            {uploadError}
          </div>
        )}

        {loading && photos.length === 0 ? (
          <SkeletonGrid />
        ) : photos.length === 0 ? (
          <EmptyState onPick={() => libraryRef.current?.click()} onCamera={openCamera} />
        ) : (
          <MasonryGrid photos={photos} onOpen={setViewer} />
        )}
      </div>

      <AnimatePresence>
        {viewer && (
          <PhotoViewer
            photo={viewer}
            onClose={() => setViewer(null)}
            onDelete={() => handleDelete(viewer.id)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCameraSheet && (
          <CameraSheet
            onClose={() => setShowCameraSheet(false)}
            onCapture={handleCapturedBlob}
            onFallback={() => {
              setShowCameraSheet(false);
              setTimeout(() => cameraFallbackRef.current?.click(), 100);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CameraSheet({ onClose, onCapture, onFallback }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [error, setError] = useState(null);

  useSheetLock(true);

  useEffect(() => {
    startCamera(facingMode);
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // Keep screen awake while camera is active
  useEffect(() => {
    if (ready) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => releaseWakeLock();
  }, [ready]);

  async function startCamera(mode) {
    stopCamera();
    setReady(false);
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('no-api');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setReady(true);
      }
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('denied');
      } else {
        setError('unavailable');
      }
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setReady(false);
  }

  function capture() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        stopCamera();
        onCapture(blob);
      },
      'image/jpeg',
      0.9
    );
  }

  function flip() {
    setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'));
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: '#000' }}
      data-testid="camera-sheet"
    >
      {/* Header */}
      <div
        className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 pt-safe"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}
      >
        <button
          onClick={() => { stopCamera(); onClose(); }}
          className="flex h-10 w-10 items-center justify-center rounded-full tap"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          aria-label="Zavrit"
          data-testid="camera-close-btn"
        >
          <X size={20} style={{ color: '#fff' }} />
        </button>
        {ready && (
          <button
            onClick={flip}
            className="flex h-10 w-10 items-center justify-center rounded-full tap"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            aria-label="Prepnout kameru"
            data-testid="camera-flip-btn"
          >
            <SwitchCamera size={20} style={{ color: '#fff' }} />
          </button>
        )}
      </div>

      {/* Video preview */}
      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <Camera size={48} style={{ color: 'rgba(255,255,255,0.3)' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {error === 'denied'
              ? 'Přístup k fotoaparátu byl zamítnut. Povol ho v nastavení prohlížeče.'
              : error === 'no-api'
              ? 'Tvůj prohlížeč nepodporuje přímý přístup k fotoaparátu.'
              : 'Fotoaparát není k dispozici.'}
          </p>
          <button
            onClick={onFallback}
            className="rounded-2xl px-5 py-3 text-sm font-medium tap"
            style={{ background: 'linear-gradient(180deg, #E5B3BB 0%, #C77A8A 100%)', color: '#1B0E14' }}
            data-testid="camera-fallback-btn"
          >
            Vybrat ze souboru
          </button>
        </div>
      ) : (
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
          data-testid="camera-video"
        />
      )}

      <canvas ref={canvasRef} className="hidden" />

      {/* Capture button */}
      {!error && (
        <div
          className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center pb-safe"
          style={{
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)',
            paddingTop: 24,
            background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
          }}
        >
          <button
            onClick={capture}
            disabled={!ready}
            data-testid="camera-capture-btn"
            className="tap disabled:opacity-40"
            aria-label="Vyfotit"
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: '#fff',
              border: '4px solid rgba(255,255,255,0.4)',
              boxShadow: '0 0 0 3px rgba(229,179,187,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                background: ready
                  ? 'linear-gradient(180deg, #E5B3BB 0%, #C77A8A 100%)'
                  : 'rgba(200,200,200,0.5)',
              }}
            />
          </button>
        </div>
      )}
    </motion.div>
  );
}

const PhotoTile = React.memo(function PhotoTile({ photo, onOpen }) {
  const isVideo = photo.media_type === 'video' || photo.data_url?.startsWith('data:video/');
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      onClick={() => onOpen(photo)}
      className="relative block w-full overflow-hidden rounded-2xl tap active:scale-[0.985]"
      data-testid={`photo-tile-${photo.id}`}
    >
      {isVideo ? (
        <>
          <video
            src={photo.data_url}
            preload="metadata"
            muted
            playsInline
            className="block h-auto w-full"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
            >
              <Play size={20} fill="currentColor" style={{ color: '#fff' }} />
            </div>
          </div>
        </>
      ) : (
        <img
          src={photo.data_url}
          alt={photo.caption || 'vzpomínka'}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
      )}
      {photo.caption && (
        <div className="px-2.5 py-1.5 text-[11px] leading-tight" style={{ color: 'var(--ink-soft)' }}>
          {photo.caption}
        </div>
      )}
    </motion.button>
  );
});

function MasonryGrid({ photos, onOpen }) {
  // Simple responsive masonry: 2 columns on mobile, 3 on larger screens
  const cols = [ [], [], [] ];
  photos.forEach((p, i) => {
    const colIndex = i % 3;
    cols[colIndex].push(p);
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="gallery-grid">
      {cols.map((col, idx) => (
        <div key={idx} className={`space-y-3 ${idx === 2 ? 'hidden md:block' : ''} ${idx === 1 ? 'pt-4 md:pt-0' : ''}`}>
          {col.map((p) => (
            <PhotoTile key={p.id} photo={p} onOpen={onOpen} />
          ))}
        </div>
      ))}
    </div>
  );
}



function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.04)', height: 90 + ((i * 27) % 90) }}
        />
      ))}
    </div>
  );
}

function EmptyState({ onPick, onCamera }) {
  return (
    <GlassCard className="flex flex-col items-center px-6 py-10 text-center" testid="gallery-empty">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: 'rgba(229,179,187,0.12)' }}
      >
        <ImagePlus size={22} style={{ color: 'var(--rose)' }} />
      </div>
      <h3 className="font-display text-2xl font-light" style={{ color: 'var(--ink)' }}>
        Tady budou vaše chvíle
      </h3>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        Sluneční odpoledne, ranní pohledy, zachycené úsměvy. Fotky i krátká videa se ukládají bezpečně mezi vámi dvěma.
      </p>
      <div className="mt-5 flex gap-3">
        <button
          onClick={onCamera}
          className="rounded-2xl px-5 py-3 text-sm tap"
          style={{ background: 'linear-gradient(180deg, #E5B3BB 0%, #C77A8A 100%)', color: '#1B0E14' }}
        >
          <Camera size={14} className="mr-2 inline" />
          Vyfotit
        </button>
        <button
          onClick={onPick}
          className="rounded-2xl glass px-5 py-3 text-sm tap"
          style={{ color: 'var(--ink)' }}
        >
          Z knihovny
        </button>
      </div>
    </GlassCard>
  );
}

function PhotoViewer({ photo, onClose, onDelete }) {
  useSheetLock(true);
  const isVideo = photo.media_type === 'video' || photo.data_url?.startsWith('data:video/');

  useEffect(() => {
    requestWakeLock(); // keep screen on while viewing memories
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      releaseWakeLock();
    };
  }, [onClose]);

  async function share() {
    try {
      const res = await fetch(photo.data_url);
      const blob = await res.blob();
      const ext = isVideo ? 'mp4' : 'jpg';
      const file = new File([blob], `vzpominka.${ext}`, { type: blob.type || (isVideo ? 'video/mp4' : 'image/jpeg') });
      await shareOrCopy({
        title: 'Pro Tebe',
        text: photo.caption || 'Naše vzpomínka',
        files: [file],
      });
    } catch {
      /* silent */
    }
  }

  // iOS-style drag to dismiss
  const [dragY, setDragY] = useState(0);

  const handleDragEnd = (event, info) => {
    if (info.offset.y > 120 || info.velocity.y > 600) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(8,8,12,0.96)', backdropFilter: 'blur(24px)' }}
      data-testid="photo-viewer"
    >
      {/* iOS-style drag handle */}
      <div className="flex justify-center pt-2 pb-1">
        <div className="h-1 w-9 rounded-full bg-white/20" />
      </div>

      <div className="flex items-center justify-between px-3 pb-2">
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full glass tap"
          aria-label="Zavrit"
          data-testid="viewer-close-btn"
        >
          <X size={18} style={{ color: 'var(--ink)' }} />
        </button>
        <div className="flex gap-2">
          <button
            onClick={share}
            className="flex h-10 w-10 items-center justify-center rounded-full glass tap"
            aria-label="Sdilet"
            data-testid="viewer-share-btn"
          >
            <Share2 size={18} style={{ color: 'var(--rose)' }} />
          </button>
          <button
            onClick={onDelete}
            className="flex h-10 w-10 items-center justify-center rounded-full glass tap"
            aria-label="Smazat"
            data-testid="viewer-delete-btn"
          >
            <Trash2 size={18} style={{ color: '#F5A0AA' }} />
          </button>
        </div>
      </div>
      {/* Main content area - draggable vertically like iOS Photos */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDrag={(e, info) => setDragY(info.offset.y)}
        onDragEnd={handleDragEnd}
        style={{
          y: dragY,
          opacity: Math.max(0.3, 1 - Math.abs(dragY) / 400),
        }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        className="flex flex-1 items-center justify-center px-4 touch-pan-y"
      >
        {isVideo ? (
          <video
            src={photo.data_url}
            controls
            playsInline
            autoPlay
            className="max-h-full max-w-full rounded-2xl"
            style={{ transform: `scale(${Math.max(0.85, 1 - Math.abs(dragY) / 800)})` }}
          />
        ) : (
          <img
            src={photo.data_url}
            alt={photo.caption || 'vzpomínka'}
            className="max-h-full max-w-full rounded-2xl object-contain"
            style={{ transform: `scale(${Math.max(0.9, 1 - Math.abs(dragY) / 700)})` }}
          />
        )}
      </motion.div>
      {photo.caption && (
        <div className="px-6 pb-safe pb-4 pt-2 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
          {photo.caption}
        </div>
      )}
    </motion.div>
  );
}

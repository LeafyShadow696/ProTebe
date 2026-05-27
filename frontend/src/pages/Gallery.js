import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Camera, X, Trash2, ImagePlus, Share2, Video as VideoIcon, SwitchCamera, Play } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import { api, storage } from '../lib/api';
import { useSheetLock } from '../lib/hooks';
import { shareOrCopy } from '../lib/media';
import { HAPTIC } from '../lib/haptics';

const MAX_IMG_DIM = 1280;
const JPEG_QUALITY = 0.82;
const MAX_VIDEO_BYTES = 12 * 1024 * 1024; // 12 MB safe limit for base64 storage

/** Compress an image File to JPEG dataURL. */
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

/** Read a video File as data URL, with a hard size cap. */
function readVideo(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_VIDEO_BYTES) {
      reject(new Error(`Video je příliš velké (${Math.round(file.size / 1024 / 1024)} MB). Maximum je 12 MB.`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export default function Gallery({ pair }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [viewer, setViewer] = useState(null);
  const libraryRef = useRef(null);
  const cameraBackRef = useRef(null);
  const cameraFrontRef = useRef(null);
  const videoRef = useRef(null);

  async function load() {
    if (!pair?.id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/photos/${pair.id}`);
      setPhotos(data);
    } finally {
      setLoading(false);
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
            media_type: isVideo ? 'video' : 'image',
          });
          sent.push(data);
        } catch (err) {
          if (err?.message) setUploadError(err.message);
        }
      }
      if (sent.length) {
        setPhotos((prev) => [...sent.reverse(), ...prev]);
        HAPTIC.success();
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    HAPTIC.warning();
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    setViewer(null);
    try {
      await api.delete(`/photos/${id}`);
    } catch {
      /* server-side delete failed but UI already updated */
    }
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
            onClick={() => cameraFrontRef.current?.click()}
            data-testid="capture-front-btn"
            className="flex items-center justify-center gap-2 rounded-2xl glass px-3 py-3 text-[13px] tap"
            style={{ color: 'var(--ink)' }}
          >
            <SwitchCamera size={15} style={{ color: 'var(--rose)' }} />
            Selfie
          </button>
          <button
            onClick={() => videoRef.current?.click()}
            data-testid="capture-video-btn"
            className="flex items-center justify-center gap-2 rounded-2xl glass px-3 py-3 text-[13px] tap"
            style={{ color: 'var(--ink)' }}
          >
            <VideoIcon size={15} style={{ color: 'var(--rose)' }} />
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

        {/* Hidden inputs */}
        <input
          ref={libraryRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden-file"
          onChange={(e) => handleFiles(e.target.files)}
          data-testid="file-input-library"
        />
        <input
          ref={cameraBackRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden-file"
          onChange={(e) => handleFiles(e.target.files)}
          data-testid="file-input-back"
        />
        <input
          ref={cameraFrontRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden-file"
          onChange={(e) => handleFiles(e.target.files)}
          data-testid="file-input-front"
        />
        <input
          ref={videoRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden-file"
          onChange={(e) => handleFiles(e.target.files)}
          data-testid="file-input-video"
        />

        {uploading && (
          <div className="mb-4 rounded-2xl glass px-4 py-3 text-sm" style={{ color: 'var(--ink-soft)' }}>
            Ukládám vzpomínku…
          </div>
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
          <EmptyState onPick={() => libraryRef.current?.click()} />
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
    </div>
  );
}

function MasonryGrid({ photos, onOpen }) {
  const left = [];
  const right = [];
  photos.forEach((p, i) => (i % 2 === 0 ? left : right).push(p));

  return (
    <div className="grid grid-cols-2 gap-3" data-testid="gallery-grid">
      <div className="space-y-3">
        {left.map((p) => (
          <PhotoTile key={p.id} photo={p} onOpen={onOpen} />
        ))}
      </div>
      <div className="space-y-3 pt-6">
        {right.map((p) => (
          <PhotoTile key={p.id} photo={p} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function PhotoTile({ photo, onOpen }) {
  const isVideo = photo.media_type === 'video' || photo.data_url?.startsWith('data:video/');
  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => onOpen(photo)}
      className="relative block w-full overflow-hidden rounded-2xl tap"
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
        <div
          className="px-2.5 py-1.5 text-[11px] leading-tight"
          style={{ color: 'var(--ink-soft)' }}
        >
          {photo.caption}
        </div>
      )}
    </motion.button>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.04)',
            height: 90 + ((i * 27) % 90),
          }}
        />
      ))}
    </div>
  );
}

function EmptyState({ onPick }) {
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
      <button
        onClick={onPick}
        className="mt-5 rounded-2xl px-5 py-3 text-sm tap"
        style={{
          background: 'linear-gradient(180deg, #E5B3BB 0%, #C77A8A 100%)',
          color: '#1B0E14',
        }}
      >
        Přidat první vzpomínku
      </button>
    </GlassCard>
  );
}

function PhotoViewer({ photo, onClose, onDelete }) {
  useSheetLock(true);
  const isVideo = photo.media_type === 'video' || photo.data_url?.startsWith('data:video/');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function share() {
    try {
      const res = await fetch(photo.data_url);
      const blob = await res.blob();
      const ext = isVideo ? 'mp4' : 'jpg';
      const file = new File([blob], `vzpominka.${ext}`, { type: blob.type || (isVideo ? 'video/mp4' : 'image/jpeg') });
      await shareOrCopy({
        title: 'Pro Tebe 😍',
        text: photo.caption || 'Naše vzpomínka',
        files: [file],
      });
    } catch {
      /* silent */
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(8,8,12,0.92)', backdropFilter: 'blur(20px)' }}
      data-testid="photo-viewer"
    >
      <div className="flex items-center justify-between p-3 pt-safe">
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full glass tap"
          aria-label="Zavřít"
          data-testid="viewer-close-btn"
        >
          <X size={18} style={{ color: 'var(--ink)' }} />
        </button>
        <div className="flex gap-2">
          <button
            onClick={share}
            className="flex h-10 w-10 items-center justify-center rounded-full glass tap"
            aria-label="Sdílet"
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
      <motion.div
        initial={{ scale: 0.96 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-1 items-center justify-center px-4"
      >
        {isVideo ? (
          <video
            src={photo.data_url}
            controls
            playsInline
            autoPlay
            className="max-h-full max-w-full rounded-2xl"
          />
        ) : (
          <img
            src={photo.data_url}
            alt={photo.caption || 'vzpomínka'}
            className="max-h-full max-w-full rounded-2xl object-contain"
          />
        )}
      </motion.div>
      {photo.caption && (
        <div
          className="px-6 pb-safe pb-4 pt-2 text-center text-sm"
          style={{ color: 'var(--ink-soft)' }}
        >
          {photo.caption}
        </div>
      )}
    </motion.div>
  );
}

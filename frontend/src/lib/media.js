/**
 * Generic image compression for profile photos.
 * Returns a JPEG data URL, max edge `maxDim`, quality `quality`.
 */
export function compressImageFile(file, { maxDim = 512, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Try Web Share API first (native share sheet), fall back to clipboard.
 * Returns 'shared' | 'copied' | 'failed'.
 */
export async function shareOrCopy({ title, text, url, files }) {
  try {
    if (navigator.share) {
      const data = { title, text, url };
      if (files && navigator.canShare && navigator.canShare({ files })) {
        data.files = files;
      }
      await navigator.share(data);
      return 'shared';
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'failed';
    /* fall through */
  }
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText([title, text, url].filter(Boolean).join('\n'));
      return 'copied';
    }
  } catch {
    /* ignore */
  }
  return 'failed';
}

/** Client-side image downscale + compression before upload. */
export type CompressedImage = { blob: Blob; contentType: string };

export async function compressImage(file: File, maxSize = 1600, quality = 0.82): Promise<CompressedImage> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("no-canvas");
    ctx.drawImage(bitmap, 0, 0, width, height); bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((result) => resolve(result), "image/jpeg", quality));
    if (!blob) throw new Error("no-blob"); return { blob, contentType: "image/jpeg" };
  } catch {
    const contentType = /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/.test(file.type) ? file.type : "image/jpeg";
    return { blob: file, contentType };
  }
}
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const root = resolve(process.env["UPLOADS_DIR"] || join(process.env["DATA_DIR"] || "/data", "uploads"));

export async function saveUpload(pairId: string, extension: string, bytes: Uint8Array): Promise<string> {
  const relative = join(pairId, `${crypto.randomUUID()}.${extension}`);
  const target = resolve(root, relative);
  if (!target.startsWith(`${root}/`)) throw new Error("Invalid upload path");
  await mkdir(join(root, pairId), { recursive: true });
  await writeFile(target, bytes, { flag: "wx" });
  return relative;
}

export function uploadPath(relative: string): string {
  const safe = relative.replaceAll("\\", "/");
  const target = resolve(root, safe);
  if (!target.startsWith(`${root}/`) || basename(target) !== basename(safe)) throw new Error("Invalid upload path");
  return target;
}

export async function removeUpload(relative: string): Promise<void> {
  try { await unlink(uploadPath(relative)); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export { root as uploadsRoot };

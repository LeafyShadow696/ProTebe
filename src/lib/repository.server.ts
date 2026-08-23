import { randomUUID } from "node:crypto";
import { getDatabase } from "./sqlite.server";

export type PhotoRecord = { id: string; pair_id: string; storage_path: string; caption: string | null; created_at: string };

export function listPhotoRecords(pairId: string): PhotoRecord[] {
  return getDatabase().prepare("SELECT * FROM photos WHERE pair_id = ? ORDER BY created_at DESC LIMIT 300").all(pairId) as unknown as PhotoRecord[];
}

export function insertPhoto(pairId: string, storagePath: string, caption: string | null): PhotoRecord {
  const row: PhotoRecord = { id: randomUUID(), pair_id: pairId, storage_path: storagePath, caption, created_at: new Date().toISOString() };
  getDatabase().prepare("INSERT INTO photos (id, pair_id, storage_path, caption, created_at) VALUES (?, ?, ?, ?, ?)").run(row.id, row.pair_id, row.storage_path, row.caption, row.created_at);
  return row;
}

export function findPhoto(pairId: string, id: string): PhotoRecord | null {
  return (getDatabase().prepare("SELECT * FROM photos WHERE pair_id = ? AND id = ? LIMIT 1").get(pairId, id) as PhotoRecord | undefined) ?? null;
}

export function deletePhotoRecord(pairId: string, id: string): void {
  getDatabase().prepare("DELETE FROM photos WHERE pair_id = ? AND id = ?").run(pairId, id);
}

export function insertPair(input: { code: string; owner_name: string; partner_name: string; anniversary: string; owner_token: string }) {
  const row = { id: randomUUID(), ...input, partner_token: null as string | null, created_at: new Date().toISOString() };
  getDatabase().prepare("INSERT INTO pairs (id, code, owner_name, partner_name, anniversary, owner_token, partner_token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(row.id, row.code, row.owner_name, row.partner_name, row.anniversary, row.owner_token, row.partner_token, row.created_at);
  return row;
}

export function findPairByTokenRecord(token: string) {
  return (getDatabase().prepare("SELECT * FROM pairs WHERE owner_token = ? OR partner_token = ? LIMIT 1").get(token, token) as any) ?? null;
}
export function findPairById(id: string) { return getDatabase().prepare("SELECT * FROM pairs WHERE id = ? LIMIT 1").get(id) as any; }
export function findPairByCode(code: string) { return getDatabase().prepare("SELECT * FROM pairs WHERE code = ? LIMIT 1").get(code) as any; }
export function updatePair(id: string, patch: Record<string, string | null>) {
  const keys = Object.keys(patch);
  if (!keys.length) return findPairById(id);
  const sql = `UPDATE pairs SET ${keys.map((key) => `${key} = ?`).join(", ")} WHERE id = ?`;
  getDatabase().prepare(sql).run(...keys.map((key) => patch[key] ?? null), id);
  return findPairById(id);
}

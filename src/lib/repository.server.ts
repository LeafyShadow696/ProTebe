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

export type MessageRecord = { id: string; pair_id: string; author: "owner" | "partner"; body: string; reaction: string | null; pinned: number; deliver_at: string | null; created_at: string };
export function listMessageRecords(pairId: string): MessageRecord[] { return getDatabase().prepare("SELECT * FROM messages WHERE pair_id = ? ORDER BY created_at DESC LIMIT 300").all(pairId) as unknown as MessageRecord[]; }
export function insertMessage(input: Omit<MessageRecord, "id" | "created_at" | "reaction" | "pinned">) { const row = { ...input, id: randomUUID(), reaction: null, pinned: 0, created_at: new Date().toISOString() }; getDatabase().prepare("INSERT INTO messages (id, pair_id, author, body, reaction, pinned, deliver_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(row.id, row.pair_id, row.author, row.body, row.reaction, row.pinned, row.deliver_at, row.created_at); return row; }
export function updateMessageRecord(pairId: string, id: string, patch: { reaction?: string | null; pinned?: boolean }) { const keys = Object.keys(patch); if (!keys.length) return; getDatabase().prepare(`UPDATE messages SET ${keys.map((key) => `${key} = ?`).join(", ")} WHERE pair_id = ? AND id = ?`).run(...keys.map((key) => { const value = patch[key as keyof typeof patch]; return value === undefined ? null : typeof value === "boolean" ? (value ? 1 : 0) : value; }), pairId, id); }
export function deleteMessageRecord(pairId: string, id: string) { getDatabase().prepare("DELETE FROM messages WHERE pair_id = ? AND id = ?").run(pairId, id); }

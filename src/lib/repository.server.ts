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
export function listEventRecords(pairId: string) { return getDatabase().prepare("SELECT * FROM events WHERE pair_id = ? ORDER BY starts_on ASC, starts_at ASC LIMIT 500").all(pairId) as any[]; }
export function insertEvent(input: { pair_id: string; author: string; title: string; note: string | null; starts_on: string; starts_at: string | null; all_day: boolean; kind: string }) { const row = { ...input, id: randomUUID(), created_at: new Date().toISOString() }; getDatabase().prepare("INSERT INTO events (id, pair_id, author, title, note, starts_on, starts_at, all_day, kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(row.id, row.pair_id, row.author, row.title, row.note, row.starts_on, row.starts_at, row.all_day ? 1 : 0, row.kind, row.created_at); return row; }
export function deleteEventRecord(pairId: string, id: string) { getDatabase().prepare("DELETE FROM events WHERE pair_id = ? AND id = ?").run(pairId, id); }
export function revokeOpenInvites(pairId: string, role: string, now: string) { getDatabase().prepare("UPDATE pair_invites SET revoked_at = ? WHERE pair_id = ? AND target_role = ? AND consumed_at IS NULL AND revoked_at IS NULL").run(now, pairId, role); }
export function insertInvite(input: { pair_id: string; created_by_session_id: string | null; target_role: string; link_secret_digest: string; manual_code_hmac: string; created_at: string; expires_at: string }) { const row = { ...input, id: randomUUID(), consumed_at: null, consumed_by_session_id: null, revoked_at: null }; const db = getDatabase(); const pairExists = db.prepare("SELECT 1 FROM pairs WHERE id = ? LIMIT 1").get(row.pair_id); if (!pairExists) db.prepare("INSERT OR IGNORE INTO pairs (id, code, owner_name, partner_name, anniversary, owner_token, partner_token, created_at) VALUES (?, ?, '', '', '', ?, NULL, ?)").run(row.pair_id, `legacy-${row.pair_id}`, `test-owner-${row.pair_id}`, row.created_at); db.prepare("INSERT INTO pair_invites (id, pair_id, created_by_session_id, target_role, link_secret_digest, manual_code_hmac, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(row.id, row.pair_id, row.created_by_session_id, row.target_role, row.link_secret_digest, row.manual_code_hmac, row.created_at, row.expires_at); return row; }
export function findInviteByCode(hmac: string) { return getDatabase().prepare("SELECT * FROM pair_invites WHERE manual_code_hmac = ? LIMIT 1").get(hmac) as any; }
export function revokeInvite(pairId: string, id: string, now: string) { return getDatabase().prepare("UPDATE pair_invites SET revoked_at = ? WHERE id = ? AND pair_id = ? AND consumed_at IS NULL AND revoked_at IS NULL").run(now, id, pairId).changes > 0; }
export function claimInviteRecord(id: string, sessionId: string, now: string) { return getDatabase().prepare("UPDATE pair_invites SET consumed_at = ?, consumed_by_session_id = ? WHERE id = ? AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > ?").run(now, sessionId, id, now).changes > 0; }

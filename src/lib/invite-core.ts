/**
 * Fáze C3 — pure invite rules (no I/O, no secrets).
 */
import { formatManualCodeForDisplay, normalizeManualCode } from "./auth-v2-format";

export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
export const INVITE_TARGET_ROLE = "partner" as const;
export const INVITE_INVALID_MESSAGE = "Tento kód už neplatí. Požádej o nový kód.";

export function inviteExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_MS);
}

export function isInviteExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  const at = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return !(at.getTime() > now.getTime());
}

export function buildInviteDeepLink(code: string, secret: string): string {
  return `/?join=${encodeURIComponent(code)}#s=${encodeURIComponent(secret)}`;
}

export type ParsedInviteLink = { code: string; secret: string | null };

export function parseInviteLink(input: { search: string; hash: string }): ParsedInviteLink | null {
  const params = new URLSearchParams(input.search);
  const raw = params.get("join");
  if (!raw) return null;
  const code = normalizeManualCode(raw) ?? "";
  const hash = new URLSearchParams(input.hash.replace(/^#/, ""));
  const secret = hash.get("s");
  return { code, secret: secret && secret.length > 0 ? secret : null };
}

export { formatManualCodeForDisplay };
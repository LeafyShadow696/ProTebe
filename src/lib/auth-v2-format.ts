/**
 * Auth V2 — pure credential formats (no secrets, no I/O).
 */
export const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const SESSION_CREDENTIAL_PREFIX = "ps1";
export const SESSION_SECRET_BYTES = 32;
export const SESSION_SECRET_LENGTH = 43;
export const INVITE_LINK_SECRET_BYTES = 32;
export const MANUAL_CODE_LENGTH = 10;
export const RECOVERY_CODE_LENGTH = 32;
export const SESSION_IDLE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BASE64URL_SECRET_PATTERN = new RegExp(`^[A-Za-z0-9_-]{${SESSION_SECRET_LENGTH}}$`);
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]+$`);

export type SessionCredential = { sessionId: string; secret: string };

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateSessionSecret(): string {
  return toBase64Url(randomBytes(SESSION_SECRET_BYTES));
}

export function generateInviteLinkSecret(): string {
  return toBase64Url(randomBytes(INVITE_LINK_SECRET_BYTES));
}

export function formatSessionCredential(sessionId: string, secret: string): string {
  return `${SESSION_CREDENTIAL_PREFIX}.${sessionId}.${secret}`;
}

export function parseSessionCredential(value: unknown): SessionCredential | null {
  if (typeof value !== "string") return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [prefix, sessionId, secret] = parts as [string, string, string];
  if (prefix !== SESSION_CREDENTIAL_PREFIX) return null;
  if (!UUID_PATTERN.test(sessionId)) return null;
  if (!BASE64URL_SECRET_PATTERN.test(secret)) return null;
  return { sessionId, secret };
}

export function isSessionCredential(value: unknown): value is string {
  return parseSessionCredential(value) !== null;
}

function randomCode(length: number): string {
  const out: string[] = [];
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= 256 - (256 % CODE_ALPHABET.length)) continue;
      out.push(CODE_ALPHABET[byte % CODE_ALPHABET.length]!);
      if (out.length === length) break;
    }
  }
  return out.join("");
}

export function generateManualCode(): string {
  return randomCode(MANUAL_CODE_LENGTH);
}

export function generateRecoveryCode(): string {
  return randomCode(RECOVERY_CODE_LENGTH);
}

export function normalizeCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s\-_]+/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/U/g, "V");
}

function isCodeOfLength(value: string, length: number): boolean {
  return value.length === length && CODE_PATTERN.test(value);
}

export function normalizeManualCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeCode(value);
  return isCodeOfLength(normalized, MANUAL_CODE_LENGTH) ? normalized : null;
}

export function normalizeRecoveryCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeCode(value);
  return isCodeOfLength(normalized, RECOVERY_CODE_LENGTH) ? normalized : null;
}

export function formatManualCodeForDisplay(code: string): string {
  return groupCode(code, 5);
}

export function formatRecoveryCodeForDisplay(code: string): string {
  return groupCode(code, 4);
}

function groupCode(code: string, size: number): string {
  const groups: string[] = [];
  for (let i = 0; i < code.length; i += size) groups.push(code.slice(i, i + size));
  return groups.join("-");
}

export function nextIdleExpiry(now: Date, absoluteExpiry: Date): Date {
  const sliding = now.getTime() + SESSION_IDLE_TTL_MS;
  return new Date(Math.min(sliding, absoluteExpiry.getTime()));
}

export function absoluteExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS);
}

export function isSessionLive(
  session: { idle_expires_at: string; absolute_expires_at: string; revoked_at: string | null },
  now: Date = new Date(),
): boolean {
  if (session.revoked_at) return false;
  const time = now.getTime();
  return (
    time < new Date(session.idle_expires_at).getTime() &&
    time < new Date(session.absolute_expires_at).getTime()
  );
}
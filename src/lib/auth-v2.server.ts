/** Auth V2 — server-only cryptographic primitives. */
import {
  absoluteExpiryFrom,
  formatSessionCredential,
  generateInviteLinkSecret,
  generateManualCode,
  generateRecoveryCode,
  generateSessionSecret,
  nextIdleExpiry,
} from "./auth-v2-format";

export const AUTH_PEPPER_ENV = "AUTH_V2_PEPPER";
const encoder = new TextEncoder();

function requirePepper(): string {
  const pepper = process.env[AUTH_PEPPER_ENV];
  if (!pepper || pepper.length < 16) throw new Error(`${AUTH_PEPPER_ENV} is not configured`);
  return pepper;
}

export function hasAuthPepper(): boolean {
  const pepper = process.env[AUTH_PEPPER_ENV];
  return typeof pepper === "string" && pepper.length >= 16;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export async function hmacHex(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(requirePepper()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function sessionSecretDigest(secret: string): Promise<string> {
  return sha256Hex(`ps1:session:${secret}`);
}
export function inviteLinkSecretDigest(secret: string): Promise<string> {
  return sha256Hex(`ps1:invite-link:${secret}`);
}
export function manualCodeHmac(normalizedCode: string): Promise<string> {
  return hmacHex(`ps1:invite-code:${normalizedCode}`);
}
export function recoveryCodeDigest(normalizedCode: string): Promise<string> {
  return sha256Hex(`ps1:recovery:${normalizedCode}`);
}
export async function verifySessionSecret(secret: string, digest: string): Promise<boolean> {
  return timingSafeEqual(await sessionSecretDigest(secret), digest);
}
export async function verifyInviteLinkSecret(secret: string, digest: string): Promise<boolean> {
  return timingSafeEqual(await inviteLinkSecretDigest(secret), digest);
}
export async function verifyManualCode(normalizedCode: string, hmac: string): Promise<boolean> {
  return timingSafeEqual(await manualCodeHmac(normalizedCode), hmac);
}
export async function verifyRecoveryCode(normalizedCode: string, digest: string): Promise<boolean> {
  return timingSafeEqual(await recoveryCodeDigest(normalizedCode), digest);
}

export type IssuedSession = {
  secret: string;
  digest: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  credential: (sessionId: string) => string;
};

export async function issueSessionSecret(now: Date = new Date()): Promise<IssuedSession> {
  const secret = generateSessionSecret();
  const absoluteExpiresAt = absoluteExpiryFrom(now);
  return {
    secret,
    digest: await sessionSecretDigest(secret),
    idleExpiresAt: nextIdleExpiry(now, absoluteExpiresAt),
    absoluteExpiresAt,
    credential: (sessionId: string) => formatSessionCredential(sessionId, secret),
  };
}

export type IssuedInvite = {
  linkSecret: string;
  linkSecretDigest: string;
  manualCode: string;
  manualCodeHmac: string;
};

export async function issueInvite(): Promise<IssuedInvite> {
  const linkSecret = generateInviteLinkSecret();
  const manualCode = generateManualCode();
  return {
    linkSecret,
    linkSecretDigest: await inviteLinkSecretDigest(linkSecret),
    manualCode,
    manualCodeHmac: await manualCodeHmac(manualCode),
  };
}

export type IssuedRecoveryCode = { code: string; digest: string };
export async function issueRecoveryCode(): Promise<IssuedRecoveryCode> {
  const code = generateRecoveryCode();
  return { code, digest: await recoveryCodeDigest(code) };
}
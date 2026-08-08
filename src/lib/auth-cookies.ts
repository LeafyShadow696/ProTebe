/**
 * Pure cookie plumbing for the pair auth cookies (Fáze C2 hardening).
 */
export const SESSION_COOKIE = "protebe_session";
export const LEGACY_COMPAT_COOKIE = "protebe_legacy_session";
export const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export type AuthCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  maxAge: number;
};

export function authCookieOptions(
  secure: boolean,
  maxAge = COOKIE_MAX_AGE_SECONDS,
): AuthCookieOptions {
  const clamped = Number.isFinite(maxAge)
    ? Math.max(0, Math.min(Math.trunc(maxAge), COOKIE_MAX_AGE_SECONDS))
    : COOKIE_MAX_AGE_SECONDS;
  return { httpOnly: true, sameSite: "lax", path: "/", secure, maxAge: clamped };
}

export type ClearCookieOptions = { path: "/"; sameSite: "lax"; secure: boolean };

export function clearCookieOptions(secure: boolean): ClearCookieOptions {
  return { path: "/", sameSite: "lax", secure };
}

export function readCookieFromHeader(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Auth V2 — the single authorisation point for every protected app operation
 * (Fáze C2). Server-only.
 */

import { deleteCookie, getCookie, getRequestUrl, setCookie } from "@tanstack/react-start/server";

import {
  authCookieOptions,
  clearCookieOptions,
  COOKIE_MAX_AGE_SECONDS,
  LEGACY_COMPAT_COOKIE,
  readCookieFromHeader,
  SESSION_COOKIE,
} from "./auth-cookies";
import { legacyCompatAllowed } from "./auth-transition";
import { isSessionLive, nextIdleExpiry, parseSessionCredential } from "./auth-v2-format";
import { issueSessionSecret, verifySessionSecret } from "./auth-v2.server";
import { INVALID_TOKEN_MESSAGE, isPairToken } from "./pair-credentials";
import { pairTokenSchema } from "./pair-schemas";
import {
  adminClient,
  dbFailure,
  findPairByToken,
  type PairRole,
  type PairRow,
} from "./protebe.server";

export { LEGACY_COMPAT_COOKIE, SESSION_COOKIE };
export const SESSION_TOUCH_AFTER_MS = 24 * 60 * 60 * 1000;
export const UPGRADE_FLAG_ENV = "AUTH_V2_UPGRADE_ENABLED";
export type SessionOrigin = "create" | "invite" | "recovery" | "legacy_migration" | "rotation";
export type AuthMode = "v2" | "legacy";
export type ResolvedSession =
  | { pair: PairRow; role: PairRole; sessionId: string; authMode: "v2" }
  | { pair: PairRow; role: PairRole; sessionId: null; authMode: "legacy" };
export type SessionRow = {
  id: string;
  pair_id: string;
  role: string;
  token_digest: string;
  last_seen_at: string;
  idle_expires_at: string;
  absolute_expires_at: string;
  revoked_at: string | null;
};

export function isUpgradeEnabled(): boolean {
  return String(process.env[UPGRADE_FLAG_ENV] ?? "true").toLowerCase() !== "false";
}

function isSecureRequest(): boolean {
  try {
    return getRequestUrl().protocol === "https:";
  } catch {
    return false;
  }
}

export function readSessionCookie(): string | null {
  try {
    return getCookie(SESSION_COOKIE) ?? null;
  } catch {
    return null;
  }
}

export function readLegacyCompatCookie(): string | null {
  try {
    return getCookie(LEGACY_COMPAT_COOKIE) ?? null;
  } catch {
    return null;
  }
}

export function readSessionCredentialFromRequest(request: Request): string | null {
  return readCookieFromHeader(request.headers.get("cookie"), SESSION_COOKIE);
}

export function readLegacyCompatFromRequest(request: Request): string | null {
  return readCookieFromHeader(request.headers.get("cookie"), LEGACY_COMPAT_COOKIE);
}

export function writeSessionCookie(credential: string): void {
  setCookie(
    SESSION_COOKIE,
    credential,
    authCookieOptions(isSecureRequest(), COOKIE_MAX_AGE_SECONDS),
  );
  clearLegacyCompatCookie();
}

export function clearSessionCookie(): void {
  try {
    deleteCookie(SESSION_COOKIE, clearCookieOptions(isSecureRequest()));
  } catch {
    // Nothing to clear outside a request context.
  }
}

export function writeLegacyCompatCookie(token: string): void {
  if (!isPairToken(token)) return;
  setCookie(
    LEGACY_COMPAT_COOKIE,
    token,
    authCookieOptions(isSecureRequest(), COOKIE_MAX_AGE_SECONDS),
  );
}

export function clearLegacyCompatCookie(): void {
  try {
    deleteCookie(LEGACY_COMPAT_COOKIE, clearCookieOptions(isSecureRequest()));
  } catch {
    // Nothing to clear outside a request context.
  }
}

export function parseRole(value: unknown): PairRole | null {
  if (value === "owner") return "owner";
  if (value === "partner") return "partner";
  return null;
}

async function touchSession(row: SessionRow, now: Date): Promise<void> {
  if (now.getTime() - new Date(row.last_seen_at).getTime() < SESSION_TOUCH_AFTER_MS) return;
  try {
    const supabase = await adminClient();
    const idle = nextIdleExpiry(now, new Date(row.absolute_expires_at));
    const { error } = await supabase
      .from("pair_sessions")
      .update({ last_seen_at: now.toISOString(), idle_expires_at: idle.toISOString() })
      .eq("id", row.id);
    if (error) console.error(`[protebe] session/touch: ${error.message}`);
  } catch (error) {
    console.error(`[protebe] session/touch: ${error instanceof Error ? error.message : "failed"}`);
  }
}

export async function resolveSessionCredential(
  credential: string | null | undefined,
  now: Date = new Date(),
): Promise<ResolvedSession | null> {
  const parsed = parseSessionCredential(credential);
  if (!parsed) return null;

  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("pair_sessions")
    .select("*")
    .eq("id", parsed.sessionId)
    .maybeSingle();
  if (error) throw dbFailure("session/lookup", error);
  if (!data) return null;

  const row = data as unknown as SessionRow;
  if (!(await verifySessionSecret(parsed.secret, row.token_digest))) return null;
  if (!isSessionLive(row, now)) return null;

  const { data: pairRow, error: pairError } = await supabase
    .from("pairs")
    .select("*")
    .eq("id", row.pair_id)
    .maybeSingle();
  if (pairError) throw dbFailure("session/pair", pairError);
  if (!pairRow) return null;

  const role = parseRole(row.role);
  if (!role) {
    console.error(`[protebe] session/role: unexpected role for session ${row.id}`);
    return null;
  }

  await touchSession(row, now);
  return { pair: pairRow as PairRow, role, sessionId: row.id, authMode: "v2" };
}

export function resolveSessionFromCookie(now?: Date): Promise<ResolvedSession | null> {
  return resolveSessionCredential(readSessionCookie(), now ?? new Date());
}

export async function resolveLegacyCompatCredential(
  credential: string | null | undefined,
): Promise<ResolvedSession | null> {
  if (!isPairToken(credential)) return null;
  if (!pairTokenSchema.safeParse(credential).success) return null;
  const found = await findPairByToken(credential);
  if (!found) return null;
  const role = parseRole(found.role);
  if (!role) return null;
  return { pair: found.pair, role, sessionId: null, authMode: "legacy" };
}

export async function resolveActiveSession(now?: Date): Promise<ResolvedSession | null> {
  const v2 = await resolveSessionCredential(readSessionCookie(), now ?? new Date());
  if (v2) return v2;
  if (!legacyCompatAllowed(isUpgradeEnabled())) return null;
  return resolveLegacyCompatCredential(readLegacyCompatCookie());
}

export async function resolveRequestSession(
  request: Request,
  now?: Date,
): Promise<ResolvedSession | null> {
  const v2 = await resolveSessionCredential(
    readSessionCredentialFromRequest(request),
    now ?? new Date(),
  );
  if (v2) return v2;
  if (!legacyCompatAllowed(isUpgradeEnabled())) return null;
  return resolveLegacyCompatCredential(readLegacyCompatFromRequest(request));
}

export async function withSession<T>(run: (session: ResolvedSession) => Promise<T>): Promise<T> {
  const session = await resolveActiveSession();
  if (!session) throw new Error(INVALID_TOKEN_MESSAGE);
  return run(session);
}

export type IssuedSessionRow = {
  sessionId: string;
  credential: string;
};

export async function createSessionRow(input: {
  pairId: string;
  role: PairRole;
  createdVia: SessionOrigin;
  inviteId?: string;
  now?: Date;
}): Promise<IssuedSessionRow> {
  const now = input.now ?? new Date();
  const issued = await issueSessionSecret(now);
  const supabase = await adminClient();

  const { data, error } = await supabase
    .from("pair_sessions")
    .insert({
      pair_id: input.pairId,
      role: input.role,
      token_digest: issued.digest,
      created_via: input.createdVia,
      created_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      idle_expires_at: issued.idleExpiresAt.toISOString(),
      absolute_expires_at: issued.absoluteExpiresAt.toISOString(),
      ...(input.inviteId ? { created_via_invite_id: input.inviteId } : {}),
    })
    .select("id")
    .single();

  if (error || !data) throw dbFailure("session/issue", error ?? "no session row");
  const sessionId = (data as { id: string }).id;
  return { sessionId, credential: issued.credential(sessionId) };
}

export async function issueSessionCookie(input: {
  pairId: string;
  role: PairRole;
  createdVia: SessionOrigin;
  now?: Date;
}): Promise<string> {
  const issued = await createSessionRow(input);
  writeSessionCookie(issued.credential);
  return issued.sessionId;
}

export async function revokeSessionRow(sessionId: string, now: Date = new Date()): Promise<void> {
  const supabase = await adminClient();
  const { error } = await supabase
    .from("pair_sessions")
    .update({ revoked_at: now.toISOString() })
    .eq("id", sessionId)
    .is("revoked_at", null);
  if (error) throw dbFailure("session/revoke", error);
}
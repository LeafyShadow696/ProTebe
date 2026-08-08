/**
 * C2 hardening: the legacy compatibility path and the cookie option helpers.
 * Pure decision logic only — no real pair rows are touched.
 */
import { describe, expect, it } from "vitest";

import {
  authCookieOptions,
  clearCookieOptions,
  COOKIE_MAX_AGE_SECONDS,
  LEGACY_COMPAT_COOKIE,
  readCookieFromHeader,
  SESSION_COOKIE,
} from "@/lib/auth-cookies";
import {
  legacyCompatAllowed,
  legacyTokenForRole,
  planResumeCredential,
} from "@/lib/auth-transition";

describe("auth cookie options", () => {
  it("is always HttpOnly, SameSite=Lax, Path=/ and at most one year", () => {
    const options = authCookieOptions(true);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.maxAge).toBe(COOKIE_MAX_AGE_SECONDS);
    expect(options.maxAge).toBeLessThanOrEqual(365 * 24 * 60 * 60);
  });
  it("takes `secure` from the caller, not a guess", () => {
    expect(authCookieOptions(true).secure).toBe(true);
    expect(authCookieOptions(false).secure).toBe(false);
    expect(clearCookieOptions(true)).toEqual({ path: "/", sameSite: "lax", secure: true });
    expect(clearCookieOptions(false).secure).toBe(false);
  });
  it("clamps a requested max-age into [0, one year]", () => {
    expect(authCookieOptions(false, 10 * 365 * 24 * 60 * 60).maxAge).toBe(COOKIE_MAX_AGE_SECONDS);
    expect(authCookieOptions(false, -5).maxAge).toBe(0);
    expect(authCookieOptions(false, 60.7).maxAge).toBe(60);
    expect(authCookieOptions(false, Number.NaN).maxAge).toBe(COOKIE_MAX_AGE_SECONDS);
  });
  it("reads a named cookie out of a raw header and ignores everything else", () => {
    const header = `a=1; ${SESSION_COOKIE}=ps1.x.y; ${LEGACY_COMPAT_COOKIE}=deadbeef`;
    expect(readCookieFromHeader(header, SESSION_COOKIE)).toBe("ps1.x.y");
    expect(readCookieFromHeader(header, LEGACY_COMPAT_COOKIE)).toBe("deadbeef");
    expect(readCookieFromHeader(header, "protebe_missing")).toBeNull();
    expect(readCookieFromHeader(null, SESSION_COOKIE)).toBeNull();
  });
  it("uses two distinct cookie names", () => {
    expect(SESSION_COOKIE).toBe("protebe_session");
    expect(LEGACY_COMPAT_COOKIE).toBe("protebe_legacy_session");
    expect(SESSION_COOKIE).not.toBe(LEGACY_COMPAT_COOKIE);
  });
});

describe("legacy transition decisions", () => {
  it("mints a V2 session while the upgrade flag is on", () => {
    expect(planResumeCredential(true)).toBe("issue_v2_session");
    expect(legacyCompatAllowed(true)).toBe(false);
  });
  it("only an explicit rollback opens the legacy compatibility path", () => {
    expect(planResumeCredential(false)).toBe("issue_legacy_compat_cookie");
    expect(legacyCompatAllowed(false)).toBe(true);
  });
  it("reads the authoritative legacy token for a role off the pair row", () => {
    const pair = { owner_token: "a".repeat(48), partner_token: "b".repeat(48) };
    expect(legacyTokenForRole(pair, "owner")).toBe(pair.owner_token);
    expect(legacyTokenForRole(pair, "partner")).toBe(pair.partner_token);
    expect(
      legacyTokenForRole({ owner_token: "a".repeat(48), partner_token: null }, "partner"),
    ).toBeNull();
    expect(legacyTokenForRole({ owner_token: "", partner_token: null }, "owner")).toBeNull();
  });
});

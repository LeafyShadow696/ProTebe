import { describe, expect, it, vi } from "vitest";
import { LOGOUT_FAILURE_MESSAGE, logoutTarget, performLogout } from "../../src/lib/auth-logout";

describe("logoutTarget", () => {
  it("targets the current V2 session row", () => {
    expect(logoutTarget({ authMode: "v2", sessionId: "row-1" })).toEqual({ mode: "v2", sessionId: "row-1" });
  });
  it("has nothing to revoke in legacy compatibility mode", () => {
    expect(logoutTarget({ authMode: "legacy", sessionId: null })).toEqual({ mode: "none" });
  });
  it("has nothing to revoke for a malformed or dead cookie", () => {
    expect(logoutTarget(null)).toEqual({ mode: "none" });
    expect(logoutTarget({ authMode: "v2", sessionId: null })).toEqual({ mode: "none" });
  });
});

describe("performLogout", () => {
  it("revokes the row, clears cookies and succeeds", async () => {
    const revoke = vi.fn(async () => undefined); const clearCookies = vi.fn();
    await expect(performLogout({ mode: "v2", sessionId: "row-1" }, { revoke, clearCookies })).resolves.toEqual({ ok: true });
    expect(revoke).toHaveBeenCalledWith("row-1"); expect(clearCookies).toHaveBeenCalledTimes(1);
  });
  it("clears cookies but never reports success when the revoke fails", async () => {
    const revoke = vi.fn(async () => { throw new Error("permission denied for table pair_sessions"); });
    const clearCookies = vi.fn(); const logError = vi.fn();
    await expect(performLogout({ mode: "v2", sessionId: "row-1" }, { revoke, clearCookies, logError })).rejects.toThrow(LOGOUT_FAILURE_MESSAGE);
    expect(clearCookies).toHaveBeenCalledTimes(1); expect(logError).toHaveBeenCalledTimes(1); expect(LOGOUT_FAILURE_MESSAGE).not.toMatch(/pair_sessions|permission/i);
  });
  it("skips the DB call and just clears cookies with no session row", async () => {
    const revoke = vi.fn(async () => undefined); const clearCookies = vi.fn();
    await expect(performLogout({ mode: "none" }, { revoke, clearCookies })).resolves.toEqual({ ok: true });
    expect(revoke).not.toHaveBeenCalled(); expect(clearCookies).toHaveBeenCalledTimes(1);
  });
});
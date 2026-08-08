/**
 * Pure logout core (Fáze C2 finální cleanup).
 */
export const LOGOUT_FAILURE_MESSAGE = "Odhlášení se na serveru nepodařilo dokončit.";
export type LogoutTarget = { mode: "v2"; sessionId: string } | { mode: "none" };
export type LogoutDeps = {
  revoke: (sessionId: string) => Promise<void>;
  clearCookies: () => void;
  logError?: (message: string) => void;
};

export function logoutTarget(
  session: { authMode: "v2" | "legacy"; sessionId: string | null } | null,
): LogoutTarget {
  if (session?.authMode === "v2" && session.sessionId)
    return { mode: "v2", sessionId: session.sessionId };
  return { mode: "none" };
}

export async function performLogout(target: LogoutTarget, deps: LogoutDeps): Promise<{ ok: true }> {
  let revokeFailed = false;
  try {
    if (target.mode === "v2") {
      try {
        await deps.revoke(target.sessionId);
      } catch (error) {
        revokeFailed = true;
        deps.logError?.(
          `[protebe] logout/revoke: ${error instanceof Error ? error.message : "failed"}`,
        );
      }
    }
  } finally {
    deps.clearCookies();
  }
  if (revokeFailed) throw new Error(LOGOUT_FAILURE_MESSAGE);
  return { ok: true };
}

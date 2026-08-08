import type { PairRole, PublicPair } from "./pair-types";

const KEY_TOKEN = "protebe.token";
const KEY_PAIR = "protebe.pair";
const KEY_THEME = "protebe.theme";
const KEY_RECOVERY = "protebe.recovery";

const COOKIE_TOKEN = "protebe_token";
const COOKIE_RECOVERY = "protebe_recovery";
const YEAR_SECONDS = 60 * 60 * 24 * 365;

export type RecoveryRecord = {
  pair_id: string;
  code: string;
  role: PairRole;
};

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${YEAR_SECONDS}; SameSite=Lax${secure}`;
}

function dropCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

function parseRecovery(raw: string | null): RecoveryRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RecoveryRecord> | null;
    if (!parsed?.code || !parsed.pair_id) return null;
    return {
      pair_id: parsed.pair_id,
      code: parsed.code,
      role: parsed.role === "partner" ? "partner" : "owner",
    };
  } catch {
    return null;
  }
}

export const pairStorage = {
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    const local = window.localStorage.getItem(KEY_TOKEN);
    if (local) return local;
    return readCookie(COOKIE_TOKEN);
  },
  getPair(): PublicPair | null {
    if (typeof window === "undefined") return null;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(KEY_PAIR) ?? "null") as
        (PublicPair & { token?: string }) | null;
      if (!parsed) return null;
      const { token: _legacy, ...rest } = parsed;
      return rest as PublicPair;
    } catch {
      return null;
    }
  },
  getRecovery(): RecoveryRecord | null {
    if (typeof window === "undefined") return null;
    const local = parseRecovery(window.localStorage.getItem(KEY_RECOVERY));
    if (local) return local;
    const cookie = parseRecovery(readCookie(COOKIE_RECOVERY));
    if (cookie) window.localStorage.setItem(KEY_RECOVERY, JSON.stringify(cookie));
    return cookie;
  },
  save(pair: PublicPair) {
    window.localStorage.setItem(KEY_PAIR, JSON.stringify(pair));
    const recovery: RecoveryRecord = { pair_id: pair.id, code: pair.code, role: pair.role };
    window.localStorage.setItem(KEY_RECOVERY, JSON.stringify(recovery));
    writeCookie(COOKIE_RECOVERY, JSON.stringify(recovery));
  },
  getTheme(): "dark" | "light" {
    if (typeof window === "undefined") return "dark";
    return window.localStorage.getItem(KEY_THEME) === "light" ? "light" : "dark";
  },
  setTheme(theme: "dark" | "light") {
    window.localStorage.setItem(KEY_THEME, theme);
  },
  clearLegacyToken() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(KEY_TOKEN);
    dropCookie(COOKIE_TOKEN);
  },
  clearToken() {
    if (typeof window === "undefined") return;
    this.clearLegacyToken();
    window.localStorage.removeItem(KEY_PAIR);
  },
  clear() {
    if (typeof window === "undefined") return;
    this.clearToken();
    window.localStorage.removeItem(KEY_RECOVERY);
    dropCookie(COOKIE_RECOVERY);
  },
};
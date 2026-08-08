import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { getPair, logoutDevice, resumeSession } from "@/lib/pair.functions";
import { INVALID_TOKEN_MESSAGE } from "@/lib/pair-credentials";
import { pairStorage } from "@/lib/pair-session";
import type { PublicPair } from "@/lib/pair-types";

type PairContextValue = {
  ready: boolean;
  pair: PublicPair | null;
  theme: "dark" | "light";
  toggleTheme: () => void;
  setPair: (pair: PublicPair) => void;
  refreshPair: () => void;
  relink: () => Promise<boolean>;
  canRelink: boolean;
  leave: () => Promise<void>;
};
const PairContext = createContext<PairContextValue | null>(null);

export function PairProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [pair, setPairState] = useState<PublicPair | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [canRelink, setCanRelink] = useState(false);

  useEffect(() => {
    setTheme(pairStorage.getTheme());
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    const cached = pairStorage.getPair();
    if (cached) setPairState(cached);
    const token = pairStorage.getToken();
    const recovery = pairStorage.getRecovery();
    setCanRelink(Boolean(recovery));
    resumeSession({ data: { ...(token ? { token } : {}), ...(recovery ? { recovery } : {}) } })
      .then((result) => {
        if (cancelled) return;
        if (result.status === "gone") {
          pairStorage.clear();
          setCanRelink(false);
          setPairState(null);
          return;
        }
        pairStorage.save(result.pair);
        if (result.authMode === "v2") pairStorage.clearLegacyToken();
        setPairState(result.pair);
        setCanRelink(true);
        if (result.relinked) toast.success("Propojení jsem obnovil. Jste zase spolu.");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const relink = useCallback(async () => {
    const recovery = pairStorage.getRecovery();
    if (!recovery) return false;
    try {
      const legacy = pairStorage.getToken();
      const result = await resumeSession({
        data: { recovery, ...(legacy ? { token: legacy } : {}) },
      });
      if (result.status === "gone") {
        pairStorage.clear();
        setCanRelink(false);
        setPairState(null);
        return false;
      }
      pairStorage.save(result.pair);
      if (result.authMode === "v2") pairStorage.clearLegacyToken();
      setPairState(result.pair);
      return true;
    } catch {
      return false;
    }
  }, []);

  const refreshPair = useCallback(() => {
    getPair()
      .then((fresh) => {
        pairStorage.save(fresh);
        setPairState(fresh);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "";
        if (message === INVALID_TOKEN_MESSAGE) void relink();
      });
  }, [relink]);

  useEffect(() => {
    if (!pair) return;
    const interval = window.setInterval(refreshPair, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshPair();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [pair, refreshPair]);

  const setPair = useCallback((next: PublicPair) => {
    pairStorage.save(next);
    pairStorage.clearLegacyToken();
    setPairState(next);
    setCanRelink(true);
  }, []);
  const leave = useCallback(async () => {
    const revoked = logoutDevice();
    pairStorage.clear();
    setCanRelink(false);
    setPairState(null);
    await revoked;
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      pairStorage.setTheme(next);
      return next;
    });
  }, []);
  const value = useMemo(
    () => ({ ready, pair, theme, toggleTheme, setPair, refreshPair, relink, canRelink, leave }),
    [ready, pair, theme, toggleTheme, setPair, refreshPair, relink, canRelink, leave],
  );
  return <PairContext.Provider value={value}>{children}</PairContext.Provider>;
}

export function usePairContext(): PairContextValue {
  const context = useContext(PairContext);
  if (!context) throw new Error("usePairContext must be used inside PairProvider");
  return context;
}
export function usePair(): { pair: PublicPair } {
  const { pair } = usePairContext();
  if (!pair) throw new Error("usePair used outside the pair gate");
  return { pair };
}

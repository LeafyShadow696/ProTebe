import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePairContext } from "@/components/PairProvider";
import { onIdle } from "@/lib/idle";
import type { SyncEngineHandle, SyncScope } from "@/lib/sync-engine";
export type { SyncScope };
type SyncContextValue = {
  notify: (scope: SyncScope) => void;
  partnerOnline: boolean;
  connected: boolean;
};
const SyncContext = createContext<SyncContextValue>({
  notify: () => {},
  partnerOnline: false,
  connected: false,
});
const CLIENT_ID = Math.random().toString(36).slice(2);

export function SyncProvider({
  pairId,
  role,
  children,
}: {
  pairId: string | null;
  role: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const { refreshPair } = usePairContext();
  const engineRef = useRef<SyncEngineHandle | null>(null);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [connected, setConnected] = useState(false);
  const refresh = useCallback(
    (scope: SyncScope) => {
      if (!pairId) return;
      if (scope === "all" || scope === "pair") refreshPair();
      if (scope === "all") {
        queryClient.invalidateQueries();
        return;
      }
      if (scope !== "pair") queryClient.invalidateQueries({ queryKey: [scope, pairId] });
    },
    [pairId, queryClient, refreshPair],
  );
  useEffect(() => {
    if (!pairId) {
      setConnected(false);
      setPartnerOnline(false);
      return;
    }
    let cancelled = false;
    const cancelIdle = onIdle(async () => {
      const { startSyncEngine } = await import("@/lib/sync-engine");
      if (cancelled) return;
      const engine = await startSyncEngine({
        pairId,
        role,
        clientId: CLIENT_ID,
        onRefresh: refresh,
        onConnected: setConnected,
        onPartnerOnline: setPartnerOnline,
      });
      if (cancelled) {
        engine.stop();
        return;
      }
      engineRef.current = engine;
    });
    return () => {
      cancelled = true;
      cancelIdle();
      engineRef.current?.stop();
      engineRef.current = null;
      setConnected(false);
      setPartnerOnline(false);
    };
  }, [pairId, role, refresh]);
  useEffect(() => {
    if (!pairId) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh("all");
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [pairId, refresh]);
  const notify = useCallback((scope: SyncScope) => {
    engineRef.current?.notify(scope);
  }, []);
  const value = useMemo(
    () => ({ notify, partnerOnline, connected }),
    [notify, partnerOnline, connected],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}
export function useLiveInterval(): number | false {
  const { connected, partnerOnline } = useSync();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === "visible");
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  if (!visible) return false;
  if (!connected) return 8_000;
  return partnerOnline ? 20_000 : 60_000;
}

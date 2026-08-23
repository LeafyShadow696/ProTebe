export type SyncScope = "messages" | "photos" | "events" | "pair" | "all";
export type SyncEngineHandle = { notify: (scope: SyncScope) => void; stop: () => void };

export async function startSyncEngine(options: {
  pairId: string;
  role: string;
  clientId: string;
  onRefresh: (scope: SyncScope) => void;
  onConnected: (connected: boolean) => void;
  onPartnerOnline: (online: boolean) => void;
}): Promise<SyncEngineHandle> {
  const { pairId } = options;
  let stopped = false;
  const timer = window.setInterval(() => {
    if (!stopped) options.onRefresh("all");
  }, 5000);
  options.onConnected(true);
  options.onPartnerOnline(false);
  options.onRefresh("all");
  return {
    notify: (scope) => { if (!stopped) options.onRefresh(scope); },
    stop: () => { stopped = true; window.clearInterval(timer); options.onConnected(false); },
  };
}

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
  const { supabase } = await import("@/integrations/supabase/client");
  const { pairId, role, clientId } = options;
  const channel = supabase.channel(`protebe:${pairId}`, {
    config: { broadcast: { self: false }, presence: { key: `${role}-${clientId}` } },
  });
  const readPresence = () => {
    const state = channel.presenceState<{ role: string; client: string }>();
    const others = Object.values(state)
      .flat()
      .filter((entry) => entry.client !== clientId);
    options.onPartnerOnline(others.length > 0);
  };
  channel
    .on("broadcast", { event: "changed" }, ({ payload }) => {
      const scope = (payload as { scope?: SyncScope } | null)?.scope ?? "all";
      options.onRefresh(scope);
    })
    .on("presence", { event: "sync" }, readPresence)
    .on("presence", { event: "join" }, readPresence)
    .on("presence", { event: "leave" }, readPresence)
    .subscribe((status) => {
      const connected = status === "SUBSCRIBED";
      options.onConnected(connected);
      if (connected) {
        void channel.track({ role, client: clientId });
        options.onRefresh("all");
      }
    });
  return {
    notify: (scope) => {
      void channel.send({ type: "broadcast", event: "changed", payload: { scope } });
    },
    stop: () => {
      void supabase.removeChannel(channel);
    },
  };
}

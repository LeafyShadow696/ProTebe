import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, LogOut, Moon, Sun } from "lucide-react";
import { toast } from "sonner";

import { GlassCard, PageHeader } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/Onboarding";
import { usePairContext } from "@/components/PairProvider";
import { useSync } from "@/components/SyncProvider";
import { INVITE_INVALID_MESSAGE } from "@/lib/invite-core";
import { createInvite, revokeInvite, type InviteTicket } from "@/lib/invite.functions";
import { updatePair } from "@/lib/pair.functions";

export const Route = createFileRoute("/nastaveni")({
  head: () => ({
    meta: [
      { title: "Náš prostor — Pro Tebe" },
      { name: "description", content: "Jména, náš den, připojení a vzhled aplikace — vše na jednom místě." },
      { property: "og:title", content: "Náš prostor — Pro Tebe" },
      { property: "og:description", content: "Nastavení našeho tichého prostoru." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { pair, setPair, leave, theme, toggleTheme } = usePairContext();
  const updateFn = useServerFn(updatePair);
  const { notify, partnerOnline, connected } = useSync();
  const [ownerName, setOwnerName] = useState(pair?.owner_name ?? "");
  const [partnerName, setPartnerName] = useState(pair?.partner_name ?? "");
  const [anniversary, setAnniversary] = useState(pair?.anniversary ?? "");
  const [leaving, setLeaving] = useState(false);

  const save = useMutation({
    mutationFn: () => updateFn({ data: { owner_name: ownerName.trim() || undefined, partner_name: partnerName.trim() || undefined, anniversary: anniversary || undefined } }),
    onSuccess: (next) => { setPair(next); notify("pair"); toast.success("Uloženo"); },
    onError: () => toast.error("Změny se nepodařilo uložit."),
  });

  if (!pair) return null;
  const canInvite = pair.role === "owner" && !pair.has_partner;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader eyebrow="Nastavení" title="Náš prostor" subtitle="Jména, náš den a vzhled." />
      <section className="px-6">
        <GlassCard strong className="space-y-4 p-5">
          <Field label="On je" value={ownerName} onChange={setOwnerName} />
          <Field label="Ona je" value={partnerName} onChange={setPartnerName} />
          <label className="block"><span className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">Náš den</span><input type="date" value={anniversary} onChange={(event) => setAnniversary(event.target.value)} className="mt-2 w-full rounded-2xl border border-input bg-secondary/50 px-4 py-3 text-foreground outline-none focus:border-ring" /></label>
          <PrimaryButton loading={save.isPending} onClick={() => save.mutate()}>Uložit</PrimaryButton>
        </GlassCard>
      </section>
      <section className="px-6">
        <GlassCard className="p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Připojení</p>
          {canInvite ? <InviteCard /> : null}
          <p className="mt-3 text-xs text-muted-foreground">{pair.has_partner ? "Jste propojení. Vidíte oba to samé, změny se objeví hned." : canInvite ? "Vytvoř jednorázový kód a pošli jí ho. Platí 24 hodin." : "Nový kód pro připojení může vytvořit jen zakladatel prostoru."}</p>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><span className={`size-2 rounded-full ${partnerOnline ? "bg-primary" : connected ? "bg-muted-foreground/60" : "bg-destructive"}`} />{partnerOnline ? "Právě je tady s tebou" : connected ? "Živé propojení je aktivní" : "Připojuji živé propojení…"}</div>
        </GlassCard>
      </section>
      <section className="space-y-3 px-6">
        <button onClick={toggleTheme} className="glass tap flex w-full items-center justify-between rounded-3xl px-5 py-4"><span className="text-sm text-foreground">{theme === "dark" ? "Noční vzhled" : "Denní vzhled"}</span>{theme === "dark" ? <Moon size={17} className="text-primary" /> : <Sun size={17} className="text-primary" />}</button>
        <button aria-busy={leaving} disabled={leaving} onClick={() => { setLeaving(true); leave().then(() => toast.success("Odhlášeno z tohoto zařízení")).catch(() => toast.error("Odhlášení se na serveru nepodařilo dokončit.")).finally(() => setLeaving(false)); }} className="glass tap flex w-full items-center justify-between rounded-3xl px-5 py-4"><span className="text-sm text-foreground">Odhlásit toto zařízení</span><LogOut size={17} className="text-muted-foreground" /></button>
        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">Data zůstanou zachovaná. Toto zařízení bude odpojeno.</p>
      </section>
    </div>
  );
}

function InviteCard() {
  const createFn = useServerFn(createInvite);
  const revokeFn = useServerFn(revokeInvite);
  const [ticket, setTicket] = useState<InviteTicket | null>(null);
  const create = useMutation({ mutationFn: () => createFn({}), onSuccess: (next) => setTicket(next), onError: (error) => toast.error(error instanceof Error && error.message ? error.message : INVITE_INVALID_MESSAGE) });
  const revoke = useMutation({ mutationFn: (inviteId: string) => revokeFn({ data: { invite_id: inviteId } }), onSuccess: () => { setTicket(null); toast.success("Kód byl zrušen"); }, onError: () => toast.error("Kód se nepodařilo zrušit.") });
  function copy(value: string, message: string) { navigator.clipboard?.writeText(value).then(() => toast.success(message)).catch(() => toast.error("Kopírování se nepovedlo")); }
  return <div className="mt-3 space-y-2">{ticket ? <><button onClick={() => copy(ticket.code, "Kód zkopírován")} className="tap flex w-full items-center justify-between rounded-2xl bg-secondary/40 px-4 py-3"><span className="font-display text-xl tracking-[0.22em] text-foreground">{ticket.display_code}</span><Copy size={16} className="text-primary" /></button><p className="text-[11px] text-muted-foreground">Platí 24 hodin. Použije se jen jednou.</p><button onClick={() => copy(`${window.location.origin}${ticket.deep_link}`, "Odkaz na připojení zkopírován")} className="tap w-full rounded-2xl border border-border/60 px-4 py-2.5 text-xs text-foreground">Zkopírovat odkaz na připojení</button><div className="flex gap-2"><button disabled={revoke.isPending} onClick={() => revoke.mutate(ticket.invite_id)} className="tap flex-1 rounded-2xl border border-border/60 px-4 py-2.5 text-xs text-muted-foreground disabled:opacity-60">Zrušit kód</button><button disabled={create.isPending} onClick={() => create.mutate()} className="tap flex-1 rounded-2xl border border-border/60 px-4 py-2.5 text-xs text-foreground disabled:opacity-60">Vygenerovat nový kód</button></div></> : <PrimaryButton loading={create.isPending} onClick={() => create.mutate()}>Vygenerovat nový kód</PrimaryButton>}</div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} maxLength={40} className="mt-2 w-full rounded-2xl border border-input bg-secondary/50 px-4 py-3 text-foreground outline-none focus:border-ring" /></label>;
}
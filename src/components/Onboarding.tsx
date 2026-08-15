import { useEffect, useState } from "react";
import { ArrowRight, Heart, KeyRound, Loader2, RefreshCw, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

import { GlassCard } from "@/components/GlassCard";
import { usePairContext } from "@/components/PairProvider";
import {
  formatManualCodeForDisplay,
  INVITE_INVALID_MESSAGE,
  parseInviteLink,
} from "@/lib/invite-core";
import { createPair, joinPair } from "@/lib/pair.functions";
import type { PublicPair } from "@/lib/pair-types";

export function Onboarding({ onReady }: { onReady: (pair: PublicPair) => void }) {
  const [mode, setMode] = useState<null | "create" | "join">(null);
  const [ownerName, setOwnerName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [anniversary, setAnniversary] = useState("2026-04-03");
  const [joinCode, setJoinCode] = useState("");
  const [joinSecret, setJoinSecret] = useState<string | null>(null);
  const [joinName, setJoinName] = useState("");
  const [loading, setLoading] = useState(false);
  const { canRelink, relink } = usePairContext();

  useEffect(() => {
    const parsed = parseInviteLink({
      search: window.location.search,
      hash: window.location.hash,
    });
    if (!parsed) return;

    setJoinCode(parsed.code ? formatManualCodeForDisplay(parsed.code) : "");
    setJoinSecret(parsed.secret);
    setMode("join");

    // The raw invite secret is needed only in memory for this submit. Remove it
    // from the address bar immediately so screenshots/history cannot retain it.
    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
  }, []);

  async function handleCreate() {
    setLoading(true);
    try {
      const pair = await createPair({
        data: {
          owner_name: ownerName.trim() || "Já",
          partner_name: partnerName.trim() || "Ty",
          anniversary,
        },
      });
      onReady(pair);
    } catch {
      toast.error("Nepodařilo se vytvořit náš prostor. Zkus to prosím znovu.");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    setLoading(true);
    try {
      const pair = await joinPair({
        data: {
          code: joinCode,
          ...(joinSecret ? { secret: joinSecret } : {}),
          joiner_name: joinName.trim() || "Ty",
        },
      });
      onReady(pair);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : INVITE_INVALID_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col px-6 pt-safe pb-10">
      <div className="anim-rise flex flex-1 flex-col justify-center">
        <div className="mb-9 flex flex-col items-center text-center">
          <div className="glass-strong mb-6 flex h-16 w-16 items-center justify-center rounded-3xl">
            <Heart size={26} className="text-primary" fill="currentColor" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.34em] text-muted-foreground">Pro Tebe</p>
          <h1 className="mt-3 font-display text-[3.4rem] font-light leading-[0.98] veil-text">
            Můj tichý
            <br />
            svět s tebou
          </h1>
          <p className="mt-4 max-w-[19rem] text-[15px] leading-relaxed text-muted-foreground">
            Náš prostor pro vzpomínky, slova a chvíle. Bez profilů, bez hesel. Jen my dva.
          </p>
        </div>
        {!mode ? (
          <div key="choice" className="anim-fade-up space-y-3">
            <ChoiceButton
              icon={<Sparkles size={19} className="text-primary" />}
              title="Vytvořit náš prostor"
              hint="Dostaneš kód, který pošleš jí"
              onClick={() => setMode("create")}
            />
            <ChoiceButton
              icon={<Users size={19} className="text-primary" />}
              title="Připojit se k páru"
              hint="Mám kód od něj"
              onClick={() => setMode("join")}
            />
            {canRelink ? (
              <ChoiceButton
                icon={<RefreshCw size={19} className="text-primary" />}
                title="Obnovit naše propojení"
                hint="Vrátit se do prostoru z tohoto zařízení"
                onClick={async () => {
                  setLoading(true);
                  const ok = await relink();
                  setLoading(false);
                  if (!ok) toast.error("Propojení se nepodařilo obnovit. Použij prosím kód.");
                }}
              />
            ) : null}
          </div>
        ) : mode === "create" ? (
          <div key="create" className="anim-fade-up">
            <GlassCard strong className="space-y-4 p-5">
              <Field
                label="Já jsem"
                value={ownerName}
                onChange={setOwnerName}
                placeholder="Tvé jméno"
              />
              <Field
                label="A ona je"
                value={partnerName}
                onChange={setPartnerName}
                placeholder="Její jméno"
              />
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">
                  Náš den
                </span>
                <input
                  type="date"
                  value={anniversary}
                  onChange={(event) => setAnniversary(event.target.value)}
                  className="field-input mt-2 w-full px-4 py-3 text-foreground outline-none"
                />
              </label>
              <PrimaryButton loading={loading} onClick={handleCreate}>
                Založit náš prostor
              </PrimaryButton>
              <BackButton onClick={() => setMode(null)} />
            </GlassCard>
          </div>
        ) : (
          <div key="join" className="anim-fade-up">
            <GlassCard strong className="space-y-4 p-5">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">
                  Kód pro připojení
                </span>
                <div className="field-input mt-2 flex items-center gap-3 px-4 py-3">
                  <KeyRound size={16} className="text-primary" />
                  <input
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                    placeholder="ABCDE-FGHJK"
                    maxLength={13}
                    className="w-full bg-transparent font-display text-xl tracking-[0.22em] text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </label>
              <Field
                label="Jmenuji se"
                value={joinName}
                onChange={setJoinName}
                placeholder="Tvé jméno"
              />
              <PrimaryButton loading={loading} onClick={handleJoin}>
                Vstoupit
              </PrimaryButton>
              <BackButton onClick={() => setMode(null)} />
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}

function ChoiceButton({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="glass-strong tap flex w-full items-center justify-between rounded-3xl px-5 py-4 text-left ring-1 ring-white/6"
    >
      <span className="flex items-center gap-4">
        <span className="icon-well flex h-11 w-11 items-center justify-center rounded-2xl">
          {icon}
        </span>
        <span>
          <span className="block text-[15px] text-foreground">{title}</span>
          <span className="block text-xs text-muted-foreground">{hint}</span>
        </span>
      </span>
      <ArrowRight size={17} className="text-muted-foreground" />
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={40}
        className="field-input mt-2 w-full px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

export function PrimaryButton({
  children,
  loading,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  loading?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-[15px] font-medium text-primary-foreground shadow-bloom ring-1 ring-primary/45 disabled:opacity-60"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-1 text-center text-xs tracking-[0.18em] uppercase text-muted-foreground"
    >
      Zpět
    </button>
  );
}

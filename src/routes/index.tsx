import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { CalendarHeart, Image as ImageIcon, MessageCircleHeart, Settings2, Wifi } from "lucide-react";

import { GlassCard, PageHeader } from "@/components/GlassCard";
import { CardSkeleton, Shimmer, SmartImage } from "@/components/Skeletons";
import { useLiveInterval, useSync } from "@/components/SyncProvider";
import { usePair } from "@/components/PairProvider";
import { czDays, formatCzechDate, loveDuration, timeOfDayGreeting, toVocativeCz } from "@/lib/cz";
import { listMessages } from "@/lib/messages.functions";
import { listPhotos } from "@/lib/photos.functions";
import { listEvents } from "@/lib/events.functions";
import { pairNames } from "@/lib/pair-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pro Tebe — náš tichý svět" },
      {
        name: "description",
        content:
          "Soukromý prostor pro dva: počítadlo našich dnů, vzkazy s časovou kapslí a galerie vzpomínek.",
      },
      { property: "og:title", content: "Pro Tebe — náš tichý svět" },
      {
        property: "og:description",
        content: "Počítadlo našich dnů, vzkazy a vzpomínky. Jen pro nás dva.",
      },
    ],
  }),
  component: Dashboard,
});

function LoveCounter({ anniversary }: { anniversary: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let frame = 0;
    const id = setInterval(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setNow(new Date()));
    }, 1000);
    return () => {
      clearInterval(id);
      cancelAnimationFrame(frame);
    };
  }, []);
  const duration = loveDuration(anniversary, now);
  return (
    <GlassCard strong className="p-6 text-center">
      <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
        {duration.future ? "Zbývá do našeho dne" : "Spolu už"}
      </p>
      <p className="mt-3 font-display text-6xl font-light leading-none veil-text tabular-nums">
        {duration.days}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{czDays(duration.days)}</p>
      <div className="mt-5 flex justify-center gap-2 text-center">
        {[
          { value: duration.hours, label: "hodin" },
          { value: duration.minutes, label: "minut" },
          { value: duration.seconds, label: "sekund" },
        ].map((unit) => (
          <div key={unit.label} className="min-w-[68px] rounded-2xl bg-secondary/40 px-3 py-2">
            <p className="font-display text-xl text-foreground tabular-nums">
              {String(unit.value).padStart(2, "0")}
            </p>
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              {unit.label}
            </p>
          </div>
        ))}
      </div>
      {duration.years > 0 || duration.months > 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          To je {duration.years > 0 ? `${duration.years} let a ` : ""}
          {duration.months} měsíců s tebou.
        </p>
      ) : null}
    </GlassCard>
  );
}

function Dashboard() {
  const { pair } = usePair();
  const names = pairNames(pair);
  const now = useMemo(() => new Date(), []);
  const messagesFn = useServerFn(listMessages);
  const photosFn = useServerFn(listPhotos);
  const eventsFn = useServerFn(listEvents);
  const liveInterval = useLiveInterval();
  const { partnerOnline } = useSync();
  const messages = useQuery({ queryKey: ["messages", pair.id], queryFn: () => messagesFn(), refetchInterval: liveInterval, staleTime: 5_000 });
  const photos = useQuery({ queryKey: ["photos", pair.id], queryFn: () => photosFn(), refetchInterval: liveInterval, staleTime: 10_000 });
  const events = useQuery({ queryKey: ["events", pair.id], queryFn: () => eventsFn(), refetchInterval: liveInterval, staleTime: 10_000 });
  const latest = messages.data?.find((message) => !message.sealed) ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const nextEvent = events.data?.find((event) => event.starts_on >= today) ?? null;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        eyebrow={timeOfDayGreeting(now)}
        title={<>Ahoj,<br />{toVocativeCz(names.you)}</>}
        subtitle={partnerOnline ? <span className="inline-flex items-center gap-1.5 text-primary"><Wifi size={13} /> {names.you} je právě s tebou v aplikaci</span> : `Náš den je ${formatCzechDate(pair.anniversary)}.`}
      />

      <section className="px-6"><LoveCounter anniversary={pair.anniversary} /></section>

      {!pair.has_partner && pair.role === "owner" ? (
        <section className="px-6">
          <GlassCard className="p-5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Pozvi ji k nám</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Vytvoř jednorázový kód pro připojení. Platí 24 hodin a použít ho lze jen jednou.
            </p>
            <Link
              to="/nastaveni"
              preload="intent"
              className="tap mt-4 flex w-full items-center justify-between rounded-2xl bg-primary/12 px-4 py-3 text-sm text-primary"
            >
              Vytvořit kód pro připojení
              <Settings2 size={16} />
            </Link>
          </GlassCard>
        </section>
      ) : null}

      <section className="space-y-3 px-6">
        {events.isLoading ? <CardSkeleton lines={1} /> : nextEvent ? (
          <Link to="/kalendar" preload="intent" className="block">
            <GlassCard className="flex items-center gap-4 p-5">
              <div className="flex h-14 w-14 flex-none flex-col items-center justify-center rounded-2xl bg-primary/12">
                <span className="font-display text-xl leading-none text-foreground">{Number(nextEvent.starts_on.slice(8, 10))}</span>
                <span className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{formatCzechDate(nextEvent.starts_on).split(" ")[1]?.slice(0, 3)}</span>
              </div>
              <div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Před námi</p><p className="mt-1 truncate font-display text-xl font-light text-foreground">{nextEvent.title}</p>{nextEvent.starts_at ? <p className="text-xs text-muted-foreground">{nextEvent.starts_at}</p> : null}</div>
              <CalendarHeart size={16} className="ml-auto flex-none text-primary" />
            </GlassCard>
          </Link>
        ) : null}

        <Link to="/vzkazy" preload="intent" className="block">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between"><p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Poslední vzkaz</p><MessageCircleHeart size={16} className="text-primary" /></div>
            {messages.isLoading ? <Shimmer className="mt-3 h-6 w-3/4" /> : <p className="mt-3 line-clamp-3 font-display text-xl font-light leading-snug text-foreground">{latest?.body ?? "Ještě tu není žádné slovo. Napiš první."}</p>}
          </GlassCard>
        </Link>

        <Link to="/galerie" preload="intent" className="block">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between"><p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Naše vzpomínky</p><ImageIcon size={16} className="text-primary" /></div>
            {photos.data && photos.data.length > 0 ? <div className="mt-3 flex gap-2 overflow-hidden">{photos.data.slice(0, 4).map((photo) => <SmartImage key={photo.id} src={photo.url} alt={photo.caption ?? "Naše vzpomínka"} className="h-20 w-20 flex-none rounded-2xl object-cover" />)}</div> : <p className="mt-3 text-sm text-muted-foreground">Zatím prázdno. Přidej první fotku.</p>}
          </GlassCard>
        </Link>
      </section>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Apple,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { GlassCard, PageHeader } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/Onboarding";
import { usePair } from "@/components/PairProvider";
import { useLiveInterval, useSync } from "@/components/SyncProvider";
import { formatCzechDate } from "@/lib/cz";
import {
  createEvent,
  deleteEvent,
  getCalendarFeed,
  listEvents,
  type EventKind,
  type EventView,
} from "@/lib/events.functions";

const KINDS: { value: EventKind; label: string; emoji: string }[] = [
  { value: "date", label: "Rande", emoji: "🍷" },
  { value: "moment", label: "Chvíle", emoji: "✨" },
  { value: "anniversary", label: "Výročí", emoji: "💞" },
  { value: "trip", label: "Cesta", emoji: "🧳" },
  { value: "reminder", label: "Nezapomeň", emoji: "🔔" },
];
const DAY_LABELS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const MONTHS = [
  "Leden",
  "Únor",
  "Březen",
  "Duben",
  "Květen",
  "Červen",
  "Červenec",
  "Srpen",
  "Září",
  "Říjen",
  "Listopad",
  "Prosinec",
];

export const Route = createFileRoute("/kalendar")({
  head: () => ({
    meta: [
      { title: "Náš kalendář — Pro Tebe" },
      {
        name: "description",
        content:
          "Společný kalendář pro dva: rande, výročí a plány. S přenosem do Apple i Google kalendáře.",
      },
      { property: "og:title", content: "Náš kalendář — Pro Tebe" },
      { property: "og:description", content: "Naše chvíle, které nás čekají." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPage,
});

function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function CalendarPage() {
  const { pair } = usePair();
  const queryClient = useQueryClient();
  const { notify } = useSync();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(isoDay(today));
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [time, setTime] = useState("");
  const [kind, setKind] = useState<EventKind>("date");

  const listFn = useServerFn(listEvents);
  const createFn = useServerFn(createEvent);
  const deleteFn = useServerFn(deleteEvent);
  const feedFn = useServerFn(getCalendarFeed);
  const events = useQuery({
    queryKey: ["events", pair.id],
    queryFn: () => listFn(),
    refetchInterval: useLiveInterval(),
  });
  const feed = useQuery({
    queryKey: ["calendar-feed", pair.id],
    queryFn: () => feedFn(),
    staleTime: Infinity,
  });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["events", pair.id] });
    notify("events");
  };
  const add = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          title: title.trim(),
          note: note.trim() || null,
          starts_on: selected,
          starts_at: time || null,
          kind,
        },
      }),
    onSuccess: () => {
      setTitle("");
      setNote("");
      setTime("");
      setComposerOpen(false);
      invalidate();
      toast.success("Zapsáno do našeho kalendáře");
    },
    onError: () => toast.error("Nepodařilo se to uložit."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: invalidate,
    onError: () => toast.error("Nepodařilo se smazat."),
  });

  const byDay = useMemo(() => {
    const map = new Map<string, EventView[]>();
    for (const event of events.data ?? []) {
      const list = map.get(event.starts_on) ?? [];
      list.push(event);
      map.set(event.starts_on, list);
    }
    return map;
  }, [events.data]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (string | null)[] = Array.from({ length: offset }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1)
      cells.push(isoDay(new Date(cursor.getFullYear(), cursor.getMonth(), day)));
    return cells;
  }, [cursor]);

  const selectedEvents = byDay.get(selected) ?? [];
  const upcoming = (events.data ?? [])
    .filter((event) => event.starts_on >= isoDay(today))
    .slice(0, 6);
  const feedUrl =
    typeof window !== "undefined" && feed.data ? `${window.location.origin}${feed.data.path}` : "";
  const webcalUrl = feedUrl.replace(/^https?:/, "webcal:");

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        eyebrow="Náš kalendář"
        title="Co nás čeká"
        subtitle="Rande, výročí a plány na jednom místě. Oba vidíte to samé."
      />
      <section className="px-6">
        <GlassCard strong className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              aria-label="Předchozí měsíc"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="tap rounded-full p-2 text-muted-foreground"
            >
              <ChevronLeft size={18} />
            </button>
            <p className="font-display text-xl font-light tracking-wide">
              {MONTHS[cursor.getMonth()]}{" "}
              <span className="text-muted-foreground">{cursor.getFullYear()}</span>
            </p>
            <button
              aria-label="Další měsíc"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="tap rounded-full p-2 text-muted-foreground"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {DAY_LABELS.map((label) => (
              <span
                key={label}
                className="pb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
              >
                {label}
              </span>
            ))}
            {grid.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />;
              const dayEvents = byDay.get(day) ?? [];
              const isToday = day === isoDay(today);
              const isSelected = day === selected;
              const isAnniversary = day.slice(5) === pair.anniversary.slice(5);
              return (
                <button
                  key={day}
                  onClick={() => setSelected(day)}
                  className={`tap relative flex h-11 flex-col items-center justify-center rounded-2xl text-sm transition-colors ${isSelected ? "bg-primary text-primary-foreground shadow-bloom" : isToday ? "bg-primary/12 text-foreground" : "text-foreground/80"}`}
                >
                  <span className={isSelected ? "font-medium" : ""}>{Number(day.slice(-2))}</span>
                  <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                    {isAnniversary ? <span className="text-[8px] leading-none">💞</span> : null}
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        className={`h-1 w-1 rounded-full ${isSelected ? "bg-primary-foreground/80" : "bg-primary"}`}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </GlassCard>
      </section>

      <section className="space-y-3 px-6">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">
            {formatCzechDate(selected)}
          </p>
          <button
            onClick={() => setComposerOpen((open) => !open)}
            className="tap flex items-center gap-1.5 rounded-full bg-primary/12 px-3 py-1.5 text-xs text-primary ring-1 ring-primary/30"
          >
            {composerOpen ? <X size={13} /> : <Plus size={13} />}
            {composerOpen ? "Zavřít" : "Přidat"}
          </button>
        </div>
        {composerOpen ? (
          <div className="anim-fade-up overflow-hidden">
            <GlassCard strong className="space-y-3 p-4">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Co nás čeká?"
                maxLength={120}
                className="field-input w-full border-none bg-transparent px-2 py-1 font-display text-xl font-light outline-none placeholder:text-muted-foreground"
              />
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                maxLength={600}
                placeholder="Detail, místo, poznámka…"
                className="field-input w-full resize-none border-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <div className="flex flex-wrap gap-1.5">
                {KINDS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setKind(option.value)}
                    className={`tap rounded-full px-3 py-1.5 text-xs transition-colors ${kind === option.value ? "bg-primary text-primary-foreground ring-1 ring-primary/45" : "bg-secondary/50 text-muted-foreground ring-1 ring-white/8"}`}
                  >
                    {option.emoji} {option.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="field-input flex flex-1 items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                  Čas
                  <input
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    className="w-full bg-transparent text-xs text-foreground outline-none"
                  />
                </label>
                <PrimaryButton
                  onClick={() => add.mutate()}
                  disabled={!title.trim() || add.isPending}
                  loading={add.isPending}
                >
                  Zapsat
                </PrimaryButton>
              </div>
            </GlassCard>
          </div>
        ) : null}
        {selectedEvents.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">
            Tenhle den je zatím volný. Naplň ho něčím naším.
          </p>
        ) : (
          selectedEvents.map((event) => (
            <EventRow key={event.id} event={event} onDelete={() => remove.mutate(event.id)} />
          ))
        )}
      </section>

      {upcoming.length > 0 ? (
        <section className="space-y-3 px-6">
          <p className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">Před námi</p>
          {upcoming.map((event) => (
            <GlassCard key={`up-${event.id}`} className="flex items-center gap-3 p-3.5">
              <div className="flex h-11 w-11 flex-none flex-col items-center justify-center rounded-2xl bg-primary/12">
                <span className="text-sm font-medium leading-none text-primary">
                  {Number(event.starts_on.slice(-2))}
                </span>
                <span className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                  {MONTHS[Number(event.starts_on.slice(5, 7)) - 1]?.slice(0, 3)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-foreground">{event.title}</p>
                <p className="text-xs text-muted-foreground">
                  {event.starts_at ? `${event.starts_at} · ` : "Celý den · "}
                  {KINDS.find((option) => option.value === event.kind)?.label ?? "Chvíle"}
                </p>
              </div>
            </GlassCard>
          ))}
        </section>
      ) : null}

      <section className="px-6">
        <GlassCard className="space-y-3 p-4">
          <div>
            <p className="font-display text-lg font-light">Mít to i v telefonu</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Přihlas si náš kalendář a všechno nové se v Apple i Google kalendáři objeví samo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={webcalUrl || "#"}
              className="tap flex items-center justify-center gap-2 rounded-2xl bg-secondary/50 px-3 py-2.5 text-xs text-foreground"
            >
              <Apple size={14} /> Apple
            </a>
            <a
              href={
                feedUrl
                  ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`
                  : "#"
              }
              target="_blank"
              rel="noreferrer"
              className="tap flex items-center justify-center gap-2 rounded-2xl bg-secondary/50 px-3 py-2.5 text-xs text-foreground"
            >
              <CalendarPlus size={14} /> Google
            </a>
            <button
              onClick={() => {
                if (!feedUrl) return;
                void navigator.clipboard.writeText(feedUrl);
                toast.success("Odkaz na kalendář zkopírován");
              }}
              className="tap flex items-center justify-center gap-2 rounded-2xl bg-secondary/50 px-3 py-2.5 text-xs text-foreground"
            >
              <Copy size={14} /> Odkaz
            </button>
            <a
              href={feedUrl || "#"}
              download="pro-tebe.ics"
              className="tap flex items-center justify-center gap-2 rounded-2xl bg-secondary/50 px-3 py-2.5 text-xs text-foreground"
            >
              <Download size={14} /> .ics
            </a>
          </div>
        </GlassCard>
      </section>
    </div>
  );
}

function EventRow({ event, onDelete }: { event: EventView; onDelete: () => void }) {
  const kind = KINDS.find((option) => option.value === event.kind);
  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            {event.starts_at ? event.starts_at : "Celý den"} · {kind?.emoji} {kind?.label}
          </p>
          <p className="mt-1.5 font-display text-xl font-light leading-snug">{event.title}</p>
          {event.note ? (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{event.note}</p>
          ) : null}
        </div>
        <button onClick={onDelete} aria-label="Smazat" className="tap rounded-full p-1.5">
          <Trash2 size={14} className="text-muted-foreground" />
        </button>
      </div>
    </GlassCard>
  );
}

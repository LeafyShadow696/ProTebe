import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Lock, Pin, Send, SmilePlus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { GlassCard, PageHeader } from "@/components/GlassCard";
import { CardSkeleton } from "@/components/Skeletons";
import { usePair } from "@/components/PairProvider";
import { useLiveInterval, useSync } from "@/components/SyncProvider";
import { formatCzechDate, toVocativeCz } from "@/lib/cz";
import { pairNames } from "@/lib/pair-types";
import {
  createMessage,
  deleteMessage,
  listMessages,
  updateMessage,
  type MessageView,
} from "@/lib/messages.functions";

const REACTIONS = ["❤️", "🥺", "😍", "🌙", "✨", "😂", "🫶"];
const PROMPTS = [
  "Dneska jsem si vzpomněl na…",
  "Nejvíc se těším na…",
  "Chybí mi tvoje…",
  "Děkuju ti za…",
];

export const Route = createFileRoute("/vzkazy")({
  head: () => ({
    meta: [
      { title: "Vzkazy — Pro Tebe" },
      {
        name: "description",
        content: "Vzkazovník pro dva: krátká slova, reakce, připíchnuté věty a časová kapsle.",
      },
      { property: "og:title", content: "Vzkazy — Pro Tebe" },
      { property: "og:description", content: "Slova, která si necháváme. I ta do budoucna." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessagesPage,
});

function dayLabel(iso: string, today: string): string {
  const day = iso.slice(0, 10);
  if (day === today) return "Dnes";
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (day === yesterday) return "Včera";
  return formatCzechDate(day);
}

function MessagesPage() {
  const { pair } = usePair();
  const queryClient = useQueryClient();
  const { notify, partnerOnline } = useSync();
  const names = pairNames(pair);
  const [body, setBody] = useState("");
  const [capsule, setCapsule] = useState("");
  const [capsuleOpen, setCapsuleOpen] = useState(false);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const listFn = useServerFn(listMessages);
  const createFn = useServerFn(createMessage);
  const updateFn = useServerFn(updateMessage);
  const deleteFn = useServerFn(deleteMessage);
  const liveInterval = useLiveInterval();
  const queryKey = ["messages", pair.id] as const;
  const messages = useQuery({
    queryKey,
    queryFn: () => listFn(),
    refetchInterval: liveInterval,
    staleTime: 5_000,
  });

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
  }, [body]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["messages", pair.id] });
    notify("messages");
  };
  const patchCache = (updater: (list: MessageView[]) => MessageView[]) =>
    queryClient.setQueryData<MessageView[]>(queryKey, (list) => updater(list ?? []));

  const send = useMutation({
    mutationFn: (input: { text: string; deliver: string | null }) =>
      createFn({ data: { body: input.text, deliver_at: input.deliver } }),
    onMutate: ({ text, deliver }) => {
      const optimistic: MessageView = {
        id: `pending-${Date.now()}`,
        body: text,
        author: "owner",
        mine: true,
        reaction: null,
        pinned: false,
        deliver_at: deliver,
        sealed: Boolean(deliver && new Date(deliver) > new Date()),
        created_at: new Date().toISOString(),
      };
      patchCache((list) => [optimistic, ...list]);
      setBody("");
      setCapsule("");
      setCapsuleOpen(false);
      return { id: optimistic.id };
    },
    onSuccess: invalidate,
    onError: (_error, vars, context) => {
      if (context) patchCache((list) => list.filter((message) => message.id !== context.id));
      setBody(vars.text);
      toast.error("Vzkaz se nepodařilo poslat.");
    },
  });

  const patch = useMutation({
    mutationFn: (input: { id: string; reaction?: string | null; pinned?: boolean }) =>
      updateFn({ data: { ...input } }),
    onMutate: (input) =>
      patchCache((list) =>
        list.map((message) => (message.id === input.id ? { ...message, ...input } : message)),
      ),
    onSuccess: invalidate,
    onError: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onMutate: (id) => patchCache((list) => list.filter((message) => message.id !== id)),
    onSuccess: invalidate,
    onError: () => toast.error("Vzkaz se nepodařilo smazat."),
  });

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    send.mutate({ text, deliver: capsule ? new Date(capsule).toISOString() : null });
  };

  const all = messages.data ?? [];
  const pinned = useMemo(
    () => (messages.data ?? []).filter((message) => message.pinned),
    [messages.data],
  );
  const today = new Date().toISOString().slice(0, 10);
  const timeline = useMemo(() => {
    const ordered = [...(messages.data ?? [])].reverse();
    const groups: { day: string; items: MessageView[] }[] = [];
    for (const message of ordered) {
      const day = message.created_at.slice(0, 10);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(message);
      else groups.push({ day, items: [message] });
    }
    return groups;
  }, [messages.data]);

  return (
    <div className="space-y-5 pb-32">
      <PageHeader
        eyebrow="Vzkazovník"
        title="Slova, která zůstávají"
        subtitle={
          partnerOnline
            ? `${names.you} je právě tady s tebou.`
            : `Napiš cokoliv ${names.you || "jí"}. Nebo to zamkni do časové kapsle.`
        }
      />

      {pinned.length > 0 ? (
        <section className="space-y-2 px-6">
          <p className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">
            Připíchnuté
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {pinned.map((message) => (
              <GlassCard key={`pin-${message.id}`} strong className="min-w-[68%] p-3.5">
                <p className="line-clamp-3 font-display text-lg font-light leading-snug">
                  {message.body ?? "Zapečetěný vzkaz"}
                </p>
                <button
                  onClick={() => patch.mutate({ id: message.id, pinned: false })}
                  className="tap mt-2 text-[11px] text-muted-foreground underline-offset-4 hover:underline"
                >
                  Odepnout
                </button>
              </GlassCard>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4 px-5">
        {messages.isLoading ? (
          <div className="space-y-3">
            <CardSkeleton lines={1} />
            <CardSkeleton lines={2} />
            <CardSkeleton lines={1} />
          </div>
        ) : null}
        {timeline.map((group) => (
          <div key={group.day} className="cv-auto space-y-2.5">
            <div className="flex items-center gap-3 px-1">
              <span className="h-px flex-1 bg-border/60" />
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {dayLabel(group.day, today)}
              </span>
              <span className="h-px flex-1 bg-border/60" />
            </div>
            {group.items.map((message) => (
              <Bubble
                key={message.id}
                message={message}
                senderName={message.mine ? names.me : names.you}
                reacting={reactingTo === message.id}
                onToggleReacting={() =>
                  setReactingTo((current) => (current === message.id ? null : message.id))
                }
                onReact={(emoji) => {
                  patch.mutate({
                    id: message.id,
                    reaction: message.reaction === emoji ? null : emoji,
                  });
                  setReactingTo(null);
                }}
                onPin={() => patch.mutate({ id: message.id, pinned: !message.pinned })}
                onDelete={() => remove.mutate(message.id)}
              />
            ))}
          </div>
        ))}
        {all.length === 0 && !messages.isLoading ? (
          <div className="space-y-3 pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Zatím tu není nic. První slovo je na tobě.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setBody(`${prompt} `)}
                  className="tap rounded-full bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground"
                >
                  <Sparkles size={11} className="mr-1 inline text-primary" />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <div className="fixed bottom-[88px] left-1/2 z-20 w-full max-w-[480px] -translate-x-1/2 px-4">
        <GlassCard strong className="p-3">
          {capsuleOpen ? (
            <label className="anim-fade-up mb-2 flex items-center gap-2 overflow-hidden rounded-2xl bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              <Lock size={13} className="text-primary" />
              Otevřít až
              <input
                type="datetime-local"
                value={capsule}
                onChange={(event) => setCapsule(event.target.value)}
                className="field-input w-full border-none bg-transparent px-1 py-1 text-xs text-foreground"
              />
            </label>
          ) : null}
          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                setCapsuleOpen((open) => !open);
                if (capsuleOpen) setCapsule("");
              }}
              aria-label="Časová kapsle"
              className={`tap mb-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full ${capsuleOpen ? "bg-primary/15 text-primary" : "bg-secondary/50 text-muted-foreground"}`}
            >
              {capsuleOpen ? <X size={15} /> : <Clock size={15} />}
            </button>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && body.trim()) {
                  event.preventDefault();
                  submit();
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder={`Co chceš dnes říct ${toVocativeCz(names.you) || "jí"}?`}
              className="max-h-[180px] w-full resize-none bg-transparent py-2 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={submit}
              disabled={!body.trim()}
              aria-label="Poslat vzkaz"
              className="tap mb-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-bloom ring-1 ring-primary/45 transition-opacity disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function Bubble({
  message,
  senderName,
  reacting,
  onToggleReacting,
  onReact,
  onPin,
  onDelete,
}: {
  message: MessageView;
  senderName: string;
  reacting: boolean;
  onToggleReacting: () => void;
  onReact: (emoji: string) => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const mine = message.mine;
  const sealedForMe = message.sealed && message.body === null;
  const time = new Date(message.created_at).toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className={`anim-fade-up flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div
        className={`relative max-w-[84%] rounded-3xl px-4 py-3 ${mine ? "bg-primary/16 text-foreground rounded-br-lg" : "glass text-foreground rounded-bl-lg"}`}
      >
        {sealedForMe ? (
          <p className="flex items-center gap-2 font-display text-lg font-light text-muted-foreground">
            <Lock size={15} className="text-primary" />
            Zapečetěno do {formatCzechDate(message.deliver_at!.slice(0, 10))}
          </p>
        ) : (
          <p className="whitespace-pre-wrap font-display text-xl font-light leading-snug">
            {message.body}
          </p>
        )}
        {message.sealed && message.body !== null ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-primary">
            <Lock size={11} /> Kapsle — otevře se{" "}
            {formatCzechDate(message.deliver_at!.slice(0, 10))}
          </p>
        ) : null}
        <div className="mt-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>{senderName || (mine ? "Ty" : "Ona")}</span>
          <span>{time}</span>
          {message.pinned ? <Pin size={10} className="text-primary" /> : null}
        </div>
        {message.reaction ? (
          <span
            className={`absolute -bottom-3 ${mine ? "left-2" : "right-2"} rounded-full bg-background/90 px-1.5 py-0.5 text-sm shadow-bloom`}
          >
            {message.reaction}
          </span>
        ) : null}
      </div>
      <div className={`mt-1.5 flex items-center gap-1 ${mine ? "flex-row-reverse" : ""}`}>
        <button onClick={onToggleReacting} aria-label="Reagovat" className="tap rounded-full p-1">
          <SmilePlus size={13} className="text-muted-foreground" />
        </button>
        <button onClick={onPin} aria-label="Připíchnout" className="tap rounded-full p-1">
          <Pin
            size={13}
            className={message.pinned ? "text-primary" : "text-muted-foreground"}
            fill={message.pinned ? "currentColor" : "none"}
          />
        </button>
        {mine ? (
          <button onClick={onDelete} aria-label="Smazat" className="tap rounded-full p-1">
            <Trash2 size={13} className="text-muted-foreground" />
          </button>
        ) : null}
      </div>
      {reacting ? (
        <div className="anim-pop glass-strong mt-1 flex items-center gap-1 rounded-full px-2 py-1.5">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReact(emoji)}
              className={`tap rounded-full px-1.5 py-0.5 text-lg ${message.reaction === emoji ? "bg-primary/15" : ""}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { withSession } from "./auth-session.server";
import { adminClient, dbFailure } from "./protebe.server";

export const EVENT_KINDS = ["moment", "date", "anniversary", "reminder", "trip"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export type EventView = {
  id: string;
  title: string;
  note: string | null;
  starts_on: string;
  starts_at: string | null;
  all_day: boolean;
  kind: EventKind;
  author: "owner" | "partner";
  mine: boolean;
};

function asKind(value: string): EventKind {
  return (EVENT_KINDS as readonly string[]).includes(value) ? (value as EventKind) : "moment";
}

export const listEvents = createServerFn({ method: "POST" }).handler(
  async (): Promise<EventView[]> =>
    withSession(async ({ pair, role }) => {
      const supabase = await adminClient();
      const { data: rows, error } = await supabase
        .from("events")
        .select("*")
        .eq("pair_id", pair.id)
        .order("starts_on", { ascending: true })
        .order("starts_at", { ascending: true, nullsFirst: true })
        .limit(500);
      if (error) throw dbFailure("events#1", error);
      return (rows ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        note: row.note,
        starts_on: row.starts_on,
        starts_at: row.starts_at ? String(row.starts_at).slice(0, 5) : null,
        all_day: row.all_day,
        kind: asKind(row.kind),
        author: row.author as "owner" | "partner",
        mine: row.author === role,
      }));
    }),
);

const CreateInput = z.object({
  title: z.string().trim().min(1).max(120),
  note: z.string().trim().max(600).nullable().optional(),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  starts_at: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  kind: z.enum(EVENT_KINDS).optional(),
});

export const createEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data }) =>
    withSession(async ({ pair, role }) => {
      const supabase = await adminClient();
      const { error } = await supabase.from("events").insert({
        pair_id: pair.id,
        author: role,
        title: data.title,
        note: data.note?.trim() ? data.note.trim() : null,
        starts_on: data.starts_on,
        starts_at: data.starts_at ?? null,
        all_day: !data.starts_at,
        kind: data.kind ?? "moment",
      });
      if (error) throw dbFailure("events#2", error);
      return { ok: true };
    }),
  );

export const deleteEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) =>
    withSession(async ({ pair }) => {
      const supabase = await adminClient();
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", data.id)
        .eq("pair_id", pair.id);
      if (error) throw dbFailure("events#4", error);
      return { ok: true };
    }),
  );

export const getCalendarFeed = createServerFn({ method: "POST" }).handler(async () =>
  withSession(async ({ pair }) => {
    const row = pair as unknown as { calendar_key?: string };
    return { path: `/api/public/calendar/${pair.id}.${row.calendar_key ?? ""}.ics` };
  }),
);
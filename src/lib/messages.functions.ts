import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { withSession } from "./auth-session.server";
import { adminClient, dbFailure } from "./protebe.server";

export type MessageView = {
  id: string;
  author: "owner" | "partner";
  body: string | null;
  reaction: string | null;
  pinned: boolean;
  deliver_at: string | null;
  sealed: boolean;
  created_at: string;
  mine: boolean;
};

export const listMessages = createServerFn({ method: "POST" }).handler(
  async (): Promise<MessageView[]> =>
    withSession(async ({ pair, role }) => {
      const supabase = await adminClient();
      const { data: rows, error } = await supabase
        .from("messages")
        .select("*")
        .eq("pair_id", pair.id)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw dbFailure("messages#1", error);
      const now = Date.now();
      return (rows ?? []).map((row) => {
        const sealed = Boolean(row.deliver_at && new Date(row.deliver_at).getTime() > now);
        const mine = row.author === role;
        return {
          id: row.id,
          author: row.author as "owner" | "partner",
          body: sealed && !mine ? null : row.body,
          reaction: row.reaction,
          pinned: row.pinned,
          deliver_at: row.deliver_at,
          sealed,
          created_at: row.created_at,
          mine,
        };
      });
    }),
);

const CreateInput = z.object({
  body: z.string().trim().min(1).max(2000),
  deliver_at: z.string().datetime().nullable().optional(),
});

export const createMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data }) =>
    withSession(async ({ pair, role }) => {
      const supabase = await adminClient();
      const { error } = await supabase.from("messages").insert({
        pair_id: pair.id,
        author: role,
        body: data.body,
        deliver_at: data.deliver_at ?? null,
      });
      if (error) throw dbFailure("messages#2", error);
      return { ok: true };
    }),
  );

const UpdateInput = z.object({
  id: z.string().uuid(),
  reaction: z.string().max(8).nullable().optional(),
  pinned: z.boolean().optional(),
});

export const updateMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data }) =>
    withSession(async ({ pair }) => {
      const supabase = await adminClient();
      const patch: { reaction?: string | null; pinned?: boolean } = {};
      if (data.reaction !== undefined) patch["reaction"] = data.reaction;
      if (data.pinned !== undefined) patch["pinned"] = data.pinned;
      const { error } = await supabase
        .from("messages")
        .update(patch)
        .eq("id", data.id)
        .eq("pair_id", pair.id);
      if (error) throw dbFailure("messages#3", error);
      return { ok: true };
    }),
  );

export const deleteMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) =>
    withSession(async ({ pair }) => {
      const supabase = await adminClient();
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", data.id)
        .eq("pair_id", pair.id);
      if (error) throw dbFailure("messages#4", error);
      return { ok: true };
    }),
  );

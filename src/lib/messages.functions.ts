import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withSession } from "./auth-session.server";
import { deleteMessageRecord, insertMessage, listMessageRecords, updateMessageRecord } from "./repository.server";

export type MessageView = { id: string; author: "owner" | "partner"; body: string | null; reaction: string | null; pinned: boolean; deliver_at: string | null; sealed: boolean; created_at: string; mine: boolean };

export const listMessages = createServerFn({ method: "POST" }).handler(async (): Promise<MessageView[]> => withSession(async ({ pair, role }) => {
  const now = Date.now();
  return listMessageRecords(pair.id).map((row) => { const sealed = Boolean(row.deliver_at && new Date(row.deliver_at).getTime() > now); return { id: row.id, author: row.author, body: sealed && row.author !== role ? null : row.body, reaction: row.reaction, pinned: Boolean(row.pinned), deliver_at: row.deliver_at, sealed, created_at: row.created_at, mine: row.author === role }; });
}));

const CreateInput = z.object({ body: z.string().trim().min(1).max(2000), deliver_at: z.string().datetime().nullable().optional() });
export const createMessage = createServerFn({ method: "POST" }).validator((input: unknown) => CreateInput.parse(input)).handler(async ({ data }) => withSession(async ({ pair, role }) => { insertMessage({ pair_id: pair.id, author: role, body: data.body, deliver_at: data.deliver_at ?? null }); return { ok: true }; }));

const UpdateInput = z.object({ id: z.string().uuid(), reaction: z.string().max(8).nullable().optional(), pinned: z.boolean().optional() });
export const updateMessage = createServerFn({ method: "POST" }).validator((input: unknown) => UpdateInput.parse(input)).handler(async ({ data }) => withSession(async ({ pair }) => { updateMessageRecord(pair.id, data.id, { ...(data.reaction !== undefined ? { reaction: data.reaction } : {}), ...(data.pinned !== undefined ? { pinned: data.pinned } : {}) }); return { ok: true }; }));
export const deleteMessage = createServerFn({ method: "POST" }).validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input)).handler(async ({ data }) => withSession(async ({ pair }) => { deleteMessageRecord(pair.id, data.id); return { ok: true }; }));

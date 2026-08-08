import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { withSession } from "./auth-session.server";
import { adminClient, dbFailure } from "./protebe.server";

export type PhotoView = { id: string; url: string; caption: string | null; created_at: string };

export const listPhotos = createServerFn({ method: "POST" }).handler(
  async (): Promise<PhotoView[]> =>
    withSession(async ({ pair }) => {
      const supabase = await adminClient();
      const { data: rows, error } = await supabase
        .from("photos")
        .select("*")
        .eq("pair_id", pair.id)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw dbFailure("photos#1", error);
      if (!rows || rows.length === 0) return [];
      const { data: signed, error: signError } = await supabase.storage
        .from("memories")
        .createSignedUrls(
          rows.map((row) => row.storage_path),
          60 * 60 * 6,
        );
      if (signError) throw dbFailure("photos#2", signError);
      return rows.map((row, index) => ({
        id: row.id,
        url: signed?.[index]?.signedUrl ?? "",
        caption: row.caption,
        created_at: row.created_at,
      }));
    }),
);

export const deletePhoto = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) =>
    withSession(async ({ pair }) => {
      const supabase = await adminClient();
      const { data: row, error: findError } = await supabase
        .from("photos")
        .select("storage_path")
        .eq("id", data.id)
        .eq("pair_id", pair.id)
        .maybeSingle();
      if (findError) throw dbFailure("photos#4", findError);
      if (!row) return { ok: true };
      await supabase.storage.from("memories").remove([row.storage_path]);
      const { error } = await supabase
        .from("photos")
        .delete()
        .eq("id", data.id)
        .eq("pair_id", pair.id);
      if (error) throw dbFailure("photos#5", error);
      return { ok: true };
    }),
  );

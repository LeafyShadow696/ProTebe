import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { withSession } from "./auth-session.server";
import { deletePhotoRecord, findPhoto, listPhotoRecords } from "./repository.server";
import { removeUpload } from "./local-storage.server";

export type PhotoView = { id: string; url: string; caption: string | null; created_at: string };

export const listPhotos = createServerFn({ method: "POST" }).handler(async (): Promise<PhotoView[]> =>
  withSession(async ({ pair }) => listPhotoRecords(pair.id).map((row) => ({
    id: row.id,
    url: `/api/photos/${row.id}`,
    caption: row.caption,
    created_at: row.created_at,
  }))),
);

export const deletePhoto = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => withSession(async ({ pair }) => {
    const row = findPhoto(pair.id, data.id);
    if (!row) return { ok: true };
    await removeUpload(row.storage_path);
    deletePhotoRecord(pair.id, data.id);
    return { ok: true };
  }));

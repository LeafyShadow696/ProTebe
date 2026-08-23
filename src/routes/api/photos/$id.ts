import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import { findPhoto } from "@/lib/repository.server";
import { uploadPath } from "@/lib/local-storage.server";
import { resolveRequestSession } from "@/lib/auth-session.server";

export const Route = createFileRoute("/api/photos/$id")({
  server: { handlers: {
    GET: async ({ request, params }) => {
      const session = await resolveRequestSession(request);
      if (!session) return new Response("Unauthorized", { status: 401 });
      const photo = findPhoto(session.pair.id, params.id);
      if (!photo) return new Response("Not found", { status: 404 });
      try {
        const bytes = await readFile(uploadPath(photo.storage_path));
        const extension = photo.storage_path.split(".").pop()?.toLowerCase();
        const contentType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : extension === "gif" ? "image/gif" : "image/jpeg";
        return new Response(bytes, { headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" } });
      } catch { return new Response("Not found", { status: 404 }); }
    },
  }},
});

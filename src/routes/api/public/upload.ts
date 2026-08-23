import { createFileRoute } from "@tanstack/react-router";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (!isSameOrigin(request)) return json({ error: "Neplatný požadavek." }, 403);

          const contentType = (request.headers.get("content-type") ?? "").split(";")[0]!.trim();
          const extension = EXT[contentType];
          if (!extension) return json({ error: `Nepodporovaný formát: ${contentType}` }, 415);

          const bytes = new Uint8Array(await request.arrayBuffer());
          if (bytes.byteLength === 0) return json({ error: "Prázdný soubor." }, 400);
          if (bytes.byteLength > 12 * 1024 * 1024)
            return json({ error: "Fotka je příliš velká (max 12 MB)." }, 413);

          const { resolveRequestSession } = await import("@/lib/auth-session.server");
          const session = await resolveRequestSession(request);
          if (!session) return json({ error: "Chybí přihlášení páru." }, 401);
          const pair = session.pair;

          const { saveUpload } = await import("@/lib/local-storage.server");
          const { insertPhoto } = await import("@/lib/repository.server");
          const path = await saveUpload(pair.id, extension, bytes);
          const rawCaption = request.headers.get("x-caption");
          const caption = rawCaption ? decodeURIComponent(rawCaption).slice(0, 160) : null;
          insertPhoto(pair.id, path, caption && caption.length > 0 ? caption : null);
          return json({ ok: true, path });
        } catch (error) {
          console.error(`[protebe] upload: ${error instanceof Error ? error.message : error}`);
          return json({ error: "Upload selhal. Zkus to prosím znovu." }, 500);
        }
      },
    },
  },
});

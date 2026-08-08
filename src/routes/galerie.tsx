import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { GlassCard, PageHeader } from "@/components/GlassCard";
import { usePair } from "@/components/PairProvider";
import { useLiveInterval, useSync } from "@/components/SyncProvider";
import { PhotoGridSkeleton, Shimmer, SmartImage } from "@/components/Skeletons";
import { formatCzechDateTime } from "@/lib/cz";
import { compressImage } from "@/lib/media";
import { deletePhoto, listPhotos, type PhotoView } from "@/lib/photos.functions";

export const Route = createFileRoute("/galerie")({
  head: () => ({
    meta: [
      { title: "Vzpomínky — Pro Tebe" },
      {
        name: "description",
        content: "Galerie našich fotek: nahrání, komprese a soukromé sdílení jen mezi námi dvěma.",
      },
      { property: "og:title", content: "Vzpomínky — Pro Tebe" },
      { property: "og:description", content: "Fotky, které chceme mít pořád u sebe." },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const { pair } = usePair();
  const queryClient = useQueryClient();
  const { notify } = useSync();
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<PhotoView | null>(null);
  const [pending, setPending] = useState(0);

  const listFn = useServerFn(listPhotos);
  const deleteFn = useServerFn(deletePhoto);

  const photos = useQuery({
    queryKey: ["photos", pair.id],
    queryFn: () => listFn(),
    refetchInterval: useLiveInterval(),
    staleTime: 10_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["photos", pair.id] });
    notify("photos");
  };

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      setPending(files.length);
      for (const file of files) {
        const { blob, contentType } = await compressImage(file);
        const response = await fetch("/api/public/upload", {
          method: "POST",
          headers: { "Content-Type": contentType },
          credentials: "same-origin",
          body: blob,
        });
        if (!response.ok) {
          const detail = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(detail?.error ?? `Nahrání selhalo (${response.status})`);
        }
        setPending((count) => Math.max(0, count - 1));
      }
    },
    onSuccess: () => {
      toast.success("Vzpomínka uložena");
      invalidate();
    },
    onSettled: () => setPending(0),
    onError: (error) =>
      toast.error("Fotku se nepodařilo nahrát.", {
        description: error instanceof Error ? error.message : undefined,
      }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      setActive(null);
      invalidate();
    },
  });

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        eyebrow="Galerie"
        title="Naše vzpomínky"
        subtitle="Fotky, které si necháváme jen pro sebe."
        action={
          <button
            onClick={() => inputRef.current?.click()}
            aria-label="Přidat fotku"
            className="glass-strong tap mt-1 flex h-11 w-11 flex-none items-center justify-center rounded-2xl"
          >
            {upload.isPending ? (
              <Loader2 size={17} className="animate-spin text-primary" />
            ) : (
              <ImagePlus size={17} className="text-primary" />
            )}
          </button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) upload.mutate(files);
          event.target.value = "";
        }}
      />

      <section className="px-6">
        {photos.isLoading ? <PhotoGridSkeleton /> : null}
        {photos.data && photos.data.length > 0 ? (
          <div className="columns-2 gap-3 [column-fill:_balance]">
            {Array.from({ length: pending }).map((_, index) => (
              <Shimmer key={`pending-${index}`} className="mb-3 block h-44 w-full rounded-3xl" />
            ))}
            {photos.data.map((photo) => (
              <button
                key={photo.id}
                onClick={() => setActive(photo)}
                className="tap cv-auto mb-3 block w-full overflow-hidden rounded-3xl"
              >
                <SmartImage
                  src={photo.url}
                  alt={photo.caption ?? "Naše vzpomínka"}
                  className="w-full rounded-3xl object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
        {photos.data && photos.data.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <p className="font-display text-2xl font-light text-foreground">Ještě nic tu není</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Přidej první fotku a začneme naši galerii.
            </p>
          </GlassCard>
        ) : null}
      </section>
      {active ? (
        <div className="anim-fade fixed inset-0 z-40 flex flex-col bg-background/92 backdrop-blur-xl">
          <div className="flex items-center justify-between px-5 pt-safe">
            <button
              onClick={() => setActive(null)}
              aria-label="Zavřít"
              className="tap rounded-full p-2"
            >
              <X size={20} className="text-foreground" />
            </button>
            <button
              onClick={() => remove.mutate(active.id)}
              aria-label="Smazat fotku"
              className="tap rounded-full p-2"
            >
              <Trash2 size={18} className="text-muted-foreground" />
            </button>
          </div>
          <div className="anim-pop flex flex-1 items-center justify-center px-4 pb-10">
            <SmartImage
              eager
              src={active.url}
              alt={active.caption ?? "Naše vzpomínka"}
              className="max-h-full w-full rounded-3xl object-contain"
            />
          </div>
          <p className="pb-10 text-center text-xs text-muted-foreground">
            {formatCzechDateTime(active.created_at)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

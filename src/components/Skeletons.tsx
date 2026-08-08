import { useState } from "react";
import { cn } from "@/lib/utils";

export function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={style}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-secondary/40",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.6s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-foreground/8 after:to-transparent",
        className,
      )}
    />
  );
}
export function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="glass space-y-3 rounded-3xl p-5">
      <Shimmer className="h-2.5 w-24 rounded-full" />
      {Array.from({ length: lines }).map((_, index) => (
        <Shimmer key={index} className={index === lines - 1 ? "h-5 w-2/3" : "h-5 w-full"} />
      ))}
    </div>
  );
}
export function PhotoGridSkeleton() {
  const heights = [150, 210, 180, 130, 200, 160];
  return (
    <div className="columns-2 gap-3">
      {heights.map((height, index) => (
        <Shimmer key={index} className="mb-3 block w-full rounded-3xl" style={{ height }} />
      ))}
    </div>
  );
}
export function SmartImage({
  src,
  alt,
  className,
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={cn(
        "transition-[opacity,filter,transform] duration-500 ease-out",
        loaded ? "opacity-100 blur-0 scale-100" : "opacity-0 blur-md scale-[1.02]",
        className,
      )}
    />
  );
}

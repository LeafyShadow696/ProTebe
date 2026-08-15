import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function GlassCard({
  children,
  className,
  strong = false,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        strong ? "glass-strong" : "glass",
        "rounded-3xl ring-1 ring-white/4 transition-shadow duration-300 hover:shadow-bloom",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 px-6 pt-safe">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.34em] text-muted-foreground/90">{eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl font-light leading-[1.05] veil-text">{title}</h1>
        {subtitle ? (
          <p className="mt-2 max-w-[30ch] text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

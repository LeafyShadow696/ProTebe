import { Link } from "@tanstack/react-router";
import { CalendarHeart, Heart, Image, MessageCircleHeart, Settings2 } from "lucide-react";

const TABS = [
  { to: "/", label: "Nás", icon: Heart },
  { to: "/vzkazy", label: "Vzkazy", icon: MessageCircleHeart },
  { to: "/kalendar", label: "Kalendář", icon: CalendarHeart },
  { to: "/galerie", label: "Vzpomínky", icon: Image },
  { to: "/nastaveni", label: "Prostor", icon: Settings2 },
] as const;

export function BottomTabBar() {
  return (
    <nav
      aria-label="Hlavní navigace"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] px-3 pb-safe"
    >
      <div className="glass-strong mb-3 flex min-h-16 items-center gap-1 rounded-[1.75rem] px-2 py-2 shadow-bloom">
        {TABS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            preload="intent"
            aria-label={label}
            className="tap flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            activeOptions={{ exact: to === "/" }}
            activeProps={{
              className:
                "tap flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-2xl bg-primary/12 px-1 py-1.5 text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            }}
          >
            <Icon size={19} strokeWidth={1.6} aria-hidden="true" />
            <span className="text-[9px] font-medium uppercase tracking-[0.08em]">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

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
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 px-4 pb-safe">
      <div className="glass-strong mb-3 flex items-center justify-between rounded-full px-2 py-2 shadow-bloom ring-1 ring-white/15">
        {TABS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            preload="intent"
            aria-label={label}
            className="tap flex flex-1 flex-col items-center gap-1 rounded-full py-2 text-muted-foreground/95"
            activeOptions={{ exact: to === "/" }}
            activeProps={{
              className:
                "tap flex flex-1 flex-col items-center gap-1 rounded-full py-2 text-primary bg-primary/14 ring-1 ring-primary/35",
            }}
          >
            <Icon size={19} strokeWidth={1.6} />
            <span className="text-[9px] tracking-[0.08em] uppercase">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

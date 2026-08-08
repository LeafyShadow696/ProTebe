import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AmbientBackground } from "@/components/AmbientBackground";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Onboarding } from "@/components/Onboarding";
import { PairProvider, usePairContext } from "@/components/PairProvider";
import { SyncProvider } from "@/components/SyncProvider";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-6xl font-light veil-text">404</h1>
        <h2 className="mt-3 text-lg text-foreground">Tady nic není</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tuhle stránku jsem nenašel. Vrať se prosím k nám domů.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="tap inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
          >
            Domů
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl font-light veil-text">Něco se nepovedlo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Zkus to prosím znovu, nebo se vrať domů.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="tap inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
          >
            Zkusit znovu
          </button>
          <a
            href="/"
            className="tap inline-flex items-center justify-center rounded-2xl border border-border px-5 py-3 text-sm text-foreground"
          >
            Domů
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#241a20" },
      { name: "author", content: "Pro Tebe" },
      { name: "robots", content: "noindex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Karla:wght@300;400;500;600&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="cs">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <PairProvider>
        <div className="relative min-h-[100dvh] w-full overflow-x-hidden">
          <AmbientBackground />
          <PairGate />
        </div>
        <Toaster position="top-center" />
      </PairProvider>
    </QueryClientProvider>
  );
}

function PairGate() {
  const { ready, pair, setPair } = usePairContext();
  if (!ready) {
    return (
      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center">
        <span className="font-display text-3xl font-light tracking-wide veil-text">Pro Tebe</span>
      </div>
    );
  }
  if (!pair) return <Onboarding onReady={setPair} />;
  return (
    <SyncProvider pairId={pair.id} role={pair.role}>
      <div className="relative z-10 mx-auto min-h-[100dvh] w-full max-w-[480px] pb-28">
        <Outlet />
        <BottomTabBar />
      </div>
    </SyncProvider>
  );
}
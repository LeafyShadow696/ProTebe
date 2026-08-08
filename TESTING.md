# Testy

## Rychlý přehled

| Příkaz | Co spustí |
| --- | --- |
| `bun run test` | unit testy (alias pro `test:unit`) |
| `bun run test:unit` | Vitest — čistá logika (`tests/unit`) |
| `bun run test:unit:watch` | Vitest ve watch módu |
| `bun run test:e2e` | Playwright smoke testy (`tests/e2e`) |
| `bun run test:ci` | unit testy + typecheck + lint + production build |

## Unit testy (Vitest)

Pokrývají čistou logiku bez sítě a bez databáze:

- `tests/unit/cz.test.ts` — české datum, skloňování ("1 den / 2 dny / 5 dní"), délka vztahu, vokativ.
- `tests/unit/pair-credentials.test.ts` — validace pair tokenů, join kódů a calendar keys; regresní testy na odmítnutí injection-like vstupů.
- `tests/unit/ics.test.ts` — escapování a folding iCalendar výstupu.

## E2E testy (Playwright)

Běží proti dev serveru na `http://localhost:8080`. Pokud server už běží, použije se
(`reuseExistingServer`); jinak si Playwright spustí `vite dev`.

- `tests/e2e/core-flows.spec.ts` — onboarding (vytvoření páru), přežití session přes reload,
  odeslání vzkazu a jeho perzistence, průchod všemi taby bez page erroru.
- `tests/e2e/api.spec.ts` — upload endpoint (funkční upload, odmítnutí špatného tokenu,
  žádné wildcard CORS, žádné DB internals v chybách) a `.ics` feed kalendáře.

### Proměnné prostředí

- `E2E_BASE_URL` — jiná adresa aplikace (default `http://localhost:8080`).
- `E2E_NO_SERVER=1` — nespouštět vlastní dev server.
- `E2E_CHROMIUM_PATH` — cesta k Chromiu, pokud v prostředí není revize, kterou Playwright očekává.

## Zásady

- Testy neobsahují žádné secrets ani produkční credentials — pairing model je anonymní,
  takže si každý test vytvoří vlastní pár.
- Testovací data jsou prefixovaná `E2E-`, aby byla v databázi rozpoznatelná.
- Testy nechodí na žádné externí API.
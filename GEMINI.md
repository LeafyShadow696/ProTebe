# MyShell - Projektové Instrukce

Tento projekt je interaktivní Next.js aplikace (App Router) navržená jako nativní PWA "Romance App" s moderním Glassmorphism vzhledem.

## Klíčové Vlastnosti
- **Native PWA:** Aplikace běží bez simulovaného rámečku telefonu, plně responzivně a v režimu "standalone".
- **Glassmorphism UI:** Průhledné karty, `backdrop-blur` efekty, ambientní gradienty a iOS estetika.
- **Love Counter:** Sleduje čas strávený spolu.
- **AI Poet:** Generuje milostné básně pomocí AI API.
- **Naše Galerie:** Správa společných fotografií (lokální úložiště s kompresí).
- **Google Workspace Koutek:** 
  - Propojení s Google Docs (Společný deník).
  - Posílání mailů přes Gmail.
  - Odesílání zpráv do Google Chat.

## Technické Poznámky
- **Hlavní soubor:** `app/page.tsx` (cca 3000 řádků).
- **Stylování:** Tailwind CSS s využitím `backdrop-blur`, moderních gradientů a zaoblených rohů (`rounded-[32px]`).
- **Animace:** `motion/react` pro plynulé přechody mezi taby.
- **PWA:** Konfigurace v `app/layout.tsx` a `public/manifest.json`.

## Příkazy
- `npm run dev`: Spuštění vývojového serveru.
- `npm run build`: Sestavení produkční verze.

## Provedené Změny (23. 5. 2026)
1. **PWA Transformace:** Odstraněn virtuální mobilní shell, nastaven fluidní layout.
2. **Redesign UI:** Implementován Glassmorphism a iOS vzhled napříč všemi komponentami.
3. **Plná Responzivita:** Layout upraven pro optimální zobrazení na mobilech i desktopu.
4. **Fixes:** Opraveny typové chyby a chybějící stavy z předchozí verze.

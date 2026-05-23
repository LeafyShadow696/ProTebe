# Srdce pro Michaelku

Soukroma mobile-first PWA aplikace pro spolecne vzpominky, vzkazy, mista, galerii, Google Workspace koutek a AI basnika.

## Funkce

- instalovatelna PWA s manifestem, ikonami, theme color a offline fallbackem
- responzivni layout bez renderovani virtualniho telefonu
- lokalni uloziste pro galerii, poznamky, mista, milniky a roli uzivatele
- volitelne Google Workspace propojeni pro Docs, Gmail a Chat po prihlaseni
- serverovy Gemini endpoint pro generovani romantickych textu

## Lokani spusteni

1. Nainstalujte zavislosti:

   ```bash
   npm install
   ```

2. Vytvorte `.env.local` podle `.env.example` a doplnte hodnoty:

   ```bash
   GEMINI_API_KEY="..."
   GEMINI_MODEL="gemini-2.5-flash"
   APP_URL="http://localhost:3000"
   ```

3. Spustte vyvojovy server:

   ```bash
   npm run dev
   ```

4. Otevrete `http://localhost:3000`.

## Produkcni kontrola

```bash
npm run lint
npm run build
```

Google Workspace funkce vyzaduji platnou Firebase/Google OAuth konfiguraci ve `firebase-applet-config.json` a povolene Google API scopes v Google Cloud/Firebase konzoli.

# PRD — Remix: Srdce pro Michaelku

## Original Problem Statement
Production-ready Progressive Web App (PWA) s názvem „Remix: Srdce pro Michaelku" — intimní romantická aplikace pro pár, působící jako luxusní nativní iOS aplikace. Datum seznámení: 3. 4. 2026. Aplikace má 7 hlavních obrazovek s důrazem na emocionální design, glassmorphism, smooth animace a mobile-first UX.

## Tech Stack (chosen with user — Jan 27, 2026)
- **Frontend**: React 18 (CRA + craco), TailwindCSS, Framer Motion, react-router-dom, react-leaflet, lucide-react, Cormorant Garamond (Google Fonts)
- **Backend**: FastAPI + Motor (MongoDB) + Pydantic v2
- **Database**: MongoDB (UUID string IDs, no ObjectId in responses)
- **AI**: Emergent Universal LLM Key → Claude Sonnet 4.6 (Czech romantic text gen)
- **Maps**: Leaflet + OpenStreetMap tiles (no API key required)
- **Auth**: Anonymous pair-code propojení (žádná registrace, žádná hesla)
- **PWA**: vlastní manifest + service worker (stale-while-revalidate shell cache)

## User Personas
- **Owner (já)**: vytváří pár, dostane pár-kód, sdílí ho s partnerkou.
- **Partner (Michaelka)**: zadá pár-kód, propojí se anonymně přes pár-token.

## Architecture
- Mobile-first (max-width 480px container), bottom tab navigation s 7 taby.
- Anonymous identity via UUID tokens stored in localStorage (`remix.token`, `remix.pair`, `remix.role`).
- Realtime messages = jednoduché 4s polling (lehké a spolehlivé).
- Photos: base64 data URL přímo v Mongo (vhodné pro osobní škálu).
- PWA: standalone display, viewport-fit=cover, safe-area handling, ikony 192/512.

## Implemented Features (Iteration 2 — Jan 27, 2026 evening)
- **Rebrand**: app renamed from "Remix" to **"Pro Tebe 😍"** (title, manifest, PWA shortcut, all UI copy).
- **Default names**: owner pre-fills as **František**, partner as **Michaelka**.
- **Časová kapsle (Time Capsule)** v Messages — odešli zprávu do budoucna, otevře se až ve zvolený den:
  - Lock button vedle send tlačítka
  - Bottom sheet s 5 presety (týden / měsíc / 3 měsíce / půl roku / rok) + vlastní datum picker
  - Indikátor "Časová kapsle — otevře se [datum]" nad input boxem
  - Locked bubble pro odesilatele: „Tvoje kapsle · Čeká pro ni · Otevře se DD. měsíc YYYY · za N dní"
  - Locked bubble pro příjemce: „Kapsle od tebe · Tajemství · Otevře se …"
  - Auto-unlock: re-render každou minutu, takže kapsle se sama „otevře" v daný den
  - Po otevření malý indikátor „kapsle otevřena DD. měsíc YYYY"
- **Backend**: `MessageIn` přijímá nový optional `unlock_date` (YYYY-MM-DD). Plně zpětně kompatibilní.
- **Bug fix**: BottomTabBar se elegantně skryje (fade + slide down) když je otevřený jakýkoli bottom sheet — vyřešen click-intercept problém přes globální `body.sheet-open` CSS pravidlo a `useSheetLock` hook.

## Implemented Features (Iteration 1 — Jan 27, 2026)
1. **Onboarding** — Create new pair / Join via pair-code, ambient hero, Cormorant Garamond „Srdce pro Michaelku".
2. **Love Dashboard** — live counter dní/hodin/minut/sekund od 3. 4. 2026, AI denní citát (auto-cached na den), mood widget dle denní doby, vzpomínek widget.
3. **Galerie vzpomínek** — upload z knihovny / kamery s automatickou kompresí na 1280px / JPEG 0.82, masonry grid 2-column, lazy-load, fullscreen viewer se swipe-out (klávesa Esc).
4. **Vzkazovník** — realtime polling (4s), iMessage-style bubbliny, reakce (5 emoji), pin top, optimistic UI, AI návrh slov bottom-sheet se 4 tóny.
5. **AI Básník** — 5 nálad (něžně/hravě/nostalgicky/s nadějí/vášnivě), volitelná nápověda, lokální historie posledních 6 básní, sdílení přes Web Share API, export na 1080×1350 PNG s gradientem.
6. **Společný kalendář** — měsíční grid (Po-prvni týden), 3 typy událostí (event/anniversary/reminder), virtuální anniversary event 3.4.2026, upcoming list, česky formátované datumy.
7. **Love Map** — Leaflet + OpenStreetMap, custom heart pin, dark filtr na tile-pane, pick-on-tap, locate-me přes Geolocation API, popup se smazáním, places list s navigací.
8. **Nastavení** — pair-code display + copy-to-clipboard, theme switch (Tichá noc / Měkké světlo), browser Notification API permission flow, privacy info, unpair (vymaže localStorage, data zůstanou na serveru).

## API Surface (all under /api)
- `GET /` health
- `POST /pair/create` · `POST /pair/join` · `GET /pair/{token}`
- `GET /messages/{pair_id}` · `POST /messages` · `PATCH /messages/{id}` · `DELETE /messages/{id}`
- `GET /photos/{pair_id}` · `POST /photos` · `DELETE /photos/{id}`
- `GET /events/{pair_id}` · `POST /events` · `DELETE /events/{id}`
- `GET /places/{pair_id}` · `POST /places` · `DELETE /places/{id}`
- `POST /ai/poem` · `POST /ai/quote` · `POST /ai/message`

## Test Results (Iteration 1)
- Backend: **18/18 (100%)** — pytest suite at `/app/backend/tests/backend_test.py`
- Frontend: **8/8 (100%)** — Playwright E2E across all 7 tabs + onboarding
- AI quality verified: real Czech with proper diacritics (e.g. „Michaelko, večer tě hledám…")

## Backlog / Future Iterations
### P1 (nice-to-have)
- Voice notes (Messages) — MediaDevices.getUserMedia + base64 audio
- Anniversary push reminders via service-worker periodic sync
- Photo captions edit-in-place
- Onboarding option: jméno změnit i v Nastavení

### P2 (advanced)
- WebAuthn / Face ID biometric unlock (volitelný layer)
- Background sync pro offline odeslání zpráv
- IndexedDB cache pro fotky a zprávy (true offline)
- Share-target API: sdílení fotky z jiné aplikace přímo do galerie
- Export PDF výročí (jako vzpomínkový almanach)

### Known minor non-blockers (z code review)
- DELETE endpoints vrací 200 s deleted=0 místo 404 (cosmetic)
- CORS allow_origins=['*'] s credentials (no-op v této anonymní app)
- AI endpointy bez rate-limitingu (per-pair throttling do budoucna)
- Base64 fotky v Mongo — sledovat 16MB doc limit při větším množství

## Files of Note
- `/app/design_guidelines.json` — vizuální systém (barvy, fonty, glassmorphism)
- `/app/backend/server.py` — všechny endpointy v jednom souboru
- `/app/frontend/src/App.js` — routing + onboarding gate + theme controller
- `/app/frontend/src/pages/*` — 7 obrazovek
- `/app/frontend/src/lib/{api,dates,czech}.js` — utility (axios, formátování, skloňování)

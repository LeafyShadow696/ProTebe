# Pro Tebe 😍

Romantická Progressive Web App pro pár. React (PWA) + FastAPI + MongoDB + Emergent LLM.
Mobile-first, glassmorphism, Cormorant Garamond, anonymní pair-code propojení.

## ✨ Funkce

- **Love Dashboard** — živé počítadlo dní od 3. 4. 2026, AI denní citát, „Co spolu dnes?" tipy, mood widget.
- **Galerie vzpomínek** — upload + komprese + masonry + fullscreen viewer + Web Share.
- **Vzkazovník** — realtime polling, reakce, pin, AI návrh slov, **Časová kapsle** (zprávy do budoucna).
- **AI Básník** — 5 nálad, krásná česká poezie přes Claude Sonnet 4.6, export jako obrázek.
- **Sdílený kalendář** — události, výročí, připomínky + `.ics` export do Apple/Google Calendar.
- **Love Map** — Leaflet/OSM, „Tady jsem" GPS, počasí (Open-Meteo), reverse geocoding (Nominatim), Apple Maps deeplink.
- **Profilové fotky** + editace jména v Nastavení.
- **PWA** — manifest, ikony, service worker, standalone mode, safe-area handling.

## 🧩 Tech stack

- **Frontend**: React 18 (CRA + craco), TailwindCSS, Framer Motion, react-leaflet, lucide-react.
- **Backend**: FastAPI + Motor (async MongoDB) + Pydantic v2 + emergentintegrations.
- **AI**: Emergent Universal Key → Claude Sonnet 4.6.
- **Maps & Weather**: OpenStreetMap (Leaflet) + Open-Meteo + Nominatim — vše zdarma, bez API klíče.
- **Native APIs**: Web Share, Vibration, Wake Lock, Geolocation, Notifications.

## 🔧 Lokální vývoj

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env  # vyplň MONGO_URL, DB_NAME, EMERGENT_LLM_KEY
uvicorn server:app --reload --port 8001

# Frontend (jiný terminál)
cd frontend
yarn install
cp .env.example .env  # nastaví REACT_APP_BACKEND_URL=http://localhost:8001
yarn start
```

Otevři http://localhost:3000 a klikni na **Vytvořit nový pár**.

## 🚀 Deploy

### Vercel (rychlé)

V kořeni je `vercel.json` s monorepo konfigurací (frontend = CRA, backend = Python serverless).

1. Push do GitHubu.
2. V Vercel dashboardu **Import Project** → vyber repo.
3. Nastav environment variables (viz níže).
4. Deploy.

### Render / Railway / Fly.io (alternativní)

- Backend: `uvicorn server:app --host 0.0.0.0 --port $PORT` z `backend/`.
- Frontend: build `yarn build` v `frontend/`, deploy `frontend/build/` jako statický web.

## 🔑 Environment variables

### Backend (`backend/.env`)

| Klíč | Popis |
| --- | --- |
| `MONGO_URL` | MongoDB connection string (např. MongoDB Atlas free tier). |
| `DB_NAME` | Název databáze, např. `pro_tebe`. |
| `EMERGENT_LLM_KEY` | Univerzální Emergent klíč pro Claude/GPT/Gemini. |

### Frontend (`frontend/.env`)

| Klíč | Popis |
| --- | --- |
| `REACT_APP_BACKEND_URL` | Veřejné URL backendu (Vercel výchozí: `/_/backend`). |

## 📦 Struktura

```
.
├── backend/              # FastAPI app
│   ├── server.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/             # React PWA
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── .env.example
├── vercel.json           # Monorepo deploy config
├── .github/
│   └── workflows/ci.yml  # Lint + smoke test
├── .gitignore
└── README.md
```

## 🛡️ Privacy

- Žádný login, žádná sociální síť, žádné cookies.
- Identita je anonymní pár-token v `localStorage`.
- Vše mezi vámi dvěma.

## 📜 Licence

Soukromý projekt. Pro Michaelku ♡.

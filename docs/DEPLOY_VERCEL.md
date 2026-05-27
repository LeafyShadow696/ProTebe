# Deploy na Vercel

## 1. Push do GitHubu

```bash
cd /path/to/project
git init
git add .
git commit -m "Initial: Pro Tebe 😍"
git branch -M main
git remote add origin git@github.com:<tvuj-uzivatel>/pro-tebe.git
git push -u origin main
```

## 2. Vercel Project

1. Na [vercel.com/new](https://vercel.com/new) → Import Git Repository → vyber svůj repo.
2. Vercel díky `vercel.json` automaticky detekuje:
   - `frontend/` jako Create React App (build → CDN)
   - `backend/` jako Python serverless (route prefix `/_/backend`)
3. **Root directory** ponech `./` (monorepo).
4. **Environment variables** (viz níže) → Add.
5. Klikni **Deploy**.

## 3. Environment variables

Vercel → Project → Settings → Environment Variables:

| Name | Value | Scope |
| --- | --- | --- |
| `MONGO_URL` | `mongodb+srv://...@cluster0...` | Production, Preview |
| `DB_NAME` | `pro_tebe` | Production, Preview |
| `EMERGENT_LLM_KEY` | `sk-emergent-...` | Production, Preview |
| `REACT_APP_BACKEND_URL` | `https://<tvuj-projekt>.vercel.app/_/backend` | Production, Preview |

> **Pozor**: `REACT_APP_BACKEND_URL` musí ukazovat na **stejnou doménu** jako frontend, jinak prohlížeč zablokuje cross-origin requesty kvůli `localStorage` perzistenci. Vercel monorepo s `routePrefix: /_/backend` to řeší automaticky.

## 4. Po deployi

1. Otevři přidělenou URL (např. `https://pro-tebe.vercel.app`).
2. Klikni **Vytvořit nový pár** → vyplň jméno → dostaneš pár-kód.
3. Pošli pár-kód Michaelce — otevře tu samou URL na svém telefonu, klikne **Mám pár kód**, zadá ho.
4. **Nainstaluj jako PWA**: Safari iOS → Share → *Add to Home Screen*. Aplikace pak vypadá jako nativní iOS app.

## 5. Custom doména (volitelné)

Vercel → Project → Settings → Domains → Add (např. `protebe.cz`). Stačí nastavit DNS:

```
A    @     76.76.21.21
CNAME www   cname.vercel-dns.com.
```

## Troubleshooting

- **„Cannot find module 'fastapi'"** → Vercel Python build nepřečetl `requirements.txt`. Zkontroluj že je v `backend/requirements.txt`.
- **CORS error** → ujisti se, že `REACT_APP_BACKEND_URL` je na stejné doméně jako frontend.
- **AI básník vrací 502** → `EMERGENT_LLM_KEY` chybí nebo má vyčerpaný kredit (Emergent profil → Universal Key → Add Balance).
- **MongoDB connection error** → IP whitelist v Atlasu musí povolovat `0.0.0.0/0` (Vercel serverless běží na různých IP).

# Deploy na Vercel — krok za krokem

Po importu repozitáře z GitHubu do Vercelu **stačí vyplnit 2 environment variables** (`MONGO_URL` a `EMERGENT_LLM_KEY`). Všechno ostatní (DB_NAME, REACT_APP_BACKEND_URL, build env) je předvyplněné v `vercel.json`.

## 1. Push do GitHubu

V Emergent chatu klikni **„Save to GitHub"** v top baru. Nebo manuálně:

```bash
git init
git add .
git commit -m "Initial: Pro Tebe 😍"
git branch -M main
git remote add origin git@github.com:<tvuj-uzivatel>/pro-tebe.git
git push -u origin main
```

## 2. MongoDB Atlas (5 minut, zdarma)

Viz `docs/MONGODB_SETUP.md`. Výsledek: connection string ve tvaru
`mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

## 3. Vercel Import

1. Otevři [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → vyber svůj repo.
2. Vercel díky `vercel.json` **automaticky detekuje monorepo**:
   - `frontend/` = Create React App (statický build na CDN)
   - `backend/` = Python serverless funkce (cesta `/_/backend/...`)
3. **Root Directory**: ponech `./`.
4. **Environment Variables** — přidej **pouze tyto dvě**:

   | Name | Value |
   | --- | --- |
   | `MONGO_URL` | tvůj Atlas connection string z kroku 2 |
   | `EMERGENT_LLM_KEY` | tvůj klíč z [emergent.sh](https://emergent.sh) → Profile → Universal Key |

   > `DB_NAME=pro_tebe` a `REACT_APP_BACKEND_URL=/_/backend` jsou už nastavené v `vercel.json` → nemusíš je vyplňovat.

5. Klikni **Deploy**. Build trvá ~2 minuty.

## 4. Po deployi

1. Otevři přidělenou URL (např. `https://pro-tebe-xxxx.vercel.app`).
2. Klikni **„Vytvořit nový pár"** → vyplň jméno → dostaneš pár-kód.
3. Pošli pár-kód Michaelce. Otevře tu samou URL na svém telefonu, klikne **„Mám pár kód"**, zadá ho.
4. **Nainstaluj jako PWA**:
   - **iPhone**: Safari → tlačítko Sdílet → *Přidat na plochu*. Aplikace pak vypadá a chová se jako nativní iOS app.
   - **Android**: Chrome → menu → *Přidat na plochu*.

## 5. Custom doména (volitelné)

Vercel → Project → Settings → Domains → Add (např. `protebe.cz`).

DNS u registrátora:

```
A      @      76.76.21.21
CNAME  www    cname.vercel-dns.com.
```

## Troubleshooting

| Problém | Řešení |
| --- | --- |
| `Cannot find module 'fastapi'` | Zkontroluj že `backend/requirements.txt` je v repu a že není v `.gitignore`. |
| `MongoServerError: bad auth` | V Atlas → Database Access → uživatel má correct heslo. V Network Access povol `0.0.0.0/0`. |
| AI básník vrací 502 | `EMERGENT_LLM_KEY` chybí nebo má vyčerpaný kredit. Doplň v Emergent Profile → Universal Key. |
| Frontend volá `localhost:8001` | `REACT_APP_BACKEND_URL` neaplikoval se. Vyforce-ne nový build (Vercel → Deployments → … → Redeploy). |
| Vercel ignoruje `experimentalServices` | Fallback: vytvoř **dva separátní Vercel projekty** — jeden s root `frontend/` a druhý s root `backend/`, propoj přes proxy/rewrites. |

## Bezpečnost

- `.env` soubory jsou v `.gitignore` — nikdy se nepushují do Gitu.
- `EMERGENT_LLM_KEY` a `MONGO_URL` zůstávají jen v Vercel Environment Variables (zašifrované).
- API neexponuje žádné citlivé endpointy bez pár-tokenu (anonymní pár ID).

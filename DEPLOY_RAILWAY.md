# Backend Deployment na Railway (doporučeno pro Pro Tebe)

Tento návod nasadí backend (FastAPI + MongoDB) na Railway s tvými reálnými credentials.

## Nejjednodušší cesta: Deploy přes webové rozhraní Railway (doporučeno)

Tato metoda **nevyžaduje žádný token**. Je nejrychlejší.

1. Jdi na [https://railway.app](https://railway.app) a přihlas se přes GitHub.
2. Klikni **New Project** → **Deploy from GitHub repo**.
3. Vyber repozitář `ProTebe`.
4. **Důležité**: Po načtení vyber jako Root Directory složku `backend` (ne celý projekt).
5. Railway by měl najít `railway.toml`.
6. Před deployem klikni na **Variables** a přidej tyto tři proměnné:

   | Název              | Hodnota |
   |--------------------|---------|
   | `MONGO_URL`        | `mongodb+srv://leafyshadow696_db_user:nqUttOTAsSVkuzAD@cluster0.dh1xfbo.mongodb.net/pro_tebe?retryWrites=true&w=majority` |
   | `DB_NAME`          | `pro_tebe` |
   | `EMERGENT_LLM_KEY` | `sk-emergent-5471c4612E08eDb12C` |

7. Klikni **Deploy**.

Po dokončení ti Railway ukáže URL (např. `https://pro-tebe-backend.up.railway.app`).

Pošli mi tu URL a já ihned:
- Nastavím ji na Vercel jako `REACT_APP_BACKEND_URL`
- Spustím redeploy
- Propojím vše na `pwnz.shop`

---

## Alternativa: Pomocí Railway CLI (vyžaduje token)

Pokud chceš použít CLI, musíš mít **správný Account Token** (ne UUID projektu/služby).

### Jak získat správný token

1. Jdi přesně na: **https://railway.app/account/tokens**
2. Klikni velké modré tlačítko **New Token**
3. Pojmenuj ho (např. `ProTebe Backend`)
4. Zkopíruj **celý vygenerovaný token** (je dlouhý řetězec, ne UUID ve tvaru `xxxx-xxxx-xxxx`)

**Poznámka:** UUID hodnoty, které jsi posílal dříve (jako `c72681f4-...`), jsou ID projektu/služby, ne API tokeny. Ty nefungují pro přihlášení.

## Nasazení pomocí CLI (po získání platného tokenu)

```bash
# Nastav token (nahraď svým)
export RAILWAY_TOKEN="tvuj-dlouhy-token"

# Přejdi do složky backend
cd backend

# Vytvoř nový projekt (nebo použij existující)
railway project new pro-tebe-backend

# Nasadit kód
railway up

# Nastav environment variables
railway variables set \
  MONGO_URL="mongodb+srv://leafyshadow696_db_user:nqUttOTAsSVkuzAD@cluster0.dh1xfbo.mongodb.net/pro_tebe?retryWrites=true&w=majority" \
  DB_NAME="pro_tebe" \
  EMERGENT_LLM_KEY="sk-emergent-5471c4612E08eDb12C"

# Získej URL backendu
railway status
```

Po úspěšném deployi ti Railway dá URL ve tvaru:
`https://pro-tebe-backend.up.railway.app`

## 3. Napojení na Vercel + pwnz.shop

Po získání Railway URL spusť:

```bash
# Nastav na Vercel
vercel env add REACT_APP_BACKEND_URL production
# zadej: https://tva-railway-url.up.railway.app

# Redeploy frontend
vercel --prod
```

Nyní by mělo https://pwnz.shop fungovat kompletně (frontend + backend).

## Poznámky
- railway.toml už je v repu (automaticky nastavuje start command)
- Backend podporuje jak memory mód (pro testy), tak reálnou MongoDB

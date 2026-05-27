# Backend Deployment na Railway (doporučeno pro Pro Tebe)

Tento návod nasadí backend (FastAPI + MongoDB) na Railway s tvými reálnými credentials.

## 1. Vygeneruj Railway Token (důležité!)

1. Jdi na: https://railway.app/account/tokens
2. Klikni **New Token**
3. Pojmenuj ho např. `ProTebe Backend`
4. **Zkopíruj celý vygenerovaný token** (je dlouhý)

## 2. Nasazení (pomocí CLI)

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

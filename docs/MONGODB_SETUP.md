# MongoDB Atlas (zdarma) Quick Start

Pro deploy potřebuješ jednu MongoDB databázi. Nejjednodušší je MongoDB Atlas (free tier, žádná kreditka).

## Krok za krokem

1. Jdi na [mongodb.com/atlas](https://www.mongodb.com/atlas/database) a vytvoř si účet.
2. **Create a Free Cluster** → vyber region nejblíž Praze (např. Frankfurt / AWS eu-central-1).
3. **Database Access** → Add user → vytvoř username + heslo, ulož si je.
4. **Network Access** → Add IP → **Allow access from anywhere** (`0.0.0.0/0`).
5. **Connect** → Drivers → Python → zkopíruj connection string ve tvaru:

   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

6. Doplň heslo na místo `<password>` a ulož jako `MONGO_URL` v environment variables.
7. `DB_NAME=pro_tebe` (nebo cokoli — kolekce se vytvoří automaticky).

## Pro Vercel deploy

V projektu Vercel → **Settings → Environment Variables** přidej:

| Name | Value |
| --- | --- |
| `MONGO_URL` | tvůj Atlas connection string |
| `DB_NAME` | `pro_tebe` |
| `EMERGENT_LLM_KEY` | tvůj klíč z Emergent profilu |

A redeploy.

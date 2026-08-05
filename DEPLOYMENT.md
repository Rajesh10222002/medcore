# Deploying MedCore AI to Azure Web Apps

## Architecture

MedCore AI deploys as **one Azure Web App**. The Flask backend serves both
the `/api/*` routes and the built React frontend (static files + SPA
fallback) — see `backend/app.py`'s `serve_frontend` route. There is no
separate frontend hosting service; everything runs from a single App
Service instance.

```
                    ┌─────────────────────────────┐
  browser  ───────► │  Azure Web App (Linux,      │
                     │  Python 3.11, gunicorn)     │
                     │                             │
                     │  /api/*      → Flask routes │
                     │  everything  → React build  │
                     │  else        → (SPA fallback)│
                     └─────────────┬───────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              Neon Postgres   HAPI FHIR      Gemini API
              (already cloud)  (public)      (AI features)
```

## 1. Build the frontend into the backend

Before deploying, bundle the React build into the Flask app:

```bash
bash build.sh
```

This runs `npm ci && npm run build` in `frontend/` and copies `frontend/dist/*`
into `backend/static_frontend/` (gitignored — regenerate this on every
deploy, don't commit it). `frontend/.env.production` sets
`VITE_API_URL=/api` so the built frontend calls the API via a relative path,
which resolves correctly since both are served from the same origin in
production.

**Deployable unit**: the `backend/` folder (containing `app.py`,
`requirements.txt`, and — after running `build.sh` — `static_frontend/`) is
what gets deployed to Azure.

## 2. Create the Azure Web App

Via Azure CLI (adjust names/region as needed):

```bash
az group create --name rg-medcore-ai --location centralindia

az appservice plan create \
  --name plan-medcore-ai \
  --resource-group rg-medcore-ai \
  --sku B1 --is-linux

az webapp create \
  --name medcore-ai-app \
  --resource-group rg-medcore-ai \
  --plan plan-medcore-ai \
  --runtime "PYTHON:3.11"
```

Or use the Azure Portal: **Create a resource → Web App → Runtime stack:
Python 3.11 → Operating System: Linux**.

## 3. Set the startup command

In the Web App's **Configuration → General settings → Startup Command**:

```
gunicorn --bind=0.0.0.0 --timeout 600 app:app
```

(Azure's Oryx build system installs `requirements.txt` automatically on
deploy — no extra step needed for that.)

## 4. Configure environment variables

**Configuration → Application settings** — add all of these (values are in
your local `backend/.env`, do not commit them anywhere):

| Key | Notes |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string — already cloud-hosted, works as-is |
| `JWT_SECRET` | Same value as local — rotate it for production if you want tokens issued locally to stop working |
| `FHIR_BASE_URL` | Public HAPI FHIR server — unchanged |
| `AI_PROVIDER` | Set to `gemini` in Azure (Ollama isn't reachable from App Service — see below) |
| `GEMINI_API_KEY` | Already in your local `.env` |
| `GEMINI_MODEL` | `gemini-2.5-flash` (verified working against the project's actual API key — `gemini-2.0-flash` returned a 429 quota-exhausted error on this key, `gemini-2.5-flash` and `gemini-flash-lite-latest` both worked) (or your preferred model) |
| `FRONTEND_ORIGIN` | Not needed in production (same-origin), but harmless to leave as `http://localhost:5173` |
| `FLASK_DEBUG` | Leave unset or `false` — **never `true`** in production (exposes the Werkzeug debugger) |
| `PORT` | Azure sets this automatically; gunicorn's `--bind=0.0.0.0` + Azure's reverse proxy handles the rest |

`OLLAMA_URL` / `OLLAMA_MODEL` aren't needed in Azure since `AI_PROVIDER=gemini`
skips that code path entirely (see `backend/ai_client.py`).

## 5. Deploy

Any of these work once the Web App exists:

- **VS Code Azure Extension** — right-click `backend/` folder → "Deploy to Web App"
- **Zip deploy via CLI**:
  ```bash
  cd backend
  zip -r ../deploy.zip . -x "*.pyc" -x "__pycache__/*"
  az webapp deploy --resource-group rg-medcore-ai --name medcore-ai-app --src-path ../deploy.zip
  ```
- **Git deploy** — push the `backend/` subtree to the Web App's git remote (Azure Portal → Deployment Center gives you the exact remote URL)

Remember to run `bash build.sh` **before** each deploy so `static_frontend/`
is current.

## 6. Verify

- `https://medcore-ai-app.azurewebsites.net/api/health` → should return the JSON health check
- `https://medcore-ai-app.azurewebsites.net/` → should load the React app
- Log in, and directly load a nested route (e.g. `/admin/patients/5`) to confirm the SPA fallback works and doesn't 404
- Try an AI feature (health summary, copilot) to confirm the Gemini provider switch is working

## Known limitations after deploying

- **Ollama-based AI is local-only.** In Azure, `AI_PROVIDER=gemini` is used instead (see `backend/ai_client.py`). Gemini's free tier is rate-limited (historically ~15 req/min) — fine for normal use and demos, but heavy concurrent AI usage could hit it. This was the original reason the project moved to Ollama for local dev in the first place; that tradeoff is unchanged.
- **No CI/CD pipeline** is included — deploys are manual (CLI/VS Code/git push) per the steps above. A GitHub Actions workflow can be added later once the Web App and its publish profile exist.
- **No connection pooling** on the Postgres connection (`db.py` opens a fresh connection per request) — fine at current scale, revisit if traffic grows.

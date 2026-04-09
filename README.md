# ALERT-ACC Deep v2 🚦

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Pandas](https://img.shields.io/badge/Pandas-150458?style=for-the-badge&logo=pandas&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-F7931E?style=for-the-badge&logo=scikitlearn&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)

Pune accident-intelligence platform with:

- interactive risk maps
- safest-route scoring
- voice-enabled assistant
- deep-analysis workflow for generated charts and map layers

## Architecture 🧩

`Vercel Frontend -> Railway Backend -> Supabase (pune-accidents)`

- Frontend serves static UI and proxies backend calls.
- Backend runs FastAPI + agent + routing + deep-analysis endpoints.
- Supabase is the runtime data source.

## Repository Structure 📁

- `accident-intel-google/frontend` - UI (`index.html`, `map.html`, `deep_analysis.html`, JS/CSS/assets)
- `accident-intel-google/backend` - FastAPI app, routes, services, sandbox runtime
- `accident-intel-google/data_pipeline` - ingestion/geocoding pipeline assets
- `accident-intel-google/DEPLOYMENT_SETUP.md` - deployment reference

## Environment Variables (Backend) 🔐

Set these in Railway (and local `.env` for local backend run):

- `GEMINI_API_KEY`
- `GOOGLE_MAPS_BROWSER_API_KEY`
- `GOOGLE_MAPS_SERVER_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_TABLE=pune-accidents`

Compatibility fallback:

- `GOOGLE_MAPS_API_KEY` is used only if split map keys are not provided.

## Local Development 💻

Start backend:

```powershell
cd accident-intel-google\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open:

- `http://127.0.0.1:8000/frontend/index.html`
- `http://127.0.0.1:8000/frontend/deep_analysis.html`

## API Surface 🔌

- map analytics: `/api/heatmap`, `/api/monthly`, `/api/hotspots`, `/api/seasonal`
- routing: `/api/safest-route`
- standard agent:
  - `POST /api/agent/interact`
  - `POST /api/agent/speak`
  - `POST /api/agent/transcribe-live`
  - `WS /api/agent/live-ws`
- deep-analysis agent:
  - `WS /api/agent/deep-live-ws`
  - `POST /api/sandbox/reset`
  - `GET /sandbox/*`

## Deployment 🚀

Backend start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Frontend `vercel.json` rewrites:

- `/api/*` -> Railway backend `/api/*`
- `/sandbox/*` -> Railway backend `/sandbox/*`

## Security Checklist ✅

- never commit `.env` files
- keep `SUPABASE_SERVICE_ROLE_KEY` server-side only
- keep map keys split:
  - browser key for Maps JS
  - server key for Routes API
- restrict browser key by HTTP referrer (Vercel domain + optional localhost)

---

Built for resilient demos and isolated deployments (Deep v2 branch promoted to `main`).

# ALERT-ACC (Deep v2)

This repository hosts the deployed Deep v2 architecture for the accident analysis system.

## Project Layout

- `accident-intel-google/frontend` - Vercel-hosted web UI (map + agent + deep analysis page)
- `accident-intel-google/backend` - FastAPI backend for analytics, routing, agent, websocket, and deep-analysis execution
- `accident-intel-google/data_pipeline` - dataset prep scripts and source CSV pipeline

## Current Deployment Model

- Frontend: Vercel (static files + rewrites)
- Backend: Railway (single FastAPI service)
- Data source: Supabase table (`pune-accidents`)

Frontend rewrites currently proxy:

- `/api/*` -> Railway backend `/api/*`
- `/sandbox/*` -> Railway backend `/sandbox/*`

## Required Environment Variables (Backend)

Set these in Railway (and in local `.env` if running locally):

- `GEMINI_API_KEY`
- `GOOGLE_MAPS_BROWSER_API_KEY`
- `GOOGLE_MAPS_SERVER_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_TABLE=pune-accidents`

Compatibility fallback exists in code:

- `GOOGLE_MAPS_API_KEY` is used only when split browser/server keys are not provided.

## Local Run

From repo root:

```powershell
cd accident-intel-google\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Then open:

- `http://127.0.0.1:8000/frontend/index.html`
- `http://127.0.0.1:8000/frontend/deep_analysis.html`

## Core API Surface

- Map analytics: `/api/heatmap`, `/api/monthly`, `/api/hotspots`, `/api/seasonal`
- Routing: `/api/safest-route`
- Agent (standard): `/api/agent/interact`, `/api/agent/speak`, `/api/agent/transcribe-live`, `WS /api/agent/live-ws`
- Agent (deep): `WS /api/agent/deep-live-ws`, deep tool flow + `/api/sandbox/reset`, `/sandbox/*`

## Security Notes

- Never commit `.env` files or raw keys.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- Keep map keys split:
  - Browser key for frontend map loading
  - Server key for backend Routes API calls
- Restrict browser map key by HTTP referrers (Vercel domain + optional localhost).

## Deployment Notes

Backend start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Additional deployment details are documented in:

- `accident-intel-google/DEPLOYMENT_SETUP.md`

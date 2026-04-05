# ALERT-ACC Deployment Split

## 1) Supabase (manual data upload)

Create table `accidents` with columns:

- `lat` (float8)
- `lon` (float8)
- `month` (int4)
- `season` (text)
- `location` (text)

Upload only `data_pipeline/gemini/data/geocoded/gemini_accidents_geo.csv` into `accidents`.

## 2) Railway (backend only)

Service root: `backend/`

Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Required env vars:

- `GEMINI_API_KEY`
- `GOOGLE_MAPS_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_TABLE=accidents`

## 3) Vercel (new frontend project only)

Project root: `frontend/`

Set `frontend/js/runtime-config.js`:

```js
window.ALERT_ACC_CONFIG.RAILWAY_API_BASE_URL = "https://<your-railway-domain>";
```

Then deploy this frontend project as a new Vercel project.

## 4) Security notes

- Do not commit `.env` files.
- Do not hardcode API keys in JS/HTML.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in Railway env vars.

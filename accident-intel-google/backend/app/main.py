from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from app.api import routes_heatmap, routes_monthly, routes_seasonal, routes_hotspots, routes_routing, routes_agent, routes_deep_agent
from app.services.sandbox_service import reset_sandbox

import os
from dotenv import load_dotenv

# Load .env from multiple possible locations to ensure the API key is found
project_env = os.path.normpath(os.path.join(os.path.dirname(__file__), "../../.env"))
workspace_env = os.path.normpath(os.path.join(os.path.dirname(__file__), "../../../.env"))

if os.path.exists(project_env):
    load_dotenv(project_env, override=True)
elif os.path.exists(workspace_env):
    load_dotenv(workspace_env, override=True)
else:
    load_dotenv(override=True)

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files from local directories
# Use absolute paths based on file location to avoid CWD issues
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.normpath(os.path.join(BASE_DIR, "../frontend"))
HAS_LOCAL_FRONTEND = os.path.exists(FRONTEND_DIR)
if HAS_LOCAL_FRONTEND:
    app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR), name="frontend")

# Serve common assets/maps if they exist, otherwise redirect or reuse
COMMON_ASSETS = os.path.normpath(os.path.join(BASE_DIR, "../../accident-intel/frontend/assets"))
if os.path.exists(COMMON_ASSETS):
    app.mount("/assets", StaticFiles(directory=COMMON_ASSETS), name="assets")

@app.get("/")
async def root_redirect():
    if HAS_LOCAL_FRONTEND:
        return RedirectResponse(url="/frontend/index.html")
    return {"status": "ok", "service": "alert-acc-backend"}

@app.get("/api/config")
async def get_config():
    # Return the API key for the frontend to use
    return {"googleMapsApiKey": os.getenv("GOOGLE_MAPS_API_KEY")}

app.include_router(routes_heatmap.router, prefix="/api")
app.include_router(routes_monthly.router, prefix="/api")
app.include_router(routes_seasonal.router, prefix="/api")
app.include_router(routes_hotspots.router, prefix="/api")
app.include_router(routes_routing.router, prefix="/api")
app.include_router(routes_agent.router, prefix="/api")
app.include_router(routes_deep_agent.router, prefix="/api")

# Serve sandbox files so frontend can load generated images/json
SANDBOX_DIR = os.path.normpath(os.path.join(BASE_DIR, "sandbox"))
if not os.path.exists(SANDBOX_DIR):
    os.makedirs(SANDBOX_DIR)
app.mount("/sandbox", StaticFiles(directory=SANDBOX_DIR), name="sandbox")

@app.post("/api/sandbox/reset")
async def api_reset_sandbox():
    return reset_sandbox()

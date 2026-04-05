from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from app.api import routes_heatmap, routes_monthly, routes_seasonal, routes_hotspots, routes_routing, routes_agent
from app.utils.data_loader import load_data
import os
from dotenv import load_dotenv

# Load .env from multiple possible locations to ensure the API key is found
load_dotenv() # current directory
load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env")) # workspace root
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))    # project root

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    load_data()

# Mount static files from local directories
# Use absolute paths based on file location to avoid CWD issues
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.normpath(os.path.join(BASE_DIR, "../frontend"))
app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR), name="frontend")

# Serve common assets/maps if they exist, otherwise redirect or reuse
COMMON_ASSETS = os.path.normpath(os.path.join(BASE_DIR, "../../accident-intel/frontend/assets"))
if os.path.exists(COMMON_ASSETS):
    app.mount("/assets", StaticFiles(directory=COMMON_ASSETS), name="assets")

@app.get("/")
async def root_redirect():
    return RedirectResponse(url="/frontend/index.html")

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

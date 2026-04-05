from fastapi import APIRouter
from app.services.analytics_service import get_heatmap_data
from typing import Optional

router = APIRouter()

@router.get("/heatmap")
def heatmap(season: Optional[str] = None):
    return get_heatmap_data(season=season)

from fastapi import APIRouter
from app.services.clustering_service import get_hotspots

router = APIRouter()

@router.get("/hotspots")
def hotspots(method: str = "kmeans", top_n: int = 5):
    # Pass 0 to get all clusters
    return get_hotspots(method=method, top_n=top_n)

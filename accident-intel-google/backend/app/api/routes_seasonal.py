from fastapi import APIRouter
from app.services.analytics_service import get_seasonal_trends

router = APIRouter()

@router.get("/seasonal")
def seasonal_trends():
    return get_seasonal_trends()

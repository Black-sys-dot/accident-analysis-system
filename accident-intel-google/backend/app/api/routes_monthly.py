from fastapi import APIRouter
from app.services.analytics_service import get_monthly_trends

router = APIRouter()

@router.get("/monthly")
def monthly_trends():
    return get_monthly_trends()

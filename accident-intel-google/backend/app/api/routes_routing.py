from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from app.services.routing_service import (
    GoogleRoutesError,
    calculate_route_threat,
    compute_and_score_routes,
)

router = APIRouter()


class RouteRequest(BaseModel):
    origin: str = Field(min_length=3)
    destination: str = Field(min_length=3)
    originPlaceId: Optional[str] = None
    originLat: Optional[float] = None
    originLng: Optional[float] = None
    destinationPlaceId: Optional[str] = None

@router.post("/route-threat")
async def get_route_threats(routes: List[List[Dict[str, float]]] = Body(...)):
    """
    Calculates threat scores for a list of provided routes.
    Each route is a list of {lat, lon}.
    Returns a list of scores corresponding to each route.
    """
    try:
        print(f"Received request to score {len(routes)} routes.")
        results = []
        for i, route in enumerate(routes):
            score = calculate_route_threat(route)
            print(f"Route {i} scored: {score}")
            results.append(float(score))  # Force conversion to native python float
        return {"scores": results}
    except Exception as e:
        print(f"Error calculating route threats: {e}")
        return {"error": str(e), "scores": []}


@router.post("/safest-route")
async def get_safest_route(data: RouteRequest):
    """
    Calls Google Routes API for alternative routes and scores each route by threat.
    """
    try:
        routes = compute_and_score_routes(
            data.origin.strip(),
            data.destination.strip(),
            origin_place_id=data.originPlaceId,
            origin_lat=data.originLat,
            origin_lng=data.originLng,
            destination_place_id=data.destinationPlaceId,
        )
        if not routes:
            return {"routes": [], "message": "No routes returned by Google Routes API."}
        return {"routes": routes}
    except GoogleRoutesError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected routing error: {exc}") from exc

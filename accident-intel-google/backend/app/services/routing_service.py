import json
import os
from urllib import error, request

import numpy as np

from app.utils.data_loader import get_data

ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
ROUTES_FIELD_MASK = (
    "routes.duration,"
    "routes.distanceMeters,"
    "routes.polyline.encodedPolyline,"
    "routes.routeLabels"
)


class GoogleRoutesError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code

def calculate_route_threat(route_coords):
    """
    Calculates a threat score for a given route (list of {lat, lon}).
    Uses a kernel density approach: sum(1 / distance_squared) for all accidents.
    """
    try:
        df = get_data()
        if df is None or df.empty:
            print("Warning: get_data() returned empty or None dataframe.")
            return 0.0

        accidents = df[['lat', 'lon']].values
        
        total_threat = 0.0
        
        # Epsilon to avoid division by zero
        epsilon = 1e-4
        
        # Iterate through route points
        for point in route_coords:
            p_lat = float(point['lat'])
            p_lon = float(point['lon'])
            
            # Calculate squared distances
            dist_sq = (accidents[:, 0] - p_lat)**2 + (accidents[:, 1] - p_lon)**2
            
            # Add to threat: Inverse distance squared kernel
            total_threat += np.sum(1 / (dist_sq + epsilon))
            
        return float(total_threat)
    except Exception as e:
        print(f"Calculation error in routing_service: {e}")
        return 0.0


def _decode_polyline(encoded_polyline):
    """
    Decodes a Google encoded polyline into a list of {lat, lon}.
    """
    if not encoded_polyline:
        return []

    coords = []
    index = 0
    lat = 0
    lon = 0
    length = len(encoded_polyline)

    while index < length:
        result = 0
        shift = 0
        while True:
            b = ord(encoded_polyline[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        delta_lat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += delta_lat

        result = 0
        shift = 0
        while True:
            b = ord(encoded_polyline[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        delta_lon = ~(result >> 1) if (result & 1) else (result >> 1)
        lon += delta_lon

        coords.append({"lat": lat / 1e5, "lon": lon / 1e5})

    return coords


def _call_google_routes_api(
    origin,
    destination,
    origin_place_id=None,
    origin_lat=None,
    origin_lng=None,
    destination_place_id=None,
):
    # Routes API must use a server-side key (IP/app restricted), not browser-referrer key.
    # Backward compatibility fallback is kept for existing environments.
    api_key = os.getenv("GOOGLE_MAPS_SERVER_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        raise GoogleRoutesError(
            "GOOGLE_MAPS_SERVER_API_KEY is not configured (fallback: GOOGLE_MAPS_API_KEY).",
            status_code=500,
        )

    payload = {
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
        "computeAlternativeRoutes": True,
        "languageCode": "en-US",
        "units": "METRIC",
    }
    if origin_place_id:
        payload["origin"] = {"placeId": origin_place_id}
    elif origin_lat is not None and origin_lng is not None:
        payload["origin"] = {
            "location": {
                "latLng": {
                    "latitude": float(origin_lat),
                    "longitude": float(origin_lng),
                }
            }
        }
    else:
        payload["origin"] = {"address": origin}
    payload["destination"] = (
        {"placeId": destination_place_id}
        if destination_place_id
        else {"address": destination}
    )

    req = request.Request(
        ROUTES_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": ROUTES_FIELD_MASK,
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=20) as response:
            raw_response = response.read().decode("utf-8")
            return json.loads(raw_response) if raw_response else {}
    except error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="ignore")
        status_code = 400 if 400 <= exc.code < 500 else 502
        raise GoogleRoutesError(
            f"Google Routes API returned HTTP {exc.code}: {error_body or exc.reason}",
            status_code=status_code,
        ) from exc
    except error.URLError as exc:
        raise GoogleRoutesError(
            f"Failed to reach Google Routes API: {exc.reason}",
            status_code=502,
        ) from exc


def compute_and_score_routes(
    origin,
    destination,
    origin_place_id=None,
    origin_lat=None,
    origin_lng=None,
    destination_place_id=None,
):
    """
    Calls Google Routes API for alternatives and scores each route by accident threat.
    """
    response_data = _call_google_routes_api(
        origin,
        destination,
        origin_place_id=origin_place_id,
        origin_lat=origin_lat,
        origin_lng=origin_lng,
        destination_place_id=destination_place_id,
    )
    routes = response_data.get("routes", [])

    scored_routes = []
    for route in routes:
        encoded_polyline = route.get("polyline", {}).get("encodedPolyline")
        decoded_path = _decode_polyline(encoded_polyline)

        if not decoded_path:
            continue

        scored_routes.append(
            {
                "distanceMeters": route.get("distanceMeters"),
                "duration": route.get("duration"),
                "routeLabels": route.get("routeLabels", []),
                "polyline": decoded_path,
                "threatScore": float(calculate_route_threat(decoded_path)),
            }
        )

    scored_routes.sort(key=lambda route: route["threatScore"])

    for idx, route in enumerate(scored_routes):
        route["isSafest"] = idx == 0

    return scored_routes

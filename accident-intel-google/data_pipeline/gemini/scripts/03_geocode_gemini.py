import pandas as pd
import requests
import time
import os
from dotenv import load_dotenv

# Load Google Maps API key securely from .env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

if not API_KEY:
    print("ERROR: GOOGLE_MAPS_API_KEY not found in environment.")
    exit(1)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.normpath(os.path.join(BASE_DIR, "../data/processed/gemini_raw_data.csv"))
OUTPUT_DIR = os.path.normpath(os.path.join(BASE_DIR, "../data/geocoded"))
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "gemini_accidents_geo.csv")
CACHE_FILE = os.path.join(OUTPUT_DIR, "location_cache.csv")

REQUEST_DELAY = 0.2  # Google allows faster requests

def geocode_google(address):
    # Appending 'Pune, Maharashtra, India' to ensure the geocoder limits searches to our area
    search_address = f"{address}, Pune, Maharashtra, India"
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": search_address,
        "key": API_KEY
    }

    try:
        response = requests.get(url, params=params)
        data = response.json()

        if data["status"] == "OK":
            location = data["results"][0]["geometry"]["location"]
            return location["lat"], location["lng"]
        else:
            print(f"Warning: {address} -> {data['status']}")
            return None, None

    except Exception as e:
        print(f"Error for {address}: {e}")
        return None, None


def geocode_all():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    df = pd.read_csv(INPUT_FILE)

    unique_locations = df["location"].dropna().unique()
    print(f"Unique locations to check: {len(unique_locations)}")

    # Load cache if exists
    if os.path.exists(CACHE_FILE):
        cache_df = pd.read_csv(CACHE_FILE)
        location_coords = dict(
            zip(cache_df["location"], zip(cache_df["lat"], cache_df["lon"]))
        )
        print(f"Loaded {len(location_coords)} cached entries")
    else:
        location_coords = {}

    geocoded_count = 0
    for loc in unique_locations:
        if loc in location_coords:
            continue

        print(f"Geocoding: {loc}")
        lat, lon = geocode_google(loc)
        location_coords[loc] = (lat, lon)
        geocoded_count += 1

        # Save progress immediately
        cache_df = pd.DataFrame([
            {"location": key, "lat": value[0], "lon": value[1]}
            for key, value in location_coords.items()
        ])
        cache_df.to_csv(CACHE_FILE, index=False)

        time.sleep(REQUEST_DELAY)

    # Map back to main dataset
    df["lat"] = df["location"].map(lambda x: location_coords.get(x, (None, None))[0])
    df["lon"] = df["location"].map(lambda x: location_coords.get(x, (None, None))[1])

    # Reorder columns explicitly as requested
    columns_order = ['title', 'date', 'location', 'year', 'month', 'season', 'lat', 'lon']
    
    # Ensure all required columns are present (fill with empty strings if missing)
    for col in columns_order:
        if col not in df.columns:
            df[col] = ""
            
    df = df[columns_order]

    df.to_csv(OUTPUT_FILE, index=False)

    print(f"\nDone. Geocoded {geocoded_count} new locations. Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    geocode_all()
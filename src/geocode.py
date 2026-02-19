import pandas as pd
import requests
import time
import os

API_KEY = "YOUR_GOOGLE_MAPS_API_KEY"  

INPUT_FILE = "data/processed/accidents_processed.csv"
OUTPUT_FILE = "data/geocoded/accidents_geo.csv"
CACHE_FILE = "data/geocoded/location_cache.csv"

REQUEST_DELAY = 0.2  # Google allows faster requests

def geocode_google(address):
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": address,
        "key": API_KEY
    }

    try:
        response = requests.get(url, params=params)
        data = response.json()

        if data["status"] == "OK":
            location = data["results"][0]["geometry"]["location"]
            return location["lat"], location["lng"]
        else:
            print(f"⚠️ {address} -> {data['status']}")
            return None, None

    except Exception as e:
        print(f"❌ Error for {address}: {e}")
        return None, None


def geocode_all():
    os.makedirs("data/geocoded", exist_ok=True)

    df = pd.read_csv(INPUT_FILE)

    unique_locations = df["location"].dropna().unique()
    print(f"🧠 Unique locations: {len(unique_locations)}")

    # Load cache if exists
    if os.path.exists(CACHE_FILE):
        cache_df = pd.read_csv(CACHE_FILE)
        location_coords = dict(
            zip(cache_df["location"], zip(cache_df["lat"], cache_df["lon"]))
        )
        print(f"📦 Loaded {len(location_coords)} cached entries")
    else:
        location_coords = {}

    for loc in unique_locations:
        if loc in location_coords:
            continue

        print(f"🌍 Geocoding: {loc}")
        lat, lon = geocode_google(loc)
        location_coords[loc] = (lat, lon)

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

    df.to_csv(OUTPUT_FILE, index=False)

    print(f"\n🔥 Done. Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    geocode_all()

import pandas as pd
import folium
from folium.plugins import HeatMap
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.db import get_accidents_data

OUTPUT_FILE = "outputs/accident_heatmap_all.html"

def generate_heatmap():
    os.makedirs("outputs", exist_ok=True)

    print("📂 Loading dataset from Supabase...")
    df = get_accidents_data()

    # Keep only rows with coordinates
    df = df.dropna(subset=["lat", "lon"])

    print("Total points used for heatmap:", len(df))

    # Center map at Pune
    pune_center = [18.5204, 73.8567]
    m = folium.Map(location=pune_center, zoom_start=12)

    heat_data = list(zip(df["lat"], df["lon"]))

    HeatMap(heat_data, radius=12, blur=15).add_to(m)

    m.save(OUTPUT_FILE)

    print(f"🔥 Heatmap saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_heatmap()

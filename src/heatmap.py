import pandas as pd
import folium
from folium.plugins import HeatMap
import os

INPUT_FILE = "data/geocoded/accidents_geo.csv"
OUTPUT_FILE = "outputs/accident_heatmap_all.html"

def generate_heatmap():
    os.makedirs("outputs", exist_ok=True)

    df = pd.read_csv(INPUT_FILE)

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

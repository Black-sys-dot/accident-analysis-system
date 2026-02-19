import pandas as pd
import folium
from folium.plugins import HeatMap
import os

INPUT_FILE = "data/geocoded/accidents_geo.csv"
OUTPUT_FOLDER = "maps"

def generate_seasonal_maps():

    print("📂 Loading dataset...")
    df = pd.read_csv(INPUT_FILE)

    # Ensure lat/lon are valid
    df = df.dropna(subset=["lat", "lon"])

    # Create output folder if not exists
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)

    seasons = df["season"].unique()

    print(f"🎯 Seasons detected: {seasons}")

    for season in seasons:

        print(f"🔥 Generating heatmap for {season}...")

        season_df = df[df["season"] == season]

        heat_data = season_df[["lat", "lon"]].values.tolist()

        # Center at Pune
        m = folium.Map(location=[18.5204, 73.8567], zoom_start=12)

        HeatMap(
            heat_data,
            radius=12,
            blur=15,
            min_opacity=0.4
        ).add_to(m)

        file_path = os.path.join(OUTPUT_FOLDER, f"heatmap_{season.lower()}.html")
        m.save(file_path)

        print(f"✅ Saved: {file_path}")

    print("🚀 All seasonal heatmaps generated successfully.")


if __name__ == "__main__":
    generate_seasonal_maps()

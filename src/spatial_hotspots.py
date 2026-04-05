import pandas as pd
import folium
from sklearn.cluster import KMeans
from folium.plugins import HeatMap
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.db import get_accidents_data

OUTPUT_FILE = "outputs/accident_heatmap_hotspots.html"

print("📂 Loading dataset from Supabase...")
df = get_accidents_data()

df = df.dropna(subset=["lat", "lon"])

coords = df[["lat", "lon"]].values

print("🔢 Running KMeans clustering...")
kmeans = KMeans(n_clusters=20, random_state=42)
df["cluster"] = kmeans.fit_predict(coords)

# Count cluster sizes
cluster_counts = df["cluster"].value_counts()

# Select top 5 clusters
top_clusters = cluster_counts.head(5).index.tolist()

print("🔥 Top clusters selected:", top_clusters)

# Base map
m = folium.Map(location=[18.5204, 73.8567], zoom_start=12)

# Add heatmap layer
HeatMap(coords, radius=12, blur=15).add_to(m)

# Color palette
colors = ["purple", "blue", "red", "green", "orange"]

for i, cluster_id in enumerate(top_clusters):

    cluster_df = df[df["cluster"] == cluster_id]

    centroid_lat = cluster_df["lat"].mean()
    centroid_lon = cluster_df["lon"].mean()

    color = colors[i]

    # Draw cluster points + lines
    for _, row in cluster_df.iterrows():

        # Small point
        folium.CircleMarker(
            location=[row["lat"], row["lon"]],
            radius=6,
            color="black",
            fill=True,
            fill_color=color,
            fill_opacity=0.8,
            weight=2
        ).add_to(m)

        # Line to centroid (THIS CREATES THE WEB)
        folium.PolyLine(
            locations=[
                [row["lat"], row["lon"]],
                [centroid_lat, centroid_lon]
            ],
            color=color,
            weight=2,
            opacity=0.6
        ).add_to(m)

    # Most common location name
    top_location = (
        cluster_df["location"]
        .value_counts()
        .idxmax()
    )

    accident_count = len(cluster_df)

    popup_text = f"""
    <b>{top_location}</b><br>
    {accident_count} accidents
    """

    # Centroid marker WITH popup
    folium.CircleMarker(
        location=[centroid_lat, centroid_lon],
        radius=14,
        color="black",
        fill=True,
        fill_color=color,
        fill_opacity=1,
        weight=3,
        popup=folium.Popup(popup_text, max_width=250)
    ).add_to(m)


print("💾 Saving hotspot map...")
m.save(OUTPUT_FILE)

print("✅ Hotspot overlay map generated successfully.")

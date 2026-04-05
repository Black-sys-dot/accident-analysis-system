from sklearn.cluster import KMeans, DBSCAN
import pandas as pd
import numpy as np
from app.utils.data_loader import get_data

def get_hotspots(method="kmeans", top_n=5):
    df = get_data()
    coords = df[['lat', 'lon']].dropna()
    
    if coords.empty:
        return []

    if method == "dbscan":
        # DBSCAN: density-based clustering
        # eps: distance between points in degrees (approx 500m)
        # min_samples: minimum points to form a cluster
        db = DBSCAN(eps=0.005, min_samples=3).fit(coords)
        df_coords = coords.copy()
        df_coords['cluster'] = db.labels_
        # Remove noise points (label -1)
        df_coords = df_coords[df_coords['cluster'] != -1]
    else:
        # Default: KMeans as per instruction.txt (20 clusters, then top 5)
        kmeans = KMeans(n_clusters=20, random_state=42, n_init=10)
        df_coords = coords.copy()
        df_coords['cluster'] = kmeans.fit_predict(coords)

    cluster_counts = df_coords['cluster'].value_counts()
    
    if top_n and top_n > 0:
        top_clusters = cluster_counts.nlargest(top_n).index
    else:
        top_clusters = cluster_counts.index

    hotspots = []
    for cluster_id in top_clusters:
        cluster_indices = df_coords[df_coords['cluster'] == cluster_id].index
        cluster_df = df.loc[cluster_indices]

        # Use the mean for the centroid
        centroid = cluster_df[['lat', 'lon']].mean().to_dict()
        
        # Get dominant location name
        if not cluster_df['location'].empty:
            location = cluster_df['location'].value_counts().idxmax()
        else:
            location = "Unknown"
            
        count = len(cluster_df)

        hotspots.append({
            "location": location,
            "count": count,
            "centroid": {
                "lat": float(centroid['lat']),
                "lon": float(centroid['lon'])
            },
            "points": [
                {"lat": float(row['lat']), "lon": float(row['lon'])}
                for _, row in cluster_df.iterrows()
            ]
        })

    return hotspots

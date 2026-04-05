# ALERT-ACC

ALERT-ACC is a data-driven accident intelligence dashboard that identifies and visualizes high-risk accident zones using spatial clustering, heatmaps, and temporal analysis.

The system focuses on accident data from Pune and presents interactive insights through a structured analytical interface.

---

## Project Overview

ALERT-ACC combines:

- Spatial heatmaps
- Clustering-based hotspot detection
- Monthly trend analysis
- Seasonal comparisons
- Interactive visualization dashboard

The goal is to support data-driven statistical analysis for safety planning and highlight regions with high accident density.

---

## Key Features

### 1. Overall Heatmap
Visualizes accident density across the city using Gaussian-based smoothing.

### 2. Seasonal Analysis
Separate heatmaps for:
- Summer
- Monsoon
- Winter

This allows comparison of accident distribution across seasons.

### 3. Monthly Trend Analysis
Interactive bar chart showing accident count per month.

Helps identify temporal patterns and peak accident periods.

### 4. Hotspot Detection (Clustering)
- KMeans clustering with increased spatial granularity (20 clusters)
- Top 5 densest clusters selected
- Centroid computation for each hotspot
- Visual structural overlay:
  - Cluster points
  - Centroid markers
  - Connection lines
- Clickable centroid popup:
  - Dominant location name
  - Accident count

---

## Methodology

### Data Processing
- Accident records cleaned and structured
- Locations converted to latitude/longitude using geocoding
- Seasonal and monthly features extracted

### Spatial Analysis
- KMeans clustering (20 clusters)
- Cluster ranking by density
- Top 5 dense spatial groupings selected as hotspots
- Centroids computed using mean coordinate method

### Visualization
- Folium + Leaflet for map rendering
- Gaussian kernel-based heatmap
- Interactive frontend built with HTML, CSS, and JavaScript

---

## Tech Stack

### Backend
- Python
- Pandas
- Scikit-learn
- Folium
- Supabase (PostgreSQL Database)
- python-dotenv

### Frontend
- HTML
- CSS (Neo-Brutalism-inspired UI)
- JavaScript
- Chart.js

---

## Project Structure

accident-heatmap/
    .env
    .env.example
    requirements.txt

    data/
        (Raw/processed CSV data files, mostly superseded by Supabase)

    src/
        db.py                # Supabase database client
        export_monthly.py
        spatial_hotspots.py
        heatmap.py
        seasonal_maps.py
        monthly_trend.py

    outputs/
        accident_heatmap_all.html
        accident_heatmap_hotspots.html

    frontend/
        index.html
        map.html

        css/
            map.css

        js/
            map.js

        assets/
            monthly_counts.json

---

## Setup and Configuration

### Prerequisites
- Python 3.8+
- Supabase account with `pune-accidents` table populated with geocoded data.

### Installation
1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Set up environment variables:
   Copy `.env.example` to `.env` and configure your Supabase URL and Key:
   ```bash
   cp .env.example .env
   ```

## Running the Project

1. Generate the maps and analytical assets by running the scripts in the `src/` directory. They will fetch the dataset directly from Supabase:
   ```bash
   python src/export_monthly.py
   python src/spatial_hotspots.py
   python src/heatmap.py
   python src/seasonal_maps.py
   python src/monthly_trend.py
   ```

2. Launch Frontend
Open:
```
frontend/index.html
```


Navigate to the analysis panel to explore:
- Overall heatmap
- Seasonal maps
- Monthly trend
- Hotspot structure visualization

---

## Objective

The system aims to:

- Identify accident-prone zones
- Understand temporal accident trends
- Provide visual decision-support insights
- Support data-driven safety planning

---

## Future Enhancements

- Density-based clustering comparison (DBSCAN)
- Seasonal hotspot comparison
- Click-to-zoom hotspot navigation
- Year-wise comparative analysis
- Real-time data integration

---

## License

This project is developed for academic purposes.


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

### Frontend
- HTML
- CSS (Neo-Brutalism-inspired UI)
- JavaScript
- Chart.js

---

## Project Structure

---

accident-heatmap/
│
├── data/
│ └── accidents_geo.csv
│
├── src/
│ ├── export_monthly.py
│ └── spatial_hotspots.py
│
├── outputs/
│ ├── accident_heatmap_all.html
│ └── accident_heatmap_hotspots.html
│
├── frontend/
│ ├── index.html
│ ├── map.html
│ ├── css/
│ │ └── map.css
│ ├── js/
│ │ └── map.js
│ └── assets/
│ └── monthly_counts.json

---

## Running the Project

Launch Frontend

Open:

frontend/index.html


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


import pandas as pd
import os

df = None

def load_data():
    global df
    if df is None:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Paths to both datasets
        gemini_path = os.path.normpath(os.path.join(current_dir, "../../../data_pipeline/gemini/data/geocoded/gemini_accidents_geo.csv"))
        scraper_path = os.path.normpath(os.path.join(current_dir, "../../../data_pipeline/scraper/data/geocoded/scraped_accidents_geo.csv"))
        
        # Load and combine
        df_gemini = pd.read_csv(gemini_path)
        df_scraper = pd.read_csv(scraper_path)
        
        # Ensure they have the same columns
        df = pd.concat([df_gemini, df_scraper], ignore_index=True)
        
        # Clean up
        df = df.dropna(subset=['lat', 'lon', 'month'])
        df["month"] = pd.to_numeric(df["month"], errors="coerce").astype(int)
    return df

def get_data():
    return load_data()

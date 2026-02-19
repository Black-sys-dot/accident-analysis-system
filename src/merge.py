import pandas as pd
import os

RAW_FOLDER = "data/raw"
OUTPUT_FILE = "data/processed/accidents_merged.csv"

def merge_raw_files():
    all_dfs = []

    for file in os.listdir(RAW_FOLDER):
        if file.endswith(".csv"):
            path = os.path.join(RAW_FOLDER, file)
            print(f"Reading: {file}")
            df = pd.read_csv(path)
            all_dfs.append(df)

    if not all_dfs:
        print("⚠️ No CSV files found in data/raw")
        return

    merged_df = pd.concat(all_dfs, ignore_index=True)

    # Normalize column names
    merged_df.columns = merged_df.columns.str.strip().str.lower()

    # Rename columns to standard format
    merged_df = merged_df.rename(columns={
        "title": "title",
        "date": "date",
        "precise address": "location"
    })

    # Keep only required columns
    merged_df = merged_df[["title", "date", "location"]]

    # Drop duplicates based on meaningful columns
    merged_df = merged_df.drop_duplicates(subset=["title", "date", "location"])

    merged_df.to_csv(OUTPUT_FILE, index=False)
    print(f"✅ Merged file saved to {OUTPUT_FILE}")
    print(f"Total rows: {len(merged_df)}")

if __name__ == "__main__":
    merge_raw_files()

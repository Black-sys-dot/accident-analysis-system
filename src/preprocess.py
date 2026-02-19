import pandas as pd

INPUT_FILE = "data/processed/accidents_merged.csv"
OUTPUT_FILE = "data/processed/accidents_processed.csv"

def get_season(month):
    if month in [6, 7, 8, 9]:
        return "Monsoon"
    elif month in [3, 4, 5]:
        return "Summer"
    else:
        return "Winter"

def preprocess_data():
    print("🔄 Loading merged dataset...")
    df = pd.read_csv(INPUT_FILE, engine="python")

    print("📌 Original row count:", len(df))

    df.columns = df.columns.str.strip().str.lower()
    print("📌 Columns detected:", df.columns.tolist())

    df["date"] = df["date"].astype(str).str.strip()

    # Correct format for abbreviated months
    df["date"] = pd.to_datetime(
        df["date"],
        format="%b %d, %Y",
        errors="coerce"
    )

    failed_dates = df["date"].isna().sum()
    print(f"⚠️ Failed date parses: {failed_dates}")

    df = df.dropna(subset=["date"])
    print("📌 Row count after date cleaning:", len(df))

    df["year"] = df["date"].dt.year
    df["month"] = df["date"].dt.month
    df["season"] = df["month"].apply(get_season)

    df["location"] = df["location"].astype(str).str.strip()

    df.to_csv(OUTPUT_FILE, index=False)

    print(f"✅ Processed file saved to {OUTPUT_FILE}")
    print("🎯 Final row count:", len(df))

if __name__ == "__main__":
    preprocess_data()

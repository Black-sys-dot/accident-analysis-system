import pandas as pd
import json
import os

INPUT_FILE = "data/geocoded/accidents_geo.csv"
OUTPUT_FILE = "frontend/assets/monthly_counts.json"

print("📂 Loading dataset...")
df = pd.read_csv(INPUT_FILE)

df["month"] = pd.to_numeric(df["month"], errors="coerce")

monthly_counts = (
    df.groupby("month")
      .size()
      .reindex(range(1, 13), fill_value=0)
)

result = monthly_counts.tolist()

os.makedirs("frontend/assets", exist_ok=True)

with open(OUTPUT_FILE, "w") as f:
    json.dump(result, f)

print("✅ Monthly data exported:")
print(result)

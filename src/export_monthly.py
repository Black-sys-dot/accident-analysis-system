import pandas as pd
import json
import os
import sys

# Add parent directory to path so we can import src.db
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.db import get_accidents_data

OUTPUT_FILE = "frontend/assets/monthly_counts.json"

print("📂 Loading dataset from Supabase...")
df = get_accidents_data()

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

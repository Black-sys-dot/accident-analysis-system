import matplotlib
matplotlib.use("Agg")

import pandas as pd
import matplotlib.pyplot as plt
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.db import get_accidents_data

OUTPUT_FOLDER = "maps"

def generate_monthly_trend():

    print("📂 Loading dataset from Supabase...")
    df = get_accidents_data()

    # Group by month
    monthly_counts = df.groupby("month").size()

    # Ensure months are sorted 1–12
    monthly_counts = monthly_counts.sort_index()

    # Month labels
    month_names = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ]

    x_labels = [month_names[i-1] for i in monthly_counts.index]

    # Plot
    plt.figure(figsize=(10,6))
    plt.bar(x_labels, monthly_counts.values)
    plt.xlabel("Month")
    plt.ylabel("Number of Accidents")
    plt.title("Monthly Accident Trend - Pune")
    plt.tight_layout()

    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    output_path = os.path.join(OUTPUT_FOLDER, "monthly_trend.png")
    plt.savefig(output_path)

    print(f"✅ Saved monthly trend chart to {output_path}")

if __name__ == "__main__":
    generate_monthly_trend()

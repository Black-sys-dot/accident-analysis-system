import json
import csv
import os
from datetime import datetime

# Paths relative to the script's new location
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
input_file = os.path.normpath(os.path.join(BASE_DIR, '../data/raw/gemini_scraped_accidents.json'))
output_dir = os.path.normpath(os.path.join(BASE_DIR, '../data/processed'))
output_file = os.path.join(output_dir, 'gemini_raw_data.csv')

# Ensure output directory exists
os.makedirs(output_dir, exist_ok=True)

# Season mapping logic based on project conventions
# Summer: 3, 4, 5
# Monsoon: 6, 7, 8, 9
# Winter: 10, 11, 12, 1, 2
def get_season(month):
    if month in [3, 4, 5]:
        return "Summer"
    elif month in [6, 7, 8, 9]:
        return "Monsoon"
    elif month in [10, 11, 12, 1, 2]:
        return "Winter"
    return "Unknown"

print(f"Loading data from {input_file}...")
with open(input_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

# CSV Headers
headers = ['title', 'date', 'location', 'year', 'month', 'season']

processed_count = 0
error_count = 0

print(f"Writing CSV to {output_file}...")
with open(output_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=headers)
    writer.writeheader()
    
    for item in data:
        date_str = item.get('date', '')
        month = None
        
        # Try to parse the date to extract the month
        try:
            # Assuming YYYY-MM-DD format as requested in prompt
            if date_str and len(date_str) >= 7:
                month = int(date_str.split('-')[1])
        except (ValueError, IndexError):
            # Fallback if date is malformed
            pass
            
        if month:
            season = get_season(month)
        else:
            season = "Unknown"
            month = "" # keep it empty if we can't parse
            error_count += 1
            
        row = {
            'title': item.get('title', 'Unknown'),
            'date': date_str,
            'location': item.get('location', 'Unknown'),
            'year': item.get('year', ''),
            'month': month,
            'season': season
        }
        
        writer.writerow(row)
        processed_count += 1

print(f"Done! Successfully processed {processed_count} records.")
if error_count > 0:
    print(f"Note: {error_count} records had missing or malformed dates and were assigned 'Unknown' season.")
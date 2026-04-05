import os
import json
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("ERROR: GEMINI_API_KEY not found in environment.")
    exit(1)

client = genai.Client(api_key=api_key)

# General queries divided by timeframes, going backwards from 2026 to 2024
queries = [
    "Pune road accident news involving trucks and two-wheelers 2024 2025",
    "Pune pedestrian hit and run cases news reports 2023 to 2025",
    "Pune fatal road accidents latest news 2024",
    "Pune PMPML bus accident news reports",
    "Pune nighttime speeding car crash news",
    "Pune highway pileup and chain collision accidents news",
    "Pune drunk driving road accident cases",
    "Pune severe motorcycle road accident news",
    "Pune local news reports fatal road accidents",
    "Pune traffic accident news updates multiple vehicles"
]

prompt_template = """
Use the Google Search tool to search for news articles matching this specific query: "{query}"

Find exactly 50 distinct news articles about different road accidents in Pune matching the timeframe in the query. If you cannot find 50, provide as many distinct articles as you possibly can. 

Extract the information into a strict JSON array of objects. 
Each object MUST have EXACTLY these fields:
- "title": (string) The headline of the news article or a summary of the accident.
- "date": (string) Date of the accident or news report (YYYY-MM-DD format).
- "location": (string) Specific location in Pune where the accident happened.
- "year": (integer) Year of the accident.
- "url": (string) Exact URL of the news article.

{avoid_section}

CRITICAL RULES:
1. Output ONLY a valid JSON array. The response must start with [ and end with ].
2. Do NOT wrap the JSON in markdown blocks (e.g., no ```json ... ```).
3. Do NOT include any intro text, outro text, or sources block.
4. ONLY include the DIRECT, PUBLIC URL to the news publisher's website (e.g., https://timesofindia.indiatimes.com/...).
5. NEVER use internal Google URLs, 'vertxaisearch.cloud.google.com' URLs, or grounding links. Extract the actual article link!
6. STRICTLY NO DUPLICATES: Check the provided list of already found articles and ensure absolutely ZERO overlap. Each article in your response must represent a UNIQUE incident.
"""

all_accidents = []
found_titles_and_dates = []

output_dir = os.path.join(os.path.dirname(__file__), "../data/raw")
os.makedirs(output_dir, exist_ok=True)
output_file = os.path.join(output_dir, "gemini_scraped_accidents.json")

# Load existing data to continue where we left off
if os.path.exists(output_file):
    with open(output_file, 'r', encoding='utf-8') as f:
        try:
            existing_data = json.load(f)
            all_accidents.extend(existing_data)
            for item in existing_data:
                if 'title' in item:
                    found_titles_and_dates.append(f"{item['title']} (Reported: {item.get('date', 'Unknown Date')})")
            print(f"Loaded {len(existing_data)} existing records. Continuing to build the dataset...", flush=True)
        except json.JSONDecodeError:
            print("Existing data file is corrupt or empty. Starting fresh.", flush=True)

print(f"Starting Gemini Search Pipeline. Batch size: {len(queries)} queries.", flush=True)

for i, query in enumerate(queries):
    print(f"\n[{i+1}/{len(queries)}] Querying: '{query}'", flush=True)
    
    avoid_text = ""
    if found_titles_and_dates:
        # Pass the previously found articles to avoid repetition
        titles_list = "\n".join(f"- {t}" for t in found_titles_and_dates)
        avoid_text = f"CRITICAL - YOU HAVE ALREADY SCRAPED THESE ARTICLES:\n{titles_list}\n\nDO NOT INCLUDE ANY OF THE ABOVE ARTICLES IN YOUR RESPONSE. FIND NEW, UNIQUE ARTICLES ONLY."
    
    prompt = prompt_template.format(query=query, avoid_section=avoid_text)
    
    try:
        text = None
        response = client.models.generate_content(
            model='gemini-3-flash-preview',
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}],
                temperature=0.2
            )
        )
        print("  -> Got response from Gemini...", flush=True)
        
        text = response.text
        
        # Hard sanitize: remove API key from the raw text immediately
        if text and api_key in text:
            text = text.replace(api_key, "REDACTED_KEY")
            
        print(f"  -> Extracted text length: {len(text) if text else 0}", flush=True)
        
        if text:
            text = text.strip()
            
            # Strip Markdown if the model accidentally includes it
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
                
            text = text.strip()
            
            data = json.loads(text)
            if isinstance(data, list):
                print(f"  -> Extracted {len(data)} articles in this batch.", flush=True)
                
                # Add to our main lists
                for item in data:
                    all_accidents.append(item)
                    if 'title' in item:
                        # Store both title and exact date to make it easier for Gemini to identify duplicates
                        found_titles_and_dates.append(f"{item['title']} (Reported: {item.get('date', 'Unknown Date')})")
            else:
                print(f"  -> Returned data is not a list. Skipping.", flush=True)
        else:
            print("  -> No text in response.", flush=True)
            
    except json.JSONDecodeError as e:
        print(f"  -> Failed to parse JSON. Model output might be malformed.", flush=True)
        t_preview = "No text"
        if text:
            t_preview = text[:200]
        print(f"  -> Preview: {t_preview}...", flush=True)
    except Exception as e:
        print(f"  -> Error occurred: {e}", flush=True)
    
    # Wait before the next request to respect rate limits
    if i < len(queries) - 1:
        print("  -> Waiting 10 seconds before next query...", flush=True)
        time.sleep(10)

print(f"\nPipeline finished. Total records before deduplication: {len(all_accidents)}", flush=True)

# Deduplicate by URL just to be absolutely sure
unique_data = {item.get('url'): item for item in all_accidents if item.get('url')}
final_list = list(unique_data.values())

print(f"Total unique records after final deduplication: {len(final_list)}", flush=True)

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(final_list, f, indent=4, ensure_ascii=False)

print(f"Data saved to: {output_file}", flush=True)

# Pune Road Accident Data Collection

## Overview

This project scrapes, cleans, and structures news articles about road accidents in Pune, Maharashtra, India from 2018-2026. The final dataset contains **188 unique articles** with locations.

---

## Data Collection Flow

```
1. SCRAPE raw articles from news sources
        ↓
2. CONSOLIDATE into year folders
        ↓
3. CLEAN with Gemini AI (extract title, location, date, season)
        ↓
4. REPAIR & FIX NULL dates from original JSON metadata
        ↓
5. FINAL CLEANUP (remove duplicates, non-accidents)
        ↓
6. OUTPUT: cleaned_data.csv
```

---

## Step 1: Scraping

### Scripts Used

| Script | Source | Purpose |
|--------|--------|---------|
| `comprehensive_scraper.js` | Multiple | Main bulk URL scraper (290+ URLs) |
| `bridge_chronicle_scraper.js` | thebridgechronicle.com | Bridge Chronicle articles |
| `hindu_scraper.js` | thehindu.com | The Hindu articles |
| `news18_scraper.js` | news18.com | News18 articles |
| `more_ie_scraper.js` | indianexpress.com | Indian Express specific |
| `more_dh_scraper.js` | deccanherald.com | Deccan Herald specific |
| `more_urls_scraper.js` | Mixed | Historical mixed URLs |

### How Scraping Works

1. Each scraper contains hardcoded URLs for specific news sources
2. Uses `axios` + `cheerio` for HTTP requests and HTML parsing
3. Extracts: title, content, date, source URL
4. Saves to `scraped_data/{year}/pune_road_accidents.json`
5. Deduplication via URL hash tracking in `seen_hashes.json`

### Success Rate

| Source | Status | Notes |
|--------|--------|-------|
| Indian Express | ✅ Working | Most reliable, clean HTML |
| Deccan Herald | ✅ Working | Good coverage |
| News18 | ✅ Working | Some video-only articles |
| Bridge Chronicle | ✅ Working | Good for Pune local |
| The Hindu | ✅ Working | Some paywall issues |
| Mumbai Live | ⚠️ Limited | Very few articles |
| Pune Mirror | ⚠️ Limited | URL structure changed |
| Times of India | ❌ Blocked | 403 Forbidden |
| Hindustan Times | ❌ Blocked | 403 Forbidden |
| Sakal | ❌ Blocked | 403 Forbidden |
| Free Press Journal | ❌ Blocked | 403 Forbidden |
| NDTV | ❌ Blocked | 403 Forbidden |

### Failed Scrapers

| Script | Why Failed |
|--------|------------|
| `scraper.js` | Monolithic, mixed URLs from blocked sources |
| `enhanced_scraper.js` | Same - Times of India, NDTV blocked |
| `new_sources_scraper.js` | Mixed blocked + fixed bug (saved all to 2026) |
| `historical_scraper.js` | One-time use, NDTV URLs blocked |
| `direct_scraper.js` | Pune Mirror URLs 404, Hindustan Times 403 |
| `puppeteer_scraper.js` | Heavy, unnecessary - found enough from open sources |

---

## Step 2: Consolidation

### Script: `consolidate.js`

- Reads all `scraped_data/{year}/pune_road_accidents.json` files
- Merges into single `pune_road_accidents.json` per year
- Uses `article.date.year` for correct year categorization
- Deduplicates based on URL hash

---

## Step 3: Gemini AI Cleaning

### Script: `clean_data.js`

Uses `models/gemini-2.5-flash` to extract structured data from scraped articles.

**Output Format:**
```
title, date, location, year, month, season, url
```

**Fields Extracted:**
- **title**: Clean, concise headline (max 100 chars)
- **date**: Full date in YYYY-MM-DD format
- **location**: Full address with area, road/highway, city, state, country
- **year**: 4-digit year
- **month**: 2-digit month (01-12)
- **season**: Spring/Summer/Monsoon/Winter
- **url**: Source URL

**Batching:**
- 8 articles per API call
- 2-second delay between batches
- Progress tracking in `cleaning_progress.json`
- Retry failed batches

---

## Step 4: Date Repair

### Script: `repair_csv.js`

Fixes NULL dates by parsing the original JSON metadata.

**Date Parsing Logic:**
1. Try ISO format: `YYYY-MM-DD`
2. Try "Mon DD, YYYY" (e.g., "Jul 24, 2019")
3. Try "DD Mon YYYY" (e.g., "24 Jul 2019")
4. Fallback to JS Date parsing

**Season Mapping:**
- Spring: March, April, May
- Summer: June, July, August
- Monsoon: September, October, November
- Winter: December, January, February

---

## Step 5: Final Cleanup

### Manual Review Process

After AI cleaning, articles were manually reviewed to:

1. **Remove non-accidents**: Plane crashes, election news, IPL scores, movie reviews, opinion pieces
2. **Remove duplicates**: Same article from different sources
3. **Fix locations**: Auto-extract from title when NULL

### Scripts (One-time use, now deleted)
- `clean_csv.js` - Batch remove non-accidents, fix locations
- `remove_dupes.js` - Remove duplicate URLs
- `dedupe_titles.js` - Remove duplicate titles
- `fix_csv.js` - Fill NULL month/season from dates

---

## API Attempts (Failed)

### NewsAPI (`newsapi_scraper.js`)
- ❌ **Failed**: Free tier only allows past 30 days
- Cannot retrieve historical 2018-2024 data

### GNews API (`gnews_scraper.js`)
- ❌ **Failed**: Date filtering is broken
- Returns only recent articles, ignores `from`/`to` parameters

### Currents API (`currents_scraper.js`)
- ⚠️ **Limited**: Returns 1-3 articles per query
- Rate limits hit quickly
- Used for fresh data only (`fetch_cycle.js`, `fetch_fresh.js`)

---

## Current Dataset Stats

| Metric | Count |
|--------|-------|
| **Total Articles** | 188 |
| **With Location** | 188 (100%) |
| **With Date** | 148 (79%) |
| **NULL Dates** | 40 (21%) |

### Season Distribution (148 with valid dates)
| Season | Count |
|--------|-------|
| Spring | 60 |
| Monsoon | 37 |
| Winter | 27 |
| Summer | 24 |

### Year Distribution
| Year | Count |
|------|-------|
| 2018 | 8 |
| 2019 | 8 |
| 2020 | 6 |
| 2021 | 10 |
| 2022 | 16 |
| 2023 | 20 |
| 2024 | 26 |
| 2025 | 18 |
| 2026 | 102 |

---

## Files

### Data
- `cleaned_data.csv` - Final structured dataset (188 articles)
- `scraped_data/` - Raw JSON data organized by year
- `scraped_data_backup/` - Backup of original scraped data
- `seen_hashes.json` - URL deduplication tracking

### Scripts
- **Scrapers**: `comprehensive_scraper.js`, `*_scraper.js` (7 files)
- **APIs**: `fetch_cycle.js`, `fetch_fresh.js`
- **Processors**: `consolidate.js`, `clean_data.js`, `repair_csv.js`, `fix_csv.js`

---

## Usage

### To Scrape New Data
```bash
node comprehensive_scraper.js
node bridge_chronicle_scraper.js
# ... other scrapers
```

### To Consolidate
```bash
node consolidate.js
```

### To Clean with Gemini
```bash
node clean_data.js
```

### To Fetch Fresh from Currents API
```bash
node fetch_cycle.js    # 10 cycles
node fetch_fresh.js   # Single fetch
```

---

## Lessons Learned

1. **Many major news sites block scrapers** - Times of India, Hindustan Times, NDTV all return 403
2. **Simple HTTP scraping works** - No need for Puppeteer/headless browsers
3. **Gemini AI is effective** - Can extract structured data from messy article content
4. **Date parsing is tricky** - Raw dates come in many formats; need robust parsing
5. **Duplicate detection is essential** - Same articles from multiple sources, and same API returning same URLs
6. **Manual review is necessary** - AI can't distinguish accident from plane crash, election news

---

## Notes

- Original instructions: Only road accidents, no general accidents
- Target: 500 unique articles (achieved 188 with proper deduplication)
- Lower limit: 2018
- All articles must have Pune/location details
- Articles categorized by actual article date, not folder name

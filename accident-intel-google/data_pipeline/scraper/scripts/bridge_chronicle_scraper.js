const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = path.join(__dirname, 'scraped_data');

const BRIDGE_CHRONICLE_URLS = [
  // 2020
  'https://www.thebridgechronicle.com/pune/pune-navale-bridge-accident-sees-vehicles-piling-52662',
  'https://www.thebridgechronicle.com/pune/not-again-punes-navale-bridge-witnesses-another-accident-after-truck-ploughs-through-multiple-vehicles',
  'https://www.thebridgechronicle.com/pune/high-gradient-slope-makes-punes-navale-bridge-as-accident-hotspot-in-the-city',
  
  // 2021
  'https://www.thebridgechronicle.com/pune/pune-three-dead-several-injured-in-two-separate-accidents',
  'https://www.thebridgechronicle.com/pune/pune-fashion-street-fire-senior-fire-officer-dies-in-road-accident',
  'https://www.thebridgechronicle.com/pune/mumbai-pune-expressway-accident-five-killed-several-injured-in-multiple-vehicles-collision',
  
  // 2024
  'https://thebridgechronicle.com/pune-porsche-case-tragic-accident',
  'https://www.thebridgechronicle.com/news/porsche-kalyaninagar-accident-chargesheet-filed-against-two-more-accused',
  'https://www.thebridgechronicle.com/news/pune-solapur-highway-deadly-collision-between-two-st-buses-leaves-1-dead-69-injured',
  'https://www.thebridgechronicle.com/news/pune-woman-killed-granddaughter-injured-in-accident-with-speeding-pmpml-bus',
  'https://www.thebridgechronicle.com/news/bhukum-couple-killed-in-dump-truck-motorcycle-collision-driver-flees',
  'https://www.thebridgechronicle.com/news/chandani-chowk-accident-speeding-cargo-bus-hits-bikers-3-persons-injured',
  'https://www.thebridgechronicle.com/news/wagholi-pedestrian-killed-by-st-bus-on-pune-nagar-highway',
  'https://www.thebridgechronicle.com/news/st-bus-hits-truck-on-expressway-one-passenger-dies-multiple-injuries-reported',
  
  // 2025
  'https://www.thebridgechronicle.com/pune/pune-navale-bridge-fatal-collision-road-safety-concern-agn97',
  'https://www.thebridgechronicle.com/news/pune-two-fatal-accidents-young-biker-pedestrian-killed-speeding-vehicles-agn97',
  'https://www.thebridgechronicle.com/pune/pune-kalepadal-drunk-driving-accident-agn97',
  'https://www.thebridgechronicle.com/pune/eight-killed-four-injured-jejuri-morgaon-road-accident-pune-pm-modi-ex-gratia',
  'https://www.thebridgechronicle.com/pune/speeding-truck-rams-two-cars-bike-vadgaon-flyover-rider-killed',
  'https://www.thebridgechronicle.com/pune/pune-accident-speeding-car-overturns-navale-bridge-satara-highway-agn97',
  
  // 2026
  'https://www.thebridgechronicle.com/pune/speeding-dumper-collides-eight-vehicles-katraj-dehu-road-mp99',
  'https://www.thebridgechronicle.com/pune/navale-bridge-accident-pune-six-month-road-safety-overhaul-agn97',
];

const BROWSER_HEADERS = [
  { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.5', 'Accept-Encoding': 'gzip, deflate, br', 'Connection': 'keep-alive' },
];

async function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function getHeader() { return BROWSER_HEADERS[0]; }

function generateHash(title, url) {
  const str = `${(title || '').toLowerCase().trim()}|${(url || '').toLowerCase().trim()}`;
  return crypto.createHash('md5').update(str).digest('hex');
}

function extractYear(dateText) {
  if (!dateText) return 2026;
  const match = dateText.match(/202[0-6]|201[89]/);
  if (match) return parseInt(match[0]);
  return 2026;
}

function getSource(url) {
  if (url.includes('thebridgechronicle')) return 'Bridge Chronicle';
  return 'Other';
}

async function scrapeArticle(url) {
  const headers = getHeader();
  try {
    const response = await axios.get(url, { headers, timeout: 20000 });
    const $ = cheerio.load(response.data);
    
    let title = $('h1').first().text().trim() || $('title').text().trim();
    if (!title) title = '';
    
    let content = '';
    $('p').each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 50 && !text.includes('Subscribe') && !text.includes('Premium') && !text.includes('Sign in')) {
        content += text + '\n\n';
      }
    });
    
    let dateText = '';
    $('[class*="date"], [class*="time"], [class*="publish"], time').each((i, el) => {
      const text = $(el).text().trim();
      if (text.match(/\d{4}/)) { dateText = text; return false; }
    });
    
    const year = extractYear(dateText);
    
    return { url, title, content: content.substring(0, 3000), date: { year, raw: dateText }, source: getSource(url), success: true };
  } catch (e) {
    return { url, success: false, error: e.message };
  }
}

async function main() {
  console.log('=== BRIDGE CHRONICLE SCRAPER ===\n');
  
  const seenHashes = new Set();
  const hashFile = path.join(BASE_DIR, 'seen_hashes.json');
  if (fs.existsSync(hashFile)) {
    try {
      const hashes = JSON.parse(fs.readFileSync(hashFile, 'utf-8'));
      hashes.forEach(h => seenHashes.add(h));
    } catch (e) {}
  }
  
  let newArticles = 0;
  let duplicates = 0;
  let failed = 0;
  const articles = [];
  const byYear = {};
  
  for (let i = 0; i < BRIDGE_CHRONICLE_URLS.length; i++) {
    const url = BRIDGE_CHRONICLE_URLS[i];
    console.log(`[${i+1}/${BRIDGE_CHRONICLE_URLS.length}] ${url.substring(0, 60)}...`);
    
    const result = await scrapeArticle(url);
    
    if (!result.success) {
      console.log(`  ✗ Failed: ${result.error}`);
      failed++;
      await delay(2000);
      continue;
    }
    
    const hash = generateHash(result.title, result.url);
    
    if (seenHashes.has(hash)) {
      console.log(`  - Duplicate`);
      duplicates++;
    } else {
      seenHashes.add(hash);
      articles.push(result);
      
      const yr = result.date.year;
      if (!byYear[yr]) byYear[yr] = 0;
      byYear[yr]++;
      
      console.log(`  ✓ NEW (${yr}): ${result.title.substring(0, 40)}...`);
      newArticles++;
    }
    
    await delay(3000);
  }
  
  for (const [yr, arts] of Object.entries(byYear)) {
    const yearDir = path.join(BASE_DIR, yr);
    if (!fs.existsSync(yearDir)) fs.mkdirSync(yearDir, { recursive: true });
    
    const yearFile = path.join(yearDir, 'pune_road_accidents.json');
    let existing = [];
    if (fs.existsSync(yearFile)) {
      try {
        existing = JSON.parse(fs.readFileSync(yearFile, 'utf-8')).articles || [];
      } catch (e) {}
    }
    
    const newArts = articles.filter(a => a.date.year === parseInt(yr));
    const all = [...existing, ...newArts];
    fs.writeFileSync(yearFile, JSON.stringify({
      source: 'Bridge Chronicle Scraper',
      year: parseInt(yr),
      totalArticles: all.length,
      scrapedAt: new Date().toISOString(),
      articles: all
    }, null, 2));
  }
  
  fs.writeFileSync(hashFile, JSON.stringify([...seenHashes], null, 2));
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total URLs: ${BRIDGE_CHRONICLE_URLS.length}`);
  console.log(`New articles: ${newArticles}`);
  console.log(`Duplicates: ${duplicates}`);
  console.log(`Failed: ${failed}`);
  console.log('\nBy year:', byYear);
}

main().catch(console.error);

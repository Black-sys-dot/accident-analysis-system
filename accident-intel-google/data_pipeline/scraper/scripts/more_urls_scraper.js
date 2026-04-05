const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = path.join(__dirname, 'scraped_data');

const MORE_URLS = [
  // 2022
  'https://preprod.indianexpress.com/photos/india-news/punes-navale-bridge-accident-a-truck-collides-with-over-48-vehicles-several-injured-8280659/',
  'https://indianexpress.com/article/cities/pune/pune-truck-accident-no-brake-failure-driver-turned-off-ignition-to-save-fuel-say-police-after-rto-assessment-8280342/',
  'https://indianexpress.com/article/cities/pune/accident-pune-navale-bridge-tanker-collides-vehicles-casualties-8291281/',
  'https://indianexpress.com/article/cities/pune/navale-bridge-accident-felt-like-experiencing-a-tremor-feel-fortunate-to-have-escaped-with-life-survivors-8281644/',
  'https://indianexpress.com/article/cities/pune/no-permanent-solution-till-gradient-of-the-slope-of-navale-bridge-is-reduced-police-commissioner-8281617/',
  'https://indianexpress.com/article/cities/pune/pune-truck-accident-authorities-phased-reduction-of-heavy-vehicles-speed-limits-8282344/',
  'https://indianexpress.com/article/cities/pune/six-injured-as-truck-with-suspected-brake-failure-rams-several-vehicles-in-pune-8279802/',
  'https://indianexpress.com/article/cities/pune/pune-tempo-falls-into-dive-ghat-valley-driver-dies-7833538/',
  
  // 2023
  'https://indianexpress.com/article/cities/pune/four-injured-as-container-hits-five-vehicles-near-navale-bridge-9051959/',
  'https://indianexpress.com/article/cities/pune/3-accidents-in-2-hours-why-this-14-km-stretch-is-a-danger-zone-8572331/',
  'https://indianexpress.com/article/cities/pune/mumbai-bangalore-highway-bus-truck-accident-deaths-injuries-8570932/',
  'https://indianexpress.com/article/cities/pune/one-dead-three-injured-as-bus-sliding-back-hits-six-vehicles-8621698/',
  'https://indianexpress.com/article/cities/pune/minor-girl-among-3-killed-in-a-truck-fire-following-road-mishap-at-punes-nawale-8986277/',
  'https://indianexpress.com/article/cities/pune/3-from-pune-family-killed-after-bus-topples-near-kolhapur-9038870/',
  'https://indianexpress.com/article/cities/pune/people-carrying-shivjayanti-jyot-injured-pune-truck-hits-tempo-8488541/',
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
  if (url.includes('indianexpress')) return 'Indian Express';
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
    $('[class*="date"], [class*="time"], [class*="publish"]').each((i, el) => {
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
  console.log('=== MORE URLS SCRAPER ===\n');
  
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
  
  for (let i = 0; i < MORE_URLS.length; i++) {
    const url = MORE_URLS[i];
    console.log(`[${i+1}/${MORE_URLS.length}] ${url.substring(0, 60)}...`);
    
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
      source: 'More URLs Scraper',
      year: parseInt(yr),
      totalArticles: all.length,
      scrapedAt: new Date().toISOString(),
      articles: all
    }, null, 2));
  }
  
  fs.writeFileSync(hashFile, JSON.stringify([...seenHashes], null, 2));
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total URLs: ${MORE_URLS.length}`);
  console.log(`New articles: ${newArticles}`);
  console.log(`Duplicates: ${duplicates}`);
  console.log(`Failed: ${failed}`);
  console.log('\nBy year:', byYear);
}

main().catch(console.error);

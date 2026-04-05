const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = path.join(__dirname, 'scraped_data');

const MORE_DH_URLS = [
  'https://www.deccanherald.com/india/maharashtra/three-iit-bombay-students-killed-in-accident-3938384',
  'https://www.deccanherald.com/india/maharashtra/pune-porsche-accident-supreme-court-seeks-maharashtra-govts-response-on-bail-plea-by-minors-father-3912526',
  'https://www.deccanherald.com/india/maharashtra/pune-accident-8-killed-over-30-injured-as-pickup-van-carrying-women-and-children-overturns-in-khed-state-announces-rs-4-lakh-compensation-3675952',
  'https://www.deccanherald.com/india/maharashtra/at-least-six-killed-as-blaze-erupts-after-accident-involving-car-trucks-in-pune-3796979',
  'https://www.deccanherald.com/india/maharashtra/drunk-driver-rams-car-into-parking-counter-of-pune-restaurant-kills-valet-assistant-3815326',
  'https://www.deccanherald.com/india/maharashtra/road-to-perdition-gas-tanker-accident-sparks-24-hour-traffic-chaos-on-mumbai-pune-expressway-3886357',
  'https://www.deccanherald.com/india/maharashtra/pune-porsche-crash-prosecution-begins-arguments-for-framing-charges-against-10-accused-3606239',
  'https://www.deccanherald.com/india/maharashtra/cops-prepare-pune-porsche-crash-impact-analysis-report-3062700',
  'https://www.deccanherald.com/india/maharashtra/pune-car-crash-understand-my-pain-says-victims-mother-as-bombay-hc-orders-release-of-accused-teen-3080286',
  'https://www.deccanherald.com/india/maharashtra/two-killed-64-injured-as-state-buses-collide-on-highway-in-pune-3253020',
  'https://www.deccanherald.com/india/maharashtra/posche-crash-pune-police-recommend-dismissal-of-two-suspended-cops-3466749',
  'https://www.deccanherald.com/india/maharashtra/candle-light-march-held-to-pay-tribute-to-two-techies-killed-in-porsche-car-crash-3038865',
  'https://www.deccanherald.com/india/maharashtra/three-dead-8-injured-in-accident-on-mumbai-pune-expressway-3016640',
  'https://www.deccanherald.com/india/maharashtra/nine-killed-in-accident-in-jejuri-morgaon-road-3593415',
  'https://www.deccanherald.com/india/maharashtra/pune-porsche-case-17-year-old-accused-to-be-tried-as-juvenile-3630880',
  'https://www.deccanherald.com/india/maharashtra/pune-porsche-whose-driver-killed-2-in-accident-was-on-streets-without-registration-since-march-report-3031817',
  'https://www.deccanherald.com/india/maharashtra/1-killed-3-injured-as-drunk-driver-crashes-tempo-into-multiple-vehicles-in-pune-3182257',
  'https://www.deccanherald.com/india/maharashtra/pune-porsche-crash-victims-father-says-accused-in-such-cases-should-be-booked-under-murder-charge-3885419',
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
  if (url.includes('deccanherald')) return 'Deccan Herald';
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
  console.log('=== MORE DH URLS SCRAPER ===\n');
  
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
  
  for (let i = 0; i < MORE_DH_URLS.length; i++) {
    const url = MORE_DH_URLS[i];
    console.log(`[${i+1}/${MORE_DH_URLS.length}] ${url.substring(0, 60)}...`);
    
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
      source: 'More DH URLs Scraper',
      year: parseInt(yr),
      totalArticles: all.length,
      scrapedAt: new Date().toISOString(),
      articles: all
    }, null, 2));
  }
  
  fs.writeFileSync(hashFile, JSON.stringify([...seenHashes], null, 2));
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total URLs: ${MORE_DH_URLS.length}`);
  console.log(`New articles: ${newArticles}`);
  console.log(`Duplicates: ${duplicates}`);
  console.log(`Failed: ${failed}`);
  console.log('\nBy year:', byYear);
}

main().catch(console.error);

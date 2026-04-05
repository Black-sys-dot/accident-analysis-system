const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = path.join(__dirname, 'scraped_data');

const MORE_IE_URLS = [
  'https://indianexpress.com/article/cities/pune/tragedy-on-pune-solapur-highway-3-killed-tyre-burst-flings-muv-into-opposite-lane-10586331/',
  'https://indianexpress.com/article/cities/pune/almost-a-month-after-wife-dies-in-pune-road-accident-guitarist-husband-booked-for-negligence-10507574/',
  'https://preprod.indianexpress.com/article/cities/pune/pune-mumbai-expressway-accident-heavy-vehicle-inspection-fitness-10527280/',
  'https://indianexpress.com/article/legal-news/pune-porsche-sc-notice-bail-pleas-accused-10460373/',
  'https://indianexpress.com/article/cities/pune/killed-injured-pune-accident-navale-bridge-selfie-point-10363830/',
  'https://indianexpress.com/article/cities/pune/pune-navale-bridge-accident-truck-was-overloaded-culpable-homicide-police-10366333/',
  'https://indianexpress.com/article/cities/pune/pune-road-accident-deep-gash-on-forehead-barely-remember-what-hit-me-10364280/',
  'https://indianexpress.com/article/cities/pune/two-killed-one-critical-speeding-truck-hits-five-vehicles-pune-satara-highway-10160307/',
  'https://indianexpress.com/article/cities/pune/road-accident-hadapsar-kills-boy-driver-held-9914926/',
  'https://indianexpress.com/article/cities/pune/pune-hit-and-run-suv-driver-arrested-morning-walker-accident-death-9919515/',
  'https://indianexpress.com/article/cities/pune/hit-and-run-accident-kills-morning-walker-in-pune-undri-locals-call-for-more-speed-bumps-9918694/',
  'https://indianexpress.com/article/cities/pune/three-injured-after-pmpml-bus-crashes-7-vehicles-brake-failure-suspected-9973279/',
  'https://indianexpress.com/article/cities/pune/pune-gangadham-shatrunjay-road-divider-accident-9893128/',
  'https://indianexpress.com/article/cities/pune/vehicles-collide-road-mishap-bhumkar-chowk-no-casualties-10371194/',
  'https://indianexpress.com/article/cities/pune/bus-climbs-footpath-hinjewadi-crushes-two-schoolchildren-10396677/',
  'https://indianexpress.com/article/cities/pune/pune-porsche-crash-police-dismiss-service-dereliction-duty-10413046/',
  'https://indianexpress.com/article/cities/pune/porsche-crash-case-exposed-systemic-corruption-police-commissioner-amitesh-kumar-10295060/',
  'https://indianexpress.com/article/cities/pune/porsche-crash-case-after-jjb-ruling-what-next-for-minor-possible-outcomes-10131092/',
  'https://indianexpress.com/article/cities/pune/porsche-crash-case-mothers-blood-accused-court-10093048/',
  'https://indianexpress.com/article/cities/pune/trial-pune-porsche-crash-case-next-year-10441664/',
  'https://indianexpress.com/article/cities/pune/cyber-security-expert-killed-accident-pune-mumbai-expressway-9940779/',
  'https://indianexpress.com/article/cities/pune/pune-mumbai-expressway-accident-heavy-vehicle-inspection-fitness-10527280/',
  'https://indianexpress.com/article/cities/pune/nashik-pune-road-accidents-10472980/',
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
  console.log('=== MORE IE URLS SCRAPER ===\n');
  
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
  
  for (let i = 0; i < MORE_IE_URLS.length; i++) {
    const url = MORE_IE_URLS[i];
    console.log(`[${i+1}/${MORE_IE_URLS.length}] ${url.substring(0, 60)}...`);
    
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
      source: 'More IE URLs Scraper',
      year: parseInt(yr),
      totalArticles: all.length,
      scrapedAt: new Date().toISOString(),
      articles: all
    }, null, 2));
  }
  
  fs.writeFileSync(hashFile, JSON.stringify([...seenHashes], null, 2));
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total URLs: ${MORE_IE_URLS.length}`);
  console.log(`New articles: ${newArticles}`);
  console.log(`Duplicates: ${duplicates}`);
  console.log(`Failed: ${failed}`);
  console.log('\nBy year:', byYear);
}

main().catch(console.error);

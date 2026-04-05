const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = path.join(__dirname, 'scraped_data');

const HINDU_URLS = [
  'https://www.thehindu.com/news/national/supreme-court-bail-to-3-accused-in-2024-pune-porsche-crash-victims-kin-say-it-sends-wrong-message/article70585992.ece',
  'https://www.thehindu.com/news/cities/mumbai/bombay-high-court-rejects-seven-bail-pleas-in-pune-luxury-car-hit-and-run-evidence-tampering-case/article70406196.ece',
  'https://www.thehindu.com/news/national/pune-porsche-car-crash-a-speeding-car-twodeaths-and-a-cover-up/article68237051.ece',
  'https://www.thehindu.com/news/national/pune-car-accident-police-arrest-five-including-realtor-as-case-snowballs-into-political-slugfest/article68199225.ece',
  'https://www.thehindu.com/news/national/maharashtra/police-detain-father-of-juvenile-involved-in-pune-car-accident/article68198781.ece',
  'https://www.thehindu.com/news/national/maharashtra/pune-car-crash-it-was-sassoon-doctors-idea-to-swap-juveniles-blood-samples-police-say/article68227305.ece',
  'https://www.thehindu.com/news/national/maharashtra/pune-porsche-accident-accused-minor-tells-police-he-was-drunk-driving/article68246726.ece',
  'https://www.thehindu.com/news/national/pune-luxury-car-crash-court-sends-minors-father-in-police-custody-in-driver-kidnapping-case/article68225147.ece',
  'https://www.thehindu.com/news/national/pune-porsche-car-accident-juveniles-father-two-pub-employees-sent-to-police-custody/article68204022.ece',
  'https://www.thehindu.com/news/national/maharashtra/chargesheet-filed-against-7-accused-in-pune-car-crash-case/article68452630.ece',
  'https://www.thehindu.com/news/national/maharashtra/pune-porsche-accident-police-form-more-than-12-teams-to-investigate-multiple-aspects/article68242252.ece',
  'https://www.thehindu.com/news/national/maharashtra/porsche-crash-police-add-charges-of-evidence-destruction-corruption-against-juvenile/article68690150.ece',
  'https://www.thehindu.com/news/national/pune-car-accident-case-congress-demands-fadnavis-resignation/article68225711.ece',
  'https://www.thehindu.com/news/national/pune-car-crash-teenagers-father-grandfather-remanded-in-14-day-judicial-custody/article68235804.ece',
  'https://www.thehindu.com/news/national/maharashtra/porsche-car-accident-case-pune-police-plan-to-move-supreme-court-against-release-of-juvenile-accused/article68355017.ece',
  'https://www.thehindu.com/news/national/maharashtra/pune-accident-porsche-cars-registration-was-pending-since-march-due-to-non-payment-of-1758-fee/article68202502.ece',
  'https://www.thehindu.com/news/national/maharashtra/pune-porsche-car-accident-bail-to-minor-accused-two-members-of-juvenile-justice-board-removed/article68740211.ece',
  'https://www.thehindu.com/news/national/maharashtra/pune-luxury-car-crash-allegations-against-mla-sunil-tingre-baseless-says-ajit-pawar/article68238993.ece',
  'https://www.thehindu.com/news/cities/mumbai/pune-porsche-crash-two-police-officers-likely-to-face-the-axe-for-shoddy-probe/article69386078.ece',
  'https://www.thehindu.com/news/national/maharashtra/porsche-car-crash-case-exposed-systemic-corruption-pune-police-commissioner/article70142341.ece',
  'https://www.thehindu.com/news/national/maharashtra/five-dead-after-bus-collides-with-tractor-on-mumbai-pune-expressway/article68409013.ece',
  'https://www.thehindu.com/news/cities/mumbai/mumbai-pune-expressway-bus-truck-collision-leaves-18-injured/article68848288.ece',
  'https://www.thehindu.com/news/cities/mumbai/one-dead-seven-injured-as-bus-hits-truck-on-mumbai-pune-expressway/article68771886.ece',
  'https://www.thehindu.com/news/national/other-states/mumbai-pune-expressway-pile-up-after-truck-suffers-brake-failure-injures-6-damages-several-vehicles/article66785102.ece',
  'https://www.thehindu.com/news/national/maharashtra/pune-maharashtra-fire-accident-november-13-2025-updates/article70276439.ece',
  'https://www.thehindu.com/news/national/maharashtra/pune-car-crash-illegal-portions-of-resort-owned-by-accused-juveniles-family-razed-in-mahabaleshwar/article68266306.ece',
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
  if (url.includes('thehindu')) return 'The Hindu';
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
  console.log('=== HINDU SCRAPER ===\n');
  
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
  
  for (let i = 0; i < HINDU_URLS.length; i++) {
    const url = HINDU_URLS[i];
    console.log(`[${i+1}/${HINDU_URLS.length}] ${url.substring(0, 60)}...`);
    
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
      source: 'The Hindu Scraper',
      year: parseInt(yr),
      totalArticles: all.length,
      scrapedAt: new Date().toISOString(),
      articles: all
    }, null, 2));
  }
  
  fs.writeFileSync(hashFile, JSON.stringify([...seenHashes], null, 2));
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total URLs: ${HINDU_URLS.length}`);
  console.log(`New articles: ${newArticles}`);
  console.log(`Duplicates: ${duplicates}`);
  console.log(`Failed: ${failed}`);
  console.log('\nBy year:', byYear);
}

main().catch(console.error);

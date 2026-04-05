const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = path.join(__dirname, 'scraped_data');

const NEWS18_URLS = [
  'https://www.news18.com/india/pune-porsche-accident-victims-parents-meet-maharashtra-cm-eknath-shinde-minor-driver-police-india-news-8944124.html',
  'https://www.news18.com/india/pune-porsche-accident-car-was-plying-with-no-registration-since-march-as-owner-didnt-pay-fee-8898205.html',
  'https://www.news18.com/india/took-innocent-lives-pune-porsche-accident-victims-family-wants-teen-drivers-bail-scrapped-strict-action-8898248.html',
  'https://www.news18.com/india/amid-porsche-crash-outrage-pune-police-to-cancel-dl-permanently-of-drunk-drivers-in-repeated-offences-8961428.html',
  'https://www.news18.com/india/pune-porsche-crash-cm-shinde-orders-probe-3-more-nabbed-cp-denies-pressures-8898939.html',
  'https://www.news18.com/india/pune-porsche-crash-who-were-two-it-professionals-killed-8899401.html',
  'https://www.news18.com/india/pune-porsche-accident-shivani-agarwal-teens-mother-arrested-8912696.html',
  'https://www.news18.com/india/pune-porsche-case-victim-families-in-trauma-but-juvenile-accused-in-traumatised-too-says-bombay-hc-8939841.html',
  'https://www.news18.com/india/police-file-chargesheet-in-porsche-crash-that-killed-2-techies-pune-teens-parents-among-7-named-8980269.html',
  'https://www.news18.com/india/pune-teen-accused-in-porsche-crash-completes-15-day-court-ordered-safe-driving-programme-9020245.html',
  'http://news18.com/explainers/why-teen-in-pune-porsche-car-crash-that-killed-2-was-let-off-what-are-drink-driving-laws-in-india-8898907.html',
  'https://www.news18.com/india/two-cops-suspended-for-dereliction-of-duty-in-pune-car-crash-case-8903006.html',
  'http://news18.com/india/7-dead-after-pick-up-van-veers-off-road-in-pune-pm-modi-cm-fadnavis-announce-ex-gratia-ws-l-9498613.html',
  'http://news18.com/india/dead-truck-driver-cleaner-booked-over-pune-crash-that-killed-8-fir-against-vehicle-owner-too-9706844.html',
  'https://www.news18.com/india/nana-patole-car-accident-news-terrible-car-truck-collision-8846478.html',
  'https://www.news18.com/auto/porsche-taycan-know-all-details-about-the-car-involved-in-pune-fatal-accident-8899866.html',
  'https://www.news18.com/india/pune-porsche-crash-juvenile-justice-board-rejects-plea-to-try-accused-as-adult-9441509.html',
  'https://www.news18.com/india/pune-porsche-crash-police-to-challenge-juvenile-boards-decision-to-try-accused-as-minor-ws-kl-9442708.html',
  'https://www.news18.com/india/pune-porsche-crash-court-rejects-temporary-bail-plea-of-juveniles-father-9473458.html',
  'https://www.news18.com/india/pune-porsche-crash-year-on-kin-of-victims-ask-what-happened-to-fast-tracking-case-ws-l-9342985.html',
  'https://www.news18.com/india/pune-porsche-crash-news-latest-updates-vishal-agarwal-vedant-agarwal-crime-branch-8903228.html',
  'https://www.news18.com/cities/pune/two-killed-four-injured-as-bus-rams-into-pedestrians-in-pune-drunk-driving-suspecteda-ws-l-9743295.html',
  'http://news18.com/agency-feeds/two-policemen-dismissed-over-lapses-in-pune-porsche-case-9761806.html',
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
  if (url.includes('news18')) return 'News18';
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
  console.log('=== NEWS18 SCRAPER ===\n');
  
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
  
  for (let i = 0; i < NEWS18_URLS.length; i++) {
    const url = NEWS18_URLS[i];
    console.log(`[${i+1}/${NEWS18_URLS.length}] ${url.substring(0, 60)}...`);
    
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
      source: 'News18 Scraper',
      year: parseInt(yr),
      totalArticles: all.length,
      scrapedAt: new Date().toISOString(),
      articles: all
    }, null, 2));
  }
  
  fs.writeFileSync(hashFile, JSON.stringify([...seenHashes], null, 2));
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total URLs: ${NEWS18_URLS.length}`);
  console.log(`New articles: ${newArticles}`);
  console.log(`Duplicates: ${duplicates}`);
  console.log(`Failed: ${failed}`);
  console.log('\nBy year:', byYear);
}

main().catch(console.error);

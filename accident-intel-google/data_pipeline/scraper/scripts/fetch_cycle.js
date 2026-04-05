const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CURRENTS_API_KEY = process.env.Currents_API_KEY;
const CSV_FILE = path.join(__dirname, 'cleaned_data.csv');
const QUEUE_FILE = path.join(__dirname, 'fetch_queue.json');

const SEASONS = { '03': 'Spring', '04': 'Spring', '05': 'Spring', '06': 'Summer', '07': 'Summer', '08': 'Summer', '09': 'Monsoon', '10': 'Monsoon', '11': 'Monsoon', '12': 'Winter', '01': 'Winter', '02': 'Winter' };

const SEARCH_QUERIES = [
  'Pune road death',
  'Pune vehicle accident',
  'Pune car crash',
  'Pune two-wheeler accident',
  'Pune pedestrian accident',
  'Pune fatal accident',
  'Pimpri Chinchwad accident',
  'Pune highway death',
  'Pune suburban accident',
  'Maharashtra highway crash'
];

const NON_ACCIDENT_KEYWORDS = [
  'plane crash', 'election', 'ipl', 'cricket', 'football', 'stock market', 
  'ai in policing', 'fruit prices', 'board result', 'rajasthan board',
  'iran war', 'middle east', 'assembly election', 'punjab election',
  'karnataka election', 'weather forecast', 'movie review', 'ai tool',
  'income tax', 'tech gadget', 'mobile launch', 'bitcoin', 'crypto',
  'football match', 'tennis', 'olympics', 'health tips', 'recipe',
  'Gandharva', 'honour killing', 'badruddin', 'ajit pawar plane'
];

function extractLocationFromText(text) {
  const t = text.toLowerCase();
  
  if (t.includes('mumbai-pune expressway')) return 'Mumbai-Pune Expressway, Maharashtra, India';
  if (t.includes('pune-mumbai expressway')) return 'Mumbai-Pune Expressway, Maharashtra, India';
  if (t.includes('mumbai expressway')) return 'Mumbai-Pune Expressway, Maharashtra, India';
  if (t.includes('old mumbai-pune')) return 'Old Mumbai-Pune Highway, Maharashtra, India';
  if (t.includes('pune-nashik') || t.includes('nashik highway')) return 'Pune-Nashik Highway, Maharashtra, India';
  if (t.includes('pune-solapur') || t.includes('solapur highway')) return 'Pune-Solapur Highway, Maharashtra, India';
  if (t.includes('pune-satara') || t.includes('satara highway')) return 'Pune-Satara Highway, Maharashtra, India';
  if (t.includes('pune-bengaluru') || t.includes('bengaluru highway')) return 'Pune-Bengaluru Highway, Maharashtra, India';
  if (t.includes('mumbai-bengaluru')) return 'Mumbai-Bengaluru Highway, Maharashtra, India';
  if (t.includes('navale bridge')) return 'Navale Bridge, Pune, Maharashtra, India';
  if (t.includes('khopoli')) return 'Khopoli, Mumbai-Pune Expressway, Maharashtra, India';
  if (t.includes('lonavala')) return 'Lonavala, Mumbai-Pune Expressway, Maharashtra, India';
  if (t.includes('khandala')) return 'Khandala, Mumbai-Pune Expressway, Maharashtra, India';
  if (t.includes('wadgaons') || t.includes('wadgaon')) return 'Wadgaonsheri, Pune, Maharashtra, India';
  if (t.includes('wakad')) return 'Wakad, Pune, Maharashtra, India';
  if (t.includes('hinjewadi')) return 'Hinjewadi, Pune, Maharashtra, India';
  if (t.includes('baner')) return 'Baner, Pune, Maharashtra, India';
  if (t.includes('aundh')) return 'Aundh, Pune, Maharashtra, India';
  if (t.includes('kothrud')) return 'Kothrud, Pune, Maharashtra, India';
  if (t.includes('hadapsar')) return 'Hadapsar, Pune, Maharashtra, India';
  if (t.includes('camp')) return 'Camp, Pune, Maharashtra, India';
  if (t.includes('koregaon')) return 'Koregaon Park, Pune, Maharashtra, India';
  if (t.includes('kalyani nagar')) return 'Kalyani Nagar, Pune, Maharashtra, India';
  if (t.includes('viman nagar')) return 'Viman Nagar, Pune, Maharashtra, India';
  if (t.includes('chinchwad')) return 'Chinchwad, Pune, Maharashtra, India';
  if (t.includes('pimpri')) return 'Pimpri, Pune, Maharashtra, India';
  if (t.includes('akurdi')) return 'Akurdi, Pune, Maharashtra, India';
  if (t.includes('nigdi')) return 'Nigdi, Pune, Maharashtra, India';
  if (t.includes('katraj')) return 'Katraj, Pune, Maharashtra, India';
  if (t.includes('swargate')) return 'Swargate, Pune, Maharashtra, India';
  if (t.includes('shivajinagar')) return 'Shivajinagar, Pune, Maharashtra, India';
  if (t.includes('deccan')) return 'Deccan, Pune, Maharashtra, India';
  if (t.includes('yerwada')) return 'Yerwada, Pune, Maharashtra, India';
  if (t.includes('kharadi')) return 'Kharadi, Pune, Maharashtra, India';
  if (t.includes('moshi')) return 'Moshi, Pune, Maharashtra, India';
  if (t.includes('chakan')) return 'Chakan, Pune, Maharashtra, India';
  if (t.includes('talegaon')) return 'Talegaon, Pune, Maharashtra, India';
  if (t.includes('pune, maharashtra')) return 'Pune, Maharashtra, India';
  if (t.includes('maharashtra, india')) return 'Maharashtra, India';
  
  return null;
}

function isAccidentArticle(title, description) {
  const text = (title + ' ' + (description || '')).toLowerCase();
  
  for (const kw of NON_ACCIDENT_KEYWORDS) {
    if (text.includes(kw)) return false;
  }
  
  const accidentKeywords = ['accident', 'crash', 'collision', 'kills', 'killed', 'dead', 'death', 'dies', 'died', 'injured', 'overturns', 'falls', 'ram', 'hits', 'pile-up', 'pile up'];
  return accidentKeywords.some(kw => text.includes(kw));
}

function loadExistingURLs() {
  const csv = fs.readFileSync(CSV_FILE, 'utf8');
  const lines = csv.split('\n').filter(l => l.trim());
  const urls = new Set();
  lines.slice(1).forEach(l => {
    const parts = l.split(',');
    if (parts[6]) {
      let url = parts[6].trim().replace(/^"|"$/g, '');
      urls.add(url);
    }
  });
  return urls;
}

function formatCSVLine(row) {
  return row.map(val => {
    if (val === null || val === undefined || val === 'NULL') return 'NULL';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(',');
}

async function fetchArticles(query) {
  try {
    const response = await axios.get(
      `https://api.currentsapi.services/v1/search`,
      {
        params: { keywords: query, language: 'en', page_size: 20 },
        headers: { 'Authorization': CURRENTS_API_KEY },
        timeout: 30000
      }
    );
    
    if (response.data && response.data.news) {
      return response.data.news;
    }
    return [];
  } catch (e) {
    console.error(`  API Error: ${e.message}`);
    return [];
  }
}

async function fetchCycle(cycleNum) {
  console.log(`\n=== CYCLE ${cycleNum} ===`);
  
  // Pick a random query
  const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
  console.log(`Query: "${query}"`);
  
  const articles = await fetchArticles(query);
  
  if (articles.length === 0) {
    console.log('No articles found or API error');
    return { newArticles: 0, duplicates: 0, nonAccidents: 0 };
  }
  
  console.log(`Received ${articles.length} articles`);
  
  const existingURLs = loadExistingURLs();
  let newArticles = 0;
  let duplicates = 0;
  let nonAccidents = 0;
  let noLocation = 0;
  const toAdd = [];
  
  for (const art of articles) {
    if (existingURLs.has(art.url)) {
      duplicates++;
      continue;
    }
    
    if (!isAccidentArticle(art.title, art.description)) {
      nonAccidents++;
      continue;
    }
    
    let location = extractLocationFromText(art.title + ' ' + art.description);
    if (!location) {
      noLocation++;
      console.log(`  SKIP (no location): ${art.title.substring(0, 50)}`);
      continue;
    }
    
    const dateStr = art.published ? art.published.split(' ')[0] : null;
    const year = dateStr ? dateStr.split('-')[0] : 'NULL';
    const month = dateStr ? dateStr.split('-')[1] : 'NULL';
    const season = month !== 'NULL' ? (SEASONS[month] || 'NULL') : 'NULL';
    
    toAdd.push({
      title: art.title,
      date: dateStr || 'NULL',
      location: location,
      year: year,
      month: month,
      season: season,
      url: art.url
    });
    
    newArticles++;
    console.log(`  NEW: ${art.title.substring(0, 50)}`);
    console.log(`    Location: ${location}`);
  }
  
  // Add to CSV
  if (toAdd.length > 0) {
    const lines = toAdd.map(a => formatCSVLine([a.title, a.date, a.location, a.year, a.month, a.season, a.url]));
    fs.appendFileSync(CSV_FILE, lines.join('\n') + '\n');
  }
  
  console.log(`\n--- Cycle ${cycleNum} Summary ---`);
  console.log(`  Received: ${articles.length}`);
  console.log(`  Duplicates: ${duplicates}`);
  console.log(`  Non-accidents: ${nonAccidents}`);
  console.log(`  No location: ${noLocation}`);
  console.log(`  NEW articles added: ${newArticles}`);
  
  return { received: articles.length, duplicates, nonAccidents, noLocation, newArticles };
}

async function main() {
  console.log('=== CURRENTS API FETCHING CYCLE ===\n');
  
  if (!CURRENTS_API_KEY) {
    console.error('ERROR: Currents_API_KEY not found');
    process.exit(1);
  }
  
  const totalStats = { received: 0, duplicates: 0, nonAccidents: 0, noLocation: 0, newArticles: 0 };
  
  for (let cycle = 1; cycle <= 10; cycle++) {
    const result = await fetchCycle(cycle);
    
    totalStats.received += result.received;
    totalStats.duplicates += result.duplicates;
    totalStats.nonAccidents += result.nonAccidents;
    totalStats.noLocation += result.noLocation;
    totalStats.newArticles += result.newArticles;
    
    // Wait between cycles
    if (cycle < 10) {
      console.log('\nWaiting 3 seconds...');
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  
  console.log('\n\n========================================');
  console.log('=== TOTAL FETCHING SUMMARY ===');
  console.log('========================================');
  console.log(`Total cycles: 10`);
  console.log(`Total received: ${totalStats.received}`);
  console.log(`Total duplicates: ${totalStats.duplicates}`);
  console.log(`Total non-accidents: ${totalStats.nonAccidents}`);
  console.log(`Total no-location: ${totalStats.noLocation}`);
  console.log(`Total NEW articles added: ${totalStats.newArticles}`);
  
  // Final CSV stats
  const csv = fs.readFileSync(CSV_FILE, 'utf8');
  const lines = csv.split('\n').filter(l => l.trim());
  console.log(`\nFinal CSV rows: ${lines.length - 1}`);
}

main().catch(console.error);

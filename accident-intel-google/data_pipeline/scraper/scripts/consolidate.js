const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = path.join(__dirname, 'scraped_data');
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

function generateHash(title, date, content) {
  const str = `${(title || '').toLowerCase().trim()}|${(date || '').toLowerCase().trim()}|${(content || '').substring(0, 200).toLowerCase()}`;
  return crypto.createHash('md5').update(str).digest('hex');
}

function consolidateData() {
  console.log('Consolidating scraped data...\n');
  
  const allArticles = new Map();
  
  function addArticle(article, source) {
    if (!article || !article.title) return;
    
    const hash = generateHash(article.title, article.date?.raw, article.content);
    const year = article.date?.year;
    
    if (YEARS.includes(year)) {
      if (!allArticles.has(year)) {
        allArticles.set(year, new Map());
      }
      if (!allArticles.get(year).has(hash)) {
        allArticles.get(year).set(hash, {
          ...article,
          consolidatedSource: source
        });
      }
    }
  }
  
  // Scan all subfolders recursively
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        scanDir(fullPath);
      } else if (item.name.endsWith('.json')) {
        try {
          const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          const articles = data.articles || [];
          const source = data.source || item.name;
          const relPath = path.relative(BASE_DIR, fullPath);
          console.log(`Processing ${relPath}: ${articles.length} articles`);
          
          for (const article of articles) {
            addArticle(article, source);
          }
        } catch (e) {
          const relPath = path.relative(BASE_DIR, fullPath);
          console.log(`Error reading ${relPath}: ${e.message}`);
        }
      }
    }
  }
  
  scanDir(BASE_DIR);
  
  console.log('\n' + '='.repeat(50));
  console.log('CONSOLIDATED DATA');
  console.log('='.repeat(50));
  
  let totalArticles = 0;
  
  for (const year of YEARS) {
    const yearArticles = allArticles.get(year) || new Map();
    const articles = Array.from(yearArticles.values());
    
    const dir = path.join(BASE_DIR, String(year));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const outputPath = path.join(dir, 'pune_road_accidents.json');
    const data = {
      source: 'Consolidated from Multiple Sources',
      topic: 'Pune Road Accidents',
      year,
      totalArticles: articles.length,
      consolidatedAt: new Date().toISOString(),
      articles: articles
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✓ ${year}: ${articles.length} articles`);
    totalArticles += articles.length;
  }
  
  console.log('='.repeat(50));
  console.log(`Total consolidated articles: ${totalArticles}`);
  console.log('='.repeat(50));
  
  console.log('\nConsolidated files saved to:');
  YEARS.forEach(y => {
    console.log(`  scraped_data/${y}/pune_road_accidents.json`);
  });
}

consolidateData();

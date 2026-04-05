const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SCRAPED_DATA_DIR = path.join(__dirname, 'scraped_data');
const CLEANED_CSV = path.join(__dirname, 'cleaned_data.csv');
const PROGRESS_FILE = path.join(__dirname, 'cleaning_progress.json');

const BATCH_SIZE = 8;
const MODEL = 'models/gemini-2.5-flash';

const SEASONS = {
  '03': 'Spring', '04': 'Spring', '05': 'Spring',
  '06': 'Summer', '07': 'Summer', '08': 'Summer',
  '09': 'Monsoon', '10': 'Monsoon', '11': 'Monsoon',
  '12': 'Winter', '01': 'Winter', '02': 'Winter'
};

function getSeason(monthStr) {
  const month = monthStr ? monthStr.toString().padStart(2, '0') : null;
  return SEASONS[month] || 'NULL';
}

function parseTrueDate(dateObj, fallbackYear) {
  if (!dateObj) return { full: null, year: fallbackYear, month: null, season: null };
  
  let dateStr = dateObj.iso || dateObj.raw || dateObj.formatted || '';
  
  // Try to match YYYY-MM-DD anywhere in the string
  let match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const month = match[2];
    return {
      full: match[0],
      year: match[1],
      month: month,
      season: getSeason(month)
    };
  }

  // Try to match DD Month YYYY (e.g. 10 Apr 2018 or Apr 10, 2018)
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  // Match "Apr 10, 2018" or "April 10 2018"
  match = dateStr.toLowerCase().match(/([a-z]{3,9})\s+(\d{1,2})[,\s]+(\d{4})/);
  if (match) {
    const mStr = match[1].substring(0, 3);
    const mIdx = monthNames.indexOf(mStr) + 1;
    if (mIdx > 0) {
      const month = mIdx.toString().padStart(2, '0');
      const day = match[2].padStart(2, '0');
      const year = match[3];
      return {
        full: `${year}-${month}-${day}`,
        year: year,
        month: month,
        season: getSeason(month)
      };
    }
  }

  // Match "10 Apr 2018" or "10 April 2018"
  match = dateStr.toLowerCase().match(/(\d{1,2})\s+([a-z]{3,9})\s+(\d{4})/);
  if (match) {
    const mStr = match[2].substring(0, 3);
    const mIdx = monthNames.indexOf(mStr) + 1;
    if (mIdx > 0) {
      const month = mIdx.toString().padStart(2, '0');
      const day = match[1].padStart(2, '0');
      const year = match[3];
      return {
        full: `${year}-${month}-${day}`,
        year: year,
        month: month,
        season: getSeason(month)
      };
    }
  }

  // Try standard Date parsing as last resort
  try {
    const cleanStr = dateStr.replace(/.*?updated:\s*/i, '').replace(/.*?published:\s*/i, '');
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear().toString();
      const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
      return {
        full: d.toISOString().split('T')[0],
        year: year,
        month: month,
        season: getSeason(month)
      };
    }
  } catch(e) {}
  
  return { full: null, year: fallbackYear, month: null, season: null };
}

function generateHash(title, url) {
  const str = `${(title || '').toLowerCase().trim()}|${(url || '').toLowerCase().trim()}`;
  return crypto.createHash('md5').update(str).digest('hex');
}

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    } catch (e) {
      return { processed: [], failed: [] };
    }
  }
  return { processed: [], failed: [] };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function initCSV() {
  if (!fs.existsSync(CLEANED_CSV)) {
    fs.writeFileSync(CLEANED_CSV, 'title,date,location,year,month,season,url\n');
  }
}

function appendToCSV(rows) {
  const lines = rows.map(row => {
    const escape = (val) => {
      if (val === null || val === undefined || val === 'NULL') return 'NULL';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
    };
    return [escape(row.title), escape(row.date), escape(row.location), escape(row.year), escape(row.month), escape(row.season), escape(row.url)].join(',');
  });
  fs.appendFileSync(CLEANED_CSV, lines.join('\n') + '\n');
}

async function extractWithGemini(articles) {
  const prompt = `You are a data extraction assistant. Extract structured information from news articles about Pune road accidents.

For each article, extract these fields:
- title: Clean, concise headline (max 100 chars)
- location: Full address with area/neighborhood, landmark, road/highway name, city, state, country (e.g., "Navale Bridge, Katraj-Dehu Road Bypass, Pune, Maharashtra, India")

IMPORTANT RULES:
- Return valid JSON array only, no markdown, no explanations
- All property names MUST be in double quotes
- All string values MUST be in double quotes
- If a field is not available, use null (not "NULL")
- For location, include all details: area, road/highway, city, state, country

Example output:
[{"title":"Porsche Crash","location":"Kalyani Nagar, Pune, Maharashtra, India"}]

ARTICLES:
${articles.map((a, i) => `[${i+1}] Title: ${(a.title || 'N/A').substring(0, 80)} | Content: ${((a.content || '').substring(0, 400)).replace(/\n/g, ' ')}`).join('\n')}

JSON array:`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json'
        }
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 90000 }
    );

    let text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    text = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return Array.isArray(data) ? data : [];
    }
    
    throw new Error('No JSON array found in response');
  } catch (e) {
    console.error('  Gemini Error:', e.message);
    return null;
  }
}

function loadAllArticles() {
  const articles = [];
  const years = fs.readdirSync(SCRAPED_DATA_DIR).filter(f => /^\d{4}$/.test(f));
  
  for (const year of years) {
    const file = path.join(SCRAPED_DATA_DIR, year, 'pune_road_accidents.json');
    if (fs.existsSync(file)) {
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        const arts = (data.articles || []).map(a => ({ ...a, _year: year }));
        articles.push(...arts);
      } catch (e) {
        console.error(`Error reading ${file}:`, e.message);
      }
    }
  }
  
  return articles;
}

async function main() {
  console.log('=== PUNE ACCIDENT DATA CLEANER (Gemini AI) ===\n');
  
  if (!GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY not found in .env file');
    process.exit(1);
  }
  
  initCSV();
  const progress = loadProgress();
  const processedSet = new Set(progress.processed);
  const failedSet = new Set(progress.failed);
  
  const allArticles = loadAllArticles();
  console.log(`Total articles loaded: ${allArticles.length}`);
  console.log(`Already processed: ${progress.processed.length}`);
  console.log(`Previous failures: ${progress.failed.length}\n`);
  
  const toProcess = allArticles.filter(a => {
    const hash = generateHash(a.title, a.url);
    return !processedSet.has(hash) && !failedSet.has(hash);
  });
  
  console.log(`Articles to process: ${toProcess.length}\n`);
  
  if (toProcess.length === 0) {
    console.log('All articles already processed!');
    return;
  }
  
  let batches = [];
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    batches.push(toProcess.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`Processing ${batches.length} batches of ~${BATCH_SIZE} articles...\n`);
  
  for (let batchNum = 0; batchNum < batches.length; batchNum++) {
    const batch = batches[batchNum];
    console.log(`--- Batch ${batchNum + 1}/${batches.length} (${batch.length} articles) ---`);
    
    const results = await extractWithGemini(batch);
    
    if (results === null) {
      console.log('  Failed - adding to retry queue');
      batch.forEach(a => {
        const hash = generateHash(a.title, a.url);
        progress.failed.push(hash);
      });
    } else {
      const csvRows = [];
      
      for (let i = 0; i < batch.length && i < results.length; i++) {
        const art = batch[i];
        const extracted = results[i];
        const hash = generateHash(art.title, art.url);
        
        if (extracted && extracted.title && extracted.title !== 'NULL') {
          // Parse the REAL date from the original raw JSON payload
          const realDate = parseTrueDate(art.date, art.date?.year || art._year);
          
          csvRows.push({
            title: extracted.title,
            date: realDate.full || 'NULL',
            location: extracted.location || 'NULL',
            year: realDate.year || 'NULL',
            month: realDate.month || 'NULL',
            season: realDate.season || 'NULL',
            url: art.url || 'NULL'
          });
          
          progress.processed.push(hash);
          console.log(`  ✓ ${extracted.title.substring(0, 50)}...`);
        } else {
          console.log(`  ✗ Failed to extract: ${art.title?.substring(0, 40)}...`);
          progress.failed.push(hash);
        }
      }
      
      if (csvRows.length > 0) {
        appendToCSV(csvRows);
        console.log(`  Saved ${csvRows.length} rows to CSV`);
      }
    }
    
    saveProgress(progress);
    
    if (batchNum < batches.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  console.log('\n=== CLEANING COMPLETE ===');
  console.log(`Total processed: ${progress.processed.length}`);
  console.log(`Total failed: ${progress.failed.length}`);
  console.log(`Output: ${CLEANED_CSV}`);
}

main().catch(console.error);

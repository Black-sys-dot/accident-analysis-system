const fs = require('fs');
const path = require('path');

const CSV_FILE = path.join(__dirname, 'cleaned_data.csv');
const SCRAPED_DATA_DIR = path.join(__dirname, 'scraped_data');

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

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
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

function getRealDateInfo(dateObj) {
  if (!dateObj) return { year: 'NULL', month: 'NULL', season: 'NULL', date: 'NULL' };
  
  let dateStr = dateObj.iso || dateObj.raw || dateObj.formatted || '';
  
  // 1. Try YYYY-MM-DD
  const match1 = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match1) {
    const month = match1[2];
    return { year: match1[1], month: month, season: getSeason(month), date: match1[0] };
  }
  
  // 2. Robust Month parsing (Mon DD, YYYY or DD Mon YYYY)
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const regexes = [
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\.,]+(\d{1,2})[,\s]+(\d{4})/i,
    /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[,\s]+(\d{4})/i
  ];
  
  for (const re of regexes) {
    const match = dateStr.toLowerCase().match(re);
    if (match) {
      const monthStr = match[1] || match[2];
      const mIdx = monthNames.indexOf(monthStr.substring(0, 3)) + 1;
      const month = mIdx.toString().padStart(2, '0');
      const day = (match[2] || match[1]).padStart(2, '0');
      const year = match[3];
      return { year, month, season: getSeason(month), date: `${year}-${month}-${day}` };
    }
  }
  
  // 3. Last resort JS date parsing
  try {
    const d = new Date(dateStr.replace(/.*?updated:\s*/i, '').replace(/.*?published:\s*/i, ''));
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear().toString();
      const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
      return { year, month, season: getSeason(month), date: d.toISOString().split('T')[0] };
    }
  } catch(e) {}
  
  return { year: dateObj.year ? dateObj.year.toString() : 'NULL', month: 'NULL', season: 'NULL', date: 'NULL' };
}

function main() {
  console.log('Repairing CSV data...');
  
  // 1. Build map from scraped JSONs (URL -> Date Info)
  const dateMap = new Map();
  const years = fs.readdirSync(SCRAPED_DATA_DIR).filter(f => /^\d{4}$/.test(f));
  for (const year of years) {
    const file = path.join(SCRAPED_DATA_DIR, year, 'pune_road_accidents.json');
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      (data.articles || []).forEach(art => {
        if (art.url) dateMap.set(art.url, getRealDateInfo(art.date));
      });
    }
  }
  
  // 2. Read and fix CSV
  const lines = fs.readFileSync(CSV_FILE, 'utf-8').split('\n');
  const header = lines[0];
  const fixedLines = [header];
  let fixedCount = 0;
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const row = parseCSVLine(lines[i]);
    const url = row[6]; // URL is at index 6
    
    if (url && dateMap.has(url)) {
      const real = dateMap.get(url);
      if (row[3] === 'NULL' && real.year !== 'NULL') { row[3] = real.year; fixedCount++; }
      if (row[4] === 'NULL' && real.month !== 'NULL') { row[4] = real.month; fixedCount++; }
      if (row[5] === 'NULL' && real.season !== 'NULL') { row[5] = real.season; fixedCount++; }
      if (row[1] === 'NULL' && real.date !== 'NULL') { row[1] = real.date; fixedCount++; }
    }
    fixedLines.push(formatCSVLine(row));
  }
  
  fs.writeFileSync(CSV_FILE, fixedLines.join('\n') + '\n');
  console.log(`Repaired ${fixedCount} fields. Saved.`);
}

main();

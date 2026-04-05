const fs = require('fs');
const path = require('path');

const CSV_FILE = path.join(__dirname, 'cleaned_data.csv');
const FIXED_CSV_FILE = path.join(__dirname, 'cleaned_data_fixed.csv');

const SEASONS = {
  '03': 'Spring', '04': 'Spring', '05': 'Spring',
  '06': 'Summer', '07': 'Summer', '08': 'Summer',
  '09': 'Monsoon', '10': 'Monsoon', '11': 'Monsoon',
  '12': 'Winter', '01': 'Winter', '02': 'Winter'
};

function getSeason(monthStr) {
  // Ensure we have a 2-digit string
  const month = monthStr.toString().padStart(2, '0');
  return SEASONS[month] || 'NULL';
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i+1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
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

async function fixData() {
  console.log('Fixing month and season columns...');
  
  if (!fs.existsSync(CSV_FILE)) {
    console.error(`File not found: ${CSV_FILE}`);
    return;
  }
  
  const content = fs.readFileSync(CSV_FILE, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    console.log('CSV is empty.');
    return;
  }
  
  const header = lines[0];
  const fixedLines = [header];
  let fixedCount = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    
    // Expected format: title(0), date(1), location(2), year(3), month(4), season(5)
    if (row.length >= 6) {
      const dateStr = row[1];
      let year = row[3];
      let month = row[4];
      let season = row[5];
      
      let needsFix = false;
      
      // If we have a valid date string like YYYY-MM-DD
      if (dateStr && dateStr !== 'NULL' && dateStr.includes('-')) {
        const parts = dateStr.split('-');
        
        // Extract year if missing
        if ((!year || year === 'NULL') && parts[0] && parts[0].length === 4) {
          year = parts[0];
          needsFix = true;
        }
        
        // Extract month if missing
        if ((!month || month === 'NULL') && parts[1]) {
          month = parts[1];
          needsFix = true;
        }
      }
      
      // Always recalculate season based on month to be safe
      if (month && month !== 'NULL') {
        const calculatedSeason = getSeason(month);
        if (season !== calculatedSeason) {
          season = calculatedSeason;
          needsFix = true;
        }
      }
      
      if (needsFix) fixedCount++;
      
      // Update row
      row[3] = year;
      row[4] = month;
      row[5] = season;
      
      fixedLines.push(formatCSVLine(row));
    } else {
      fixedLines.push(lines[i]); // Keep malformed lines as-is
    }
  }
  
  fs.writeFileSync(FIXED_CSV_FILE, fixedLines.join('\n') + '\n');
  
  // Replace the original file
  fs.copyFileSync(FIXED_CSV_FILE, CSV_FILE);
  fs.unlinkSync(FIXED_CSV_FILE);
  
  console.log(`Successfully fixed ${fixedCount} rows.`);
  console.log(`Saved back to ${CSV_FILE}`);
}

fixData().catch(console.error);

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CURRENTS_API_KEY = process.env.Currents_API_KEY;
const FRESH_DATA_FILE = path.join(__dirname, 'fresh_currents_data.json');

async function main() {
  console.log('Fetching fresh data from Currents API...');
  
  if (!CURRENTS_API_KEY) {
    console.error('ERROR: Currents_API_KEY not found in .env');
    process.exit(1);
  }
  
  try {
    const response = await axios.get(
      'https://api.currentsapi.services/v1/search',
      {
        params: { keywords: 'Pune accident', language: 'en', page_size: 20 },
        headers: { 'Authorization': CURRENTS_API_KEY },
        timeout: 30000
      }
    );
    
    if (response.data && response.data.news) {
      fs.writeFileSync(FRESH_DATA_FILE, JSON.stringify({
        fetchedAt: new Date().toISOString(),
        articles: response.data.news
      }, null, 2));
      console.log(`Saved ${response.data.news.length} articles to ${FRESH_DATA_FILE}`);
    }
  } catch (e) {
    console.error('API Error:', e.message);
  }
}

main();

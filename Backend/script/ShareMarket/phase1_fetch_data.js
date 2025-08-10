import puppeteer from 'puppeteer';
import { MongoClient } from 'mongodb';

const sectorList = [
    'NIFTY 50', 'NIFTY AUTO', 'NIFTY BANK', 'NIFTY FMCG', 'NIFTY IT',
    'NIFTY METAL', 'NIFTY PHARMA', 'NIFTY PSU BANK', 'NIFTY REALTY',
    'NIFTY OIL & GAS', 'NIFTY FINANCIAL SERVICES', 'NIFTY MEDIA', 'NIFTY ENERGY'
];

// MongoDB config
const MONGO_URI = "mongodb+srv://amankashyap0246jploft:kprUz7Puu9cS9zkl@cluster0.bqz0rdo.mongodb.net/Secerate"; // adjust if needed
const DB_NAME = "nse_data";
const COLLECTION = "sector_indices";

async function fetchSectorData(sector, page, collection) {
    const url = `https://www.nseindia.com/api/equity-stockIndices?index=${encodeURIComponent(sector)}`;
    await page.goto(url, { waitUntil: 'networkidle2' });

    const content = await page.content();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        console.log(`❌ Failed for ${sector}`);
        return;
    }

    const jsonData = JSON.parse(jsonMatch[0]);

    if (!jsonData?.data) {
        console.log(`❌ No data found for ${sector}`);
        return;
    }

    // Extract data array
    // Note: NSE API typically returns an array of stocks with metadata;
    // the "date" info may be in metadata or elsewhere
    // We'll extract "lastUpdateTime" from metadata for date

    // Extract sector date from metadata if available
    const sectorDate = jsonData?.metadata?.lastUpdateTime?.split(' ')[0] || new Date().toISOString().split('T')[0];

    // Map each stock data with sector and date for DB insertion
    const docs = jsonData.data.map(stock => ({
        sector,
        date: sectorDate,
        symbol: stock.symbol,
        open: stock.open,
        high: stock.dayHigh,
        low: stock.dayLow,
        close: stock.lastPrice,
        change: stock.pChange,
        // optionally add more fields here like volume, etc.
    }));

    // Upsert each doc in MongoDB (sector + date + symbol uniqueness)
    for (const doc of docs) {
        await collection.updateOne(
            { sector: doc.sector, date: doc.date, symbol: doc.symbol },
            { $set: doc },
            { upsert: true }
        );
    }

    console.log(`✅ Saved ${docs.length} records for sector: ${sector} on date: ${sectorDate}`);
}

(async () => {
    // Connect to MongoDB
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION);

    // Create indexes for faster upsert/search (optional but recommended)
    await collection.createIndex({ sector: 1, date: 1, symbol: 1 }, { unique: true });

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

    // Initialize NSE session by loading homepage
    await page.goto('https://www.nseindia.com', { waitUntil: 'networkidle2' });

    for (const sector of sectorList) {
        try {
            await fetchSectorData(sector, page, collection);
        } catch (err) {
            console.error(`Error fetching data for ${sector}: ${err.message}`);
        }
    }

    await browser.close();
    await client.close();
    console.log('All done, browser and DB connection closed.');
})();

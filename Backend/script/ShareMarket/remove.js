import { MongoClient } from 'mongodb';

const sectorList = [
  'NIFTY 50', 'NIFTY AUTO', 'NIFTY BANK', 'NIFTY FMCG', 'NIFTY IT',
  'NIFTY METAL', 'NIFTY PHARMA', 'NIFTY PSU BANK', 'NIFTY REALTY',
  'NIFTY OIL & GAS', 'NIFTY FINANCIAL SERVICES', 'NIFTY MEDIA', 'NIFTY ENERGY'
];

// Example symbols per sector (you can customize or expand this)
const exampleSymbols = [
  'RELIANCE', 'TCS', 'INFY', 'HDFC', 'ICICI'
];

// MongoDB config
const MONGO_URI = "mongodb+srv://amankashyap0246jploft:kprUz7Puu9cS9zkl@cluster0.bqz0rdo.mongodb.net/Secerate";
const DB_NAME = "nse_data";
const COLLECTION = "sector_indices";

function generateSampleDataForSector(sector, days = 30) {
  const data = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const formattedDate = date.toISOString().split('T')[0];

    exampleSymbols.forEach(symbol => {
      // Generate random realistic prices
      const open = +(Math.random() * 1000 + 1000).toFixed(2);
      const high = +(open + Math.random() * 100).toFixed(2);
      const low = +(open - Math.random() * 100).toFixed(2);
      const close = +(low + Math.random() * (high - low)).toFixed(2);
      const change = +((close - open) / open * 100).toFixed(2);

      data.push({
        sector,
        date: formattedDate,
        symbol,
        open,
        high,
        low,
        close,
        change,
      });
    });
  }
  return data;
}

(async () => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION);

  // Optional index for uniqueness and speed
  await collection.createIndex({ sector: 1, date: 1, symbol: 1 }, { unique: true });

  // Generate sample data for all sectors
  let allSampleData = [];
  for (const sector of sectorList) {
    const sectorData = generateSampleDataForSector(sector, 30);
    allSampleData = allSampleData.concat(sectorData);
  }

  // Insert sample data
  try {
    await collection.insertMany(allSampleData, { ordered: false });
    console.log(`✅ Inserted ${allSampleData.length} sample records for 30 days across ${sectorList.length} sectors.`);
  } catch (err) {
    // If some duplicates or errors occur, log and continue
    console.error('Error inserting sample data:', err.message);
  }

  await client.close();
  console.log('DB connection closed. Sample data insertion complete.');
})();

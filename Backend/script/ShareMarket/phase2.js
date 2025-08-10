import { MongoClient } from "mongodb";

const MONGO_URI = "mongodb+srv://amankashyap0246jploft:kprUz7Puu9cS9zkl@cluster0.bqz0rdo.mongodb.net/Secerate";
const DB_NAME = "nse_data";
const COLLECTION = "sector_indices";

export async function getSectorMomentumTrends(client, daysBack = 30) {
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION);

    const latestDateDoc = await collection.find().sort({ date: -1 }).limit(1).next();
    if (!latestDateDoc) throw new Error("No data found");

    const latestDate = new Date(latestDateDoc.date);
    const pastDate = new Date(latestDate);
    pastDate.setDate(latestDate.getDate() - daysBack);

    const dailySectorChanges = await collection.aggregate([
        {
            $match: {
                date: { $gte: pastDate.toISOString().split("T")[0], $lte: latestDateDoc.date }
            }
        },
        {
            $group: {
                _id: { sector: "$sector", date: "$date" },
                avgChange: { $avg: "$change" }
            }
        },
        { $sort: { "_id.sector": 1, "_id.date": 1 } }
    ]).toArray();

    const sectorDataMap = new Map();
    dailySectorChanges.forEach(doc => {
        const sector = doc._id.sector;
        if (!sectorDataMap.has(sector)) sectorDataMap.set(sector, []);
        sectorDataMap.get(sector).push({ date: doc._id.date, avgChange: doc.avgChange });
    });

    const sectorTrends = [];
    for (const [sector, records] of sectorDataMap.entries()) {
        if (records.length < 2) continue;

        const first = records[0];
        const last = records[records.length - 1];
        const days = records.length - 1 || 1;
        const slope = (last.avgChange - first.avgChange) / days;

        sectorTrends.push({ sector, slope });
    }

    sectorTrends.sort((a, b) => b.slope - a.slope);

    return sectorTrends;
}

export async function getCurrentLeadingSector(client) {
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION);

    const latestDateDoc = await collection.find().sort({ date: -1 }).limit(1).next();
    if (!latestDateDoc) throw new Error("No data found");

    const latestDate = latestDateDoc.date;

    const currentTopSector = await collection.aggregate([
        { $match: { date: latestDate } },
        {
            $group: {
                _id: "$sector",
                avgChange: { $avg: "$change" }
            }
        },
        { $sort: { avgChange: -1 } },
        { $limit: 1 }
    ]).next();

    return { sector: currentTopSector._id, avgChange: currentTopSector.avgChange };
}

export async function getStockDataForSector(client, sector, daysBack = 30) {
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION);

    const latestDateDoc = await collection.find().sort({ date: -1 }).limit(1).next();
    if (!latestDateDoc) throw new Error("No data found");

    const latestDate = new Date(latestDateDoc.date);
    const pastDate = new Date(latestDate);
    pastDate.setDate(latestDate.getDate() - daysBack);

    const cursor = collection.find({
        sector,
        date: { $gte: pastDate.toISOString().split("T")[0], $lte: latestDateDoc.date }
    });

    const stockMap = new Map();
    await cursor.forEach(doc => {
        const symbol = doc.symbol;
        if (!stockMap.has(symbol)) stockMap.set(symbol, []);
        stockMap.get(symbol).push(doc);
    });

    return stockMap;
}

export function calculateMomentum(stockRecords) {
    stockRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

    const first = stockRecords[0];
    const last = stockRecords[stockRecords.length - 1];

    const priceChangePct = ((last.close - first.close) / first.close) * 100;

    const avgVolume = stockRecords.reduce((sum, rec) => sum + (rec.volume || 0), 0) / stockRecords.length;

    const latestVolume = stockRecords[stockRecords.length - 1].volume || 0;
    const volumeSpike = avgVolume ? latestVolume / avgVolume : 1;

    const momentumScore = priceChangePct * 0.7 + volumeSpike * 0.3 * 100;

    return { priceChangePct, volumeSpike, momentumScore };
}

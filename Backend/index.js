const MONGO_URI = "mongodb+srv://amankashyap0246jploft:kprUz7Puu9cS9zkl@cluster0.bqz0rdo.mongodb.net/Secerate"; // adjust if needed
const DB_NAME = "nse_data";
const COLLECTION = "sector_indices";





import express from "express";
import { MongoClient } from "mongodb";
import path from "path";
import expressLayouts from "express-ejs-layouts";

const app = express();
const PORT = 3000;
app.use(expressLayouts);
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));
app.set("layout", "layout"); // default layout file is views/layout.ejs
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// === Utilities ===
async function getDistinctSectors(client) {
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION);
    const sectors = await collection.distinct("sector");
    return sectors.sort();
}

async function getDistinctDates(client) {
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION);
    const dates = await collection.distinct("date");
    return dates.sort((a, b) => (a < b ? 1 : -1));
}

// === PHASE 1 ===
// Fetch momentum data grouped by sector for a given date (default latest)
async function getSectorMomentum(client, { date, search = "", sortBy = "avgChange", order = "desc" } = {}) {
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION);

    let targetDate = date;
    if (!targetDate) {
        const latestDateDoc = await collection.find().sort({ date: -1 }).limit(1).next();
        if (!latestDateDoc) throw new Error("No data found");
        targetDate = latestDateDoc.date;
    }

    const matchStage = { date: targetDate };
    if (search && search.trim()) {
        matchStage["sector"] = { $regex: search.trim(), $options: "i" };
    }

    const sectors = await collection.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: "$sector",
                avgChange: { $avg: "$change" },
                avgClose: { $avg: "$close" }
            }
        },
        { $sort: { [sortBy]: order === "asc" ? 1 : -1 } },
        {
            $project: {
                sector: "$_id",
                avgChange: 1,
                avgClose: 1,
                _id: 0
            }
        }
    ]).toArray();

    return { sectors, targetDate };
}

// === PHASE 2 ===
// Get top stocks in given sector(s)
async function getTopStocksForSectors(client, sectors, daysBack = 30, topN = 10) {
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION);

    const latestDateDoc = await collection.find().sort({ date: -1 }).limit(1).next();
    const latestDate = new Date(latestDateDoc.date);
    const pastDate = new Date(latestDate);
    pastDate.setDate(latestDate.getDate() - daysBack);

    const sectorResults = [];

    for (const sector of sectors) {
        const cursor = collection.find({
            sector,
            date: { $gte: pastDate.toISOString().split("T")[0], $lte: latestDateDoc.date },
        });

        const stockMap = new Map();

        await cursor.forEach((doc) => {
            const symbol = doc.symbol;
            if (!stockMap.has(symbol)) {
                stockMap.set(symbol, []);
            }
            stockMap.get(symbol).push(doc);
        });

        function calculateMomentum(stockRecords) {
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

        const momentumArray = [];
        for (const [symbol, records] of stockMap.entries()) {
            const momentum = calculateMomentum(records);
            momentumArray.push({ symbol, ...momentum });
        }

        momentumArray.sort((a, b) => b.momentumScore - a.momentumScore);
        sectorResults.push({ sector, topStocks: momentumArray.slice(0, topN) });
    }

    return sectorResults;
}

// === ROUTES ===

app.get("/", async (req, res) => {
    // Show Phase 1 sector momentum overview with filters
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const { date, search, sortBy, order } = req.query;
        const { sectors, targetDate } = await getSectorMomentum(client, { date, search, sortBy, order });
        const allSectors = await getDistinctSectors(client);
        const allDates = await getDistinctDates(client);
        res.render("phase1", {
            sectors,
            filters: { date: targetDate, search: search || "", sortBy: sortBy || "avgChange", order: order || "desc" },
            allSectors,
            allDates,
            title: "Phase 1 - Sector Momentum"
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading sector momentum");
    } finally {
        await client.close();
    }
});

app.get("/phase2", async (req, res) => {
    // Show Phase 2 first movers in top sectors with filters
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const allSectors = await getDistinctSectors(client);

        // Parse filters
        const { sectors: sectorsParam, daysBack: daysBackParam, topN: topNParam } = req.query;
        let selectedSectors = [];
        if (sectorsParam && String(sectorsParam).trim().length > 0) {
            selectedSectors = String(sectorsParam)
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s);
        } else {
            // default to top 3 sectors by avgChange
            const { sectors } = await getSectorMomentum(client, {});
            selectedSectors = sectors.slice(0, 3).map((s) => s.sector);
        }

        const daysBack = Math.max(1, parseInt(daysBackParam || "30", 10));
        const topN = Math.max(1, Math.min(50, parseInt(topNParam || "10", 10)));

        const sectorResults = await getTopStocksForSectors(client, selectedSectors, daysBack, topN);
        res.render("phase2", {
            sectorResults,
            filters: { sectors: selectedSectors, daysBack, topN },
            allSectors,
            title: "Phase 2 - First Mover Stocks"
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading phase 2 data");
    } finally {
        await client.close();
    }
});

// === JSON APIs for charts/filters ===
app.get("/api/sectors", async (_req, res) => {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const sectors = await getDistinctSectors(client);
        res.json({ sectors });
    } catch (err) {
        res.status(500).json({ error: "failed" });
    } finally {
        await client.close();
    }
});

app.get("/api/dates", async (_req, res) => {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const dates = await getDistinctDates(client);
        res.json({ dates });
    } catch (err) {
        res.status(500).json({ error: "failed" });
    } finally {
        await client.close();
    }
});

// Returns daily average % change for a sector over the last N days
app.get("/api/sector-daily", async (req, res) => {
    const { sector, daysBack = 30 } = req.query;
    if (!sector) return res.status(400).json({ error: "sector is required" });
    const days = Math.max(1, parseInt(daysBack, 10));

    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION);

        const latestDateDoc = await collection.find({ sector }).sort({ date: -1 }).limit(1).next();
        if (!latestDateDoc) return res.json({ sector, series: [] });
        const latestDate = new Date(latestDateDoc.date);
        const pastDate = new Date(latestDate);
        pastDate.setDate(latestDate.getDate() - days);

        const daily = await collection
            .aggregate([
                {
                    $match: {
                        sector,
                        date: { $gte: pastDate.toISOString().split("T")[0], $lte: latestDateDoc.date },
                    },
                },
                {
                    $group: {
                        _id: "$date",
                        avgChange: { $avg: "$change" },
                    },
                },
                { $project: { date: "$_id", avgChange: 1, _id: 0 } },
                { $sort: { date: 1 } },
            ])
            .toArray();

        res.json({ sector, series: daily });
    } catch (err) {
        res.status(500).json({ error: "failed" });
    } finally {
        await client.close();
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

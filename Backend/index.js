import express from 'express';
import { MongoClient } from 'mongodb';
import moment from 'moment';

const app = express();
app.use(express.json());

const MONGO_URI = "mongodb+srv://amankashyap0246jploft:kprUz7Puu9cS9zkl@cluster0.bqz0rdo.mongodb.net/Secerate";
const DB_NAME = "nse_data";

let db, sectorIndicesCol, sectorSummaryCol;

async function connectDb() {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(DB_NAME);
    sectorIndicesCol = db.collection('sector_indices');
    sectorSummaryCol = db.collection('sector_summary');
}

connectDb();

// Helper: get previous date string in YYYY-MM-DD
function prevDate(dateStr) {
    return moment(dateStr).subtract(1, 'day').format('YYYY-MM-DD');
}

// 1. Get sector strength ranking for a given date (default today)
app.get('/api/sectors/ranking', async (req, res) => {
    try {
        const date = req.query.date || moment().format('YYYY-MM-DD');

        // Aggregate average % change and total volume per sector
        const pipeline = [
            { $match: { date } },
            {
                $group: {
                    _id: "$sector",
                    avgChangePercent: { $avg: "$changePercent" },
                    totalVolume: { $sum: "$volume" },
                    totalTurnover: { $sum: "$turnover" },
                }
            },
            {
                $project: {
                    sector: "$_id",
                    avgChangePercent: 1,
                    totalVolume: 1,
                    totalTurnover: 1,
                    _id: 0
                }
            },
            { $sort: { avgChangePercent: -1 } }
        ];

        const ranking = await sectorIndicesCol.aggregate(pipeline).toArray();

        res.json({ date, ranking });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Get sector strength trend (strengthening, weakening, stable) between today and yesterday
app.get('/api/sectors/trend', async (req, res) => {
    try {
        const date = req.query.date || moment().format('YYYY-MM-DD');
        const yesterday = prevDate(date);

        // Fetch today sector summary or calculate on the fly
        const todaySummary = await sectorSummaryCol.find({ date }).toArray();
        if (!todaySummary.length) {
            return res.status(404).json({ error: "No summary data for today. Run aggregation first." });
        }

        const yesterdaySummary = await sectorSummaryCol.find({ date: yesterday }).toArray();
        if (!yesterdaySummary.length) {
            return res.status(404).json({ error: "No summary data for yesterday. Run aggregation first." });
        }

        // Map yesterday summary by sector for quick lookup
        const yestMap = {};
        yesterdaySummary.forEach(s => { yestMap[s.sector] = s; });

        // Compute trend for each sector
        const trends = todaySummary.map(today => {
            const yest = yestMap[today.sector];
            if (!yest) return { sector: today.sector, trend: 'no data for yesterday', delta: null };

            const delta = today.avgChangePercent - yest.avgChangePercent;
            const trend = delta > 0 ? 'strengthening' : delta < 0 ? 'weakening' : 'stable';

            return {
                sector: today.sector,
                date,
                avgChangePercent: today.avgChangePercent,
                trend,
                delta: +delta.toFixed(4),
                totalVolume: today.totalVolume,
                totalTurnover: today.totalTurnover
            };
        });

        res.json({ date, trends });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Get top N stocks by % change or volume within a sector for a date
app.get('/api/stocks/top', async (req, res) => {
    try {
        const { sector, date, sortBy = 'changePercent', order = 'desc', limit = 10 } = req.query;

        if (!sector || !date) {
            return res.status(400).json({ error: "sector and date query params required" });
        }

        const sortField = sortBy === 'volume' ? 'volume' : 'changePercent';
        const sortOrder = order === 'asc' ? 1 : -1;

        const stocks = await sectorIndicesCol.find({ sector, date })
            .sort({ [sortField]: sortOrder })
            .limit(parseInt(limit))
            .toArray();

        res.json({ sector, date, sortBy, order, count: stocks.length, stocks });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Get full time-series sector strength for last N days (default 30 days)
app.get('/api/sectors/timeseries', async (req, res) => {
    try {
        const { sector, days = 30 } = req.query;
        if (!sector) return res.status(400).json({ error: "sector query param required" });

        const fromDate = moment().subtract(days, 'days').format('YYYY-MM-DD');

        const timeSeries = await sectorSummaryCol.find({
            sector,
            date: { $gte: fromDate }
        }).sort({ date: 1 }).toArray();

        res.json({ sector, days, fromDate, timeSeries });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Trigger daily sector summary aggregation (run this manually or schedule with cron)
app.post('/api/aggregate/daily-sector-summary', async (req, res) => {
    try {
        const date = req.body.date || moment().format('YYYY-MM-DD');

        // Aggregate from sector_indices collection
        const pipeline = [
            { $match: { date } },
            {
                $group: {
                    _id: "$sector",
                    avgChangePercent: { $avg: "$changePercent" },
                    totalVolume: { $sum: "$volume" },
                    totalTurnover: { $sum: "$turnover" },
                }
            },
            {
                $project: {
                    sector: "$_id",
                    date,
                    avgChangePercent: 1,
                    totalVolume: 1,
                    totalTurnover: 1,
                    _id: 0
                }
            }
        ];

        const results = await sectorIndicesCol.aggregate(pipeline).toArray();

        for (const summary of results) {
            await sectorSummaryCol.updateOne(
                { sector: summary.sector, date },
                { $set: summary },
                { upsert: true }
            );
        }

        res.json({ message: `Aggregated sector summary for date ${date}`, count: results.length });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
});

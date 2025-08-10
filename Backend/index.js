import express from 'express';
import { MongoClient } from 'mongodb';
import moment from 'moment';
import cors from 'cors';

const app = express();
app.use(cors());
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

















// Helper: get moving average avgChangePercent over last N days for a sector
async function getMovingAvg(sectorSummaryCol, sector, endDate, days = 3) {
    const fromDate = moment(endDate).subtract(days - 1, 'days').format('YYYY-MM-DD');
    const records = await sectorSummaryCol.find({
        sector,
        date: { $gte: fromDate, $lte: endDate }
    }).toArray();
    if (!records.length) return null;
    const sum = records.reduce((acc, r) => acc + r.avgChangePercent, 0);
    return sum / records.length;
}

app.get('/api/trading-signal', async (req, res) => {
    try {
        const date = req.query.date || moment().format('YYYY-MM-DD');
        const yesterday = moment(date).subtract(1, 'day').format('YYYY-MM-DD');

        const todayRanking = await sectorSummaryCol.find({ date }).sort({ avgChangePercent: -1 }).toArray();
        const yesterdayRanking = await sectorSummaryCol.find({ date: yesterday }).sort({ avgChangePercent: -1 }).toArray();

        if (!todayRanking.length || !yesterdayRanking.length) {
            return res.status(404).json({ error: 'Insufficient data for the specified dates' });
        }

        const currentLeaderToday = todayRanking[0];
        const nextLeaderToday = todayRanking.find(s => s.sector !== currentLeaderToday.sector) || null;

        const currentLeader3DayAvg = await getMovingAvg(sectorSummaryCol, currentLeaderToday.sector, date, 3);
        const nextLeader3DayAvg = nextLeaderToday
            ? await getMovingAvg(sectorSummaryCol, nextLeaderToday.sector, date, 3)
            : null;

        // Today's actual changePercent for extra detail
        const currentLeaderTodayChange = currentLeaderToday.avgChangePercent;
        const nextLeaderTodayChange = nextLeaderToday ? nextLeaderToday.avgChangePercent : null;

        const threshold = 0.5; // percentage points threshold to switch sectors

        let signal = 'HOLD';
        let reason = 'No significant changes detected';

        if (currentLeader3DayAvg === null) {
            signal = 'HOLD';
            reason = `Insufficient moving average data for current leader (${currentLeaderToday.sector})`;
        } else if (nextLeader3DayAvg === null) {
            // No next leader data - stick with current leader
            signal = 'BUY_CURRENT_HOLD_OTHERS';
            reason = `No next leader data; holding current leader (${currentLeaderToday.sector})`;
        } else {
            if ((currentLeader3DayAvg + threshold) < nextLeader3DayAvg) {
                signal = 'SELL_CURRENT_BUY_NEXT';
                reason = `Current leader 3-day avg (${currentLeader3DayAvg.toFixed(2)}%) weaker than next leader 3-day avg (${nextLeader3DayAvg.toFixed(2)}%) by >${threshold}%`;
            } else {
                signal = 'BUY_CURRENT_HOLD_OTHERS';
                reason = `Current leader remains stronger or no significant difference`;
            }
        }

        res.json({
            date,
            currentLeader: currentLeaderToday.sector,
            nextLeader: nextLeaderToday ? nextLeaderToday.sector : null,
            signal,
            reason,
            details: {
                currentLeader: {
                    "3DayAvgChangePercent": Number(currentLeader3DayAvg?.toFixed(2)) || null,
                    "todayChangePercent": Number(currentLeaderTodayChange.toFixed(2))
                },
                nextLeader: {
                    "3DayAvgChangePercent": Number(nextLeader3DayAvg?.toFixed(2)) || null,
                    "todayChangePercent": nextLeaderTodayChange !== null ? Number(nextLeaderTodayChange.toFixed(2)) : null
                }
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
});

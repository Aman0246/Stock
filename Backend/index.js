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

connectDb().then(e => {
    console.log("connected")
});

// Helper: get previous date string in YYYY-MM-DD
function prevDate(dateStr) {
    return moment(dateStr).subtract(1, 'day').format('YYYY-MM-DD');
}

// sector ranking based on Days defaut 5 days with moving average Data
app.get('/api/sectors/ranking', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 5;
        const gapThreshold = parseFloat(req.query.threshold) || 0.2; // % difference
        const endDate = moment(req.query.date || undefined).endOf('day');
        const startDate = moment(endDate).subtract(days, 'days').startOf('day');


        const benchmarkSymbol = 'NIFTY 50';
        const benchmarkData = await sectorIndicesCol.find({
            sector: benchmarkSymbol,
            symbol: benchmarkSymbol,
            date: {
                $gte: startDate.format('YYYY-MM-DD'),
                $lte: endDate.format('YYYY-MM-DD')
            }
        }).sort({ date: 1 }).toArray();

        if (benchmarkData.length < days + 1) {
            return res.status(500).json({ error: `Not enough benchmark data for ${benchmarkSymbol}` });
        }

        const benchmarkStart = benchmarkData[benchmarkData.length - days - 1].close;
        const benchmarkEnd = benchmarkData[benchmarkData.length - 1].close;
        const benchmarkChange = ((benchmarkEnd - benchmarkStart) / benchmarkStart) * 100;


        const pipeline = [
            {
                $match: {
                    date: {
                        $gte: startDate.format('YYYY-MM-DD'),
                        $lte: endDate.format('YYYY-MM-DD')
                    },
                    $expr: { $eq: ["$sector", "$symbol"] }
                }
            },
            { $sort: { sector: 1, date: 1 } },
            {
                $group: {
                    _id: "$sector",
                    dailyData: { $push: { date: "$date", changePercent: "$changePercent", volume: "$volume", turnover: "$turnover" } }
                }
            },
            { $project: { sector: "$_id", dailyData: 1, _id: 0 } }
        ];

        const sectorsData = await sectorIndicesCol.aggregate(pipeline).toArray();

        const ranking = sectorsData.map(sector => {
            const data = sector.dailyData;
            if (data.length < days) return null;

            const todaySlice = data.slice(-days);
            const yesterdaySlice = data.slice(-(days + 1), -1);

            const avgToday = todaySlice.reduce((sum, d) => sum + d.changePercent, 0) / days;
            const avgYesterday = yesterdaySlice.reduce((sum, d) => sum + d.changePercent, 0) / days;

            const totalVolume = todaySlice.reduce((sum, d) => sum + d.volume, 0);
            const totalTurnover = todaySlice.reduce((sum, d) => sum + d.turnover, 0);

            return {
                sector: sector.sector,
                avg5DayChange: parseFloat(avgToday.toFixed(2)),
                trend: avgToday - avgYesterday > 0 ? 'strengthening' : 'weakening',
                totalVolume,
                totalTurnover
            };
        }).filter(Boolean);

        // Sort sectors by avg5DayChange
        ranking.sort((a, b) => b.avg5DayChange - a.avg5DayChange);

        // Add labels based on gap and trend
        if (ranking.length > 0) {
            ranking[0].label = ranking[0].trend === 'weakening' ? 'Getting Weak' : 'Leading';

            if (ranking.length > 1) {
                const gap = ranking[0].avg5DayChange - ranking[1].avg5DayChange;
                if (gap < gapThreshold && ranking[1].trend === 'strengthening') {
                    ranking[1].label = 'Next Leader';
                }
            }
        }

        res.json({
            date: endDate.format('YYYY-MM-DD'),
            days,
            threshold: gapThreshold,
            ranking
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/stocks/ranking', async (req, res) => {
    try {
        const sector = req.query.sector;
        const days = parseInt(req.query.days) || 5; // for momentum calculation
        const volumeThreshold = parseInt(req.query.volume) || 100000; // minimum avg volume
        const endDate = moment(req.query.date || undefined).endOf('day');
        const startDate = moment(endDate).subtract(30, 'days').startOf('day'); // last 30 days for calculations

        if (!sector) return res.status(400).json({ error: "sector parameter is required" });

        // Fetch stock price data
        const pipeline = [
            {
                $match: {
                    sector,
                    date: { $gte: startDate.format('YYYY-MM-DD'), $lte: endDate.format('YYYY-MM-DD') }
                }
            },
            { $sort: { symbol: 1, date: 1 } },
            {
                $group: {
                    _id: "$symbol",
                    dailyData: { $push: { date: "$date", open: "$open", high: "$high", low: "$low", close: "$close", volume: "$volume" } }
                }
            }
        ];

        const stocksData = await stockPriceCol.aggregate(pipeline).toArray();

        const rankedStocks = stocksData.map(stock => {
            const data = stock.dailyData;

            if (data.length < 20) return null; // need at least 20 days for DMA20 and ATR10

            // Moving averages
            const calcDMA = (n) => data.slice(-n).reduce((sum, d) => sum + d.close, 0) / n;
            const dma5 = calcDMA(5);
            const dma10 = calcDMA(10);
            const dma20 = calcDMA(20);

            // Average volume
            const avgVolume = data.slice(-days).reduce((sum, d) => sum + d.volume, 0) / days;

            // Last N-day % change
            const change5Day = ((data[data.length - 1].close - data[data.length - days].close) / data[data.length - days].close) * 100;

            const rs = change5Day - benchmarkChange;

            // ATR(10) calculation
            const trueRanges = [];
            for (let i = data.length - 10; i < data.length; i++) {
                const curr = data[i];
                const prevClose = i > 0 ? data[i - 1].close : curr.close;
                const tr = Math.max(
                    curr.high - curr.low,
                    Math.abs(curr.high - prevClose),
                    Math.abs(curr.low - prevClose)
                );
                trueRanges.push(tr);
            }
            const atr10 = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;

            // Filter: above DMAs and volume threshold
            if (data[data.length - 1].close < dma5 || data[data.length - 1].close < dma10 || data[data.length - 1].close < dma20) return null;
            if (avgVolume < volumeThreshold) return null;

            return {
                symbol: stock._id,
                sector,
                close: data[data.length - 1].close,
                dma5: parseFloat(dma5.toFixed(2)),
                dma10: parseFloat(dma10.toFixed(2)),
                dma20: parseFloat(dma20.toFixed(2)),
                avgVolume: parseInt(avgVolume),
                change5Day: parseFloat(change5Day.toFixed(2)),
                atr10: parseFloat(atr10.toFixed(2)),
                rs: parseFloat(rs.toFixed(2)) // ✅ Relative Strength added
            };
        }).filter(Boolean);

        // Rank from leading to lagging by 5-day % change
        rankedStocks.sort((a, b) => b.change5Day - a.change5Day);
        rankedStocks.forEach((s, idx) => s.rank = idx + 1);

        res.json({
            sector,
            days,
            volumeThreshold,
            count: rankedStocks.length,
            stocks: rankedStocks
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});






const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
});

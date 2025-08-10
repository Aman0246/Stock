import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import { getSectorMomentumTrends, getCurrentLeadingSector, getStockDataForSector, calculateMomentum } from './script/ShareMarket/phase2.js';

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = "mongodb+srv://amankashyap0246jploft:kprUz7Puu9cS9zkl@cluster0.bqz0rdo.mongodb.net/Secerate";
const client = new MongoClient(MONGO_URI);

app.get('/api/sector-analysis', async (req, res) => {
    try {
        await client.connect();

        // Get current leading sector
        const currentLeader = await getCurrentLeadingSector(client);

        // Get sector momentum trends
        const sectorTrends = await getSectorMomentumTrends(client, 30);

        // Find current leader's momentum
        const currentTrend = sectorTrends.find(t => t.sector === currentLeader.sector);
        const currentSlope = currentTrend ? currentTrend.slope : 0;

        // Identify potential next leading sectors
        const betterMomentumSectors = sectorTrends.filter(t => t.slope > currentSlope + 0.001);
        const nextLeadingSectors = betterMomentumSectors.length > 0 && currentSlope < 0.001
            ? betterMomentumSectors.slice(0, 3)
            : [{ sector: currentLeader.sector, slope: currentSlope }];

        // Get top stocks for current and next leading sectors
        const sectorDetails = [];
        const sectorsToAnalyze = [...nextLeadingSectors, currentTrend].filter(Boolean);

        for (const sectorTrend of sectorsToAnalyze) {
            const stockMap = await getStockDataForSector(client, sectorTrend.sector, 30);
            const momentumArray = [];

            for (const [symbol, records] of stockMap.entries()) {
                const momentum = calculateMomentum(records);
                momentumArray.push({ symbol, ...momentum });
            }

            momentumArray.sort((a, b) => b.momentumScore - a.momentumScore);

            sectorDetails.push({
                sector: sectorTrend.sector,
                momentumSlope: sectorTrend.slope,
                topStocks: momentumArray.slice(0, 10)
            });
        }

        res.json({
            currentLeader: {
                sector: currentLeader.sector,
                avgChange: currentLeader.avgChange,
                momentumSlope: currentSlope
            },
            nextLeaders: nextLeadingSectors.length > 1 ? nextLeadingSectors : [],
            sectorDetails,
            allSectorTrends: sectorTrends
        });

    } catch (error) {
        console.error('Error in sector analysis:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const SectorAnalysis = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sectorRanking, setSectorRanking] = useState([]);
  const [sectorTrends, setSectorTrends] = useState([]);
  const [selectedSector, setSelectedSector] = useState('');
  const [topStocks, setTopStocks] = useState([]);
  const [timeseriesData, setTimeseriesData] = useState([]);

  useEffect(() => {
    fetchSectorRanking();
    fetchSectorTrends();
  }, [date]);

  useEffect(() => {
    if (selectedSector) {
      fetchTopStocks();
      fetchTimeseries();
    }
  }, [selectedSector, date]);

  const fetchSectorRanking = async () => {
    try {
      const response = await axios.get(`/api/sectors/ranking?date=${date}`);
      setSectorRanking(response.data.ranking);
      if (!selectedSector && response.data.ranking.length > 0) {
        setSelectedSector(response.data.ranking[0].sector);
      }
    } catch (error) {
      console.error('Error fetching sector ranking:', error);
    }
  };

  const fetchSectorTrends = async () => {
    try {
      const response = await axios.get(`/api/sectors/trend?date=${date}`);
      setSectorTrends(response.data.trends);
    } catch (error) {
      console.error('Error fetching sector trends:', error);
    }
  };

  const fetchTopStocks = async () => {
    try {
      const response = await axios.get(
        `/api/stocks/top?sector=${selectedSector}&date=${date}&limit=5`
      );
      setTopStocks(response.data.stocks);
    } catch (error) {
      console.error('Error fetching top stocks:', error);
    }
  };

  const fetchTimeseries = async () => {
    try {
      const response = await axios.get(
        `/api/sectors/timeseries?sector=${selectedSector}&days=30`
      );
      setTimeseriesData(response.data.timeSeries);
    } catch (error) {
      console.error('Error fetching timeseries:', error);
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={3}>
        {/* Date Filter */}
        <Grid item xs={12}>
          <TextField
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
            label="Select Date"
            InputLabelProps={{ shrink: true }}
          />
        </Grid>

        {/* Sector Selection */}
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>Select Sector</InputLabel>
            <Select
              value={selectedSector}
              label="Select Sector"
              onChange={(e) => setSelectedSector(e.target.value)}
            >
              {sectorRanking.map((sector) => (
                <MenuItem key={sector.sector} value={sector.sector}>
                  {sector.sector}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Sector Ranking */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Sector Ranking
              </Typography>
              {sectorRanking.map((sector, index) => (
                <Box key={sector.sector} sx={{ mb: 1, p: 1, bgcolor: sector.sector === selectedSector ? 'action.selected' : 'transparent' }}>
                  <Typography>
                    {index + 1}. {sector.sector} ({sector.avgChangePercent.toFixed(2)}%)
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Sector Trends */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Sector Trends
              </Typography>
              {sectorTrends.map((trend) => (
                <Box 
                  key={trend.sector} 
                  sx={{ 
                    mb: 1, 
                    p: 1, 
                    bgcolor: trend.sector === selectedSector ? 'action.selected' : 'transparent',
                    color: trend.trend === 'strengthening' ? 'success.main' : trend.trend === 'weakening' ? 'error.main' : 'text.primary'
                  }}
                >
                  <Typography>
                    {trend.sector}: {trend.trend} ({trend.delta > 0 ? '+' : ''}
                    {trend.delta}%)
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Top Stocks */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Stocks in {selectedSector}
              </Typography>
              {topStocks.map((stock, index) => (
                <Box 
                  key={stock.symbol} 
                  sx={{ 
                    mb: 1, 
                    p: 1, 
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    boxShadow: 1
                  }}
                >
                  <Typography>
                    {index + 1}. {stock.symbol}: {stock.changePercent.toFixed(2)}%
                    <Typography variant="body2" color="text.secondary">
                      Volume: {stock.volume.toLocaleString()}
                    </Typography>
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Timeseries Chart */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {selectedSector} Performance (30 Days)
              </Typography>
              <Box sx={{ width: '100%', height: 400, overflowX: 'auto' }}>
                <LineChart
                  width={800}
                  height={400}
                  data={timeseriesData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avgChangePercent"
                    stroke="#8884d8"
                    name="Change %"
                    dot={false}
                  />
                </LineChart>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SectorAnalysis;
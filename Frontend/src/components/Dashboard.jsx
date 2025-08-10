import { useState, useEffect } from 'react';
import { Box, Container, Grid, Paper, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import axios from 'axios';

const Dashboard = () => {
  const [sectorData, setSectorData] = useState([]);
  const [selectedSector, setSelectedSector] = useState('');
  const [topStocks, setTopStocks] = useState([]);
  const [sectorTrends, setSectorTrends] = useState([]);

  const sectorList = [
    'NIFTY 50', 'NIFTY AUTO', 'NIFTY BANK', 'NIFTY FMCG', 'NIFTY IT',
    'NIFTY METAL', 'NIFTY PHARMA', 'NIFTY PSU BANK', 'NIFTY REALTY',
    'NIFTY OIL & GAS', 'NIFTY FINANCIAL SERVICES', 'NIFTY MEDIA', 'NIFTY ENERGY'
  ];

  useEffect(() => {
    // Fetch sector trends data
    const fetchSectorTrends = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/sector-trends');
        setSectorTrends(response.data);
      } catch (error) {
        console.error('Error fetching sector trends:', error);
      }
    };

    fetchSectorTrends();
  }, []);

  useEffect(() => {
    if (selectedSector) {
      // Fetch top stocks for selected sector
      const fetchTopStocks = async () => {
        try {
          const response = await axios.get(`http://localhost:3000/api/top-stocks/${selectedSector}`);
          setTopStocks(response.data);
        } catch (error) {
          console.error('Error fetching top stocks:', error);
        }
      };

      fetchTopStocks();
    }
  }, [selectedSector]);

  const handleSectorChange = (event) => {
    setSelectedSector(event.target.value);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        {/* Sector Selection */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Select Sector</InputLabel>
              <Select
                value={selectedSector}
                label="Select Sector"
                onChange={handleSectorChange}
              >
                {sectorList.map((sector) => (
                  <MenuItem key={sector} value={sector}>
                    {sector}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Paper>
        </Grid>

        {/* Sector Trends Chart */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Sector Momentum Trends
            </Typography>
            <Box sx={{ height: 300 }}>
              <LineChart
                width={800}
                height={300}
                data={sectorTrends}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="sector" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="slope" stroke="#8884d8" />
              </LineChart>
            </Box>
          </Paper>
        </Grid>

        {/* Top Stocks Table */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Top Performing Stocks
            </Typography>
            <Box sx={{ mt: 2 }}>
              {topStocks.map((stock, index) => (
                <Box key={stock.symbol} sx={{ mb: 2, p: 1, bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle1">
                    {index + 1}. {stock.symbol}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Momentum Score: {stock.momentumScore.toFixed(2)}
                    <br />
                    Price Change: {stock.priceChangePct.toFixed(2)}%
                    <br />
                    Volume Spike: {stock.volumeSpike.toFixed(2)}x
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
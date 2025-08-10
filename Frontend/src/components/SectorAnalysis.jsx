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
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SectorAnalysis = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

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
    <Box sx={{ flexGrow: 1, p: { xs: 1, sm: 2, md: 3 } }}>
      <Grid container spacing={{ xs: 2, sm: 3 }}>
        {/* Date Filter */}
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
            label="Select Date"
            InputLabelProps={{ shrink: true }}
            size={isMobile ? "small" : "medium"}
          />
        </Grid>

        {/* Sector Selection */}
        <Grid item xs={12} sm={6} md={4}>
          <FormControl fullWidth size={isMobile ? "small" : "medium"}>
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
        <Grid item xs={12} sm={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant={isMobile ? "subtitle1" : "h6"} gutterBottom>
                Sector Ranking
              </Typography>
              <Box sx={{ maxHeight: isMobile ? 200 : 300, overflowY: 'auto' }}>
                {sectorRanking.map((sector, index) => (
                  <Box 
                    key={sector.sector} 
                    sx={{
                      mb: 1,
                      p: 1,
                      bgcolor: sector.sector === selectedSector ? 'action.selected' : 'transparent',
                      borderRadius: 1,
                      '&:hover': {
                        bgcolor: 'action.hover'
                      }
                    }}
                  >
                    <Typography variant={isMobile ? "body2" : "body1"}>
                      {index + 1}. {sector.sector} ({sector.avgChangePercent.toFixed(2)}%)
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Sector Trends */}
        <Grid item xs={12} sm={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant={isMobile ? "subtitle1" : "h6"} gutterBottom>
                Sector Trends
              </Typography>
              <Box sx={{ maxHeight: isMobile ? 200 : 300, overflowY: 'auto' }}>
                {sectorTrends.map((trend) => (
                  <Box
                    key={trend.sector}
                    sx={{
                      mb: 1,
                      p: 1,
                      bgcolor: trend.sector === selectedSector ? 'action.selected' : 'transparent',
                      color: trend.trend === 'strengthening' ? 'success.main' : trend.trend === 'weakening' ? 'error.main' : 'text.primary',
                      borderRadius: 1,
                      '&:hover': {
                        bgcolor: 'action.hover'
                      }
                    }}
                  >
                    <Typography variant={isMobile ? "body2" : "body1"}>
                      {trend.sector}: {trend.trend} ({trend.delta > 0 ? '+' : ''}
                      {trend.delta}%)
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Stocks */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant={isMobile ? "subtitle1" : "h6"} gutterBottom>
                Top Stocks in {selectedSector}
              </Typography>
              <Box sx={{ maxHeight: isMobile ? 200 : 300, overflowY: 'auto' }}>
                {topStocks.map((stock, index) => (
                  <Box
                    key={stock.symbol}
                    sx={{
                      mb: 1,
                      p: 1.5,
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                      boxShadow: 1,
                      '&:hover': {
                        boxShadow: 2
                      }
                    }}
                  >
                    <Typography variant={isMobile ? "body2" : "body1"}>
                      {index + 1}. {stock.symbol}: {stock.changePercent.toFixed(2)}%
                      <Typography variant={isMobile ? "caption" : "body2"} color="text.secondary">
                        Volume: {stock.volume.toLocaleString()}
                      </Typography>
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Timeseries Chart */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant={isMobile ? "subtitle1" : "h6"} gutterBottom>
                {selectedSector} Performance (30 Days)
              </Typography>
              <Box sx={{ width: '100%', height: isMobile ? 300 : 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={timeseriesData}
                    margin={{
                      top: 5,
                      right: isMobile ? 10 : 30,
                      left: isMobile ? 10 : 20,
                      bottom: 5
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date"
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                      angle={isMobile ? -45 : 0}
                      textAnchor={isMobile ? "end" : "middle"}
                      height={isMobile ? 60 : 30}
                    />
                    <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} />
                    <Line
                      type="monotone"
                      dataKey="avgChangePercent"
                      stroke="#8884d8"
                      name="Change %"
                      dot={false}
                      strokeWidth={isMobile ? 1 : 2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SectorAnalysis;
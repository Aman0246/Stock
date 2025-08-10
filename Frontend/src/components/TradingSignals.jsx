import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  TextField,
  Alert,
  Chip,
  Paper,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PauseIcon from '@mui/icons-material/Pause';

const TradingSignals = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [signalData, setSignalData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTradingSignal = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/trading-signal?date=${date}`);
      setSignalData(response.data);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to fetch trading signal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTradingSignal();
  }, [date]);

  const getSignalIcon = (signal) => {
    switch (signal) {
      case 'SELL_CURRENT_BUY_NEXT':
        return <TrendingDownIcon color="error" fontSize={isMobile ? "small" : "medium"} />;
      case 'BUY_CURRENT_HOLD_OTHERS':
        return <TrendingUpIcon color="success" fontSize={isMobile ? "small" : "medium"} />;
      default:
        return <PauseIcon color="warning" fontSize={isMobile ? "small" : "medium"} />;
    }
  };

  const getSignalColor = (signal) => {
    switch (signal) {
      case 'SELL_CURRENT_BUY_NEXT':
        return 'error';
      case 'BUY_CURRENT_HOLD_OTHERS':
        return 'success';
      default:
        return 'warning';
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

        {/* Error Display */}
        {error && (
          <Grid item xs={12}>
            <Alert 
              severity="error"
              sx={{
                '& .MuiAlert-message': {
                  fontSize: isMobile ? '0.875rem' : '1rem'
                }
              }}
            >
              {error}
            </Alert>
          </Grid>
        )}

        {/* Loading State */}
        {loading && (
          <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={isMobile ? 30 : 40} />
          </Grid>
        )}

        {/* Signal Display */}
        {!loading && signalData && (
          <>
            {/* Signal Summary */}
            <Grid item xs={12}>
              <Card>
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Box sx={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    gap: 2,
                    mb: 2
                  }}>
                    <Typography variant={isMobile ? "subtitle1" : "h6"}>
                      Trading Signal
                    </Typography>
                    <Chip
                      icon={getSignalIcon(signalData.signal)}
                      label={signalData.signal.replace(/_/g, ' ')}
                      color={getSignalColor(signalData.signal)}
                      variant="outlined"
                      size={isMobile ? "small" : "medium"}
                    />
                  </Box>
                  <Typography 
                    color="text.secondary"
                    variant={isMobile ? "body2" : "body1"}
                    gutterBottom
                  >
                    {signalData.reason}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Leader Details */}
            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: { xs: 2, sm: 3 }, height: '100%' }}>
                <Typography variant={isMobile ? "subtitle1" : "h6"} gutterBottom>
                  Current Leader: {signalData.currentLeader}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant={isMobile ? "body2" : "body1"} gutterBottom>
                    3-Day Average: {signalData.details.currentLeader['3DayAvgChangePercent']}%
                  </Typography>
                  <Typography variant={isMobile ? "body2" : "body1"}>
                    Today's Change: {signalData.details.currentLeader.todayChangePercent}%
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* Next Leader Details */}
            {signalData.nextLeader && (
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: { xs: 2, sm: 3 }, height: '100%' }}>
                  <Typography variant={isMobile ? "subtitle1" : "h6"} gutterBottom>
                    Next Leader: {signalData.nextLeader}
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant={isMobile ? "body2" : "body1"} gutterBottom>
                      3-Day Average: {signalData.details.nextLeader['3DayAvgChangePercent']}%
                    </Typography>
                    <Typography variant={isMobile ? "body2" : "body1"}>
                      Today's Change: {signalData.details.nextLeader.todayChangePercent}%
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            )}
          </>
        )}
      </Grid>
    </Box>
  );
};

export default TradingSignals;
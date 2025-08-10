import React, { useState, useEffect } from 'react';
import {
    Container,
    Paper,
    Typography,
    Grid,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Alert,
    Box
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';

const SectorAnalysis = () => {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await axios.get('http://localhost:3000/api/sector-analysis');
            setData(response.data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch sector analysis data');
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 300000); // Refresh every 5 minutes
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Container>
                <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
            </Container>
        );
    }

    if (!data) return null;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {/* Current Leader Section */}
            <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                <Typography variant="h5" gutterBottom>Current Leading Sector</Typography>
                <Typography variant="h4" color="primary">
                    {data.currentLeader.sector}
                </Typography>
                <Typography variant="subtitle1">
                    Average Change: {data.currentLeader.avgChange.toFixed(2)}%
                </Typography>
                <Typography variant="subtitle1">
                    Momentum Slope: {data.currentLeader.momentumSlope.toFixed(5)}
                </Typography>
            </Paper>

            {/* Next Leaders Section */}
            {data.nextLeaders.length > 0 && (
                <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                    <Typography variant="h5" gutterBottom>Next Leading Sectors</Typography>
                    <Grid container spacing={2}>
                        {data.nextLeaders.map((sector, index) => (
                            <Grid item xs={12} sm={6} md={4} key={index}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6">{sector.sector}</Typography>
                                        <Typography variant="body2">
                                            Momentum Slope: {sector.slope.toFixed(5)}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Paper>
            )}

            {/* Sector Details Section */}
            <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                <Typography variant="h5" gutterBottom>Sector Details</Typography>
                {data.sectorDetails.map((sectorDetail, index) => (
                    <Box key={index} sx={{ mb: 4 }}>
                        <Typography variant="h6" gutterBottom>
                            {sectorDetail.sector} (Momentum Slope: {sectorDetail.momentumSlope.toFixed(5)})
                        </Typography>
                        <TableContainer component={Paper}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Symbol</TableCell>
                                        <TableCell align="right">Price Change %</TableCell>
                                        <TableCell align="right">Volume Spike</TableCell>
                                        <TableCell align="right">Momentum Score</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {sectorDetail.topStocks.map((stock, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell component="th" scope="row">
                                                {stock.symbol}
                                            </TableCell>
                                            <TableCell align="right">
                                                {stock.priceChangePct.toFixed(2)}%
                                            </TableCell>
                                            <TableCell align="right">
                                                {stock.volumeSpike.toFixed(2)}
                                            </TableCell>
                                            <TableCell align="right">
                                                {stock.momentumScore.toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                ))}
            </Paper>

            {/* Sector Trends Chart */}
            <Paper elevation={3} sx={{ p: 3 }}>
                <Typography variant="h5" gutterBottom>All Sector Trends</Typography>
                <Box sx={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={data.allSectorTrends}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="sector" angle={-45} textAnchor="end" height={100} />
                            <YAxis label={{ value: 'Momentum Slope', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="slope"
                                stroke="#8884d8"
                                name="Momentum Slope"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </Box>
            </Paper>
        </Container>
    );
};

export default SectorAnalysis;
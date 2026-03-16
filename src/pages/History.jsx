import React, { useState, useEffect } from 'react';
import { Box, Card, Typography, Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Chip } from '@mui/material';
import { History as HistoryIcon } from '@mui/icons-material';

export default function ScanHistory() {
  const [historyData, setHistoryData] = useState([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/history`)
      .then(res => res.json())
      .then(data => setHistoryData(data))
      .catch(err => console.error("History fetch error:", err));
  }, []);

  return (
    <Box sx={{ animation: 'fadeIn 0.5s ease-in' }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <HistoryIcon color="primary" fontSize="large" /> Threat Archives
      </Typography>
      
      <Card sx={{ bgcolor: 'background.paper', border: '1px solid #1A2C42' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date / Time</TableCell>
                <TableCell>Data Source</TableCell>
                <TableCell>Total Flows</TableCell>
                <TableCell>Anomalies</TableCell>
                <TableCell>Integrity Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {historyData.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                  <TableCell>{row.filename}</TableCell>
                  <TableCell>{row.total_flows}</TableCell>
                  <TableCell sx={{ color: row.threats_detected > 0 ? '#ff1744' : 'inherit' }}>{row.threats_detected}</TableCell>
                  <TableCell>
                    <Chip 
                      label={row.status} 
                      sx={{ 
                        bgcolor: row.status === 'Secure' ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 23, 68, 0.1)', 
                        color: row.status === 'Secure' ? '#00e676' : '#ff1744',
                        fontWeight: 'bold'
                      }} 
                      size="small" 
                    />
                  </TableCell>
                </TableRow>
              ))}
              {historyData.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: '#8e9fac' }}>No database records found in Supabase.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}

import React from 'react';
import { Box, Typography } from '@mui/material';
import { Radar } from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function TopAttackers({ attackersData }) {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid #1A2C42', display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#0b162c' }}>
        <Radar fontSize="small" color="error"/> 
        <Typography variant="subtitle1" fontWeight="bold">Top Hostile Sources</Typography>
      </Box>
      <Box sx={{ flexGrow: 1, p: 2, minHeight: 300 }}>
        {attackersData && attackersData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={attackersData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
              <XAxis type="number" stroke="#8e9fac" tick={{ fill: '#8e9fac' }} />
              <YAxis 
                dataKey="ip" 
                type="category" 
                stroke="#8e9fac" 
                width={120} 
                tick={{ fontFamily: 'monospace', fontSize: 12, fill: '#cfd8dc' }} 
              />
              <Tooltip 
                cursor={{ fill: 'rgba(255, 23, 68, 0.1)' }} 
                contentStyle={{ backgroundColor: '#0A1526', borderColor: '#1A2C42', borderRadius: '8px', color: '#fff' }} 
                itemStyle={{ color: '#ff1744', fontWeight: 'bold' }}
              />
              <Bar dataKey="count" fill="#ff1744" radius={[0, 4, 4, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">No hostile activity detected.</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
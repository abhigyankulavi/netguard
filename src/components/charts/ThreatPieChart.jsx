import React from 'react';
import { Box, Typography } from '@mui/material';
import { BugReport } from '@mui/icons-material';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CHART_COLORS = ['#ff1744', '#ff9100', '#4fc3f7', '#ab47bc', '#00e676'];

export default function ThreatPieChart({ distributionData }) {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid #1A2C42', display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#0b162c' }}>
        <BugReport fontSize="small" color="error"/> 
        <Typography variant="subtitle1" fontWeight="bold">Signature Distribution</Typography>
      </Box>
      <Box sx={{ flexGrow: 1, p: 2, minHeight: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie 
              data={distributionData} 
              cx="50%" 
              cy="45%" 
              innerRadius={0} 
              outerRadius={90} 
              dataKey="value"
              stroke="#0A1526" 
              strokeWidth={2}
            >
              {distributionData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#0A1526', borderColor: '#1A2C42', borderRadius: '8px' }} 
              itemStyle={{ color: '#fff' }}
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Drawer, List, ListItem, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { Security, History, Analytics } from '@mui/icons-material';

export const DRAWER_WIDTH = 260;

export default function Sidebar() {
  const location = useLocation();
  
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': { 
          width: DRAWER_WIDTH, 
          boxSizing: 'border-box', 
          bgcolor: '#03070E', 
          borderRight: '1px solid #1A2C42' 
        },
      }}
    >
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid #1A2C42' }}>
        <Analytics color="primary" fontSize="large" />
        <Typography variant="h6" fontWeight="bold">
          NetGuard <span style={{ color: '#8e9fac', fontWeight: 300 }}>SIEM</span>
        </Typography>
      </Box>
      <List sx={{ px: 2, pt: 4 }}>
        {[
          { text: 'Live Dashboard', icon: <Security />, path: '/' },
          { text: 'Threat Archives', icon: <History />, path: '/history' }
        ].map((item) => (
          <ListItem 
            button 
            key={item.text} 
            component={Link} 
            to={item.path}
            sx={{ 
              borderRadius: 2, mb: 1,
              bgcolor: location.pathname === item.path ? 'rgba(79, 195, 247, 0.1)' : 'transparent',
              color: location.pathname === item.path ? '#4fc3f7' : '#8e9fac',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                bgcolor: 'rgba(79, 195, 247, 0.2)'
              }
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: 600 }} />
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
}
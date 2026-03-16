import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';

import { socTheme } from './theme/SocTheme';
import Sidebar, { DRAWER_WIDTH } from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import ScanHistory from './pages/History';

export default function App() {
  return (
    <ThemeProvider theme={socTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
          
          <Sidebar />
          
          {/* Dynamic Page Content */}
          <Box 
            component="main" 
            sx={{ 
              flexGrow: 1, 
              p: 4, 
              width: `calc(100% - ${DRAWER_WIDTH}px)`,
              height: '100vh',
              overflow: 'auto'
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/history" element={<ScanHistory />} />
            </Routes>
          </Box>
          
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
}
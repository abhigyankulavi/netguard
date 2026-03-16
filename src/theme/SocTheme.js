import { createTheme } from '@mui/material';

export const socTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#4fc3f7' },
    secondary: { main: '#f06292' },
    background: { default: '#050B14', paper: '#0A1526' },
    error: { main: '#ff1744' },
    success: { main: '#00e676' },
    warning: { main: '#ff9100' },
  },
  typography: { 
    fontFamily: '"Inter", "Roboto", "Helvetica", sans-serif',
    h6: { fontWeight: 600, letterSpacing: '0.5px' },
  },
  components: {
    MuiCard: { 
      styleOverrides: { 
        root: { 
          borderRadius: 12, 
          border: '1px solid #1A2C42', 
          backgroundImage: 'none',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        } 
      } 
    },
    MuiButton: { 
      styleOverrides: { 
        root: { textTransform: 'none', borderRadius: 8, fontWeight: 600 } 
      } 
    },
    MuiTableCell: { 
      styleOverrides: { 
        head: { color: '#8e9fac', fontWeight: 600, borderBottom: '1px solid #1A2C42' }, 
        body: { borderBottom: '1px solid #1A2C42' } 
      } 
    }
  }
});
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Box, Grid, Card, CardContent, Typography, Button, CircularProgress, 
  ToggleButton, ToggleButtonGroup, Chip, Table, TableBody, TableCell, 
  TableHead, TableRow, TableContainer 
} from '@mui/material';
import { 
  CloudUpload, Security, Warning, Sensors, StopCircle, RadioButtonChecked 
} from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

import AttackGraph from '../components/topology/AttackGraph';
import ThreatPieChart from '../components/charts/ThreatPieChart';
import TopAttackers from '../components/charts/TopAttackers';
export default function Dashboard() {
  const [analysisMode, setAnalysisMode] = useState('upload'); 
  const [file, setFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  
  const [isLiveActive, setIsLiveActive] = useState(false);
  const wsRef = useRef(null);

  const [scanSummary, setScanSummary] = useState(null);
  const [threatDetails, setThreatDetails] = useState([]);

  //Live Sensor WebSocket
  const toggleLiveSensor = () => {
    if (isLiveActive) {
      if (wsRef.current) wsRef.current.close();
      setIsLiveActive(false);
    } else {
      setScanSummary({ total_flows_analyzed: 0, threats_detected: 0, status: 'Secure' });
      setThreatDetails([]);
      
      const WS_URL = import.meta.env.VITE_WS_BASE_URL;
      wsRef.current = new WebSocket(`${WS_URL}/ws/live`);
      wsRef.current.onopen = () => setIsLiveActive(true);
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setScanSummary(prev => ({
          total_flows_analyzed: (prev?.total_flows_analyzed || 0) + data.total_flows,
          threats_detected: (prev?.threats_detected || 0) + data.threats_detected,
          status: data.status === 'Critical' ? 'Critical' : prev?.status || 'Secure'
        }));
        
        if (data.threat_details && data.threat_details.length > 0) {
          setThreatDetails(prev => {
            const newThreats = [...data.threat_details, ...prev];
            return newThreats.slice(0, 150); 
          });
        }
      };

      wsRef.current.onerror = () => {
        setIsLiveActive(false);
        alert("Failed to connect to Live Sensor. Is the backend running?");
      };
    }
  };

  useEffect(() => {
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  //File Upload
  const handleScan = async () => {
    if (!file) return;
    setIsScanning(true);
    setThreatDetails([]);
    setScanSummary(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      const response = await fetch(`${API_URL}/api/analyze`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(await response.text());
      
      const data = await response.json();
 
      setScanSummary({
        total_flows_analyzed: data.total_flows,
        threats_detected: data.threats_detected,
        status: data.status
      });
      setThreatDetails(data.threat_details);
      
    } catch (err) {
      alert("Scan failed: " + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const { graphData, attackDistribution, topAttackers } = useMemo(() => {
    if (threatDetails.length === 0) return { graphData: { nodes: [], links: [] }, attackDistribution: [], topAttackers: [] };

    const nodes = new Map();
    const links = [];
    const typeCount = {};
    const ipCount = {};

    threatDetails.forEach((threat) => {
      if (!nodes.has(threat.source_ip)) nodes.set(threat.source_ip, { id: threat.source_ip, group: 'Attacker', color: '#ff1744' });
      if (!nodes.has(threat.target_ip)) nodes.set(threat.target_ip, { id: threat.target_ip, group: 'Target', color: '#4fc3f7' });
      
      links.push({ source: threat.source_ip, target: threat.target_ip, name: threat.attack_type, color: 'rgba(255, 23, 68, 0.6)' });
      typeCount[threat.attack_type] = (typeCount[threat.attack_type] || 0) + 1;
      ipCount[threat.source_ip] = (ipCount[threat.source_ip] || 0) + 1;
    });

    return { 
      graphData: { nodes: Array.from(nodes.values()), links }, 
      attackDistribution: Object.keys(typeCount).map(k => ({ name: k, value: typeCount[k] })), 
      topAttackers: Object.keys(ipCount).map(k => ({ ip: k, count: ipCount[k] })).sort((a, b) => b.count - a.count).slice(0, 5) 
    };
  }, [threatDetails]);

  return (
    <Box sx={{ animation: 'fadeIn 0.5s ease-in' }}>
      {/* Control Panel */}
      <Card sx={{ mb: 4, p: 2, bgcolor: 'background.paper' }}>
        <Grid container spacing={2} alignItems="center" justifyContent="space-between">
          <Grid item xs={12} md={6}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Sensors color="primary" /> File Upload & Live Analysis
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Select data source.
            </Typography>
          </Grid>
          <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 3 }}>
            <ToggleButtonGroup
              color="primary" value={analysisMode} exclusive size="small"
              onChange={(e, newMode) => { if(newMode) setAnalysisMode(newMode); }}
            >
              <ToggleButton value="upload" sx={{ px: 3 }}><CloudUpload sx={{ mr: 1, fontSize: 18 }}/> File Upload</ToggleButton>
              <ToggleButton value="live" sx={{ px: 3 }}><RadioButtonChecked sx={{ mr: 1, fontSize: 18 }}/> Live Network</ToggleButton>
            </ToggleButtonGroup>

            {analysisMode === 'upload' ? (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button variant="outlined" component="label" sx={{ borderColor: '#1A2C42' }}>
                  {file ? file.name : "Select PCAP/CSV"}
                  <input type="file" hidden accept=".csv,.pcap,.pcapng" onChange={(e) => setFile(e.target.files[0])} />
                </Button>
                <Button 
                  variant="contained" color="primary" onClick={handleScan} disabled={isScanning || !file}
                  startIcon={isScanning ? <CircularProgress size={20} color="inherit"/> : <Security />}
                >
                  {isScanning ? 'Processing...' : 'Analyze'}
                </Button>
              </Box>
            ) : (
              <Button 
                variant="contained" color={isLiveActive ? "error" : "success"} onClick={toggleLiveSensor}
                startIcon={isLiveActive ? <StopCircle /> : <Sensors />}
                sx={{ boxShadow: isLiveActive ? '0 0 15px rgba(255, 23, 68, 0.4)' : '0 0 15px rgba(0, 230, 118, 0.2)' }}
              >
                {isLiveActive ? 'Stop Capture' : 'Start Sensor'}
              </Button>
            )}
          </Grid>
        </Grid>
      </Card>

      {/* KPI and Visualizations */}
      {scanSummary && (
        <Grid container spacing={3}>
          {/* KPI Row */}
          <Grid item xs={12} md={3}>
            <Card sx={{ borderTop: scanSummary.status === 'Secure' ? '4px solid #00e676' : '4px solid #ff1744' }}>
              <CardContent>
                <Typography color="text.secondary" variant="subtitle2">Network Integrity</Typography>
                <Typography variant="h4" sx={{ mt: 1, color: scanSummary.status === 'Secure' ? 'success.main' : 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                  {scanSummary.status === 'Secure' ? <Security /> : <Warning />} {scanSummary.status}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card><CardContent>
              <Typography color="text.secondary" variant="subtitle2">Total Flows Analyzed</Typography>
              <Typography variant="h4" sx={{ mt: 1 }}>{scanSummary.total_flows_analyzed.toLocaleString()}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card><CardContent>
              <Typography color="text.secondary" variant="subtitle2">Malicious Anomalies</Typography>
              <Typography variant="h4" sx={{ mt: 1, color: 'warning.main' }}>{scanSummary.threats_detected.toLocaleString()}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card><CardContent>
              <Typography color="text.secondary" variant="subtitle2">Primary Threat Actor</Typography>
              <Typography variant="h5" sx={{ mt: 1, fontFamily: 'monospace', color: 'error.main' }}>
                {topAttackers.length > 0 ? topAttackers[0].ip : "None"}
              </Typography>
            </CardContent></Card>
          </Grid>

          {/* Visualization Row */}
          {threatDetails.length > 0 && (
            <>
              {/* Force Graph */}
              <Grid item xs={12} lg={8}>
                <Card sx={{ height: 450 }}>
                  <AttackGraph graphData={graphData} />
                </Card>
              </Grid>

              {/* Pie Chart*/}
              <Grid item xs={12} lg={4}>
                <Card sx={{ height: 450 }}>
                  <ThreatPieChart distributionData={attackDistribution} />
                </Card>
              </Grid>

              {/* Top Attackers Bar Chart */}
              <Grid item xs={12} lg={4}>
                <Card sx={{ height: 450 }}>
                  <TopAttackers attackersData={topAttackers} />
                </Card>
              </Grid>
              {/* Threat Log Table */}
              <Grid item xs={12} lg={8}>
                <Card sx={{ height: 400, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ p: 2, borderBottom: '1px solid #1A2C42', bgcolor: '#0b162c' }}>
                    <Typography variant="subtitle1" fontWeight="bold">Threat Log</Typography>
                  </Box>
                  <TableContainer sx={{ flexGrow: 1 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Signature</TableCell>
                          <TableCell>Source IP</TableCell>
                          <TableCell>Target IP</TableCell>
                          <TableCell>Response Plan</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {threatDetails.map((threat, index) => (
                          <TableRow key={index} hover>
                            <TableCell><Chip label={threat.attack_type} sx={{ bgcolor: 'rgba(255, 23, 68, 0.1)', color: '#ff1744', fontWeight: 'bold' }} size="small" /></TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', color: '#8e9fac' }}>{threat.source_ip}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', color: '#8e9fac' }}>{threat.target_ip}</TableCell>
                            <TableCell sx={{ color: '#cfd8dc', fontSize: '0.8rem' }}>{threat.ai_insight}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Card>
              </Grid>
            </>
          )}
        </Grid>
      )}
    </Box>
  );
}
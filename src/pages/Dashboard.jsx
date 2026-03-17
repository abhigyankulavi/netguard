import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Box, Grid, Card, CardContent, Typography, Button, CircularProgress, 
  ToggleButton, ToggleButtonGroup, Chip, Table, TableBody, TableCell, 
  TableHead, TableRow, TableContainer, Alert 
} from '@mui/material';
import { 
  CloudUpload, Security, Sensors, StopCircle, RadioButtonChecked,
  GppGood, ErrorOutline
} from '@mui/icons-material';
import toast from 'react-hot-toast';

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

  const toggleLiveSensor = () => {
    if (isLiveActive) {
      if (wsRef.current) wsRef.current.close();
      setIsLiveActive(false);
      toast('Live Sensor Disconnected', { icon: '🛑' });
    } else {
      setScanSummary({ total_flows_analyzed: 0, threats_detected: 0, warning: null });
      setThreatDetails([]);
      
      const WS_URL = import.meta.env.VITE_WS_BASE_URL;
      wsRef.current = new WebSocket(`${WS_URL}/ws/live`);
      
      wsRef.current.onopen = () => {
        setIsLiveActive(true);
        toast.success('Live Sensor Activated. Monitoring traffic...');
      };
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.error) { toast.error(`Stream Error: ${data.error}`); return; }
        if (data.warning) {
            toast(data.warning, { icon: '⚠️', style: { background: '#fff3cd', color: '#856404' }, duration: 4000 });
        }

        setScanSummary(prev => ({
          total_flows_analyzed: (prev?.total_flows_analyzed || 0) + data.total_flows,
          threats_detected: (prev?.threats_detected || 0) + data.threats_detected,
          warning: data.warning || prev?.warning 
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
        toast.error("Failed to connect to Live Sensor. Is the backend running?");
      };
    }
  };

  useEffect(() => {
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  const handleScan = async () => {
    if (!file) return;
    setIsScanning(true);
    setThreatDetails([]);
    setScanSummary(null);

    const toastId = toast.loading('Uploading capture to NetGuard Engine...');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      const response = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(await response.text());
      
      const data = await response.json();
      toast.loading('Analyzing traffic flows...', { id: toastId });
      pollTaskStatus(data.task_id, toastId);
    } catch (err) {
      toast.error(`Scan failed: ${err.message}`, { id: toastId });
      setIsScanning(false);
    }
  };

  const pollTaskStatus = async (taskId, toastId) => {
    try {
        const API_URL = import.meta.env.VITE_API_BASE_URL;
        const statusRes = await fetch(`${API_URL}/api/status/${taskId}`);
        const statusData = await statusRes.json();

        if (statusData.status === 'SUCCESS') {
            const mlResults = statusData.result;
            if (mlResults.error) {
                toast.error(`Analysis Failed: ${mlResults.error}`, { id: toastId });
                setIsScanning(false);
                return;
            }

            setScanSummary({
                total_flows_analyzed: mlResults.total_flows,
                threats_detected: mlResults.threats_detected,
                warning: mlResults.warning 
            });
            setThreatDetails(mlResults.threat_details || []);
            setIsScanning(false);

            if (mlResults.warning) {
                toast.error("Scan Complete with Warnings. See dashboard.", { id: toastId, icon: '⚠️', style: { background: '#fff3cd', color: '#856404' }, duration: 6000 });
            } else if (mlResults.threats_detected > 0) {
                toast.error(`Analysis Complete: ${mlResults.threats_detected} Threats Detected!`, { id: toastId });
            } else {
                toast.success('Analysis Complete: Network Secure.', { id: toastId });
            }
        } else if (statusData.status === 'FAILURE') {
            toast.error(`Engine Failure: ${statusData.error}`, { id: toastId });
            setIsScanning(false);
        } else {
            if (statusData.message) toast.loading(statusData.message, { id: toastId });
            setTimeout(() => pollTaskStatus(taskId, toastId), 2000);
        }
    } catch (error) {
        toast.error("Lost connection to the SIEM engine.", { id: toastId });
        setIsScanning(false);
    }
  };

  const { graphData, attackDistribution, topAttackers } = useMemo(() => {
    if (!threatDetails || threatDetails.length === 0) return { graphData: { nodes: [], links: [] }, attackDistribution: [], topAttackers: [] };

    const nodes = new Map();
    const links = [];
    const typeCount = {};
    const ipCount = {};

    threatDetails.forEach((threat) => {
      const srcId = threat.source_ip === 'Unknown' ? `Unknown_Src_${Math.random()}` : threat.source_ip;
      const tgtId = threat.target_ip === 'Unknown' ? `Unknown_Tgt_${Math.random()}` : threat.target_ip;
      
      const srcLabel = threat.source_ip === 'Unknown' ? 'Unknown IP' : threat.source_ip;
      const tgtLabel = threat.target_ip === 'Unknown' ? 'Target System' : threat.target_ip;

      if (!nodes.has(srcId)) {
          nodes.set(srcId, { id: srcId, label: srcLabel, group: 'Attacker', color: '#ff1744', val: 1 });
      } else {
          nodes.get(srcId).val += 1;
      }

      if (!nodes.has(tgtId)) {
          nodes.set(tgtId, { id: tgtId, label: tgtLabel, group: 'Target', color: '#4fc3f7', val: 1 });
      } else {
          nodes.get(tgtId).val += 1;
      }
      
      links.push({ source: srcId, target: tgtId, name: threat.attack_type, color: 'rgba(255, 23, 68, 0.4)' });
      typeCount[threat.attack_type] = (typeCount[threat.attack_type] || 0) + 1;
      
      if (threat.source_ip !== 'Unknown') {
          ipCount[threat.source_ip] = (ipCount[threat.source_ip] || 0) + 1;
      }
    });

    return { 
      graphData: { nodes: Array.from(nodes.values()), links }, 
      attackDistribution: Object.keys(typeCount).map(k => ({ name: k, value: typeCount[k] })), 
      topAttackers: Object.keys(ipCount).map(k => ({ ip: k, count: ipCount[k] })).sort((a, b) => b.count - a.count).slice(0, 5) 
    };
  }, [threatDetails]);

  const isCritical = scanSummary?.threats_detected > 0;

  return (
    <Box sx={{ animation: 'fadeIn 0.5s ease-in', maxWidth: '1600px', margin: '0 auto' }}>
      
      {/*HEADER CONTROLS*/}
      <Card sx={{ mb: 4, bgcolor: '#0b1426', border: '1px solid #1e293b', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
        <Box sx={{ p: 2, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Sensors sx={{ color: '#4fc3f7', fontSize: 32 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#e2e8f0', letterSpacing: '0.5px' }}>
                NetGuard Threat Engine
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                Ingest telemetry via PCAP or CSV logs.
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <ToggleButtonGroup
              value={analysisMode} exclusive size="small"
              onChange={(e, newMode) => { if(newMode) setAnalysisMode(newMode); }}
              sx={{ bgcolor: '#0f172a', border: '1px solid #334155' }}
            >
              <ToggleButton value="upload" sx={{ color: '#cbd5e1', '&.Mui-selected': { bgcolor: '#1e293b', color: '#4fc3f7' } }}>
                <CloudUpload sx={{ mr: 1, fontSize: 18 }}/> File Upload
              </ToggleButton>
              <ToggleButton value="live" sx={{ color: '#cbd5e1', '&.Mui-selected': { bgcolor: '#1e293b', color: '#4fc3f7' } }}>
                <RadioButtonChecked sx={{ mr: 1, fontSize: 18 }}/> Live Feed
              </ToggleButton>
            </ToggleButtonGroup>

            {analysisMode === 'upload' ? (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="outlined" component="label" sx={{ color: '#cbd5e1', borderColor: '#334155', textTransform: 'none' }}>
                  {file ? file.name : "Select File"}
                  <input type="file" hidden accept=".csv,.pcap,.pcapng" onChange={(e) => setFile(e.target.files[0])} />
                </Button>
                <Button 
                  variant="contained" 
                  onClick={handleScan} 
                  disabled={isScanning || !file}
                  sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, textTransform: 'none', px: 3 }}
                  startIcon={isScanning ? <CircularProgress size={20} color="inherit"/> : <Security />}
                >
                  {isScanning ? 'Scanning...' : 'Analyze Data'}
                </Button>
              </Box>
            ) : (
              <Button 
                variant="contained" 
                onClick={toggleLiveSensor}
                sx={{ 
                    bgcolor: isLiveActive ? '#ef4444' : '#10b981', 
                    '&:hover': { bgcolor: isLiveActive ? '#dc2626' : '#059669' },
                    textTransform: 'none', px: 3,
                    boxShadow: isLiveActive ? '0 0 15px rgba(239, 68, 68, 0.4)' : 'none'
                }}
                startIcon={isLiveActive ? <StopCircle /> : <Sensors />}
              >
                {isLiveActive ? 'Stop Capture' : 'Start Sensor'}
              </Button>
            )}
          </Box>
        </Box>
      </Card>

      {/*DASHBOARD */}
      {scanSummary && (
        <Box>
          
          {/*PERSISTENT WARNING BANNER*/}
          {scanSummary.warning && (
            <Alert 
              severity="warning" 
              variant="filled" 
              sx={{ mb: 3, bgcolor: '#856404', color: '#fff3cd', border: '1px solid #ffeeba' }}
            >
              <strong>Data Quality Warning:</strong> {scanSummary.warning}
            </Alert>
          )}

          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#0b1426', border: '1px solid #1e293b', borderTop: `4px solid ${isCritical ? '#ef4444' : '#10b981'}` }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Network Posture</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 1 }}>
                    {isCritical ? <ErrorOutline sx={{ color: '#ef4444', fontSize: 28 }} /> : <GppGood sx={{ color: '#10b981', fontSize: 28 }} />}
                    <Typography variant="h5" sx={{ color: isCritical ? '#ef4444' : '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                      {isCritical ? 'Critical' : 'Secure'}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#0b1426', border: '1px solid #1e293b' }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Flows Analyzed</Typography>
                  <Typography variant="h4" sx={{ mt: 1, color: '#f8fafc', fontWeight: 600 }}>
                    {scanSummary.total_flows_analyzed.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#0b1426', border: '1px solid #1e293b' }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Threats Blocked</Typography>
                  <Typography variant="h4" sx={{ mt: 1, color: isCritical ? '#fba918' : '#f8fafc', fontWeight: 600 }}>
                    {scanSummary.threats_detected.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#0b1426', border: '1px solid #1e293b' }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Primary Vector</Typography>
                  <Typography variant="h6" sx={{ mt: 1, color: '#f8fafc', fontFamily: 'monospace' }}>
                    {attackDistribution.length > 0 ? attackDistribution.sort((a,b) => b.value - a.value)[0].name : "None"}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* VISUALIZATION ROW */}
          {threatDetails && threatDetails.length > 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} lg={8}>
                <Card sx={{ height: 450, bgcolor: '#0b1426', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ p: 2, borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1" sx={{ color: '#e2e8f0', fontWeight: 600 }}>Live Vector Topology</Typography>
                    {threatDetails[0].source_ip === 'Unknown' && (
                      <Chip label="IP Data Anonymized in CSV" size="small" sx={{ bgcolor: '#334155', color: '#cbd5e1', fontSize: '0.7rem' }} />
                    )}
                  </Box>
        
                  <Box sx={{ flexGrow: 1, overflow: 'hidden', width: '100%', height: '100%', position: 'relative' }}>
                    <AttackGraph graphData={graphData} />
                  </Box>
                </Card>
              </Grid>

              {/* Pie Chart*/}
              <Grid item xs={12} lg={4}>
                <Card sx={{ height: 450, bgcolor: '#0b1426', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ p: 2, borderBottom: '1px solid #1e293b' }}>
                     <Typography variant="subtitle1" sx={{ color: '#e2e8f0', fontWeight: 600 }}>Signature Distribution</Typography>
                  </Box>
                  <Box sx={{ flexGrow: 1, p: 2 }}>
                    <ThreatPieChart distributionData={attackDistribution} />
                  </Box>
                </Card>
              </Grid>

              {/*Threat Log Table*/}
              <Grid item xs={12} lg={8}>
                <Card sx={{ height: 400, bgcolor: '#0b1426', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ p: 2, borderBottom: '1px solid #1e293b' }}>
                    <Typography variant="subtitle1" sx={{ color: '#e2e8f0', fontWeight: 600 }}>Active Threat Log</Typography>
                  </Box>
                  <TableContainer sx={{ flexGrow: 1, '&::-webkit-scrollbar': { width: '8px' }, '&::-webkit-scrollbar-thumb': { bgcolor: '#334155', borderRadius: '4px' } }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ bgcolor: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>Signature</TableCell>
                          <TableCell sx={{ bgcolor: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>Source IP</TableCell>
                          <TableCell sx={{ bgcolor: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>Target IP</TableCell>
                          <TableCell sx={{ bgcolor: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>AI Response Plan</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {threatDetails.map((threat, index) => (
                          <TableRow key={index} hover sx={{ '&:last-child td, &:last-child th': { border: 0 }, '&:hover': { bgcolor: '#1e293b' } }}>
                            <TableCell sx={{ borderBottom: '1px solid #1e293b' }}>
                                <Chip label={threat.attack_type} sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 600, borderRadius: '4px' }} size="small" />
                            </TableCell>
                            <TableCell sx={{ borderBottom: '1px solid #1e293b', fontFamily: 'monospace', color: '#cbd5e1' }}>{threat.source_ip}</TableCell>
                            <TableCell sx={{ borderBottom: '1px solid #1e293b', fontFamily: 'monospace', color: '#cbd5e1' }}>{threat.target_ip}</TableCell>
                            <TableCell sx={{ borderBottom: '1px solid #1e293b', color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.5 }}>{threat.ai_insight}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Card>
              </Grid>

              {/*Top Attackers*/}
              <Grid item xs={12} lg={4}>
                <Card sx={{ height: 400, bgcolor: '#0b1426', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ p: 2, borderBottom: '1px solid #1e293b' }}>
                     <Typography variant="subtitle1" sx={{ color: '#e2e8f0', fontWeight: 600 }}>Top Hostile Sources</Typography>
                  </Box>
                  <Box sx={{ flexGrow: 1, p: 2 }}>
                    {topAttackers.length > 0 ? (
                        <TopAttackers attackersData={topAttackers} />
                    ) : (
                        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography sx={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', px: 2 }}>
                                Insufficient IP data.<br/>Upload a PCAP to track active threat actors.
                            </Typography>
                        </Box>
                    )}
                  </Box>
                </Card>
              </Grid>

            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
}

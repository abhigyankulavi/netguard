import React, { useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Box, Typography } from '@mui/material';
import { Public } from '@mui/icons-material';

export default function AttackGraph({ graphData }) {
  const graphRef = useRef();

  useEffect(() => {
    if (graphData.nodes.length > 0 && graphRef.current) {
      setTimeout(() => graphRef.current.zoomToFit(400, 50), 800);
    }
  }, [graphData]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid #1A2C42', display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#0b162c' }}>
        <Public fontSize="small" color="primary"/> 
        <Typography variant="subtitle1" fontWeight="bold">Live Vector Topology</Typography>
      </Box>
      <Box sx={{ flexGrow: 1, bgcolor: '#02060D', position: 'relative', overflow: 'hidden' }}>
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeRelSize={6}
          linkColor={(link) => link.color}
          linkWidth={2}
          linkDirectionalArrowLength={5}
          linkDirectionalArrowRelPos={1}

          linkCanvasObjectMode={() => 'after'}
          linkCanvasObject={(link, ctx) => {
            const MAX_FONT_SIZE = 4;
            const LABEL = link.name; 
            if (!LABEL) return;

            const start = link.source;
            const end = link.target;

            if (typeof start !== 'object' || typeof end !== 'object') return;

            const textPos = Object.assign(...['x', 'y'].map(c => ({
              [c]: start[c] + (end[c] - start[c]) / 2 
            })));

            const relLink = { x: end.x - start.x, y: end.y - start.y };
            let textAngle = Math.atan2(relLink.y, relLink.x);
            if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) textAngle += Math.PI;

            ctx.font = `${MAX_FONT_SIZE}px Inter`;
            ctx.fillStyle = '#cfd8dc';
            
            ctx.save();
            ctx.translate(textPos.x, textPos.y);
            ctx.rotate(textAngle);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(LABEL, 0, -3); 
            ctx.restore();
          }}
          
          nodeLabel={(node) => `IP: ${node.id}`}
          width={800} 
          height={400}
        />
      </Box>
    </Box>
  );
}
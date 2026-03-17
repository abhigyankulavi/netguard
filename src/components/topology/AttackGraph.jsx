import React, { useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export default function AttackGraph({ graphData }) {
  const fgRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [hasZoomed, setHasZoomed] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        if (width > 10 && height > 10) {
          setDimensions({ width, height });
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    setHasZoomed(false);
  }, [graphData]);

  const handleEngineStop = useCallback(() => {
    if (fgRef.current && !hasZoomed) {
      fgRef.current.zoomToFit(600, 50);
      setHasZoomed(true);
    }
  }, [hasZoomed]);

  if (!graphData || graphData.nodes.length === 0) return null;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex' }}>
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeRelSize={4}
        
        // Physics Engine Controls
        d3VelocityDecay={0.1} 
        cooldownTicks={100}  
        onEngineStop={handleEngineStop} 
        
        // Rendering for Nodes
        nodeCanvasObject={(node, ctx, globalScale) => {
          const size = Math.min(16, Math.max(6, Math.sqrt(node.val || 1) * 2));
          
          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
          ctx.fillStyle = node.color;
          ctx.fill();

          const label = node.label;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#e2e8f0'; 
          ctx.fillText(label, node.x, node.y + size + 2);
        }}
        
        // Link rendering
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkColor={link => link.color}
        linkCanvasObjectMode={() => 'after'}
        linkCanvasObject={(link, ctx) => {
          const start = link.source;
          const end = link.target;
          if (typeof start !== 'object' || typeof end !== 'object') return;

          const textPos = {
            x: start.x + (end.x - start.x) / 2,
            y: start.y + (end.y - start.y) / 2 
          };

          const relLink = { x: end.x - start.x, y: end.y - start.y };
          let textAngle = Math.atan2(relLink.y, relLink.x);
          if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
          if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);

          const label = link.name;
          ctx.font = `3px Sans-Serif`; 
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, 4].map(n => n + 0.5); 

          ctx.save();
          ctx.translate(textPos.x, textPos.y);
          ctx.rotate(textAngle);

          ctx.fillStyle = 'rgba(11, 20, 38, 0.85)';
          ctx.fillRect(-bckgDimensions[0] / 2, -bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }}
      />
    </div>
  );
}

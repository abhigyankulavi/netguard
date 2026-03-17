import React, { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export default function AttackGraph({ graphData }) {
  const fgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef();

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        setDimensions({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height
        });
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      fgRef.current.d3Force('charge').strength(-400); // Spread nodes out
      fgRef.current.zoomToFit(400, 50); // Auto zoom to fit the graph
    }
  }, [graphData]);

  if (!graphData || graphData.nodes.length === 0) return null;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeRelSize={4}
        // Custom rendering for Nodes (IP Address Text + Scaled Circle)
        nodeCanvasObject={(node, ctx, globalScale) => {
          const size = Math.min(12, Math.max(4, Math.sqrt(node.val || 1) * 2));
          
          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
          ctx.fillStyle = node.color;
          ctx.fill();

          const label = node.label;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#e2e8f0'; // Clean white text for dark mode
          ctx.fillText(label, node.x, node.y + size + 2);
        }}
        // Link rendering (Attack Type tags on the line)
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkColor={link => link.color}
        linkCanvasObjectMode={() => 'after'}
        linkCanvasObject={(link, ctx, globalScale) => {
          const MAX_FONT_SIZE = 4;
          const LABEL_NODE_MARGIN = 15;

          const start = link.source;
          const end = link.target;

          if (typeof start !== 'object' || typeof end !== 'object') return;

          const textPos = Object.assign(...['x', 'y'].map(c => ({
            [c]: start[c] + (end[c] - start[c]) / 2 
          })));

          const relLink = { x: end.x - start.x, y: end.y - start.y };
          const maxTextLength = Math.sqrt(Math.pow(relLink.x, 2) + Math.pow(relLink.y, 2)) - LABEL_NODE_MARGIN * 2;

          let textAngle = Math.atan2(relLink.y, relLink.x);
          if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
          if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);

          const label = link.name;
          ctx.font = `1px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, 1].map(n => n + 0.2); 

          ctx.save();
          ctx.translate(textPos.x, textPos.y);
          ctx.rotate(textAngle);

          ctx.fillStyle = 'rgba(11, 20, 38, 0.8)';
          ctx.fillRect(-bckgDimensions[0] / 2, -bckgDimensions[1] / 2, ...bckgDimensions);

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

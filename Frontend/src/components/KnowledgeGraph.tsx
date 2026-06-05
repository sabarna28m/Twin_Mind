import { useState } from 'react';

interface KNode { id: string; label: string; score: number; mastery: string; records: number; last_updated: string | null }
interface KEdge { source: string; target: string }
interface Props  { nodes: KNode[]; edges: KEdge[] }

const MASTERY_COLOR: Record<string, string> = {
  not_started: '#334155',
  weak:        '#ef4444',
  average:     '#f59e0b',
  strong:      '#10b981',
};
const MASTERY_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  weak:        'Weak',
  average:     'Average',
  strong:      'Strong',
};

export default function KnowledgeGraph({ nodes, edges }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const W = 520, H = 340, CX = W / 2, CY = H / 2;
  const R = Math.min(CX, CY) - 58;

  // Position nodes in a circle
  const posMap: Record<string, { x: number; y: number }> = {};
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
    posMap[n.id] = {
      x: CX + R * Math.cos(angle),
      y: CY + R * Math.sin(angle),
    };
  });

  // Node radius based on records count
  const nodeR = (n: KNode) => Math.max(18, Math.min(30, 18 + n.records * 1.5));

  const hoveredNode = nodes.find(n => n.id === hovered);

  return (
    <div style={kg.wrap}>
      {/* SVG graph */}
      <div style={{ position: 'relative' }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={kg.svg}>
          <defs>
            {/* Glow filter per mastery */}
            <filter id="glow-strong"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <filter id="glow-weak"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          {/* Edges */}
          {edges.map((e, i) => {
            const s = posMap[e.source], t = posMap[e.target];
            if (!s || !t) return null;
            const isActive = hovered && (e.source === hovered || e.target === hovered);
            return (
              <line key={i}
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={isActive ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.08)'}
                strokeWidth={isActive ? 1.5 : 1}
                strokeDasharray={isActive ? undefined : '4 4'}
                style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(n => {
            const pos = posMap[n.id];
            if (!pos) return null;
            const color  = MASTERY_COLOR[n.mastery];
            const r      = nodeR(n);
            const isHov  = hovered === n.id;
            const isConn = hovered && edges.some(e => (e.source === hovered && e.target === n.id) || (e.target === hovered && e.source === n.id));
            const opacity = hovered && !isHov && !isConn ? 0.35 : 1;

            return (
              <g key={n.id}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer', opacity, transition: 'opacity 0.2s' }}
              >
                {/* Outer ring */}
                <circle cx={pos.x} cy={pos.y} r={r + 5}
                  fill="none" stroke={color} strokeWidth={isHov ? 1.5 : 0.75}
                  opacity={isHov ? 0.6 : 0.25}
                  style={{ transition: 'r 0.2s, stroke-width 0.2s' }}
                />
                {/* Main circle */}
                <circle cx={pos.x} cy={pos.y} r={r}
                  fill={`${color}22`} stroke={color}
                  strokeWidth={isHov ? 2 : 1.5}
                  filter={isHov ? (n.mastery === 'strong' ? 'url(#glow-strong)' : 'url(#glow-weak)') : undefined}
                  style={{ transition: 'r 0.2s' }}
                />
                {/* Score text */}
                {n.mastery !== 'not_started' && (
                  <text x={pos.x} y={pos.y - 3} textAnchor="middle" fill={color}
                    fontSize="9" fontWeight="800" fontFamily="inherit">
                    {n.score.toFixed(0)}%
                  </text>
                )}
                {n.mastery === 'not_started' && (
                  <text x={pos.x} y={pos.y + 4} textAnchor="middle"
                    fill="rgba(148,163,184,0.4)" fontSize="8" fontFamily="inherit">?</text>
                )}
                {/* Label below */}
                <text x={pos.x} y={pos.y + r + 14} textAnchor="middle"
                  fill={isHov ? '#f1f5f9' : 'rgba(148,163,184,0.75)'}
                  fontSize="9" fontWeight={isHov ? 700 : 500} fontFamily="inherit"
                  style={{ transition: 'fill 0.2s' }}>
                  {n.label.length > 12 ? n.label.slice(0, 11) + '…' : n.label}
                </text>
              </g>
            );
          })}

          {/* Center label */}
          <text x={CX} y={CY - 8} textAnchor="middle"
            fill="rgba(148,163,184,0.25)" fontSize="10" fontFamily="inherit">
            Knowledge
          </text>
          <text x={CX} y={CY + 8} textAnchor="middle"
            fill="rgba(148,163,184,0.25)" fontSize="10" fontFamily="inherit">
            Graph
          </text>
        </svg>

        {/* Hover tooltip */}
        {hoveredNode && (
          <div style={kg.tooltip}>
            <p style={kg.tipLabel}>{hoveredNode.label}</p>
            <p style={{ ...kg.tipMastery, color: MASTERY_COLOR[hoveredNode.mastery] }}>
              {MASTERY_LABEL[hoveredNode.mastery]}
              {hoveredNode.mastery !== 'not_started' ? ` · ${hoveredNode.score.toFixed(0)}%` : ''}
            </p>
            <p style={kg.tipSub}>{hoveredNode.records} record{hoveredNode.records !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={kg.legend}>
        {Object.entries(MASTERY_COLOR).map(([key, color]) => (
          <div key={key} style={kg.legendItem}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}` }} />
            <span style={{ fontSize: '0.65rem', color: 'rgba(148,163,184,0.6)', fontWeight: 600 }}>{MASTERY_LABEL[key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const kg: Record<string, React.CSSProperties> = {
  wrap: { position: 'relative' },
  svg:  { display: 'block', width: '100%' },
  tooltip: {
    position: 'absolute', top: '12px', left: '12px',
    background: 'rgba(6,8,20,0.95)', border: '1px solid rgba(0,212,255,0.2)',
    borderRadius: '12px', padding: '0.65rem 0.85rem',
    backdropFilter: 'blur(16px)', pointerEvents: 'none',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
  },
  tipLabel:   { margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#f1f5f9' },
  tipMastery: { margin: '0.15rem 0 0', fontSize: '0.72rem', fontWeight: 700 },
  tipSub:     { margin: '0.1rem 0 0', fontSize: '0.65rem', color: 'rgba(148,163,184,0.5)' },
  legend: {
    display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' as const,
    padding: '0.5rem 0 0.25rem',
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: '0.35rem' },
};

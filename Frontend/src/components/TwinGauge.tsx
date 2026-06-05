import { useEffect, useState } from 'react';

interface Props {
  label: string;
  value: number;       // 0-100
  color: string;
  icon: string;
  unit?: string;
  inverse?: boolean;   // true = lower value is better (e.g. burnout)
  description?: string;
}

export default function TwinGauge({ label, value, color, icon, unit = '%', inverse = false, description }: Props) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const target = Math.max(0, Math.min(100, value));
    let frame = 0;
    const total = 50;
    const tick = () => {
      frame++;
      const p = 1 - Math.pow(1 - frame / total, 3);
      setAnimated(Math.round(p * target));
      if (frame < total) requestAnimationFrame(tick);
    };
    const id = setTimeout(() => requestAnimationFrame(tick), 100);
    return () => clearTimeout(id);
  }, [value]);

  const R = 36;
  const stroke = 7;
  const C = 2 * Math.PI * R;
  // Arc goes from -210° to +30° (240° sweep)
  const SWEEP = 240;
  const dashLen = (animated / 100) * (SWEEP / 360) * C;
  const dashGap = C - dashLen;

  // The arc starts at 150° (left-bottom), sweeps 240° clockwise to 30° (right-bottom)
  // We rotate the circle so the arc starts correctly
  const rotationDeg = 150 - 90; // 60° offset because SVG 0° is top (12 o'clock)

  // Status label from value
  const statusColor = inverse
    ? (value <= 30 ? '#10b981' : value <= 60 ? '#f59e0b' : '#ef4444')
    : (value >= 70 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444');
  const statusText = inverse
    ? (value <= 30 ? 'Low' : value <= 60 ? 'Medium' : 'High')
    : (value >= 70 ? 'Good' : value >= 40 ? 'Fair' : 'Low');

  return (
    <div style={g.wrap}>
      <div style={g.iconRow}>
        <span style={g.icon}>{icon}</span>
        <span style={g.label}>{label}</span>
      </div>

      {/* SVG arc gauge */}
      <div style={g.svgWrap}>
        <svg width="100" height="70" viewBox="0 0 100 70" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id={`g-${label.replace(/\s/g,'-')}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity="0.5" />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx="50" cy="50" r={R}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={stroke}
            strokeDasharray={`${(SWEEP / 360) * C} ${C}`}
            strokeLinecap="round"
            transform={`rotate(${rotationDeg} 50 50)`}
          />
          {/* Fill */}
          <circle
            cx="50" cy="50" r={R}
            fill="none"
            stroke={`url(#g-${label.replace(/\s/g,'-')})`}
            strokeWidth={stroke}
            strokeDasharray={`${dashLen} ${dashGap}`}
            strokeLinecap="round"
            transform={`rotate(${rotationDeg} 50 50)`}
            style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 4px ${color}99)` }}
          />
          {/* Value text */}
          <text x="50" y="50" textAnchor="middle" dominantBaseline="middle"
            fill={color} fontSize="13" fontWeight="800" fontFamily="inherit">
            {animated}
          </text>
          <text x="50" y="62" textAnchor="middle"
            fill="rgba(148,163,184,0.55)" fontSize="7" fontFamily="inherit">
            {unit}
          </text>
        </svg>
      </div>

      <div style={{ ...g.statusChip, background: `${statusColor}18`, color: statusColor, borderColor: `${statusColor}30` }}>
        {statusText}
      </div>

      {description && <p style={g.desc}>{description}</p>}
    </div>
  );
}

const g: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    gap: '0.4rem', padding: '1rem 0.75rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  iconRow: { display: 'flex', alignItems: 'center', gap: '0.3rem' },
  icon:    { fontSize: '0.9rem' },
  label:   { fontSize: '0.65rem', fontWeight: 700, color: 'rgba(148,163,184,0.65)', letterSpacing: '0.06em', textTransform: 'uppercase' as const, textAlign: 'center' as const },
  svgWrap: { margin: '-4px 0' },
  statusChip: {
    padding: '0.18rem 0.55rem', borderRadius: '99px',
    fontSize: '0.62rem', fontWeight: 700, border: '1px solid',
  },
  desc: {
    margin: 0, fontSize: '0.6rem', color: 'rgba(148,163,184,0.4)',
    textAlign: 'center' as const, lineHeight: 1.4,
  },
};

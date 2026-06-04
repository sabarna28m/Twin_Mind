import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface BurnoutEntry {
  burnout_score: number;
  risk_level: string;
  created_at: string;
}

function riskColor(risk: string) {
  if (risk === 'high')   return '#ef4444';
  if (risk === 'medium') return '#f59e0b';
  return '#10b981';
}
function riskEmoji(risk: string) {
  if (risk === 'high')   return '🔴';
  if (risk === 'medium') return '🟡';
  return '🟢';
}
function riskLabel(risk: string) {
  if (risk === 'high')   return 'High Risk';
  if (risk === 'medium') return 'Medium Risk';
  return 'Low Risk';
}

// Small circular SVG meter
function MiniMeter({ score, risk }: { score: number; risk: string }) {
  const R = 30;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - score / 100);
  const color = riskColor(risk);
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
      <circle
        cx="40" cy="40" r={R} fill="none"
        stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={offset}
        transform="rotate(-90 40 40)"
        style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.4s' }}
      />
      <text x="40" y="44" textAnchor="middle" fill={color} fontSize="14" fontWeight="800" fontFamily="inherit">
        {score}
      </text>
    </svg>
  );
}

export default function BurnoutWidget() {
  const [entry, setEntry] = useState<BurnoutEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/burnout/latest')
      .then(r => setEntry(r.data))
      .catch(() => setEntry(null))
      .finally(() => setLoading(false));
  }, []);

  const color = riskColor(entry?.risk_level ?? 'low');

  return (
    <div style={w.wrap}>
      {/* Decorative glow */}
      <div style={{ ...w.glow, background: `radial-gradient(circle, ${color}22 0%, transparent 70%)` }} />

      <div style={w.top}>
        <div>
          <div style={w.label}>Burnout Risk</div>
          {entry && (
            <div style={{ ...w.badge, background: `${color}22`, color, border: `1px solid ${color}44` }}>
              {riskEmoji(entry.risk_level)} {riskLabel(entry.risk_level)}
            </div>
          )}
        </div>
        {loading ? (
          <div style={w.spinnerWrap}>
            <div style={w.spinner} className="spin" />
          </div>
        ) : entry ? (
          <MiniMeter score={entry.burnout_score} risk={entry.risk_level} />
        ) : (
          <div style={w.noData}>—</div>
        )}
      </div>

      {entry ? (
        <p style={w.sub}>
          Updated {new Date(entry.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
        </p>
      ) : (
        <p style={w.sub}>No check-in yet</p>
      )}

      <Link to="/burnout" style={w.cta}>
        {entry ? 'View Details →' : 'Check Now →'}
      </Link>
    </div>
  );
}

const w: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative',
    background: 'var(--glass-bg, rgba(255,255,255,0.04))',
    backdropFilter: 'blur(24px)',
    border: '1px solid var(--glass-border, rgba(255,255,255,0.08))',
    borderRadius: '18px',
    padding: '1.25rem',
    overflow: 'hidden',
    boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
    height: '100%',
  },
  glow: {
    position: 'absolute', top: '-20%', right: '-20%',
    width: '160px', height: '160px', borderRadius: '50%',
    pointerEvents: 'none',
  },
  top: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '0.5rem',
  },
  label: {
    fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-h)',
    marginBottom: '0.4rem', letterSpacing: '0.02em',
  },
  badge: {
    display: 'inline-block', padding: '0.2rem 0.6rem',
    borderRadius: '99px', fontSize: '0.68rem', fontWeight: 700,
  },
  spinnerWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px' },
  spinner: { width: '24px', height: '24px', border: '2px solid rgba(99,102,241,0.2)', borderTop: '2px solid #818cf8', borderRadius: '50%' },
  noData: { width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: 'var(--text)', opacity: 0.3 },
  sub: { margin: '0 0 0.85rem', fontSize: '0.7rem', color: 'var(--text)', opacity: 0.5 },
  cta: {
    display: 'inline-block', fontSize: '0.78rem', fontWeight: 700,
    color: '#818cf8', textDecoration: 'none',
    padding: '0.35rem 0.85rem',
    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: '8px', transition: 'background 0.2s',
  },
};

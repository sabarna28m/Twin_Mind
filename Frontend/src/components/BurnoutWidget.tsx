import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp, Minus, Wind } from 'lucide-react';
import api from '../services/api';

interface BurnoutLatest {
  burnout_score: number;
  risk_level: string;
  created_at: string;
}

interface TrendPoint {
  date: string;
  burnout_score: number;
  risk_level: string;
}

function riskColor(risk: string): string {
  if (risk === 'high')   return '#ef4444';
  if (risk === 'medium') return '#f59e0b';
  return '#10b981';
}

function riskLabel(risk: string): string {
  if (risk === 'high')   return 'High Risk';
  if (risk === 'medium') return 'Medium Risk';
  return 'Low Risk';
}

function getTrendDirection(trend: TrendPoint[]): 'improving' | 'stable' | 'worsening' {
  if (trend.length < 2) return 'stable';
  const pts = trend.slice(-Math.min(trend.length, 3));
  const diff = pts[pts.length - 1].burnout_score - pts[0].burnout_score;
  if (diff <= -5) return 'improving';
  if (diff >= 5)  return 'worsening';
  return 'stable';
}

function ScoreMeter({ score, risk }: { score: number; risk: string }) {
  const R = 26, C = 2 * Math.PI * R, offset = C * (1 - score / 100);
  const color = riskColor(risk);
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" style={{ flexShrink: 0 }}>
      <circle cx="34" cy="34" r={R} fill="none" stroke="var(--border)" strokeWidth="7" />
      <circle cx="34" cy="34" r={R} fill="none" stroke={color} strokeWidth="7"
        strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
        transform="rotate(-90 34 34)"
        style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <text x="34" y="38" textAnchor="middle" fill={color} fontSize="13" fontWeight="800" fontFamily="inherit">
        {score}
      </text>
    </svg>
  );
}

function HoverTooltip({ active, payload }: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
}) {
  if (!active || !payload?.length) return null;
  const pt: TrendPoint & { label: string } = payload[0].payload;
  const color = riskColor(pt.risk_level);
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: `1px solid ${color}35`, borderRadius: '8px',
      padding: '8px 12px', boxShadow: 'var(--shadow, 0 4px 12px rgba(0,0,0,0.1))', fontSize: '0.75rem',
    }}>
      <p style={{ margin: 0, color: 'var(--text-m)' }}>{pt.label}</p>
      <p style={{ margin: '3px 0 0', fontWeight: 800, color, fontSize: '1rem' }}>
        {pt.burnout_score}
        <span style={{ fontWeight: 400, fontSize: '0.7rem', color: 'var(--text-m)' }}> / 100</span>
      </p>
      <p style={{ margin: '2px 0 0', fontWeight: 600, color }}>{riskLabel(pt.risk_level)}</p>
    </div>
  );
}

export default function BurnoutWidget() {
  const [entry, setEntry]     = useState<BurnoutLatest | null>(null);
  const [trend, setTrend]     = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/burnout/latest').catch(() => ({ data: null })),
      api.get('/burnout/trend?days=7').catch(() => ({ data: [] })),
    ]).then(([latestRes, trendRes]) => {
      setEntry(latestRes.data);
      setTrend(Array.isArray(trendRes.data) ? trendRes.data : []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '28px 0', justifyContent: 'center' }}>
        <div style={{ width: '18px', height: '18px', border: '2px solid var(--border)', borderTop: '2px solid #6366f1', borderRadius: '50%' }} className="spin" />
        <span style={{ fontSize: '0.78rem', color: 'var(--text-m)' }}>Loading…</span>
      </div>
    );
  }

  if (!entry) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 8px' }}>
        <Wind size={28} style={{ margin: '0 0 8px', color: 'var(--text-m)' }} />
        <p style={{ margin: '0 0 4px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-h)' }}>No Check-ins Yet</p>
        <p style={{ margin: '0 0 14px', fontSize: '0.75rem', color: 'var(--text-m)', lineHeight: 1.5 }}>
          Complete a burnout check-in to generate your mental health score and start tracking trends.
        </p>
        <Link to="/burnout" style={{
          display: 'inline-block', padding: '7px 16px',
          background: 'linear-gradient(135deg,#ef4444,#f59e0b)',
          color: '#fff', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none',
        }}>Take Check-in →</Link>
      </div>
    );
  }

  const color    = riskColor(entry.risk_level);
  const dir      = getTrendDirection(trend);
  const DirIcon  = dir === 'improving' ? TrendingDown : dir === 'worsening' ? TrendingUp : Minus;
  const dirColor = dir === 'improving' ? '#10b981' : dir === 'worsening' ? '#ef4444' : '#94a3b8';
  const dirText  = dir === 'improving' ? 'Improving' : dir === 'worsening' ? 'Worsening' : 'Stable';

  const chartData = trend.map(p => ({
    ...p,
    label: new Date(p.date + 'T00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' }),
  }));

  return (
    <div>
      {/* Current score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
        <ScoreMeter score={entry.burnout_score} risk={entry.risk_level} />
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '6px',
            padding: '3px 10px', borderRadius: '99px',
            background: `${color}12`, border: `1px solid ${color}30`, color,
            fontSize: '0.72rem', fontWeight: 700,
          }}>
            {riskLabel(entry.risk_level)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <DirIcon size={13} color={dirColor} />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: dirColor }}>{dirText}</span>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: '0.65rem', color: 'var(--text-m)' }}>
            Updated {new Date(entry.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* 7-day trend chart */}
      {chartData.length > 1 ? (
        <>
          <p style={{ margin: '0 0 6px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            7-Day Trend
          </p>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -30 }}>
              <defs>
                <linearGradient id="bwGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="40%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: 'var(--text-m)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<HoverTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
              <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Line
                type="monotone" dataKey="burnout_score"
                stroke="url(#bwGrad)" strokeWidth={2}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  return (
                    <circle key={payload.date} cx={cx} cy={cy} r={3}
                      fill={riskColor(payload.risk_level)} stroke="var(--bg-elevated)" strokeWidth={1.5} />
                  );
                }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--bg-elevated)' }}
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Risk zone legend */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
            {[
              { label: '0–39 Low', color: '#10b981' },
              { label: '40–69 Medium', color: '#f59e0b' },
              { label: '70+ High', color: '#ef4444' },
            ].map(z => (
              <span key={z.label} style={{
                padding: '2px 8px', borderRadius: '99px', fontSize: '0.62rem', fontWeight: 600,
                background: `${z.color}10`, color: z.color, border: `1px solid ${z.color}25`,
              }}>{z.label}</span>
            ))}
          </div>
        </>
      ) : (
        <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: 'var(--text-m)', lineHeight: 1.5 }}>
          Log more check-ins to see your 7-day trend.
        </p>
      )}

      <Link to="/burnout" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
        marginTop: '14px', padding: '9px', borderRadius: '10px',
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
        fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none',
      }}>Full Report →</Link>
    </div>
  );
}

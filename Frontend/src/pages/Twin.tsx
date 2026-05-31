import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface HistoryPoint { date: string; overall_score: number; }

interface TwinState {
  overall_score: number;
  consistency_score: number;
  wellness_score: number;
  academic_score: number;
  risk_level: 'low' | 'medium' | 'high';
  trend: 'improving' | 'declining' | 'stable';
  twin_age: number;
  data_points: number;
  strengths: string[];
  areas_to_improve: string[];
  history: HistoryPoint[];
}

const RISK_COLOR = { low: '#16a34a', medium: '#d97706', high: '#dc2626' };
const RISK_BG    = { low: 'rgba(34,197,94,0.12)', medium: 'rgba(217,119,6,0.12)', high: 'rgba(239,68,68,0.12)' };
const RISK_RING  = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' };
const TREND_ICON = { improving: '↑', declining: '↓', stable: '→' };
const TREND_COLOR = { improving: '#16a34a', declining: '#dc2626', stable: '#6b7280' };
const TREND_LABEL = { improving: 'Improving', declining: 'Declining', stable: 'Stable' };

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color }}>{Math.round(value)}</span>
      </div>
      <div style={{ height: '7px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${value}%`,
          background: color,
          borderRadius: '99px',
          transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  );
}

function SparkLine({ history }: { history: HistoryPoint[] }) {
  if (history.length < 2) return null;
  const W = 340, H = 80, pad = 8;
  const vals = history.map(h => h.overall_score);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
      <polyline
        points={pts}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {vals.map((v, i) => {
        const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
        const y = H - pad - ((v - min) / range) * (H - pad * 2);
        return (
          <circle key={i} cx={x} cy={y} r="4" fill="var(--accent)" />
        );
      })}
    </svg>
  );
}

export default function Twin() {
  const { user, token } = useAuth();
  const [twin, setTwin] = useState<TwinState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/twin', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setTwin(r.data))
      .catch(() => setError('Failed to load twin data.'))
      .finally(() => setLoading(false));
  }, [token]);

  const initials = user?.full_name
    ? user.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div style={s.shell}>
      {/* Navbar */}
      <header style={s.nav}>
        <span style={s.navLogo}>TwinMind</span>
        <div style={s.navRight}>
          <Link to="/" style={s.navLink}>← Dashboard</Link>
          <Link to="/checkin" style={s.navLink}>Log Check-in</Link>
        </div>
      </header>

      <main style={s.main}>
        <h1 style={s.pageTitle}>Your Digital Twin</h1>
        <p style={s.pageSub}>A living model of your academic self, built from your data.</p>

        {loading && <p style={{ color: 'var(--text)', textAlign: 'center', marginTop: '3rem' }}>Loading twin…</p>}
        {error && <p style={{ color: '#dc2626', textAlign: 'center', marginTop: '3rem' }}>{error}</p>}

        {twin && (
          <div style={s.grid}>
            {/* Avatar card */}
            <div style={s.avatarCard}>
              <div style={{ ...s.avatarRing, borderColor: RISK_RING[twin.risk_level] }}>
                <div style={s.avatar}>{initials}</div>
              </div>

              <h2 style={s.twinName}>{user?.full_name?.split(' ')[0]}'s Twin</h2>

              {/* Risk badge */}
              <div style={{
                ...s.riskBadge,
                color: RISK_COLOR[twin.risk_level],
                background: RISK_BG[twin.risk_level],
              }}>
                {twin.risk_level.toUpperCase()} RISK
              </div>

              {/* Trend */}
              <div style={{ ...s.trendRow, color: TREND_COLOR[twin.trend] }}>
                <span style={s.trendIcon}>{TREND_ICON[twin.trend]}</span>
                <span style={s.trendLabel}>{TREND_LABEL[twin.trend]}</span>
              </div>

              {/* Twin meta */}
              <div style={s.metaRow}>
                <div style={s.metaItem}>
                  <span style={s.metaValue}>{twin.twin_age}</span>
                  <span style={s.metaLabel}>days old</span>
                </div>
                <div style={s.metaDivider} />
                <div style={s.metaItem}>
                  <span style={s.metaValue}>{twin.data_points}</span>
                  <span style={s.metaLabel}>check-ins</span>
                </div>
              </div>

              {twin.data_points === 0 && (
                <Link to="/checkin" style={s.ctaBtn}>Log your first check-in →</Link>
              )}
            </div>

            {/* Scores card */}
            <div style={s.card}>
              <h3 style={s.cardTitle}>Twin Vitals</h3>
              <div style={{ marginBottom: '0.5rem' }}>
                <ScoreBar label="Overall Score" value={twin.overall_score} color="var(--accent)" />
                <ScoreBar label="Academic Performance" value={twin.academic_score} color="#3b82f6" />
                <ScoreBar label="Wellness" value={twin.wellness_score} color="#10b981" />
                <ScoreBar label="Consistency" value={twin.consistency_score} color="#8b5cf6" />
              </div>

              {/* Strengths & areas */}
              {twin.strengths.length > 0 && (
                <div style={s.tagSection}>
                  <p style={s.tagHeading}>Strengths</p>
                  <div style={s.tagRow}>
                    {twin.strengths.map(s2 => (
                      <span key={s2} style={{ ...s.tag, ...s.tagGreen }}>{s2}</span>
                    ))}
                  </div>
                </div>
              )}
              {twin.areas_to_improve.length > 0 && (
                <div style={s.tagSection}>
                  <p style={s.tagHeading}>Focus Areas</p>
                  <div style={s.tagRow}>
                    {twin.areas_to_improve.map(a => (
                      <span key={a} style={{ ...s.tag, ...s.tagAmber }}>{a}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Evolution card */}
            <div style={{ ...s.card, ...s.fullWidth }}>
              <h3 style={s.cardTitle}>Twin Evolution</h3>
              {twin.history.length < 2 ? (
                <p style={{ color: 'var(--text)', fontSize: '0.875rem' }}>
                  Log at least 2 check-ins to see your twin evolving over time.
                </p>
              ) : (
                <>
                  <SparkLine history={twin.history} />
                  <div style={s.historyDates}>
                    <span style={s.historyDate}>{twin.history[0].date}</span>
                    <span style={s.historyDate}>{twin.history[twin.history.length - 1].date}</span>
                  </div>
                  <div style={s.historyList}>
                    {[...twin.history].reverse().slice(0, 5).map(h => (
                      <div key={h.date} style={s.historyRow}>
                        <span style={s.historyDateLabel}>{h.date}</span>
                        <div style={s.historyBarWrap}>
                          <div style={{
                            ...s.historyBar,
                            width: `${h.overall_score}%`,
                            background: h.overall_score >= 70 ? '#22c55e' : h.overall_score >= 50 ? '#f59e0b' : '#ef4444',
                          }} />
                        </div>
                        <span style={s.historyScore}>{Math.round(h.overall_score)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100svh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 2rem',
    height: '60px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  navLogo: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: '-0.5px',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
  },
  navLink: {
    fontSize: '0.875rem',
    color: 'var(--text)',
    textDecoration: 'none',
    fontWeight: 500,
  },
  main: {
    flex: 1,
    padding: '2rem',
    maxWidth: '960px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  pageTitle: {
    margin: '0 0 0.25rem',
    fontSize: '1.75rem',
    fontWeight: 700,
    color: 'var(--text-h)',
  },
  pageSub: {
    margin: '0 0 2rem',
    color: 'var(--text)',
    fontSize: '0.95rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '240px 1fr',
    gap: '1.25rem',
    alignItems: 'start',
  },
  avatarCard: {
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '2rem 1.5rem',
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    textAlign: 'center',
  },
  avatarRing: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    border: '4px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 0 6px rgba(139,92,246,0.08)',
  },
  avatar: {
    width: '84px',
    height: '84px',
    borderRadius: '50%',
    background: 'var(--accent-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.75rem',
    fontWeight: 700,
    color: 'var(--accent)',
  },
  twinName: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-h)',
  },
  riskBadge: {
    padding: '0.3rem 0.8rem',
    borderRadius: '99px',
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.8px',
  },
  trendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.9rem',
    fontWeight: 600,
  },
  trendIcon: {
    fontSize: '1.1rem',
    fontWeight: 800,
  },
  trendLabel: {
    fontSize: '0.875rem',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginTop: '0.25rem',
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.1rem',
  },
  metaValue: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: 'var(--text-h)',
  },
  metaLabel: {
    fontSize: '0.72rem',
    color: 'var(--text)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  metaDivider: {
    width: '1px',
    height: '32px',
    background: 'var(--border)',
  },
  ctaBtn: {
    display: 'inline-block',
    marginTop: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '0.82rem',
    fontWeight: 600,
  },
  card: {
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '1.5rem',
    background: 'var(--bg)',
  },
  fullWidth: {
    gridColumn: '1 / -1',
  },
  cardTitle: {
    margin: '0 0 1.25rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-h)',
  },
  tagSection: {
    marginTop: '1rem',
  },
  tagHeading: {
    margin: '0 0 0.5rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.4rem',
  },
  tag: {
    padding: '0.25rem 0.6rem',
    borderRadius: '99px',
    fontSize: '0.78rem',
    fontWeight: 500,
  },
  tagGreen: {
    background: 'rgba(34,197,94,0.12)',
    color: '#16a34a',
  },
  tagAmber: {
    background: 'rgba(217,119,6,0.12)',
    color: '#d97706',
  },
  historyDates: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '0.25rem',
    marginBottom: '1.25rem',
  },
  historyDate: {
    fontSize: '0.75rem',
    color: 'var(--text)',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  historyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  historyDateLabel: {
    fontSize: '0.78rem',
    color: 'var(--text)',
    width: '90px',
    flexShrink: 0,
  },
  historyBarWrap: {
    flex: 1,
    height: '8px',
    background: 'var(--border)',
    borderRadius: '99px',
    overflow: 'hidden',
  },
  historyBar: {
    height: '100%',
    borderRadius: '99px',
    transition: 'width 0.6s ease',
  },
  historyScore: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--text-h)',
    width: '28px',
    textAlign: 'right' as const,
  },
};

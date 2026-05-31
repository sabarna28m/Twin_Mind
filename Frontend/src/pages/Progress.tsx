import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveBadge from '../components/LiveBadge';

interface SubjectStat { subject: string; count: number; total_minutes: number; }
interface DayActivity  { date: string; sessions: number; minutes: number; }
interface Analytics {
  total_sessions: number;
  completed_sessions: number;
  active_sessions: number;
  total_study_minutes: number;
  total_notes: number;
  total_materials: number;
  subjects: SubjectStat[];
  activity_last_14_days: DayActivity[];
}

function formatHours(mins: number) {
  if (!mins) return '0h';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
}

function shortDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Progress() {
  const { user, token } = useAuth();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(() => {
    api.get<Analytics>('/analytics', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setData(r.data))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    api.get<Analytics>('/analytics', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  const wsConnected = useWebSocket(user?.id, token, refreshData);

  const completionRate = data && data.total_sessions > 0
    ? Math.round((data.completed_sessions / data.total_sessions) * 100)
    : 0;

  const maxDaySessions = data
    ? Math.max(...data.activity_last_14_days.map(d => d.sessions), 1)
    : 1;

  const maxSubjectCount = data && data.subjects.length > 0
    ? data.subjects[0].count
    : 1;

  return (
    <div style={s.shell}>
      <header style={s.nav}>
        <div style={s.navLeft}>
          <Link to="/" style={s.navLogo}>TwinMind</Link>
          {wsConnected && <LiveBadge />}
        </div>
        <Link to="/" style={s.backLink}>← Dashboard</Link>
      </header>

      <main style={s.main}>
        <h1 style={s.pageTitle}>Progress</h1>

        {loading ? (
          <p style={s.loading}>Loading…</p>
        ) : !data ? (
          <p style={s.loading}>Failed to load analytics.</p>
        ) : (
          <>
            {/* Summary cards */}
            <section style={s.statsGrid}>
              {[
                { label: 'Total Sessions',    value: data.total_sessions,    icon: '📚' },
                { label: 'Study Time',        value: formatHours(data.total_study_minutes), icon: '⏱' },
                { label: 'Notes',             value: data.total_notes,       icon: '📝' },
                { label: 'Materials',         value: data.total_materials,   icon: '📎' },
              ].map(c => (
                <div key={c.label} style={s.statCard}>
                  <span style={s.statIcon}>{c.icon}</span>
                  <p style={s.statValue}>{c.value}</p>
                  <p style={s.statLabel}>{c.label}</p>
                </div>
              ))}
            </section>

            <div style={s.cols}>
              {/* Session completion */}
              <section style={s.panel}>
                <h2 style={s.panelTitle}>Session Status</h2>
                <div style={s.donutWrap}>
                  <svg viewBox="0 0 36 36" style={s.donut}>
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3.2" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke="var(--accent)" strokeWidth="3.2"
                      strokeDasharray={`${completionRate} ${100 - completionRate}`}
                      strokeDashoffset="25"
                      strokeLinecap="round"
                    />
                    <text x="18" y="20.5" textAnchor="middle" style={{ fontSize: '8px', fill: 'var(--text-h)', fontWeight: 700 }}>
                      {completionRate}%
                    </text>
                  </svg>
                </div>
                <div style={s.legendList}>
                  <div style={s.legendItem}>
                    <span style={{ ...s.legendDot, background: 'var(--accent)' }} />
                    <span style={s.legendLabel}>Completed</span>
                    <span style={s.legendVal}>{data.completed_sessions}</span>
                  </div>
                  <div style={s.legendItem}>
                    <span style={{ ...s.legendDot, background: 'var(--border)' }} />
                    <span style={s.legendLabel}>Active</span>
                    <span style={s.legendVal}>{data.active_sessions}</span>
                  </div>
                </div>
              </section>

              {/* Subject breakdown */}
              <section style={s.panel}>
                <h2 style={s.panelTitle}>Subjects</h2>
                {data.subjects.length === 0 ? (
                  <p style={s.emptyHint}>No sessions with subjects yet.</p>
                ) : (
                  <div style={s.barList}>
                    {data.subjects.slice(0, 6).map(sub => (
                      <div key={sub.subject} style={s.barRow}>
                        <span style={s.barLabel}>{sub.subject}</span>
                        <div style={s.barTrack}>
                          <div style={{ ...s.barFill, width: `${Math.round((sub.count / maxSubjectCount) * 100)}%` }} />
                        </div>
                        <span style={s.barCount}>{sub.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* 14-day activity chart */}
            <section style={s.panel}>
              <h2 style={s.panelTitle}>Activity — last 14 days</h2>
              {data.activity_last_14_days.every(d => d.sessions === 0) ? (
                <p style={s.emptyHint}>No sessions recorded yet. Start one to see activity here.</p>
              ) : (
                <div style={s.activityChart}>
                  {data.activity_last_14_days.map(day => (
                    <div key={day.date} style={s.dayCol}>
                      <div style={s.dayBarWrap}>
                        <div
                          title={`${day.sessions} session${day.sessions !== 1 ? 's' : ''}`}
                          style={{
                            ...s.dayBar,
                            height: `${Math.round((day.sessions / maxDaySessions) * 100)}%`,
                            background: day.sessions > 0 ? 'var(--accent)' : 'var(--border)',
                          }}
                        />
                      </div>
                      <span style={s.dayLabel}>{shortDate(day.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
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
  navLeft:  { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  navLogo: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px', textDecoration: 'none' },
  backLink: { fontSize: '0.875rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 },
  main: {
    flex: 1,
    padding: '2rem',
    maxWidth: '900px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    textAlign: 'left',
  },
  pageTitle: { margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-h)' },
  loading: { color: 'var(--text)', fontSize: '0.9rem', margin: 0 },

  // Summary cards
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  statCard: {
    padding: '1.25rem',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    textAlign: 'center',
    background: 'var(--bg)',
  },
  statIcon: { fontSize: '1.5rem' },
  statValue: { margin: '0.5rem 0 0.25rem', fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-h)' },
  statLabel: { margin: 0, fontSize: '0.78rem', color: 'var(--text)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },

  // Two-col
  cols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' },
  panel: { border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', background: 'var(--bg)', marginBottom: '1.5rem' },
  panelTitle: { margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-h)' },
  emptyHint: { margin: 0, color: 'var(--text)', fontSize: '0.875rem' },

  // Donut
  donutWrap: { display: 'flex', justifyContent: 'center', marginBottom: '1rem' },
  donut: { width: '100px', height: '100px' },
  legendList: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text)' },
  legendDot: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  legendLabel: { flex: 1 },
  legendVal: { fontWeight: 600, color: 'var(--text-h)' },

  // Subject bars
  barList: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  barRow: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  barLabel: { width: '80px', fontSize: '0.825rem', color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flexShrink: 0 },
  barTrack: { flex: 1, height: '8px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' },
  barFill: { height: '100%', background: 'var(--accent)', borderRadius: '99px', transition: 'width 0.4s' },
  barCount: { width: '24px', fontSize: '0.8rem', color: 'var(--text)', textAlign: 'right' as const, flexShrink: 0 },

  // Activity chart
  activityChart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '6px',
    height: '120px',
    paddingTop: '8px',
  },
  dayCol: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' },
  dayBarWrap: { flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' },
  dayBar: { width: '100%', borderRadius: '4px 4px 0 0', minHeight: '4px', transition: 'height 0.3s' },
  dayLabel: { fontSize: '0.6rem', color: 'var(--text)', marginTop: '4px', whiteSpace: 'nowrap' as const, transform: 'rotate(-45deg)', transformOrigin: 'top center', display: 'block', paddingTop: '4px' },
};

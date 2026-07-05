import type { Session } from '../../types/sessions';

interface Props { sessions: Session[]; }

function getLast7Days(sessions: Session[]) {
  const map = new Map<string, number>();
  sessions.forEach(s => {
    if (!s.created_at) return;
    const key = s.created_at.slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + (s.duration_minutes || 0));
  });
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      key,
      mins: map.get(key) ?? 0,
      label: d.toLocaleDateString('en', { weekday: 'narrow' }),
    };
  });
}

function getTopSubjects(sessions: Session[]) {
  const map = new Map<string, number>();
  sessions.forEach(s => {
    if (!s.subject) return;
    map.set(s.subject, (map.get(s.subject) ?? 0) + (s.duration_minutes || 0));
  });
  return Array.from(map.entries())
    .map(([subject, mins]) => ({ subject, mins }))
    .sort((a, b) => b.mins - a.mins)
    .slice(0, 5);
}

export default function SessionAnalytics({ sessions }: Props) {
  const days    = getLast7Days(sessions);
  const maxMins = Math.max(...days.map(d => d.mins), 60);
  const subjects = getTopSubjects(sessions);
  const maxSubMins = subjects.length > 0 ? Math.max(...subjects.map(s => s.mins)) : 1;

  const today    = new Date().toISOString().slice(0, 10);
  const todayMin = days.find(d => d.key === today)?.mins ?? 0;
  const totalMin = sessions.reduce((a, s) => a + (s.duration_minutes || 0), 0);
  const completed = sessions.filter(s => s.status === 'completed').length;

  return (
    <div style={s.wrap}>

      {/* Weekly chart */}
      <div style={s.panel} className="glass-card glass-lavender">
        <div style={s.panelHead}>
          <span style={s.panelTitle}>Weekly Focus Time</span>
          <span style={s.panelBadge}>Last 7 days</span>
        </div>
        <div style={s.chart}>
          {days.map(d => {
            const pct = maxMins > 0 ? (d.mins / maxMins) * 100 : 0;
            const isToday = d.key === today;
            return (
              <div key={d.key} style={s.bar}>
                <span style={s.barVal}>
                  {d.mins > 0 ? (d.mins >= 60 ? `${(d.mins / 60).toFixed(1)}h` : `${d.mins}m`) : ''}
                </span>
                <div style={{ ...s.barTrack }}>
                  <div style={{
                    ...s.barFill,
                    height: `${Math.max(pct, d.mins > 0 ? 4 : 0)}%`,
                    background: isToday
                      ? 'linear-gradient(180deg, #00D4FF, #7C3AED)'
                      : 'linear-gradient(180deg, rgba(0,212,255,0.55), rgba(124,58,237,0.4))',
                    boxShadow: isToday ? '0 0 12px rgba(0,212,255,0.4)' : 'none',
                  }} />
                </div>
                <span style={{ ...s.barLabel, color: isToday ? '#00D4FF' : 'var(--text)', fontWeight: isToday ? 700 : 500 }}>
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
        <div style={s.quickStats}>
          <div style={s.qStat}><span style={{ ...s.qVal, color: '#00D4FF' }}>{todayMin >= 60 ? `${(todayMin/60).toFixed(1)}h` : `${todayMin}m`}</span><span style={s.qLbl}>Today</span></div>
          <div style={s.qStat}><span style={{ ...s.qVal, color: '#10b981' }}>{totalMin >= 60 ? `${(totalMin/60).toFixed(1)}h` : `${totalMin}m`}</span><span style={s.qLbl}>Total</span></div>
          <div style={s.qStat}><span style={{ ...s.qVal, color: '#a78bfa' }}>{completed}</span><span style={s.qLbl}>Sessions</span></div>
        </div>
      </div>

      {/* Top subjects */}
      {subjects.length > 0 && (
        <div style={s.panel} className="glass-card glass-lavender">
          <div style={s.panelHead}>
            <span style={s.panelTitle}>Top Subjects</span>
            <span style={s.panelBadge}>By time spent</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {subjects.map((sub, i) => {
              const pct = maxSubMins > 0 ? (sub.mins / maxSubMins) * 100 : 0;
              const colors = ['#00D4FF', '#7C3AED', '#10b981', '#f59e0b', '#ef4444'];
              const c = colors[i % colors.length];
              return (
                <div key={sub.subject} style={s.subRow}>
                  <span style={s.subName}>{sub.subject}</span>
                  <div style={s.subTrack}>
                    <div style={{ ...s.subFill, width: `${pct}%`, background: c, boxShadow: `0 0 8px ${c}55` }} />
                  </div>
                  <span style={{ ...s.subTime, color: c }}>
                    {sub.mins >= 60 ? `${(sub.mins/60).toFixed(1)}h` : `${sub.mins}m`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  panel: {
    padding: '1.25rem',
    
  },
  panelHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' },
  panelTitle:{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-h)', margin: 0 },
  panelBadge:{ fontSize: '0.68rem', fontWeight: 600, color: '#00D4FF', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '99px', padding: '0.15rem 0.6rem' },

  chart: { display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '100px', marginBottom: '0.75rem' },
  bar:   { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', height: '100%' },
  barVal:  { fontSize: '0.55rem', color: 'var(--text)', fontWeight: 600, minHeight: '14px', textAlign: 'center' },
  barTrack:{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', background: '#ffffff', borderRadius: '4px 4px 0 0', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: '4px 4px 0 0', transition: 'height 0.8s ease, box-shadow 0.4s ease', minHeight: 0 },
  barLabel:{ fontSize: '0.62rem', fontWeight: 500 },

  quickStats: { display: 'flex', gap: '1.5rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' },
  qStat: { display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'center' },
  qVal:  { fontSize: '1.1rem', fontWeight: 800 },
  qLbl:  { fontSize: '0.6rem', color: 'var(--text)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },

  subRow:   { display: 'flex', alignItems: 'center', gap: '0.65rem' },
  subName:  { width: '90px', flexShrink: 0, fontSize: '0.78rem', color: 'var(--text-h)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  subTrack: { flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' },
  subFill:  { height: '100%', borderRadius: '99px', transition: 'width 0.8s ease' },
  subTime:  { width: '38px', textAlign: 'right', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 },
};

import type { ReactNode } from 'react';
import { Clock, CheckCircle, BarChart2, Flame, Trophy, Target } from 'lucide-react';
import type { Session } from '../../types/sessions';

interface Props { sessions: Session[]; }

function computeStreak(sessions: Session[]): number {
  const days = new Set(
    sessions
      .filter(s => s.status === 'completed' && s.created_at)
      .map(s => s.created_at!.slice(0, 10))
  );
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (days.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function computeLongestStreak(sessions: Session[]): number {
  const days = Array.from(
    new Set(
      sessions
        .filter(s => s.status === 'completed' && s.created_at)
        .map(s => s.created_at!.slice(0, 10))
    )
  ).sort();

  let longest = 0, current = 0;
  for (let i = 0; i < days.length; i++) {
    if (i === 0) { current = 1; continue; }
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86_400_000;
    current = diff === 1 ? current + 1 : 1;
    if (current > longest) longest = current;
  }
  return Math.max(longest, current > 0 ? current : 0);
}

export default function SessionStats({ sessions }: Props) {
  const completed  = sessions.filter(s => s.status === 'completed');
  const totalMins  = sessions.reduce((a, s) => a + (s.duration_minutes || 0), 0);
  const totalHours = (totalMins / 60).toFixed(1);
  const avgMins    = completed.length > 0 ? Math.round(totalMins / completed.length) : 0;
  const streak     = computeStreak(sessions);
  const longest    = computeLongestStreak(sessions);
  const compRate   = sessions.length > 0
    ? Math.round((completed.length / sessions.length) * 100)
    : 0;

  const stats: { icon: ReactNode; value: string; unit: string; label: string; color: string }[] = [
    { icon: <Clock size={18} />,       value: totalHours, unit: 'h', label: 'Total Hours',    color: '#00D4FF' },
    { icon: <CheckCircle size={18} />, value: String(completed.length), unit: '', label: 'Sessions Done', color: '#10b981' },
    { icon: <BarChart2 size={18} />,   value: avgMins > 0 ? `${avgMins}m` : '—', unit: '', label: 'Avg Duration', color: '#f59e0b' },
    { icon: <Flame size={18} />,       value: String(streak),  unit: 'd', label: 'Streak',     color: '#ef4444' },
    { icon: <Trophy size={18} />,      value: String(longest), unit: 'd', label: 'Best Streak', color: '#a78bfa' },
    { icon: <Target size={18} />,      value: `${compRate}%`, unit: '', label: 'Completion',   color: '#34d399' },
  ];

  return (
    <div style={s.wrap}>
      <p style={s.heading}>Your Stats</p>
      <div style={s.grid}>
        {stats.map(st => (
          <div key={st.label} style={s.cell} className="glass-panel">
            <span style={{ ...s.icon, display: 'flex', color: st.color }}>{st.icon}</span>
            <p style={{ ...s.val, color: st.color }}>{st.value}{st.unit}</p>
            <p style={s.lbl}>{st.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap:    { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  heading: { margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  grid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' },
  cell:    {
    padding: '0.85rem 0.65rem', borderRadius: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)', textAlign: 'center',
    background: 'rgba(10,16,32,0.75)', border: '1px solid #e2e8f0',
    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.18rem',
  },
  icon: { fontSize: '1.1rem', lineHeight: 1 },
  val:  { margin: 0, fontSize: '1.3rem', fontWeight: 800, lineHeight: 1.1 },
  lbl:  { margin: 0, fontSize: '0.6rem', color: '#475569', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' },
};

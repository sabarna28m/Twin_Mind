import type { ReactNode } from 'react';
import { Clock, CheckCircle, BarChart2, Flame, Trophy, Target } from 'lucide-react';
import type { Session } from '../../types/sessions';
import { useTheme } from '../../contexts/ThemeContext';

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
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
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

  const pastels = ['glass-cyan', 'glass-babyblue', 'glass-mint', 'glass-lavender', 'glass-peach', 'glass-amber'];
  const s = getStyles(isDark);

  return (
    <div style={s.wrap}>
      <p style={s.heading}>Your Stats</p>
      <div style={s.grid}>
        {stats.map((st, i) => (
          <div key={st.label} style={s.cell} className={`glass-card glass-hover ${pastels[i % pastels.length]}`}>
            <span style={{ ...s.icon, display: 'flex', color: st.color }}>{st.icon}</span>
            <p style={{ ...s.val, color: st.color }}>{st.value}{st.unit}</p>
            <p style={s.lbl}>{st.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function getStyles(isDark: boolean): Record<string, React.CSSProperties> {
  return {
  wrap:    { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  heading: { margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  grid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' },
  cell:    {
    padding: '0.85rem 0.65rem', borderRadius: '24px', boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(0, 212, 255, 0.08)', textAlign: 'center',
    background: isDark
      ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(124, 58, 237, 0.1) 100%), rgba(15, 23, 42, 0.65)'
      : 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(124, 58, 237, 0.15) 100%), rgba(255, 255, 255, 0.55)',
    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255, 255, 255, 0.5)',
    backdropFilter: 'blur(24px) saturate(150%)', WebkitBackdropFilter: 'blur(24px) saturate(150%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.18rem',
  },
  icon: { fontSize: '1.1rem', lineHeight: 1 },
  val:  { margin: 0, fontSize: '1.3rem', fontWeight: 800, lineHeight: 1.1 },
  lbl:  { margin: 0, fontSize: '0.6rem', color: isDark ? '#475569' : 'var(--text)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' },
  };
}

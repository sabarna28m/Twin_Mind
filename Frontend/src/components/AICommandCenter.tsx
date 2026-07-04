import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Brain, TrendingDown as TrendDown, Target, Flame, TrendingUp, Clock, Trophy } from 'lucide-react';
import api from '../services/api';

interface BurnoutEntry {
  burnout_score: number;
  risk_level: 'low' | 'medium' | 'high';
}
interface SubjectSummary {
  subject: string;
  avg_score: number;
  recommended_daily_minutes: number;
}
interface SubjectAnalysis {
  weakest: SubjectSummary | null;
  strongest: SubjectSummary | null;
  focus_today: SubjectSummary | null;
}

interface Props {
  brainReadiness: number;
  streak: number;
  level?: number;
}

function MetricCard({
  icon, label, value, sub, color, to,
}: {
  icon: ReactNode; label: string; value: string; sub: string; color: string; to: string;
}) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{ ...mc.card, borderColor: `${color}28` }} className="cmd-metric-card">
        <div style={{ ...mc.glow, background: `radial-gradient(circle,${color}18 0%,transparent 70%)` }} />
        <div style={{ ...mc.iconBox, background: `${color}15`, color }}>{icon}</div>
        <p style={mc.label}>{label}</p>
        <p style={{ ...mc.value, color }}>{value}</p>
        <p style={mc.sub}>{sub}</p>
      </div>
    </Link>
  );
}

const mc: Record<string, React.CSSProperties> = {
  card: {
    position: 'relative', overflow: 'hidden',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px', padding: '1.1rem 1rem',
    cursor: 'pointer',
    display: 'flex', flexDirection: 'column' as const, gap: '0.22rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  glow: {
    position: 'absolute', top: '-40%', right: '-30%',
    width: '130px', height: '130px', borderRadius: '50%',
    pointerEvents: 'none',
  },
  iconBox: {
    width: '36px', height: '36px', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1rem', marginBottom: '0.45rem', flexShrink: 0,
  },
  label: {
    margin: 0, fontSize: '0.57rem', fontWeight: 700,
    color: '#64748b', letterSpacing: '0.09em',
    textTransform: 'uppercase' as const,
  },
  value: {
    margin: 0, fontSize: '1.25rem', fontWeight: 900, lineHeight: 1.1,
  },
  sub: {
    margin: 0, fontSize: '0.65rem', color: '#94a3b8',
    lineHeight: 1.35,
  },
};

export default function AICommandCenter({ brainReadiness, streak, level = 1 }: Props) {
  const [burnout, setBurnout] = useState<BurnoutEntry | null>(null);
  const [subjects, setSubjects] = useState<SubjectAnalysis | null>(null);

  useEffect(() => {
    api.get('/burnout/latest').then(r => setBurnout(r.data)).catch(() => {});
    api.get('/subject-performance/analysis').then(r => setSubjects(r.data)).catch(() => {});
  }, []);

  const burnoutColor =
    burnout?.risk_level === 'high' ? '#ef4444' :
    burnout?.risk_level === 'medium' ? '#f59e0b' : '#10b981';
  const burnoutLabel =
    burnout?.risk_level === 'high' ? 'HIGH' :
    burnout?.risk_level === 'medium' ? 'MEDIUM' :
    burnout ? 'LOW' : 'N/A';
  const readinessColor =
    brainReadiness >= 70 ? '#10b981' :
    brainReadiness >= 45 ? '#f59e0b' :
    brainReadiness > 0   ? '#ef4444' : '#6366f1';

  const predictedBoost = subjects?.weakest
    ? Math.max(3, Math.round((80 - subjects.weakest.avg_score) * 0.3))
    : null;

  const mainMetrics = [
    {
      icon: <Brain size={18} />, label: 'Brain Readiness', to: '/checkin',
      value: brainReadiness > 0 ? `${brainReadiness}%` : '—',
      sub: brainReadiness >= 70 ? 'Thriving' : brainReadiness >= 45 ? 'Growing' : brainReadiness > 0 ? 'Needs Attention' : 'Log check-in',
      color: readinessColor,
    },
    {
      icon: <span style={{ width: 14, height: 14, borderRadius: '50%', display: 'inline-block', background: burnoutColor }} />,
      label: 'Burnout Risk', to: '/burnout',
      value: burnoutLabel,
      sub: burnout ? `Score: ${burnout.burnout_score}/100` : 'No data yet',
      color: burnoutColor,
    },
    {
      icon: <TrendDown size={18} />, label: 'Weakest Subject', to: '/subjects',
      value: subjects?.weakest?.subject ?? '—',
      sub: subjects?.weakest ? `${subjects.weakest.avg_score != null ? subjects.weakest.avg_score.toFixed(0) : '?'}% avg · needs focus` : 'Add subject data',
      color: '#ef4444',
    },
    {
      icon: <Target size={18} />, label: 'Focus Today', to: '/sessions',
      value: subjects?.focus_today?.subject ?? '—',
      sub: subjects?.focus_today ? `${subjects.focus_today.recommended_daily_minutes} min recommended` : 'Log a session',
      color: '#6366f1',
    },
  ];

  return (
    <div style={cc.wrap}>
      <div style={cc.orb1} />
      <div style={cc.orb2} />

      {/* Header */}
      <div style={cc.header}>
        <div style={cc.headerLeft}>
          <span style={cc.pulseDot} className="live-dot" />
          <span style={cc.aiTag}>TWINMIND AI</span>
          <span style={cc.sep}>·</span>
          <h2 style={cc.title}>AI Command Center</h2>
        </div>
        <div style={cc.liveChip}>
          <span style={cc.liveDot} className="live-dot" />
          <span style={cc.liveText}>LIVE AI</span>
        </div>
      </div>

      {/* 4 main metric cards */}
      <div style={cc.mainGrid} className="mob-cmd-grid">
        {mainMetrics.map((m, i) => (
          <MetricCard key={i} {...m} />
        ))}
      </div>

      {/* Secondary stats bar */}
      <div style={cc.statsBar} className="mob-cmd-statsbar">
        {[
          { icon: <Flame size={16} />,      label: 'Study Streak',  value: `${streak} days`,                            color: '#f59e0b', to: '/checkin'      },
          { icon: <TrendingUp size={16} />, label: 'AI Prediction',  value: predictedBoost ? `+${predictedBoost}% improvement` : 'Log data', color: '#10b981', to: '/predict' },
          { icon: <Clock size={16} />,      label: 'Recommended',   value: `${subjects?.focus_today?.recommended_daily_minutes ?? 45} min session`, color: '#00D4FF', to: '/sessions' },
          { icon: <Trophy size={16} />,     label: 'Level',          value: `Level ${level}`,                            color: '#a78bfa', to: '/achievements' },
        ].map((stat, i) => (
          <Link key={i} to={stat.to} style={{ textDecoration: 'none', flex: 1 }}>
            <div style={cc.statItem} className="cmd-stat-item">
              <span style={{ display: 'flex', alignItems: 'center', color: stat.color }}>{stat.icon}</span>
              <div>
                <p style={cc.statItemLabel}>{stat.label}</p>
                <p style={{ ...cc.statItemValue, color: stat.color }}>{stat.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const cc: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative', overflow: 'hidden',
    background: 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(226, 232, 240, 0.9)',
    borderRadius: '1.5rem',
    padding: '1.75rem',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
  },
  orb1: { display: 'none' },
  orb2: { display: 'none' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '1.25rem', position: 'relative', zIndex: 1,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '0.55rem' },
  pulseDot: {
    display: 'inline-block',
    width: '8px', height: '8px', borderRadius: '50%',
    background: '#00D4FF',
    flexShrink: 0,
  },
  aiTag: {
    fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.15em',
    color: '#6366f1', opacity: 0.85,
  },
  sep: { color: '#cbd5e1', fontSize: '0.9rem' },
  title: {
    margin: 0, fontSize: '1.05rem', fontWeight: 900,
    color: '#0f172a',
  },
  liveChip: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.22rem 0.75rem',
    background: 'rgba(16,185,129,0.1)',
    border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: '99px',
  },
  liveDot: {
    display: 'inline-block',
    width: '6px', height: '6px', borderRadius: '50%',
    background: '#10b981',
  },
  liveText: { fontSize: '0.6rem', fontWeight: 800, color: '#10b981', letterSpacing: '0.1em' },
  mainGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.85rem', marginBottom: '0.85rem',
    position: 'relative', zIndex: 1,
  },
  statsBar: {
    display: 'flex', gap: '0.5rem',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '14px', padding: '0.75rem 1rem',
    position: 'relative', zIndex: 1,
  },
  statItem: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.3rem 0.5rem', borderRadius: '10px', cursor: 'pointer',
  },
  statItemLabel: {
    margin: 0, fontSize: '0.6rem',
    color: '#64748b', fontWeight: 600, letterSpacing: '0.04em',
  },
  statItemValue: {
    margin: 0, fontSize: '0.8rem', fontWeight: 700,
  },
};

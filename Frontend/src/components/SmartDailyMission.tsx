import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface SubjectSummary { subject: string; recommended_daily_minutes: number }
interface SubjectAnalysis {
  weakest: SubjectSummary | null;
  focus_today: SubjectSummary | null;
}

const TODAY_KEY = () => `daily-mission-${new Date().toISOString().slice(0, 10)}`;

export default function SmartDailyMission() {
  const [subjects, setSubjects] = useState<SubjectAnalysis | null>(null);
  const [checked, setChecked]   = useState<[boolean, boolean, boolean]>([false, false, false]);

  useEffect(() => {
    api.get('/subject-performance/analysis').then(r => setSubjects(r.data)).catch(() => {});
    try {
      const saved = localStorage.getItem(TODAY_KEY());
      if (saved) setChecked(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const focusSub     = subjects?.focus_today?.subject ?? subjects?.weakest?.subject ?? 'your focus subject';
  const focusMinutes = subjects?.focus_today?.recommended_daily_minutes ?? 45;

  const missions = [
    { icon: '🧠', task: 'Complete 1 Practice Quiz',                              xp: 30, to: '/quiz'     },
    { icon: '📚', task: `Study ${focusSub} for ${focusMinutes} min`,             xp: 50, to: '/sessions' },
    { icon: '👁',  task: 'Run AI Focus Detector — keep score above 80%',          xp: 40, to: '/ai-focus' },
  ];

  function toggle(i: number) {
    setChecked(prev => {
      const next = [prev[0], prev[1], prev[2]] as [boolean, boolean, boolean];
      next[i] = !next[i];
      try { localStorage.setItem(TODAY_KEY(), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  const doneCount = checked.filter(Boolean).length;
  const earnedXP  = missions.reduce((s, m, i) => s + (checked[i] ? m.xp : 0), 0);
  const totalXP   = missions.reduce((s, m) => s + m.xp, 0);
  const allDone   = doneCount === missions.length;

  return (
    <div style={dm.wrap}>
      <div style={dm.orb} />

      {/* Header */}
      <div style={dm.header}>
        <div>
          <div style={dm.tagRow}>
            <span style={{ fontSize: '0.85rem' }}>⚡</span>
            <span style={dm.tag}>DAILY MISSION</span>
          </div>
          <p style={dm.title}>Today's AI Mission</p>
        </div>
        <div style={dm.xpCard}>
          <p style={dm.xpLabel}>XP Earned</p>
          <p style={dm.xpValue}>+{earnedXP} <span style={dm.xpTotal}>/ {totalXP}</span></p>
        </div>
      </div>

      {/* Progress */}
      <div style={dm.progTrack}>
        <div style={{
          ...dm.progFill,
          width: `${(doneCount / missions.length) * 100}%`,
        }} />
      </div>
      <p style={dm.progLabel}>{doneCount} / {missions.length} tasks complete</p>

      {/* Mission list */}
      <div style={dm.list}>
        {missions.map((m, i) => (
          <div key={i} style={{ ...dm.item, opacity: checked[i] ? 0.65 : 1 }}>
            <button
              onClick={() => toggle(i)}
              style={{
                ...dm.checkbox,
                background: checked[i] ? 'rgba(245,158,11,0.25)' : 'transparent',
                borderColor: checked[i] ? '#f59e0b' : 'rgba(245,158,11,0.35)',
                color: checked[i] ? '#fbbf24' : 'transparent',
              }}
              aria-label={`Toggle ${m.task}`}
            >
              ✓
            </button>
            <Link to={m.to} style={{ textDecoration: 'none', flex: 1 }}>
              <p style={{
                ...dm.missionText,
                textDecoration: checked[i] ? 'line-through' : 'none',
                opacity: checked[i] ? 0.7 : 1,
              }}>
                {m.icon} {m.task}
              </p>
            </Link>
            <span style={dm.xpPill}>+{m.xp} XP</span>
          </div>
        ))}
      </div>

      {/* All done banner */}
      {allDone && (
        <div style={dm.doneBanner}>
          🎉 All missions complete! <strong>+{totalXP} XP earned today</strong>
        </div>
      )}
    </div>
  );
}

const dm: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative', overflow: 'hidden',
    background: 'linear-gradient(135deg, rgba(4,12,24,0.97) 0%, rgba(10,6,22,0.97) 100%)',
    border: '1px solid rgba(245,158,11,0.22)',
    borderRadius: '20px', padding: '1.5rem',
    display: 'flex', flexDirection: 'column' as const, gap: '0.85rem',
    boxShadow: '0 4px 40px rgba(245,158,11,0.07)',
  },
  orb: {
    position: 'absolute', width: '230px', height: '230px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 70%)',
    top: '-80px', right: '-60px', pointerEvents: 'none',
    animation: 'orb-drift-1 16s ease-in-out infinite',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    position: 'relative', zIndex: 1,
  },
  tagRow: { display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' },
  tag: {
    fontSize: '0.57rem', fontWeight: 800, letterSpacing: '0.13em',
    color: '#f59e0b', opacity: 0.7,
  },
  title: {
    margin: 0, fontSize: '1rem', fontWeight: 900,
    background: 'linear-gradient(135deg, #fef3c7 0%, #fbbf24 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  xpCard: {
    padding: '0.5rem 0.75rem',
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.22)',
    borderRadius: '12px',
    textAlign: 'right' as const,
  },
  xpLabel: { margin: 0, fontSize: '0.57rem', color: 'rgba(148,163,184,0.5)', fontWeight: 600 },
  xpValue: { margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#fbbf24' },
  xpTotal: { fontSize: '0.72rem', fontWeight: 600, color: 'rgba(148,163,184,0.45)' },
  progTrack: {
    height: '4px', background: 'rgba(255,255,255,0.08)',
    borderRadius: '99px', overflow: 'hidden',
    position: 'relative', zIndex: 1,
  },
  progFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
    borderRadius: '99px', transition: 'width 0.5s ease',
    boxShadow: '0 0 10px rgba(245,158,11,0.5)',
  },
  progLabel: {
    margin: 0, fontSize: '0.63rem', color: 'rgba(148,163,184,0.4)',
    fontWeight: 600, position: 'relative', zIndex: 1,
  },
  list: {
    display: 'flex', flexDirection: 'column' as const, gap: '0.5rem',
    position: 'relative', zIndex: 1, flex: 1,
  },
  item: {
    display: 'flex', alignItems: 'center', gap: '0.7rem',
    padding: '0.65rem 0.75rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px', transition: 'opacity 0.3s',
  },
  checkbox: {
    width: '22px', height: '22px', borderRadius: '6px',
    border: '2px solid',
    cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.68rem', fontWeight: 800,
    transition: 'background 0.2s, border-color 0.2s',
    fontFamily: 'inherit',
  },
  missionText: {
    margin: 0, fontSize: '0.78rem', fontWeight: 600,
    color: 'rgba(226,232,240,0.85)', lineHeight: 1.3,
    transition: 'text-decoration 0.2s, opacity 0.2s',
  },
  xpPill: {
    padding: '0.18rem 0.5rem',
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.22)',
    borderRadius: '99px', fontSize: '0.63rem', fontWeight: 700,
    color: '#fbbf24', flexShrink: 0,
  },
  doneBanner: {
    padding: '0.65rem 0.9rem',
    background: 'rgba(16,185,129,0.1)',
    border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: '12px',
    fontSize: '0.8rem', color: '#34d399',
    textAlign: 'center' as const,
    position: 'relative', zIndex: 1,
    animation: 'fade-in 0.4s ease',
  },
};

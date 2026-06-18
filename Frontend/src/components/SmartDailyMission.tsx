import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  generateDailyMissions,
  CATEGORY_META,
  DIFFICULTY_META,
  type DailyMission,
  type UserContext,
} from '../services/missionGenerator';

const STORAGE_KEY = () => `missions-done-${new Date().toISOString().slice(0, 10)}`;

export default function SmartDailyMission() {
  const [ctx,     setCtx]     = useState<UserContext>({});
  const [done,    setDone]    = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [showBonus, setShowBonus] = useState(false);

  useEffect(() => {
    /* Restore completion state for today */
    try {
      const saved = localStorage.getItem(STORAGE_KEY());
      if (saved) setDone(JSON.parse(saved));
    } catch { /* ignore */ }

    /* Fetch user context in parallel */
    let pending = 4;
    const done_ = () => { if (--pending === 0) setLoading(false); };

    api.get('/subject-performance/analysis')
      .then(r => {
        const d = r.data;
        setCtx(prev => ({
          ...prev,
          subject:          d.focus_today?.subject ?? d.weakest?.subject,
          subjectMinutes:   d.focus_today?.recommended_daily_minutes ?? d.weakest?.recommended_daily_minutes,
          weakSubjectScore: d.weakest?.avg_score,
        }));
      })
      .catch(() => {})
      .finally(done_);

    api.get('/burnout/latest')
      .then(r => setCtx(prev => ({ ...prev, burnoutRisk: r.data?.risk_level })))
      .catch(() => {})
      .finally(done_);

    api.get('/sessions')
      .then(r => {
        const count = Array.isArray(r.data) ? r.data.length : 0;
        setCtx(prev => ({ ...prev, sessionCount: count }));
      })
      .catch(() => {})
      .finally(done_);

    api.get('/quiz/history')
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : [];
        const scores = list
          .map((q: Record<string, unknown>) => {
            const raw = q.score ?? q.percentage ?? q.quiz_score;
            return typeof raw === 'number' ? raw : null;
          })
          .filter((s): s is number => s !== null);
        if (scores.length) {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          setCtx(prev => ({ ...prev, quizAvgScore: Math.round(avg) }));
        }
      })
      .catch(() => {})
      .finally(done_);
  }, []);

  /* Generate missions (stable per day + context) */
  const missions  = generateDailyMissions(ctx);
  const primary   = missions.filter(m => !m.bonus);
  const bonus     = missions.find(m => m.bonus)!;

  /* Merge saved completion state */
  function live(m: DailyMission): DailyMission {
    return { ...m, completed: done[m.id] ?? false };
  }
  const livePrimary = primary.map(live);
  const liveBonus   = live(bonus);

  function toggle(id: string) {
    setDone(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(STORAGE_KEY(), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  const completedCount = livePrimary.filter(m => m.completed).length;
  const earnedXP       = [...livePrimary, liveBonus].filter(m => m.completed).reduce((s, m) => s + m.xpReward, 0);
  const totalPrimaryXP = livePrimary.reduce((s, m) => s + m.xpReward, 0);
  const allPrimaryDone = livePrimary.every(m => m.completed);

  return (
    <div style={dm.wrap}>
      <div style={dm.orb} />

      {/* ── Header ── */}
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
          <p style={dm.xpValue}>
            +{earnedXP} <span style={dm.xpTotal}>/ {totalPrimaryXP + liveBonus.xpReward}</span>
          </p>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div style={dm.progTrack}>
        <div style={{ ...dm.progFill, width: `${(completedCount / primary.length) * 100}%` }} />
      </div>
      <p style={dm.progLabel}>{completedCount} / {primary.length} primary missions complete</p>

      {/* ── Primary missions ── */}
      {loading ? (
        <div style={dm.list}>
          {[0, 1, 2].map(i => <div key={i} style={dm.skeleton} />)}
        </div>
      ) : (
        <div style={dm.list}>
          {livePrimary.map(m => (
            <MissionRow key={m.id} mission={m} onToggle={() => toggle(m.id)} />
          ))}
        </div>
      )}

      {/* ── Bonus mission ── */}
      {!loading && (
        <div style={dm.bonusSection}>
          <button
            onClick={() => setShowBonus(v => !v)}
            style={dm.bonusToggle}
          >
            <span style={{ fontSize: '0.8rem' }}>🎁</span>
            <span>Bonus Mission</span>
            <span style={dm.bonusXPPill}>+{liveBonus.xpReward} XP</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.5 }}>
              {showBonus ? '▲' : '▼'}
            </span>
          </button>
          {showBonus && (
            <div style={dm.bonusRow} className="animate-fade-in">
              <MissionRow mission={liveBonus} onToggle={() => toggle(liveBonus.id)} isBonus />
            </div>
          )}
        </div>
      )}

      {/* ── All done banner ── */}
      {allPrimaryDone && !loading && (
        <div style={dm.doneBanner} className="animate-fade-in">
          🎉 All missions complete! <strong>+{earnedXP} XP earned today</strong>
        </div>
      )}
    </div>
  );
}

/* ── Mission row sub-component ── */
function MissionRow({
  mission,
  onToggle,
  isBonus = false,
}: {
  mission: DailyMission;
  onToggle: () => void;
  isBonus?: boolean;
}) {
  const cat  = CATEGORY_META[mission.category];
  const diff = DIFFICULTY_META[mission.difficulty];

  return (
    <div style={{ ...dm.item, opacity: mission.completed ? 0.6 : 1, borderColor: mission.completed ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.07)' }}>
      <button
        onClick={onToggle}
        style={{
          ...dm.checkbox,
          background:   mission.completed ? 'rgba(245,158,11,0.22)' : 'transparent',
          borderColor:  mission.completed ? '#f59e0b' : 'rgba(245,158,11,0.35)',
          color:        mission.completed ? '#fbbf24' : 'transparent',
        }}
        aria-label={`Toggle: ${mission.title}`}
      >
        ✓
      </button>

      <Link to={mission.route} style={{ textDecoration: 'none', flex: 1, minWidth: 0 }}>
        <p style={{ ...dm.missionTitle, textDecoration: mission.completed ? 'line-through' : 'none' }}>
          {mission.icon} {mission.title}
        </p>
        <p style={dm.missionDesc}>{mission.description}</p>
        <div style={dm.metaRow}>
          <span style={{ ...dm.catBadge, color: cat.color, borderColor: `${cat.color}30`, background: `${cat.color}12` }}>
            {cat.label}
          </span>
          {diff.icon && <span style={dm.diffBadge}>{diff.icon} {diff.label}</span>}
          {isBonus && <span style={dm.bonusBadge}>BONUS</span>}
          {mission.targetValue && (
            <span style={dm.targetChip}>🎯 Target: {mission.targetValue}{mission.category === 'quiz' && mission.title.includes('%') ? '%' : mission.category === 'study' ? 'min' : ''}</span>
          )}
        </div>
      </Link>

      <span style={dm.xpPill}>+{mission.xpReward} XP</span>
    </div>
  );
}

/* ── Styles ── */
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
  tag:    { fontSize: '0.57rem', fontWeight: 800, letterSpacing: '0.13em', color: '#f59e0b', opacity: 0.7 },
  title:  {
    margin: 0, fontSize: '1rem', fontWeight: 900,
    background: 'linear-gradient(135deg, #fef3c7 0%, #fbbf24 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  xpCard: {
    padding: '0.5rem 0.75rem',
    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.22)',
    borderRadius: '12px', textAlign: 'right' as const,
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
    height: '100%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
    borderRadius: '99px', transition: 'width 0.5s ease',
    boxShadow: '0 0 10px rgba(245,158,11,0.5)',
  },
  progLabel: {
    margin: 0, fontSize: '0.63rem', color: 'rgba(148,163,184,0.4)',
    fontWeight: 600, position: 'relative', zIndex: 1,
  },

  list: {
    display: 'flex', flexDirection: 'column' as const, gap: '0.5rem',
    position: 'relative', zIndex: 1,
  },
  skeleton: {
    height: '70px', borderRadius: '12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    animation: 'fade-in 1.2s ease infinite alternate',
  },
  item: {
    display: 'flex', alignItems: 'flex-start', gap: '0.7rem',
    padding: '0.7rem 0.75rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid',
    borderRadius: '12px', transition: 'opacity 0.3s, border-color 0.3s',
  },
  checkbox: {
    width: '22px', height: '22px', minWidth: '22px',
    borderRadius: '6px', border: '2px solid',
    cursor: 'pointer', flexShrink: 0, marginTop: '0.05rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.68rem', fontWeight: 800,
    transition: 'background 0.2s, border-color 0.2s',
    fontFamily: 'inherit',
  },
  missionTitle: {
    margin: '0 0 0.18rem', fontSize: '0.8rem', fontWeight: 700,
    color: 'rgba(226,232,240,0.9)', lineHeight: 1.35,
    transition: 'text-decoration 0.2s',
  },
  missionDesc: {
    margin: '0 0 0.35rem', fontSize: '0.68rem',
    color: 'rgba(148,163,184,0.5)', lineHeight: 1.45,
  },
  metaRow: { display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' as const },
  catBadge: {
    padding: '0.1rem 0.45rem', borderRadius: '99px',
    fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.05em',
    border: '1px solid', textTransform: 'uppercase' as const,
  },
  diffBadge: {
    padding: '0.1rem 0.4rem', borderRadius: '99px',
    fontSize: '0.6rem', fontWeight: 700, color: 'rgba(148,163,184,0.5)',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
  },
  bonusBadge: {
    padding: '0.1rem 0.4rem', borderRadius: '99px',
    fontSize: '0.58rem', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.06em',
    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
  },
  targetChip: {
    fontSize: '0.58rem', color: 'rgba(148,163,184,0.4)', fontWeight: 600,
  },
  xpPill: {
    padding: '0.18rem 0.5rem',
    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.22)',
    borderRadius: '99px', fontSize: '0.63rem', fontWeight: 700,
    color: '#fbbf24', flexShrink: 0, alignSelf: 'flex-start', marginTop: '0.05rem',
  },

  bonusSection: { position: 'relative', zIndex: 1 },
  bonusToggle: {
    display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
    padding: '0.5rem 0.75rem', borderRadius: '10px',
    background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
    cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '0.73rem', fontWeight: 700, color: 'rgba(251,191,36,0.7)',
    transition: 'background 0.18s',
  },
  bonusXPPill: {
    padding: '0.1rem 0.4rem', borderRadius: '99px',
    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.22)',
    fontSize: '0.6rem', fontWeight: 800, color: '#fbbf24',
  },
  bonusRow: { marginTop: '0.4rem' },

  doneBanner: {
    padding: '0.65rem 0.9rem',
    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: '12px', fontSize: '0.8rem', color: '#34d399',
    textAlign: 'center' as const, position: 'relative', zIndex: 1,
    animation: 'fade-in 0.4s ease',
  },
};

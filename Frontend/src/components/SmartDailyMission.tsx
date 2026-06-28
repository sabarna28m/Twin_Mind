import { useEffect, useRef, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  generateDailyMissions,
  evaluateMissionProgress,
  CATEGORY_META,
  DIFFICULTY_META,
  EMPTY_METRICS,
  type DailyMission,
  type EvaluatedMission,
  type MissionMetrics,
  type UserContext,
} from '../services/missionGenerator';

/* ─────────────────────────────────────────────────────────────────────────────
   Confetti burst — pure CSS, spawned once when all primary missions complete
   ─────────────────────────────────────────────────────────────────────────────*/
const CONFETTI_EMOJI = ['🎉', '⭐', '✨', '🎊', '💫', '🌟', '🔥', '🏆'];
const CONFETTI_ITEMS = Array.from({ length: 18 }, (_, i) => ({
  emoji:    CONFETTI_EMOJI[i % CONFETTI_EMOJI.length],
  left:     `${Math.round((i / 18) * 100 + (i % 3) * 2)}%`,
  delay:    `${(i * 0.07).toFixed(2)}s`,
  duration: `${(1.0 + (i % 4) * 0.2).toFixed(1)}s`,
}));

function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div style={cf.wrap} aria-hidden="true">
      {CONFETTI_ITEMS.map((c, i) => (
        <span
          key={i}
          className="mission-confetti-item"
          style={{ ...cf.item, left: c.left, animationDuration: c.duration, animationDelay: c.delay }}
        >
          {c.emoji}
        </span>
      ))}
    </div>
  );
}
const cf: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '110px',
    overflow: 'hidden', pointerEvents: 'none', zIndex: 20,
  },
  item: { position: 'absolute', top: '-10px', fontSize: '1rem', userSelect: 'none' },
};

/* ─────────────────────────────────────────────────────────────────────────────
   XP Toast — floats above the card on completion
   ─────────────────────────────────────────────────────────────────────────────*/
interface ToastItem { id: string; xp: number; key: number }

function XPToast({ toasts }: { toasts: ToastItem[] }) {
  if (!toasts.length) return null;
  return (
    <>
      {toasts.map(t => (
        <div key={t.key} className="xp-toast-anim" style={xp.wrap}>
          ⭐ +{t.xp} XP
        </div>
      ))}
    </>
  );
}
const xp: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'absolute', top: '0.75rem', left: '50%',
    transform: 'translateX(-50%)',
    padding: '0.3rem 0.9rem', borderRadius: '99px',
    background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
    color: '#1a0a00', fontSize: '0.8rem', fontWeight: 900,
    boxShadow: '0 4px 16px rgba(245,158,11,0.5)',
    zIndex: 30, whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   Mission Row — read-only progress display + CTA
   ─────────────────────────────────────────────────────────────────────────────*/
function MissionRow({
  mission,
  isJustCompleted,
  isBonus,
}: {
  mission:          EvaluatedMission;
  isJustCompleted:  boolean;
  isBonus?:         boolean;
}) {
  const cat  = CATEGORY_META[mission.category] ?? CATEGORY_META.study;
  const diff = DIFFICULTY_META[mission.difficulty];

  const pct = mission.targetValue > 0
    ? Math.min(100, Math.round((mission.currentProgress / mission.targetValue) * 100))
    : (mission.completed ? 100 : 0);

  const isBoolTarget = mission.trackingKey === 'checkin_today';

  return (
    <div
      className={isJustCompleted ? 'mission-just-completed' : undefined}
      style={{
        ...mr.item,
        borderColor: mission.completed
          ? 'rgba(16,185,129,0.35)'
          : 'rgba(255,255,255,0.07)',
        background: mission.completed
          ? 'rgba(16,185,129,0.06)'
          : 'rgba(255,255,255,0.03)',
        opacity: mission.completed ? 0.88 : 1,
      }}
    >
      {/* Status icon */}
      <div style={{
        ...mr.statusIcon,
        background: mission.completed
          ? 'rgba(16,185,129,0.2)'
          : `${cat.color}18`,
        border: `1.5px solid ${mission.completed ? 'rgba(16,185,129,0.5)' : cat.color + '35'}`,
        color: mission.completed ? '#34d399' : cat.color,
      }}>
        {mission.completed ? '✓' : mission.icon}
      </div>

      {/* Content */}
      <div style={mr.content}>
        <p style={{
          ...mr.title,
          textDecoration: mission.completed ? 'line-through' : 'none',
          color: mission.completed ? '#94a3b8' : '#0f172a',
        }}>
          {mission.title}
        </p>
        <p style={mr.desc}>{mission.description}</p>

        {/* Progress bar */}
        <div style={mr.barWrap}>
          <div style={mr.barTrack}>
            <div
              className={isJustCompleted ? 'prog-fill-complete' : undefined}
              style={{
                ...mr.barFill,
                width: `${pct}%`,
                background: mission.completed
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : `linear-gradient(90deg, ${cat.color}99, ${cat.color})`,
                boxShadow: mission.completed
                  ? '0 0 10px rgba(16,185,129,0.5)'
                  : `0 0 8px ${cat.color}44`,
              }}
            />
          </div>
          <span style={{ ...mr.barPct, color: mission.completed ? '#34d399' : cat.color }}>
            {pct}%
          </span>
        </div>

        {/* Progress text */}
        <p style={mr.progText}>
          {isBoolTarget
            ? (mission.completed ? '✓ Done' : 'Not logged yet')
            : `${mission.currentProgress} / ${mission.targetValue} ${mission.progressUnit}`}
        </p>

        {/* Meta row */}
        <div style={mr.metaRow}>
          <span style={{ ...mr.catBadge, color: cat.color, borderColor: `${cat.color}30`, background: `${cat.color}12` }}>
            {cat.label}
          </span>
          {diff.icon && <span style={mr.diffBadge}>{diff.icon} {diff.label}</span>}
          {isBonus && <span style={mr.bonusBadge}>BONUS</span>}
        </div>
      </div>

      {/* Right: XP + CTA */}
      <div style={mr.right}>
        <span style={mr.xpPill}>+{mission.xpReward} XP</span>
        {mission.completed ? (
          <div style={mr.doneChip}>✓ Done</div>
        ) : (
          <Link to={mission.actionRoute} style={mr.ctaBtn}>
            {mission.actionLabel} →
          </Link>
        )}
      </div>
    </div>
  );
}

const mr: Record<string, React.CSSProperties> = {
  item: {
    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
    padding: '0.8rem 0.85rem',
    background: '#ffffff',
    border: '1px solid', borderRadius: '13px',
    transition: 'border-color 0.35s, background 0.35s, opacity 0.35s',
  },
  statusIcon: {
    width: '34px', height: '34px', minWidth: '34px',
    borderRadius: '50%', border: '1.5px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.85rem', fontWeight: 800, flexShrink: 0, marginTop: '0.05rem',
    transition: 'background 0.3s, border-color 0.3s, color 0.3s',
  },
  content: { flex: 1, minWidth: 0 },
  title: {
    margin: '0 0 0.18rem', fontSize: '0.82rem', fontWeight: 700, lineHeight: 1.35,
    transition: 'color 0.3s, text-decoration 0.3s',
  },
  desc: { margin: '0 0 0.45rem', fontSize: '0.68rem', color: '#64748b', lineHeight: 1.45 },
  barWrap: { display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.22rem' },
  barTrack: {
    flex: 1, height: '4px', background: '#e2e8f0',
    borderRadius: '99px', overflow: 'hidden',
  },
  barFill: {
    height: '100%', borderRadius: '99px',
    transition: 'width 0.6s ease, background 0.4s ease',
  },
  barPct: { fontSize: '0.6rem', fontWeight: 800, flexShrink: 0, minWidth: '26px', textAlign: 'right' },
  progText: {
    margin: '0 0 0.4rem', fontSize: '0.62rem',
    color: '#94a3b8', fontWeight: 600,
  },
  metaRow: { display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' },
  catBadge: {
    padding: '0.1rem 0.4rem', borderRadius: '99px',
    fontSize: '0.58rem', fontWeight: 800, border: '1px solid', letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  diffBadge: {
    padding: '0.1rem 0.38rem', borderRadius: '99px',
    fontSize: '0.58rem', fontWeight: 700, color: 'rgba(148,163,184,0.5)',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
  },
  bonusBadge: {
    padding: '0.1rem 0.38rem', borderRadius: '99px',
    fontSize: '0.56rem', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.06em',
    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
  },
  right: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '0.4rem', flexShrink: 0, marginTop: '0.05rem',
  },
  xpPill: {
    padding: '0.16rem 0.45rem',
    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.22)',
    borderRadius: '99px', fontSize: '0.6rem', fontWeight: 700, color: '#fbbf24',
    whiteSpace: 'nowrap',
  },
  ctaBtn: {
    padding: '0.3rem 0.6rem',
    background: 'rgba(0,212,255,0.12)',
    border: '1px solid rgba(0,212,255,0.3)',
    borderRadius: '8px',
    fontSize: '0.64rem', fontWeight: 800, color: '#00D4FF',
    textDecoration: 'none', whiteSpace: 'nowrap',
    transition: 'background 0.18s',
  },
  doneChip: {
    padding: '0.3rem 0.6rem',
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.28)',
    borderRadius: '8px',
    fontSize: '0.64rem', fontWeight: 800, color: '#34d399',
    whiteSpace: 'nowrap',
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   Main Component
   ─────────────────────────────────────────────────────────────────────────────*/
export default function SmartDailyMission({ layout = 'vertical' }: { layout?: 'vertical' | 'horizontal' }) {
  const [ctx,     setCtx]     = useState<UserContext>({});
  const [metrics, setMetrics] = useState<MissionMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [showBonus, setShowBonus] = useState(false);
  const [toasts,  setToasts]  = useState<ToastItem[]>([]);
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);

  const prevCompleted = useRef<Set<string>>(new Set());
  const prevAllDone   = useRef(false);
  const toastKey      = useRef(0);

  /* ── Generate missions (stable per day) ── */
  const missions = useMemo(() => generateDailyMissions(ctx), [ctx]);
  const primary  = useMemo(() => missions.filter(m => !m.bonus), [missions]);
  const bonus    = useMemo(() => missions.find(m => m.bonus)!, [missions]);

  /* ── Evaluate progress against live metrics ── */
  const evaluated = useMemo(
    () => missions.map(m => evaluateMissionProgress(m, metrics)),
    [missions, metrics],
  );
  const evalPrimary = evaluated.filter(m => !m.bonus);
  const evalBonus   = evaluated.find(m => m.bonus)!;

  const completedCount  = evalPrimary.filter(m => m.completed).length;
  const allPrimaryDone  = evalPrimary.every(m => m.completed);
  const earnedXP        = evaluated.filter(m => m.completed).reduce((s, m) => s + m.xpReward, 0);
  const totalPrimaryXP  = evalPrimary.reduce((s, m) => s + m.xpReward, 0);

  /* ── Detect newly-completed missions and trigger animations ── */
  useEffect(() => {
    const nowCompleted = new Set(evaluated.filter(m => m.completed).map(m => m.id));
    const newlyDone    = [...nowCompleted].filter(id => !prevCompleted.current.has(id));

    if (newlyDone.length > 0) {
      setJustCompleted(new Set(newlyDone));
      setTimeout(() => setJustCompleted(new Set()), 1000);

      const newToasts: ToastItem[] = newlyDone.map(id => {
        const m = evaluated.find(e => e.id === id)!;
        return { id, xp: m.xpReward, key: ++toastKey.current };
      });
      setToasts(prev => [...prev, ...newToasts]);
      setTimeout(() => setToasts([]), 2200);
    }

    prevCompleted.current = nowCompleted;
  }, [evaluated]);

  /* ── Detect all-primary-done for confetti ── */
  useEffect(() => {
    if (allPrimaryDone && !prevAllDone.current) {
      setShowBonus(true);
      setShowConfetti(true);
      setConfettiKey(k => k + 1);
      setTimeout(() => setShowConfetti(false), 2200);
    }
    prevAllDone.current = allPrimaryDone;
  }, [allPrimaryDone]);

  /* ── Fetch mission metrics from backend ── */
  const fetchMetrics = () => {
    api.get<MissionMetrics>('/missions/progress')
      .then(r => setMetrics(r.data))
      .catch(() => { /* keep current metrics */ });
  };

  /* ── Fetch user context from backend ── */
  useEffect(() => {
    let pending = 4;
    const done = () => { if (--pending === 0) setLoading(false); };

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
      .finally(done);

    api.get('/burnout/latest')
      .then(r => setCtx(prev => ({ ...prev, burnoutRisk: r.data?.risk_level })))
      .catch(() => {})
      .finally(done);

    api.get('/sessions')
      .then(r => {
        const count = Array.isArray(r.data) ? r.data.length : 0;
        setCtx(prev => ({ ...prev, sessionCount: count }));
      })
      .catch(() => {})
      .finally(done);

    api.get('/quiz/history')
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : [];
        const pcts = list
          .map((q: Record<string, unknown>) => {
            if (typeof q.score === 'number' && typeof q.total === 'number' && q.total > 0)
              return Math.round((q.score / q.total) * 100);
            if (typeof q.percentage === 'number') return q.percentage;
            return null;
          })
          .filter((s): s is number => s !== null);
        if (pcts.length) {
          const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
          setCtx(prev => ({ ...prev, quizAvgScore: Math.round(avg) }));
        }
      })
      .catch(() => {})
      .finally(done);

    /* ── Initial metrics fetch + polling + focus refresh ── */
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60_000);
    const onFocus  = () => fetchMetrics();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return (
    <div style={dm.wrap}>
      <div style={dm.orb} />
      <ConfettiBurst key={confettiKey} active={showConfetti} />
      <div style={{ position: 'relative', zIndex: 30 }}>
        <XPToast toasts={toasts} />
      </div>

      {/* ── Header ── */}
      <div style={dm.header}>
        <div>
          <div style={dm.tagRow}>
            <span style={{ fontSize: '0.85rem' }}>⚡</span>
            <span style={dm.tag}>DAILY MISSION</span>
          </div>
          <p style={dm.title}>Today's Mission</p>
        </div>
        <div style={dm.xpCard}>
          <p style={dm.xpLabel}>XP Earned</p>
          <p style={dm.xpValue}>
            +{earnedXP}&thinsp;<span style={dm.xpTotal}>/ {totalPrimaryXP + bonus.xpReward}</span>
          </p>
        </div>
      </div>

      {/* ── Overall progress bar ── */}
      <div style={dm.progTrack}>
        <div style={{ ...dm.progFill, width: `${(completedCount / primary.length) * 100}%` }} />
      </div>
      <p style={dm.progLabel}>{completedCount} / {primary.length} missions complete · auto-tracked</p>

      {/* ── Auto-sync indicator ── */}
      <div style={dm.syncRow}>
        <span style={dm.syncDot} />
        <span style={dm.syncText}>Progress syncs with your platform activity</span>
      </div>

      {/* ── Primary missions ── */}
      {(() => {
        const listStyle: React.CSSProperties = layout === 'horizontal'
          ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.65rem', position: 'relative', zIndex: 1 }
          : dm.list;
        return loading ? (
          <div style={listStyle}>
            {[0, 1, 2].map(i => <div key={i} style={dm.skeleton} />)}
          </div>
        ) : (
          <div style={listStyle}>
            {evalPrimary.map(m => (
              <MissionRow
                key={m.id}
                mission={m}
                isJustCompleted={justCompleted.has(m.id)}
              />
            ))}
          </div>
        );
      })()}

      {/* ── Bonus mission — unlocks when all primary done ── */}
      {!loading && (
        <div style={dm.bonusSection}>
          <button
            onClick={() => setShowBonus(v => !v)}
            disabled={!allPrimaryDone && !showBonus}
            style={{
              ...dm.bonusToggle,
              opacity: allPrimaryDone ? 1 : 0.5,
              cursor: allPrimaryDone ? 'pointer' : 'not-allowed',
              borderColor: allPrimaryDone ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.12)',
            }}
          >
            <span style={{ fontSize: '0.8rem' }}>🎁</span>
            <span>Bonus Mission</span>
            {!allPrimaryDone && (
              <span style={dm.bonusLock}>🔒 Complete all primary missions first</span>
            )}
            <span style={dm.bonusXPPill}>+{bonus.xpReward} XP</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.5 }}>
              {showBonus ? '▲' : '▼'}
            </span>
          </button>
          {showBonus && allPrimaryDone && (
            <div style={{ marginTop: '0.4rem' }} className="mission-bonus-unlock">
              <MissionRow mission={evalBonus} isJustCompleted={justCompleted.has(evalBonus.id)} isBonus />
            </div>
          )}
        </div>
      )}

      {/* ── All-done banner ── */}
      {allPrimaryDone && !loading && (
        <div style={dm.doneBanner} className="animate-fade-in">
          🎉 All missions complete! <strong>+{earnedXP} XP earned today</strong>
          {evalBonus.completed && ' · Bonus unlocked!'}
        </div>
      )}
    </div>
  );
}

/* ── Styles ── */
const dm: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative', overflow: 'hidden',
    background: 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(226, 232, 240, 0.9)',
    borderRadius: '1.5rem', padding: '1.5rem',
    display: 'flex', flexDirection: 'column', gap: '0.85rem',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)',
  },
  orb: { display: 'none' },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    position: 'relative', zIndex: 1,
  },
  tagRow:  { display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' },
  tag:     { fontSize: '0.57rem', fontWeight: 800, letterSpacing: '0.13em', color: '#f59e0b', opacity: 0.9 },
  title:   {
    margin: 0, fontSize: '1rem', fontWeight: 900,
    color: '#0f172a',
  },
  xpCard: {
    padding: '0.5rem 0.75rem',
    background: '#fffbeb', border: '1px solid #fde68a',
    borderRadius: '12px', textAlign: 'right',
  },
  xpLabel: { margin: 0, fontSize: '0.57rem', color: '#d97706', fontWeight: 600 },
  xpValue: { margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#b45309' },
  xpTotal: { fontSize: '0.72rem', fontWeight: 600, color: '#d97706' },

  progTrack: {
    height: '4px', background: '#e2e8f0',
    borderRadius: '99px', overflow: 'hidden', position: 'relative', zIndex: 1,
  },
  progFill: {
    height: '100%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
    borderRadius: '99px', transition: 'width 0.6s ease',
  },
  progLabel: {
    margin: 0, fontSize: '0.62rem', color: '#64748b',
    fontWeight: 600, position: 'relative', zIndex: 1,
  },

  syncRow: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    position: 'relative', zIndex: 1,
  },
  syncDot: {
    width: '6px', height: '6px', borderRadius: '50%',
    background: '#10b981', flexShrink: 0,
    boxShadow: '0 0 6px rgba(16,185,129,0.7)',
    animation: 'breathe 2s ease-in-out infinite',
  },
  syncText: {
    fontSize: '0.6rem', color: 'rgba(16,185,129,0.55)', fontWeight: 600,
  },

  list: {
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    position: 'relative', zIndex: 1,
  },
  skeleton: {
    height: '100px', borderRadius: '13px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    animation: 'fade-in 1.2s ease infinite alternate',
  },

  bonusSection: { position: 'relative', zIndex: 1 },
  bonusToggle: {
    display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
    padding: '0.5rem 0.75rem', borderRadius: '10px',
    background: 'rgba(245,158,11,0.06)', border: '1px solid',
    fontFamily: 'inherit', fontSize: '0.73rem', fontWeight: 700,
    color: 'rgba(251,191,36,0.7)', transition: 'border-color 0.3s, opacity 0.3s',
  },
  bonusLock: {
    fontSize: '0.58rem', color: 'rgba(148,163,184,0.4)',
    background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.4rem', borderRadius: '6px',
  },
  bonusXPPill: {
    padding: '0.1rem 0.4rem', borderRadius: '99px',
    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.22)',
    fontSize: '0.6rem', fontWeight: 800, color: '#fbbf24',
  },

  doneBanner: {
    padding: '0.65rem 0.9rem',
    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: '12px', fontSize: '0.8rem', color: '#34d399',
    textAlign: 'center', position: 'relative', zIndex: 1,
    animation: 'fade-in 0.4s ease',
  },
};

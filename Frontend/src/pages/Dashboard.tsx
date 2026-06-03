import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import ThemeToggle from '../components/ThemeToggle';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NotificationBell from '../components/NotificationBell';
import PlanContent from '../components/PlanContent';
import TutorialOverlay from '../components/TutorialOverlay';
import api from '../services/api';
import { getLevelColor, getLevelGradient, LEVEL_NAMES, type GamificationProgress, type WeeklyChallengeData } from '../utils/gamification';

const BACKEND = 'http://localhost:8000';

interface LearningEntry {
  date: string;
  study_hours: number;
  attendance_percentage: number;
  assignment_completion_rate: number;
  stress_level: number;
}

// ── Daily quote (changes each day, deterministic) ──────────────────
const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "The beautiful thing about learning is nobody can take it away.", author: "B.B. King" },
  { text: "Live as if you were to die tomorrow. Learn as if you'll live forever.", author: "Gandhi" },
  { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "Strive for progress, not perfection.", author: "Unknown" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
  { text: "Great things never come from comfort zones.", author: "Unknown" },
  { text: "Education is the most powerful weapon to change the world.", author: "Nelson Mandela" },
  { text: "Your limitation — it's only your imagination.", author: "Unknown" },
];

const getDailyQuote = () => QUOTES[Math.floor(Date.now() / 86_400_000) % QUOTES.length];

// ── Computed helpers ───────────────────────────────────────────────
function computeStreak(entries: LearningEntry[]): number {
  const dateSet = new Set(entries.map(e => e.date));
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (dateSet.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function computeTwinHealth(entries: LearningEntry[]) {
  if (!entries.length) return { status: 'Getting Started', pct: 0, color: '#6366f1', anim: 'glow-pulse' };
  const last = entries.slice(0, 7);
  const avg = (key: keyof LearningEntry) => last.reduce((s, e) => s + Number(e[key]), 0) / last.length;
  const pct = Math.round(
    Math.min(avg('study_hours') / 8, 1) * 35 +
    (avg('attendance_percentage') / 100) * 30 +
    (avg('assignment_completion_rate') / 100) * 25 +
    ((10 - avg('stress_level')) / 9) * 10
  );
  if (pct >= 70) return { status: 'Thriving',       pct, color: '#10b981', anim: 'glow-pulse-green' };
  if (pct >= 45) return { status: 'Growing',        pct, color: '#f59e0b', anim: 'glow-pulse-amber' };
  return            { status: 'Needs Attention', pct, color: '#ef4444', anim: 'glow-pulse-red'   };
}

function getLast7Days(entries: LearningEntry[]) {
  const map = new Map(entries.map(e => [e.date, e.study_hours]));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { date: key, hours: map.get(key) ?? 0, label: d.toLocaleDateString('en', { weekday: 'narrow' }) };
  });
}

// ── Animated counter hook ──────────────────────────────────────────
function useCounter(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    let start: number | null = null;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.round(p * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target, duration]);
  return val;
}

// ── Stat card ──────────────────────────────────────────────────────
function StatCard({ icon, grad, value, unit = '', label, delay }: {
  icon: string; grad: string; value: number; unit?: string; label: string; delay: number;
}) {
  const count = useCounter(value);
  return (
    <div style={{ ...s.statCard, animationDelay: `${delay}ms` }} className="animate-slide-up">
      <div style={{ ...s.statIconWrap, background: grad }}>
        <span style={s.statIcon}>{icon}</span>
      </div>
      <div>
        <p style={s.statValue}>{count}{unit}</p>
        <p style={s.statLabel}>{label}</p>
      </div>
    </div>
  );
}

// ── 7-day bar chart ────────────────────────────────────────────────
function StudyChart({ data }: { data: { date: string; hours: number; label: string }[] }) {
  const max = Math.max(...data.map(d => d.hours), 1);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div style={ch.wrap}>
      {data.map((d, i) => {
        const isToday = d.date === today;
        const barH = Math.max((d.hours / max) * 72, d.hours > 0 ? 6 : 2);
        return (
          <div key={i} style={ch.col}>
            <span style={{ ...ch.hoursLabel, opacity: d.hours > 0 ? 1 : 0 }}>{d.hours}h</span>
            <div style={ch.track}>
              <div style={{
                ...ch.bar,
                height: `${barH}px`,
                background: isToday
                  ? 'linear-gradient(180deg,#6366f1,#8b5cf6)'
                  : d.hours > 0
                    ? 'linear-gradient(180deg,rgba(99,102,241,0.65),rgba(139,92,246,0.45))'
                    : 'var(--border)',
                boxShadow: isToday ? '0 0 14px rgba(99,102,241,0.55)' : 'none',
              }} />
            </div>
            <span style={{
              ...ch.dayLabel,
              color: isToday ? '#818cf8' : 'var(--text)',
              fontWeight: isToday ? 700 : 400,
            }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

const ch: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', gap: '6px', alignItems: 'flex-end', paddingTop: '0.5rem' },
  col:  { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  hoursLabel: { fontSize: '0.58rem', color: 'var(--text)', height: '12px', lineHeight: '12px' },
  track: { width: '100%', height: '72px', display: 'flex', alignItems: 'flex-end' },
  bar: { width: '100%', borderRadius: '4px 4px 0 0', transition: 'height 0.7s cubic-bezier(0.4,0,0.2,1)' },
  dayLabel: { fontSize: '0.63rem', letterSpacing: '0.02em' },
};

// ── Data constants ─────────────────────────────────────────────────
const NAV_KEYS = [
  { key: 'nav_sessions', to: '/sessions' },
  { key: 'nav_notes',    to: '/notes'    },
  { key: 'nav_materials',to: '/materials'},
  { key: 'nav_progress', to: '/progress' },
  { key: 'nav_checkin',  to: '/checkin'  },
  { key: 'nav_achievements', to: '/achievements' },
  { key: 'nav_quiz',     to: '/quiz'     },
  { key: 'nav_simulate', to: '/simulate' },
  { key: 'nav_mentor',   to: '/mentor'   },
  { key: 'nav_twin',     to: '/twin'     },
];

const NAV_TOUR: Record<string, string> = {
  '/checkin':  'checkin',
  '/twin':     'twin',
  '/mentor':   'mentor',
  '/simulate': 'simulate',
  '/quiz':     'quiz',
};

const QA_DEFS = [
  { labelKey: 'qa_sessions',     descKey: 'qa_desc_study',    icon: '▶',  grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)', to: '/sessions'     },
  { labelKey: 'qa_materials',    descKey: 'qa_desc_upload',   icon: '↑',  grad: 'linear-gradient(135deg,#3b82f6,#06b6d4)', to: '/materials'    },
  { labelKey: 'qa_progress',     descKey: 'qa_desc_analytics',icon: '◎',  grad: 'linear-gradient(135deg,#10b981,#34d399)', to: '/progress'     },
  { labelKey: 'qa_quiz',         descKey: 'qa_desc_quiz',     icon: '🧠', grad: 'linear-gradient(135deg,#06b6d4,#3b82f6)', to: '/quiz'         },
  { labelKey: 'qa_predict',      descKey: 'qa_desc_ml',       icon: '🎯', grad: 'linear-gradient(135deg,#8b5cf6,#d946ef)', to: '/predict'      },
  { labelKey: 'qa_achievements', descKey: 'qa_desc_badges',   icon: '🏆', grad: 'linear-gradient(135deg,#f59e0b,#fbbf24)', to: '/achievements' },
  { labelKey: 'qa_simulate',     descKey: 'qa_desc_whatif',   icon: '⚡', grad: 'linear-gradient(135deg,#f59e0b,#ef4444)', to: '/simulate'     },
  { labelKey: 'qa_mentor',       descKey: 'qa_desc_advice',   icon: '💬', grad: 'linear-gradient(135deg,#ec4899,#8b5cf6)', to: '/mentor'       },
  { labelKey: 'qa_twin',         descKey: 'qa_desc_twin',     icon: '◈',  grad: 'linear-gradient(135deg,#06b6d4,#6366f1)', to: '/twin'         },
  { labelKey: 'qa_checkin',      descKey: 'qa_desc_log',      icon: '✓',  grad: 'linear-gradient(135deg,#34d399,#10b981)', to: '/checkin'      },
  { labelKey: 'qa_battles',      descKey: 'qa_desc_battles',  icon: '⚔️', grad: 'linear-gradient(135deg,#ef4444,#f97316)', to: '/battles'      },
];

interface SavedPlan { id: number; plan_text: string; created_at: string }
interface CalEvent  { id: string; title: string; start: string; link: string }

// ── Main component ─────────────────────────────────────────────────
export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const { t } = useLanguage();
  const hour = new Date().getHours();
  const greeting = hour < 5 ? t('greeting_midnight') : hour < 12 ? t('greeting_morning') : hour < 17 ? t('greeting_afternoon') : t('greeting_evening');
  const firstName = user?.full_name?.split(' ')[0] ?? '';
  const quote = getDailyQuote();
  const avatarSrc = user?.avatar_url ? BACKEND + user.avatar_url : null;
  const [entries, setEntries]           = useState<LearningEntry[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [noteCount, setNoteCount]       = useState(0);
  const [badgeCount, setBadgeCount]     = useState(0);
  const [wsConnected, setWsConnected]   = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const [savedPlan,        setSavedPlan]        = useState<SavedPlan | null>(null);
  const [showPlanModal,    setShowPlanModal]    = useState(false);
  const [calEvents,        setCalEvents]        = useState<CalEvent[]>([]);
  const [gamProgress,      setGamProgress]      = useState<GamificationProgress | null>(null);
  const [weeklyChallenge,  setWeeklyChallenge]  = useState<WeeklyChallengeData | null>(null);
  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [chStudy,          setChStudy]          = useState('');
  const [chQuiz,           setChQuiz]           = useState('');
  const [chCheckin,        setChCheckin]         = useState('');
  const [savingChallenge,  setSavingChallenge]  = useState(false);

  const refreshData = useCallback(() => {
    Promise.all([
      api.get<LearningEntry[]>('/learning-data?limit=60'),
      api.get<unknown[]>('/sessions'),
      api.get<unknown[]>('/notes'),
      api.get<{ earned: boolean }[]>('/achievements'),
    ]).then(([ld, sess, notes, ach]) => {
      setEntries(ld.data);
      setSessionCount(sess.data.length);
      setNoteCount(notes.data.length);
      setBadgeCount(ach.data.filter(b => b.earned).length);
    }).catch(() => {});
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  useEffect(() => {
    api.get<SavedPlan>('/mentor/study-plan/saved')
      .then(r => setSavedPlan(r.data))
      .catch(() => setSavedPlan(null));
    api.get<{ events: CalEvent[] }>('/calendar/upcoming')
      .then(r => setCalEvents(r.data.events))
      .catch(() => {});
    api.get<GamificationProgress>('/gamification/progress')
      .then(r => setGamProgress(r.data))
      .catch(() => {});
    api.get<WeeklyChallengeData>('/gamification/weekly-challenge')
      .then(r => setWeeklyChallenge(r.data))
      .catch(() => {});
  }, []);

  // WebSocket — connect on mount, auto-reconnect on drop
  useEffect(() => {
    if (!user?.id || !token) return;

    let dead = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (dead) return;
      const ws = new WebSocket(
        `ws://localhost:8000/ws/${user.id}?token=${encodeURIComponent(token)}`
      );
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as { type: string };
          if (msg.type === 'checkin_update') refreshData();
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!dead) reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      dead = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [user?.id, token, refreshData]);

  async function saveChallenge() {
    setSavingChallenge(true);
    try {
      await api.post('/gamification/weekly-challenge', {
        target_study_hours:  chStudy  ? parseFloat(chStudy)  : null,
        target_quiz_count:   chQuiz   ? parseInt(chQuiz)     : null,
        target_checkin_days: chCheckin ? parseInt(chCheckin) : null,
      });
      const { data } = await api.get<WeeklyChallengeData>('/gamification/weekly-challenge');
      setWeeklyChallenge(data);
      setShowChallengeForm(false);
    } catch { /* ignore */ }
    finally { setSavingChallenge(false); }
  }

  const streak     = computeStreak(entries);
  const totalHours = Math.round(entries.reduce((s, e) => s + e.study_hours, 0));
  const last7      = getLast7Days(entries);
  const health     = computeTwinHealth(entries);
  const weekHours  = last7.reduce((s, d) => s + d.hours, 0);

  return (
    <div style={s.shell}>

      {/* ── Navbar ── */}
      <header style={s.nav}>
        <div style={s.navLeft}>
          <span style={s.logoIcon}>◈</span>
          <span style={s.navLogo}>TwinMind</span>
          {wsConnected && (
            <div style={s.liveBadge}>
              <span style={s.liveDot} className="live-dot" />
              Live
            </div>
          )}
        </div>
        <nav style={s.navCenter}>
          {NAV_KEYS.map(n => (
            <Link key={n.to} to={n.to} className="nav-link" {...(NAV_TOUR[n.to] ? { 'data-tour': NAV_TOUR[n.to] } : {})}>
              {t(n.key)}
            </Link>
          ))}
        </nav>
        <div style={s.navRight}>
          <LanguageSwitcher />
          <ThemeToggle />
          <NotificationBell />
          <Link to="/profile" style={s.navUser} data-tour="profile">
            {avatarSrc
              ? <img src={avatarSrc} alt="" style={s.navAvatar} />
              : <span style={s.navInitials}>{firstName[0]?.toUpperCase()}</span>}
            {user?.full_name}
          </Link>
          <button className="sign-out-btn" onClick={logout}>{t('sign_out')}</button>
        </div>
      </header>

      <main style={s.main}>

        {/* ── Hero ── */}
        <section style={s.heroCard} className="animate-slide-up" data-tour="dashboard">
          <div style={s.heroOrb1} />
          <div style={s.heroOrb2} />
          <div style={s.heroContent}>

            {/* Left */}
            <div style={s.heroLeft}>
              <p style={s.greetingLabel}>{greeting} ✦</p>

              <h1 style={s.heroName}>
                {firstName}&nbsp;
                <span style={{ display: 'inline-block', animation: 'float 3s ease-in-out infinite' }}>👋</span>
              </h1>
              <p style={s.heroSub}>{t('hero_sub')}</p>
              <div style={s.quoteBox}>
                <span style={s.quoteMark}>"</span>
                <div>
                  <p style={s.quoteText}>{quote.text}</p>
                  <p style={s.quoteAuthor}>— {quote.author}</p>
                </div>
              </div>
            </div>

            {/* Right — twin health */}
            <div style={s.heroRight}>
              <div style={s.healthChip}>
                <div style={{
                  ...s.healthDot,
                  background: health.color,
                  boxShadow: `0 0 8px ${health.color}99, 0 0 18px ${health.color}55`,
                  animation: `${health.anim} 2.5s ease-in-out infinite`,
                }} />
                <span style={{ ...s.healthStatus, color: health.color }}>{health.status}</span>
              </div>
              <p style={s.healthSectionLabel}>Twin Health Score</p>
              <p style={{ ...s.healthPctText, color: health.color }}>{health.pct}<span style={s.healthPctSuffix}>%</span></p>
              <div style={s.healthBarTrack}>
                <div style={{
                  ...s.healthBarFill,
                  width: `${health.pct}%`,
                  background: `linear-gradient(90deg, ${health.color}cc, ${health.color})`,
                  boxShadow: `0 0 10px ${health.color}77`,
                }} />
              </div>
              <p style={s.healthHint}>
                {entries.length === 0
                  ? 'Log a check-in to activate'
                  : `Based on last ${Math.min(entries.length, 7)} day${entries.length > 1 ? 's' : ''}`}
              </p>

              {/* XP / Level mini display */}
              {gamProgress && (
                <div style={{ marginTop: '0.85rem', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      background: getLevelGradient(gamProgress.level),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65rem', fontWeight: 800, color: '#fff',
                      boxShadow: `0 0 8px ${getLevelColor(gamProgress.level)}60`,
                    }}>{gamProgress.level}</div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: getLevelColor(gamProgress.level) }}>
                      {gamProgress.level_name}
                    </span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${gamProgress.progress_pct}%`,
                      background: getLevelGradient(gamProgress.level),
                      borderRadius: '99px', transition: 'width 0.8s ease',
                    }} />
                  </div>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.62rem', color: 'var(--text)', textAlign: 'center' as const }}>
                    {gamProgress.xp.toLocaleString()} XP · {gamProgress.xp_to_next > 0 ? `${gamProgress.xp_to_next} to next` : 'Max level!'}
                  </p>
                </div>
              )}
            </div>

          </div>
        </section>

        {/* ── Stat cards ── */}
        <section style={s.statsGrid}>
          <StatCard icon="▶"  grad="linear-gradient(135deg,#6366f1,#818cf8)" value={sessionCount} label={t('stat_sessions')}  delay={0}   />
          <StatCard icon="⏱"  grad="linear-gradient(135deg,#8b5cf6,#a78bfa)" value={totalHours}  unit="h" label={t('stat_hours')} delay={70}  />
          <StatCard icon="🔥" grad="linear-gradient(135deg,#f59e0b,#fbbf24)" value={streak}      label={t('stat_streak')}   delay={140} />
          <StatCard icon="📝" grad="linear-gradient(135deg,#10b981,#34d399)" value={noteCount}   label={t('stat_notes')}    delay={210} />
          <Link to="/achievements" style={{ textDecoration: 'none' }}>
            <StatCard icon="🏆" grad="linear-gradient(135deg,#f59e0b,#fbbf24)" value={badgeCount} label={t('stat_badges')} delay={280} />
          </Link>
        </section>

        {/* ── Weekly Challenge ── */}
        {weeklyChallenge && (
          <section style={s.panel}>
            <div style={s.panelHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1rem' }}>⚔️</span>
                <h2 style={s.panelTitle}>Weekly Challenge</h2>
                {weeklyChallenge.has_challenge && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: weeklyChallenge.completion_pct >= 100 ? '#10b981' : 'var(--accent)', padding: '0.15rem 0.5rem', background: weeklyChallenge.completion_pct >= 100 ? 'rgba(16,185,129,0.1)' : 'var(--accent-bg)', border: `1px solid ${weeklyChallenge.completion_pct >= 100 ? 'rgba(16,185,129,0.3)' : 'var(--accent-border)'}`, borderRadius: '99px' }}>
                    {weeklyChallenge.completion_pct}% done
                  </span>
                )}
              </div>
              <button onClick={() => { setShowChallengeForm(f => !f); setChStudy(''); setChQuiz(''); setChCheckin(''); }} style={{ fontSize: '0.75rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                {weeklyChallenge.has_challenge ? 'Update' : 'Set Challenge'}
              </button>
            </div>

            {/* Set-challenge form */}
            {showChallengeForm && (
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' as const, marginBottom: '0.85rem', padding: '0.85rem', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: '10px' }}>
                {[
                  { label: 'Study hours goal', val: chStudy, set: setChStudy, ph: 'e.g. 30' },
                  { label: 'Quizzes goal', val: chQuiz, set: setChQuiz, ph: 'e.g. 5' },
                  { label: 'Check-in days goal', val: chCheckin, set: setChCheckin, ph: 'e.g. 7' },
                ].map(f => (
                  <label key={f.label} style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.2rem', fontSize: '0.75rem', color: 'var(--text)', fontWeight: 500 }}>
                    {f.label}
                    <input type="number" value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} min={0} style={{ width: '100px', padding: '0.35rem 0.5rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text-h)', fontSize: '0.875rem', outline: 'none' }} />
                  </label>
                ))}
                <button onClick={saveChallenge} disabled={savingChallenge || (!chStudy && !chQuiz && !chCheckin)} style={{ padding: '0.4rem 1rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: (!chStudy && !chQuiz && !chCheckin) ? 0.5 : 1 }}>
                  {savingChallenge ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}

            {weeklyChallenge.has_challenge && weeklyChallenge.targets ? (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.55rem' }}>
                {[
                  { label: 'Study Hours', cur: weeklyChallenge.progress.study_hours, target: weeklyChallenge.targets.study_hours, unit: 'h' },
                  { label: 'Quizzes',     cur: weeklyChallenge.progress.quiz_count,   target: weeklyChallenge.targets.quiz_count,   unit: '' },
                  { label: 'Check-in Days', cur: weeklyChallenge.progress.checkin_days, target: weeklyChallenge.targets.checkin_days, unit: ' days' },
                ].filter(m => m.target).map(m => {
                  const pct = Math.min(100, Math.round((m.cur / m.target!) * 100));
                  const done = pct >= 100;
                  return (
                    <div key={m.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text)', fontWeight: 500 }}>{m.label}</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: done ? '#10b981' : 'var(--text-h)' }}>
                          {m.cur}{m.unit} / {m.target}{m.unit} {done ? '✓' : ''}
                        </span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: done ? 'linear-gradient(90deg,#10b981,#34d399)' : 'linear-gradient(90deg,var(--accent),#8b5cf6)', borderRadius: '99px', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : !showChallengeForm && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: 0 }}>
                Set weekly study targets to track your progress and stay accountable.
              </p>
            )}
          </section>
        )}

        {/* ── Chart + Actions ── */}
        <div style={s.midRow}>

          {/* 7-day chart */}
          <section style={s.panel}>
            <div style={s.panelHead}>
              <h2 style={s.panelTitle}>{t('chart_title')}</h2>
              <Link to="/checkin" style={s.panelCta}>{t('chart_log_today')}</Link>
            </div>
            {last7.some(d => d.hours > 0) ? (
              <>
                <StudyChart data={last7} />
                <div style={s.chartFooter}>
                  <span style={s.chartStat}>{t('chart_this_week')}&nbsp;<strong style={s.chartStatVal}>{weekHours.toFixed(1)}h</strong></span>
                  <span style={s.chartStat}>{t('chart_daily_avg')}&nbsp;<strong style={s.chartStatVal}>{(weekHours / 7).toFixed(1)}h</strong></span>
                </div>
              </>
            ) : (
              <div style={s.emptyState}>
                <p style={s.emptyIcon}>📊</p>
                <p style={s.emptyText}>{t('no_data_title')}</p>
                <p style={s.emptySub}>{t('no_data_sub')}</p>
                <Link to="/checkin" style={s.emptyBtn}>{t('no_data_btn')}</Link>
              </div>
            )}
          </section>

          {/* Quick actions icon grid */}
          <section style={s.panel}>
            <h2 style={s.panelTitle}>{t('quick_actions')}</h2>
            <div style={s.actionGrid}>
              {QA_DEFS.map(a => (
                <Link key={a.labelKey} to={a.to} style={{ textDecoration: 'none' }}>
                  <div className="action-tile" {...(a.to === '/predict' ? { 'data-tour': 'predict' } : {})}>
                    <div className="action-icon-big" style={{ ...s.actionIconBig, background: a.grad }}>
                      <span style={s.actionIconGlyph}>{a.icon}</span>
                    </div>
                    <p style={s.actionTileLabel}>{t(a.labelKey)}</p>
                    <p style={s.actionTileDesc}>{t(a.descKey)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

        </div>

        {/* ── Upcoming Calendar Events ── */}
        {calEvents.length > 0 && (
          <section style={s.panel}>
            <div style={s.panelHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1rem' }}>📅</span>
                <h2 style={s.panelTitle}>Upcoming Study Events</h2>
              </div>
              <Link to="/profile" style={s.panelCta}>Manage Calendar</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.55rem' }}>
              {calEvents.map(ev => {
                const d = new Date(ev.start);
                const isDateOnly = ev.start.length === 10;
                const label = isDateOnly
                  ? d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                  : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
                    ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                return (
                  <a
                    key={ev.id}
                    href={ev.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.6rem 0.75rem',
                      background: 'rgba(99,102,241,0.06)',
                      border: '1px solid rgba(99,102,241,0.15)',
                      borderRadius: '10px',
                      textDecoration: 'none',
                    }}
                  >
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                      background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.85rem',
                    }}>📅</div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                        {ev.title}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text)' }}>{label}</p>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#818cf8', flexShrink: 0 }}>↗</span>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* ── My Study Plan card ── */}
        <section style={s.panel}>
          <div style={s.panelHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>📋</span>
              <h2 style={s.panelTitle}>{t('my_study_plan')}</h2>
            </div>
            <Link to="/mentor" style={s.panelCta}>{t('generate_new')}</Link>
          </div>

          {savedPlan ? (
            <div>
              <p style={s.planDate}>
                {t('plan_saved')} {new Date(savedPlan.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <div style={s.planPreview}>
                {savedPlan.plan_text
                  .split('\n')
                  .filter(l => l.trim())
                  .slice(0, 4)
                  .map((line, i) => {
                    const clean = line.replace(/^#{1,3}\s*/, '').replace(/\*\*/g, '');
                    return <p key={i} style={i === 0 ? s.planPreviewHead : s.planPreviewLine}>{clean}</p>;
                  })}
                <p style={s.planFade}>…</p>
              </div>
              <button onClick={() => setShowPlanModal(true)} style={s.viewPlanBtn}>
                {t('view_full_plan')}
              </button>
            </div>
          ) : (
            <div style={s.emptyState}>
              <p style={s.emptyIcon}>📋</p>
              <p style={s.emptyText}>{t('no_plan_title')}</p>
              <p style={s.emptySub}>{t('no_plan_sub')}</p>
              <Link to="/mentor" style={s.emptyBtn}>{t('go_to_mentor')}</Link>
            </div>
          )}
        </section>

      </main>

      {/* ── Onboarding Tour ── */}
      <TutorialOverlay />

      {/* ── Full Plan Modal ── */}
      {showPlanModal && savedPlan && (
        <div style={s.modalOverlay} onClick={() => setShowPlanModal(false)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <p style={s.modalTitle}>{t('modal_plan_title')}</p>
                <p style={s.modalSub}>
                  {t('plan_saved')} {new Date(savedPlan.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setShowPlanModal(false)} style={s.modalClose}>✕</button>
            </div>
            <div style={s.modalBody}>
              <PlanContent text={savedPlan.plan_text} />
            </div>
            <div style={s.modalFooter}>
              <Link to="/mentor" style={s.modalMentorLink} onClick={() => setShowPlanModal(false)}>
                {t('modal_regenerate')}
              </Link>
              <button onClick={() => setShowPlanModal(false)} style={s.modalCloseBtn}>{t('close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },

  /* Navbar */
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 1.75rem', height: '60px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    position: 'sticky', top: 0, zIndex: 50,
  },
  navLeft:    { display: 'flex', alignItems: 'center', gap: '0.45rem' },
  logoIcon:   { fontSize: '1.1rem', color: '#6366f1' },
  navLogo:    { fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-h)', letterSpacing: '-0.3px' },
  navCenter:  { display: 'flex', alignItems: 'center', gap: '0.15rem' },
  navRight:   { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  liveBadge:  { display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 700, color: '#10b981', letterSpacing: '0.04em' },
  liveDot:    { width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', flexShrink: 0 },
  navUser:    { display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', color: 'var(--text)', textDecoration: 'none', fontWeight: 500 },
  navAvatar:  { width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' as const, border: '1.5px solid var(--accent-border)' },
  navInitials:{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-bg)', border: '1.5px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 },

  /* Main */
  main: { flex: 1, padding: '2rem 2rem 3rem', maxWidth: '1040px', width: '100%', margin: '0 auto', boxSizing: 'border-box' as const, display: 'flex', flexDirection: 'column', gap: '1.5rem' },

  /* Hero */
  heroCard: {
    position: 'relative', overflow: 'hidden',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    padding: '2rem 2rem',
    boxShadow: '0 4px 30px rgba(0,0,0,0.2)',
  },
  heroOrb1: {
    position: 'absolute', width: '400px', height: '400px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 65%)',
    top: '-150px', right: '-80px', pointerEvents: 'none',
  },
  heroOrb2: {
    position: 'absolute', width: '300px', height: '300px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 65%)',
    bottom: '-100px', left: '30%', pointerEvents: 'none',
  },
  heroContent: { position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '2rem' },
  heroLeft:    { flex: 1 },
  greetingLabel: { fontSize: '0.75rem', color: '#6366f1', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '0.4rem' },
  heroName:    { fontSize: '2.1rem', fontWeight: 800, color: 'var(--text-h)', letterSpacing: '-0.5px', marginBottom: '0.25rem', lineHeight: 1.1 },
  heroSub:     { fontSize: '0.9rem', color: 'var(--text)', marginBottom: '1.25rem' },
  quoteBox:    { display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.9rem 1rem', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', maxWidth: '480px' },
  quoteMark:   { fontSize: '1.5rem', color: '#6366f1', lineHeight: 1, flexShrink: 0, marginTop: '-2px' },
  quoteText:   { fontSize: '0.83rem', color: 'var(--text-m)', lineHeight: 1.55, marginBottom: '0.2rem', fontStyle: 'italic' },
  quoteAuthor: { fontSize: '0.72rem', color: 'var(--text)', fontWeight: 600 },

  /* Hero right — twin health */
  heroRight: { width: '200px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' },
  healthChip: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.85rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '99px' },
  healthDot:  { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  healthStatus: { fontSize: '0.8rem', fontWeight: 700 },
  healthSectionLabel: { fontSize: '0.7rem', color: 'var(--text)', fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0.25rem 0 0' },
  healthPctText: { fontSize: '2.5rem', fontWeight: 800, lineHeight: 1, margin: '0' },
  healthPctSuffix: { fontSize: '1.1rem', fontWeight: 600 },
  healthBarTrack: { width: '100%', height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' },
  healthBarFill:  { height: '100%', borderRadius: '99px', transition: 'width 0.8s ease' },
  healthHint: { fontSize: '0.68rem', color: 'var(--text)', margin: '0.1rem 0 0', textAlign: 'center' as const },

  /* Stat cards */
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' },
  statCard: {
    display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem',
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: '16px', boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
  },
  statIconWrap: { width: '46px', height: '46px', borderRadius: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(0,0,0,0.3)' },
  statIcon:  { fontSize: '1.15rem' },
  statValue: { fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-h)', lineHeight: 1.1, marginBottom: '0.15rem' },
  statLabel: { fontSize: '0.68rem', color: 'var(--text)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const },

  /* Mid row */
  midRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' },

  /* Panels */
  panel: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' },
  panelHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' },
  panelTitle: { fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-h)', margin: 0, letterSpacing: '-0.1px' },
  panelCta: { fontSize: '0.75rem', color: '#818cf8', textDecoration: 'none', fontWeight: 600 },

  /* Chart footer */
  chartFooter: { display: 'flex', gap: '1rem', marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border)' },
  chartStat: { fontSize: '0.75rem', color: 'var(--text)' },
  chartStatVal: { color: 'var(--text-h)', fontWeight: 700 },

  /* Empty state */
  emptyState: { textAlign: 'center', padding: '1.5rem 0' },
  emptyIcon: { fontSize: '2rem', marginBottom: '0.5rem' },
  emptyText: { fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.3rem' },
  emptySub:  { fontSize: '0.78rem', color: 'var(--text)', marginBottom: '1rem' },
  emptyBtn:  { display: 'inline-block', padding: '0.45rem 1rem', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', color: '#818cf8', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' },

  /* Quick actions grid */
  actionGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.25rem', marginTop: '0.25rem' },
  actionIconBig: { width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.3)', marginBottom: '0.1rem' },
  actionIconGlyph: { fontSize: '1.2rem' },
  actionTileLabel: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-h)', margin: 0, lineHeight: 1.2 },
  actionTileDesc:  { fontSize: '0.62rem', color: 'var(--text)', margin: 0, lineHeight: 1.2 },

  /* Study plan card */
  planDate:        { fontSize: '0.7rem', color: 'var(--text)', marginBottom: '0.75rem', fontWeight: 500 },
  planPreview:     { background: 'var(--bg-elevated, var(--bg))', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.9rem 1rem', marginBottom: '0.85rem' },
  planPreviewHead: { fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-h)', margin: '0 0 0.3rem', lineHeight: 1.35 },
  planPreviewLine: { fontSize: '0.78rem', color: 'var(--text)', margin: '0 0 0.15rem', lineHeight: 1.4 },
  planFade:        { fontSize: '0.78rem', color: 'var(--text)', margin: '0.2rem 0 0', opacity: 0.5 },
  viewPlanBtn:     {
    padding: '0.45rem 1.1rem', background: 'var(--accent)', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },

  /* Full-plan modal */
  modalOverlay: {
    position: 'fixed' as const, inset: 0,
    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: '1rem',
  },
  modalBox: {
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: '16px', width: '100%', maxWidth: '760px',
    maxHeight: '85vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
  },
  modalHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', flexShrink: 0,
  },
  modalTitle:  { margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-h)' },
  modalSub:    { margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text)' },
  modalClose:  { background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '1.1rem', cursor: 'pointer', padding: '0.2rem 0.4rem', borderRadius: '6px', lineHeight: 1 },
  modalBody:   { flex: 1, overflowY: 'auto' as const, padding: '1.25rem 1.5rem' },
  modalFooter: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', flexShrink: 0 },
  modalMentorLink: { fontSize: '0.82rem', color: '#818cf8', textDecoration: 'none', fontWeight: 500 },
  modalCloseBtn: {
    padding: '0.45rem 1.25rem', background: 'var(--accent)', border: 'none',
    borderRadius: '8px', color: '#fff', fontSize: '0.82rem', fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer',
  },
};

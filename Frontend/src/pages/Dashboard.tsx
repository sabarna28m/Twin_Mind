import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, Upload, BarChart2, CheckSquare, Trophy, Brain, Zap, MessageCircle, Layers, Menu, Rocket, Mic2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import ThemeToggle from '../components/ThemeToggle';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NotificationBell from '../components/NotificationBell';
import PlanContent from '../components/PlanContent';
import TutorialOverlay from '../components/TutorialOverlay';
import MobileNav from '../components/MobileNav';
import api from '../services/api';
import { BACKEND_URL, WS_URL } from '../lib/config';
import { getLevelColor, getLevelGradient, LEVEL_NAMES, type GamificationProgress, type WeeklyChallengeData } from '../utils/gamification';
import BurnoutWidget from '../components/BurnoutWidget';
import SubjectWidgets from '../components/SubjectWidgets';
import AICommandCenter from '../components/AICommandCenter';
import AITwinAssistant from '../components/AITwinAssistant';
import SmartDailyMission from '../components/SmartDailyMission';
import HeroPriorityCard from '../components/HeroPriorityCard';

const BACKEND = BACKEND_URL;

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
    <div style={{ ...s.statCard, animationDelay: `${delay}ms` }} className="animate-slide-up stat-card-premium">
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
                  ? 'var(--grad-primary)'
                  : d.hours > 0
                    ? 'linear-gradient(180deg,rgba(var(--primary-rgb),0.65),rgba(var(--primary-rgb),0.35))'
                    : 'var(--border)',
                boxShadow: isToday ? `0 0 14px rgba(var(--primary-rgb),0.55)` : 'none',
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
  { key: 'nav_sessions',     to: '/sessions',     Icon: BookOpen      },
  { key: 'nav_notes',        to: '/notes',         Icon: FileText      },
  { key: 'nav_materials',    to: '/materials',     Icon: Upload        },
  { key: 'nav_progress',     to: '/progress',      Icon: BarChart2     },
  { key: 'nav_checkin',      to: '/checkin',       Icon: CheckSquare   },
  { key: 'nav_achievements', to: '/achievements',  Icon: Trophy        },
  { key: 'nav_quiz',         to: '/quiz',          Icon: Brain         },
  { key: 'nav_simulate',     to: '/simulate',      Icon: Zap           },
  { key: 'nav_mentor',       to: '/mentor',        Icon: MessageCircle },
  { key: 'nav_twin',         to: '/twin',          Icon: Layers        },
  { key: 'nav_career',       to: '/career',        Icon: Rocket        },
  { key: 'nav_comm_twin',   to: '/comm-twin',     Icon: Mic2          },
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
  { labelKey: 'qa_focus',        descKey: 'qa_desc_focus',    icon: '⏱',  grad: 'linear-gradient(135deg,#00D4FF,#7C3AED)', to: '/focus'        },
  { labelKey: 'qa_videos',       descKey: 'qa_desc_videos',   icon: '▶',  grad: 'linear-gradient(135deg,#ef4444,#f97316)', to: '/videos'       },
  { labelKey: 'qa_burnout',      descKey: 'qa_desc_burnout',  icon: '🧠', grad: 'linear-gradient(135deg,#ef4444,#f59e0b)', to: '/burnout'      },
  { labelKey: 'qa_subjects',     descKey: 'qa_desc_subjects', icon: '📊', grad: 'linear-gradient(135deg,#6366f1,#06b6d4)', to: '/subjects'     },
  { labelKey: 'qa_career',      descKey: 'qa_desc_career',    icon: '🚀', grad: 'linear-gradient(135deg,#6366f1,#00D4FF)', to: '/career'      },
  { labelKey: 'qa_comm_twin',  descKey: 'qa_desc_comm_twin', icon: '🗣️', grad: 'linear-gradient(135deg,#14b8a6,#00D4FF)', to: '/comm-twin'   },
  { labelKey: 'qa_smart_notes', descKey: 'qa_desc_smart_notes', icon: '🧠', grad: 'linear-gradient(135deg,#6366f1,#8b5cf6,#00D4FF)', to: '/notes' },
  { labelKey: 'qa_skill_tree', descKey: 'qa_desc_skill_tree', icon: '🌳', grad: 'linear-gradient(135deg,#f59e0b,#7c3aed)', to: '/skill-tree' },
];

interface SavedPlan { id: number; plan_text: string; created_at: string }
interface CalEvent  { id: string; title: string; start: string; link: string }
interface DayPlan   { day: string; tasks: string[] }
interface SmartPlan {
  current_score: number
  target_score: number
  daily_hours: number
  forecast: string
  days: DayPlan[]
}

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
  const [smartPlan,        setSmartPlan]        = useState<SmartPlan | null>(null);
  const [planLoading,      setPlanLoading]      = useState(false);
  const [planError,        setPlanError]        = useState<string | null>(null);
  const [gamProgress,      setGamProgress]      = useState<GamificationProgress | null>(null);
  const [weeklyChallenge,  setWeeklyChallenge]  = useState<WeeklyChallengeData | null>(null);
  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [chStudy,          setChStudy]          = useState('');
  const [chQuiz,           setChQuiz]           = useState('');
  const [chCheckin,        setChCheckin]         = useState('');
  const [savingChallenge,  setSavingChallenge]  = useState(false);
  const [drawerOpen,       setDrawerOpen]       = useState(false);

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
    api.get<SmartPlan>('/smart-plan/current')
      .then(r => setSmartPlan(r.data))
      .catch(() => {});  // 404 is expected when no plan saved yet
  }, []);

  // WebSocket — connect on mount, auto-reconnect on drop
  useEffect(() => {
    if (!user?.id || !token) return;

    let dead = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (dead) return;
      const ws = new WebSocket(
        `${WS_URL}/ws/${user.id}?token=${encodeURIComponent(token)}`
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

  async function generatePlan() {
    setPlanLoading(true);
    setPlanError(null);
    try {
      const { data } = await api.post<SmartPlan>('/smart-plan/generate');
      setSmartPlan(data);
      api.post('/smart-plan/save', data).catch(() => {});
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setPlanError(detail ?? 'Failed to generate plan. Please try again.');
    } finally {
      setPlanLoading(false);
    }
  }

  function downloadPDF(plan: SmartPlan) {
    const rows = plan.days.map(d => `
      <div class="day-col">
        <div class="day-name">${d.day.slice(0, 3)}</div>
        ${d.tasks.map(t => `<div class="task">${t}</div>`).join('')}
      </div>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>TwinMind Smart Plan</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:2rem;color:#0f172a;background:#fff}
  h1{font-size:1.4rem;font-weight:800;color:#4338ca;margin:0 0 0.25rem}
  .sub{font-size:0.9rem;color:#475569;margin:0 0 1.5rem}
  .badge{display:inline-block;background:#eef2ff;color:#4338ca;border-radius:99px;padding:0.25rem 0.85rem;font-size:0.82rem;font-weight:700;margin-bottom:1.5rem}
  .grid{display:flex;gap:0.75rem;margin-bottom:1.5rem}
  .day-col{flex:1;background:#f8fafc;border-radius:10px;padding:0.75rem;border:1px solid #e2e8f0}
  .day-name{font-size:0.75rem;font-weight:800;color:#4338ca;text-transform:uppercase;letter-spacing:.06em;margin-bottom:0.5rem}
  .task{font-size:0.72rem;color:#334155;padding:0.35rem 0;border-bottom:1px solid #e2e8f0;line-height:1.4}
  .task:last-child{border-bottom:none}
  .report{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1rem;margin-top:0.5rem}
  .report-title{font-size:0.8rem;font-weight:700;color:#4338ca;margin:0 0 0.4rem}
  .forecast{font-size:0.82rem;color:#475569;line-height:1.5;margin:0}
  @media print{body{padding:1rem}}
</style></head><body>
<h1>TwinMind Smart Plan</h1>
<p class="sub">Raise expected performance from <strong>${plan.current_score}%</strong> to <strong>${plan.target_score}%</strong> over the next 3 weeks</p>
<div class="badge">${plan.daily_hours}h/day recommended</div>
<div class="grid">${rows}</div>
<div class="report">
  <p class="report-title">Twin Report</p>
  <p class="forecast">${plan.forecast}</p>
</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  }

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

      {/* ── Mobile nav drawer ── */}
      <MobileNav
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userName={user?.full_name ?? undefined}
        avatarSrc={avatarSrc ?? undefined}
        onLogout={logout}
      />

      {/* ── Navbar ── */}
      <header style={s.nav} className="nav-premium mob-nav">
        <div style={s.navLeft}>
          {/* Hamburger — mobile only */}
          <button
            className="mob-hamburger"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span style={s.logoIcon}>◈</span>
          <span style={s.navLogo}>TwinMind</span>
          {wsConnected && (
            <div style={s.liveBadge} className="mob-hide-mobile">
              <span style={s.liveDot} className="live-dot" />
              Live
            </div>
          )}
        </div>
        <nav style={s.navCenter} className="mob-nav-links">
          {NAV_KEYS.map(({ key, to, Icon: NavIcon }) => (
            <Link key={to} to={to} className="nav-link" {...(NAV_TOUR[to] ? { 'data-tour': NAV_TOUR[to] } : {})}>
              <NavIcon size={13} strokeWidth={2.5} />
              {t(key)}
            </Link>
          ))}
        </nav>
        <div style={s.navRight} className="mob-nav-right">
          <span className="mob-hide-mobile"><LanguageSwitcher /></span>
          <ThemeToggle />
          <span className="mob-hide-mobile"><NotificationBell /></span>
          <Link to="/profile" style={s.navUser} data-tour="profile">
            {avatarSrc
              ? <img src={avatarSrc} alt="" style={s.navAvatar} />
              : <span style={s.navInitials}>{firstName[0]?.toUpperCase()}</span>}
            <span className="mob-nav-user-text">{user?.full_name}</span>
          </Link>
          <span className="mob-hide-mobile">
            <button className="sign-out-btn" onClick={logout}>{t('sign_out')}</button>
          </span>
        </div>
      </header>

      <main style={s.main} className="mob-dash-main">

        {/* ── 1. Hero ── */}
        <section style={s.heroCard} className="animate-slide-up hero-animated mob-hero-card" data-tour="dashboard">
          <div style={s.heroOrb1} />
          <div style={s.heroOrb2} />
          <div style={s.heroContent} className="mob-hero-content">

            {/* Left */}
            <div style={s.heroLeft} className="mob-hero-left">
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
            <div style={s.heroRight} className="mob-hero-right">
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

        {/* ── 2. Hero Priority Card (Today's AI Recommendation) ── */}
        <HeroPriorityCard />

        {/* ── 3. AI Command Center ── */}
        <AICommandCenter brainReadiness={health.pct} streak={streak} level={gamProgress?.level} />

        {/* ── 4. AI Twin Assistant + Smart Daily Mission ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="mob-mid-row">
          <AITwinAssistant />
          <SmartDailyMission />
        </div>

        {/* ── 5. Subject Intelligence Panel ── */}
        <section style={s.panel} className="glass-panel">
          <div style={s.panelHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>📊</span>
              <h2 style={s.panelTitle}>Subject Intelligence</h2>
            </div>
            <Link to="/subjects" style={s.panelCta}>Full Analysis →</Link>
          </div>
          <SubjectWidgets />
        </section>

        {/* ── 6. Quick AI Actions (full-width, hero prominence) ── */}
        <section style={s.panel} className="glass-panel">
          <div style={s.panelHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>⚡</span>
              <h2 style={s.panelTitle}>{t('quick_actions')}</h2>
            </div>
          </div>
          <div style={s.actionGrid} className="mob-action-grid">
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

        {/* ── 7. Burnout Prevention Center ── */}
        <section style={s.panel} className="glass-panel">
          <div style={s.panelHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>🧠</span>
              <h2 style={s.panelTitle}>Burnout Prevention Center</h2>
            </div>
            <Link to="/burnout" style={s.panelCta}>Full Analysis →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,280px) 1fr', gap: '1rem', alignItems: 'start' }} className="mob-mid-row">
            <BurnoutWidget />
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' }}>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.65, opacity: 0.88 }}>
                Track your daily study load, sleep, breaks, mood, and energy to monitor burnout risk in real-time.
                TwinMind AI detects early warning signs before they impact your performance.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' as const }}>
                {[
                  { label: '🟢 0–39 Low Risk',    color: '#10b981' },
                  { label: '🟡 40–69 Medium Risk', color: '#f59e0b' },
                  { label: '🔴 70–100 High Risk',  color: '#ef4444' },
                ].map(r => (
                  <span key={r.label} style={{ padding: '0.22rem 0.65rem', borderRadius: '99px', fontSize: '0.68rem', fontWeight: 600, background: `${r.color}15`, color: r.color, border: `1px solid ${r.color}30` }}>{r.label}</span>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
                {[
                  { icon: '😴', label: 'Sleep Quality', desc: 'Track sleep hours & quality'  },
                  { icon: '🧘', label: 'Stress Levels', desc: 'Daily mood & energy check-in'  },
                  { icon: '💡', label: 'Recovery Tips', desc: 'AI-generated recommendations'  },
                ].map(f => (
                  <div key={f.label} style={{ padding: '0.65rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                    <p style={{ margin: '0 0 0.2rem', fontSize: '1rem' }}>{f.icon}</p>
                    <p style={{ margin: '0 0 0.1rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-h)' }}>{f.label}</p>
                    <p style={{ margin: 0, fontSize: '0.63rem', color: 'var(--text)', lineHeight: 1.4 }}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 8. Weekly Challenge ── */}
        {weeklyChallenge && (
          <section style={s.panel} className="glass-panel">
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
                  { label: 'Study Hours',   cur: weeklyChallenge.progress.study_hours,  target: weeklyChallenge.targets.study_hours,  unit: 'h'     },
                  { label: 'Quizzes',       cur: weeklyChallenge.progress.quiz_count,   target: weeklyChallenge.targets.quiz_count,   unit: ''      },
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

        {/* ── 9. 7-day Study Chart ── */}
        <section style={s.panel} className="glass-panel">
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

        {/* ── 10. Smart Plan ── */}
        <section style={sp.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.15rem' }}>◈</span>
              <h2 style={sp.title}>Smart Plan</h2>
            </div>
            <button onClick={generatePlan} disabled={planLoading} style={sp.regenBtn}>
              {planLoading ? '⟳ Generating…' : smartPlan ? '⟳ Regenerate' : '✦ Generate Plan'}
            </button>
          </div>
          {planError && <div style={sp.errorBox}>{planError}</div>}
          {!smartPlan && !planLoading && !planError && (
            <div style={sp.emptyWrap}>
              <p style={sp.emptyIcon}>🧠</p>
              <p style={sp.emptyTitle}>AI-Powered Weekly Schedule</p>
              <p style={sp.emptySub}>
                Generate a personalized 7-day study plan based on your performance data, weak areas, and academic goals.
              </p>
              <button onClick={generatePlan} style={sp.generateBigBtn}>Generate My Smart Plan</button>
            </div>
          )}
          {planLoading && (
            <div style={sp.loadingWrap}>
              <div style={sp.spinner} className="spin" />
              <p style={sp.loadingText}>Analyzing your performance data…</p>
            </div>
          )}
          {smartPlan && !planLoading && (
            <>
              <div style={sp.headline}>
                <p style={sp.headlineText}>
                  Raise expected performance from&nbsp;
                  <span style={sp.scoreFrom}>{smartPlan.current_score}%</span>
                  &nbsp;to&nbsp;
                  <span style={sp.scoreTo}>{smartPlan.target_score}%</span>
                  &nbsp;over the next 3 weeks
                </p>
                <span style={sp.hoursBadge}>{smartPlan.daily_hours}h/day recommended</span>
              </div>
              <div style={sp.dayGrid} className="mob-day-grid">
                {smartPlan.days.map((d, i) => (
                  <div key={i} style={sp.dayCol}>
                    <p style={sp.dayName}>{d.day.slice(0, 3).toUpperCase()}</p>
                    {d.tasks.map((task, j) => (
                      <div key={j} style={sp.taskCard}>
                        <span style={sp.taskDot} />
                        <span style={sp.taskText}>{task}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div style={sp.reportBox}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem' }}>◈</span>
                    <span style={sp.reportTitle}>Twin Report</span>
                  </div>
                  <button onClick={() => downloadPDF(smartPlan)} style={sp.downloadBtn}>↓ Download PDF</button>
                </div>
                <p style={sp.forecastText}>{smartPlan.forecast}</p>
              </div>
            </>
          )}
        </section>

        {/* ── 11. Productivity Metrics (supporting role — moved to bottom) ── */}
        <section style={s.statsGrid} className="mob-stats-4">
          <StatCard icon="▶"  grad="linear-gradient(135deg,#6366f1,#818cf8)" value={sessionCount} label={t('stat_sessions')}  delay={0}   />
          <StatCard icon="⏱"  grad="linear-gradient(135deg,#8b5cf6,#a78bfa)" value={totalHours}  unit="h" label={t('stat_hours')} delay={70}  />
          <StatCard icon="🔥" grad="linear-gradient(135deg,#f59e0b,#fbbf24)" value={streak}      label={t('stat_streak')}   delay={140} />
          <StatCard icon="📝" grad="linear-gradient(135deg,#10b981,#34d399)" value={noteCount}   label={t('stat_notes')}    delay={210} />
          <Link to="/achievements" style={{ textDecoration: 'none' }}>
            <StatCard icon="🏆" grad="linear-gradient(135deg,#f59e0b,#fbbf24)" value={badgeCount} label={t('stat_badges')} delay={280} />
          </Link>
        </section>

        {/* ── 12. Upcoming Calendar Events ── */}
        {calEvents.length > 0 && (
          <section style={s.panel} className="glass-panel">
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
                  <a key={ev.id} href={ev.link} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '10px', textDecoration: 'none' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>📅</div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{ev.title}</p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text)' }}>{label}</p>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#818cf8', flexShrink: 0 }}>↗</span>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* ── 13. My Study Plan ── */}
        <section style={s.panel} className="glass-panel">
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
                {savedPlan.plan_text.split('\n').filter(l => l.trim()).slice(0, 4).map((line, i) => {
                  const clean = line.replace(/^#{1,3}\s*/, '').replace(/\*\*/g, '');
                  return <p key={i} style={i === 0 ? s.planPreviewHead : s.planPreviewLine}>{clean}</p>;
                })}
                <p style={s.planFade}>…</p>
              </div>
              <button onClick={() => setShowPlanModal(true)} style={s.viewPlanBtn}>{t('view_full_plan')}</button>
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
        <div style={s.modalOverlay} className="mob-modal-overlay" onClick={() => setShowPlanModal(false)}>
          <div style={s.modalBox} className="mob-modal-box" onClick={e => e.stopPropagation()}>
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

// ── Premium Styles ──────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },

  /* Navbar */
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 1.75rem', height: '64px',
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(28px) saturate(200%)',
    WebkitBackdropFilter: 'blur(28px) saturate(200%)',
    borderBottom: '1px solid var(--glass-border)',
    boxShadow: '0 1px 0 rgba(var(--primary-rgb),0.06), 0 8px 32px rgba(0,0,0,0.4)',
    position: 'sticky', top: 0, zIndex: 50,
  },
  navLeft:    { display: 'flex', alignItems: 'center', gap: '0.55rem' },
  logoIcon:   { fontSize: '1.25rem', color: '#00D4FF', filter: 'drop-shadow(0 0 8px rgba(0,212,255,0.7))' },
  navLogo:    {
    fontSize: '1.1rem', fontWeight: 900, letterSpacing: '-0.5px',
    background: 'linear-gradient(135deg, #00D4FF 0%, #a78bfa 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  navCenter:  { display: 'flex', alignItems: 'center', gap: '0.1rem' },
  navRight:   { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  liveBadge:  { display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.22rem 0.7rem', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.28)', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 800, color: '#00D4FF', letterSpacing: '0.06em' },
  liveDot:    { width: '6px', height: '6px', borderRadius: '50%', background: '#00D4FF', boxShadow: '0 0 8px rgba(0,212,255,0.9)', flexShrink: 0 },
  navUser:    { display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', color: 'var(--text-m)', textDecoration: 'none', fontWeight: 600 },
  navAvatar:  { width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' as const, border: '2px solid rgba(0,212,255,0.4)', boxShadow: '0 0 12px rgba(0,212,255,0.2)' },
  navInitials:{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,212,255,0.12)', border: '2px solid rgba(0,212,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#00D4FF', flexShrink: 0 },

  /* Main */
  main: { flex: 1, padding: '2.25rem 2rem 4rem', maxWidth: '1080px', width: '100%', margin: '0 auto', boxSizing: 'border-box' as const, display: 'flex', flexDirection: 'column', gap: '1.75rem' },

  /* Hero */
  heroCard: {
    position: 'relative', overflow: 'hidden',
    border: '1px solid rgba(0,212,255,0.14)',
    borderRadius: '24px',
    padding: '2.5rem 2.25rem',
    boxShadow: '0 4px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,212,255,0.06)',
  },
  heroOrb1: {
    position: 'absolute', width: '520px', height: '520px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,212,255,0.1) 0%, transparent 65%)',
    top: '-220px', right: '-120px', pointerEvents: 'none',
    animation: 'orb-drift-1 18s ease-in-out infinite',
  },
  heroOrb2: {
    position: 'absolute', width: '420px', height: '420px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)',
    bottom: '-160px', left: '22%', pointerEvents: 'none',
    animation: 'orb-drift-2 14s ease-in-out infinite',
  },
  heroContent: { position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '2rem' },
  heroLeft:    { flex: 1 },
  greetingLabel: {
    fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.15em',
    textTransform: 'uppercase' as const, marginBottom: '0.5rem',
    background: 'linear-gradient(90deg, #00D4FF, #7C3AED)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  heroName: {
    fontSize: '2.8rem', fontWeight: 900, letterSpacing: '-1.2px',
    marginBottom: '0.3rem', lineHeight: 1.05,
    background: 'linear-gradient(135deg, #f8fafc 0%, #c7d2fe 45%, #00D4FF 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  heroSub:     { fontSize: '0.95rem', color: 'rgba(148,163,184,0.85)', marginBottom: '1.5rem', lineHeight: 1.55 },
  quoteBox:    { display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem 1.15rem', background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.14)', borderRadius: '14px', maxWidth: '500px', backdropFilter: 'blur(10px)' },
  quoteMark:   { fontSize: '1.6rem', color: '#00D4FF', lineHeight: 1, flexShrink: 0, marginTop: '-4px', opacity: 0.75 },
  quoteText:   { fontSize: '0.85rem', color: 'rgba(203,213,225,0.82)', lineHeight: 1.6, marginBottom: '0.22rem', fontStyle: 'italic' },
  quoteAuthor: { fontSize: '0.72rem', color: '#00D4FF', fontWeight: 700, opacity: 0.75 },

  /* Hero right — twin health */
  heroRight: { width: '215px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.55rem' },
  healthChip: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.42rem 0.9rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '99px', backdropFilter: 'blur(10px)' },
  healthDot:  { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  healthStatus: { fontSize: '0.8rem', fontWeight: 800 },
  healthSectionLabel: { fontSize: '0.68rem', color: 'rgba(148,163,184,0.65)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0.25rem 0 0' },
  healthPctText: { fontSize: '2.9rem', fontWeight: 900, lineHeight: 1, margin: '0' },
  healthPctSuffix: { fontSize: '1.25rem', fontWeight: 700 },
  healthBarTrack: { width: '100%', height: '7px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden' },
  healthBarFill:  { height: '100%', borderRadius: '99px', transition: 'width 0.9s cubic-bezier(0.16,1,0.3,1)' },
  healthHint: { fontSize: '0.68rem', color: 'rgba(148,163,184,0.55)', margin: '0.1rem 0 0', textAlign: 'center' as const },

  /* Stat cards */
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1.1rem' },
  statCard: {
    display: 'flex', alignItems: 'center', gap: '1.1rem', padding: '1.4rem',
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--card-radius)',
    boxShadow: 'var(--card-shadow)',
    backdropFilter: 'blur(var(--glass-blur))', WebkitBackdropFilter: 'blur(var(--glass-blur))',
  },
  statIconWrap: { width: '50px', height: '50px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 20px rgba(0,0,0,0.45)' },
  statIcon:  { fontSize: '1.3rem' },
  statValue: {
    fontSize: '1.95rem', fontWeight: 900, lineHeight: 1.05, marginBottom: '0.18rem',
    background: 'var(--grad-primary)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  statLabel: { fontSize: '0.68rem', color: 'rgba(148,163,184,0.65)', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase' as const },

  /* Mid row */
  midRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.75rem', alignItems: 'start' },

  /* Panels */
  panel: {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--card-radius)',
    padding: '1.6rem',
    backdropFilter: 'blur(var(--glass-blur))', WebkitBackdropFilter: 'blur(var(--glass-blur))',
    boxShadow: 'var(--card-shadow)',
  },
  panelHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' },
  panelTitle: { fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-h)', margin: 0, letterSpacing: '-0.2px' },
  panelCta: { fontSize: '0.75rem', color: 'var(--section-accent)', textDecoration: 'none', fontWeight: 700, opacity: 0.85, transition: 'opacity 0.2s' },

  /* Chart footer */
  chartFooter: { display: 'flex', gap: '1rem', marginTop: '0.85rem', paddingTop: '0.7rem', borderTop: '1px solid rgba(255,255,255,0.06)' },
  chartStat: { fontSize: '0.75rem', color: 'var(--text)' },
  chartStatVal: { color: 'var(--text-h)', fontWeight: 700 },

  /* Empty state */
  emptyState: { textAlign: 'center' as const, padding: '2rem 0' },
  emptyIcon: { fontSize: '2.25rem', marginBottom: '0.6rem' },
  emptyText: { fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-h)', marginBottom: '0.35rem' },
  emptySub:  { fontSize: '0.8rem', color: 'var(--text)', marginBottom: '1.25rem', lineHeight: 1.55 },
  emptyBtn:  {
    display: 'inline-block', padding: '0.52rem 1.3rem',
    background: 'linear-gradient(135deg, rgba(0,212,255,0.14), rgba(124,58,237,0.14))',
    border: '1px solid rgba(0,212,255,0.3)',
    borderRadius: '10px', color: '#00D4FF', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none',
  },

  /* Quick actions grid */
  actionGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.3rem', marginTop: '0.35rem' },
  actionIconBig: { width: '50px', height: '50px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(0,0,0,0.45)', marginBottom: '0.15rem' },
  actionIconGlyph: { fontSize: '1.25rem' },
  actionTileLabel: { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-h)', margin: 0, lineHeight: 1.2 },
  actionTileDesc:  { fontSize: '0.62rem', color: 'var(--text)', margin: 0, lineHeight: 1.25 },

  /* Study plan card */
  planDate:        { fontSize: '0.72rem', color: 'rgba(148,163,184,0.55)', marginBottom: '0.85rem', fontWeight: 600, letterSpacing: '0.02em' },
  planPreview:     { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1rem 1.1rem', marginBottom: '1rem' },
  planPreviewHead: { fontSize: '0.83rem', fontWeight: 700, color: 'var(--text-h)', margin: '0 0 0.3rem', lineHeight: 1.35 },
  planPreviewLine: { fontSize: '0.78rem', color: 'var(--text)', margin: '0 0 0.15rem', lineHeight: 1.45 },
  planFade:        { fontSize: '0.78rem', color: 'var(--text)', margin: '0.2rem 0 0', opacity: 0.4 },
  viewPlanBtn:     {
    padding: '0.52rem 1.3rem',
    background: 'var(--grad-primary)',
    color: '#fff', border: 'none', borderRadius: 'var(--btn-radius)', fontSize: '0.8rem', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: 'var(--btn-shadow)',
    transition: 'box-shadow 0.2s, transform 0.18s',
  },

  /* Full-plan modal */
  modalOverlay: {
    position: 'fixed' as const, inset: 0,
    background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(10px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: '1rem',
  },
  modalBox: {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--card-radius)', width: '100%', maxWidth: '780px',
    maxHeight: '85vh', display: 'flex', flexDirection: 'column',
    boxShadow: 'var(--card-hover-shadow)',
    backdropFilter: 'blur(var(--glass-blur))',
  },
  modalHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '1.4rem 1.6rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
  },
  modalTitle:  { margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-h)' },
  modalSub:    { margin: '0.25rem 0 0', fontSize: '0.78rem', color: 'var(--text)' },
  modalClose:  { background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '1.15rem', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '8px', lineHeight: 1 },
  modalBody:   { flex: 1, overflowY: 'auto' as const, padding: '1.4rem 1.6rem' },
  modalFooter: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', padding: '1.1rem 1.6rem', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
  modalMentorLink: { fontSize: '0.82rem', color: '#00D4FF', textDecoration: 'none', fontWeight: 700 },
  modalCloseBtn: {
    padding: '0.52rem 1.4rem',
    background: 'linear-gradient(135deg, #00D4FF, #7C3AED)',
    border: 'none', borderRadius: '10px', color: '#fff', fontSize: '0.82rem', fontWeight: 700,
    fontFamily: 'inherit', cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0,212,255,0.32)',
  },
};

// ── Smart Plan styles ──────────────────────────────────────────────
const sp: Record<string, React.CSSProperties> = {
  card: {
    position: 'relative',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 'var(--card-radius)',
    padding: '1.75rem',
    overflow: 'hidden',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
  },
  title: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 800,
    color: 'var(--text-h)',
    letterSpacing: '-0.2px',
  },
  regenBtn: {
    padding: '0.4rem 1rem',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '99px',
    color: 'var(--text-m)',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.01em',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    transition: 'background 0.25s, border-color 0.25s',
  },

  // Empty / loading states
  emptyWrap: { textAlign: 'center' as const, padding: '2rem 1rem' },
  emptyIcon: { fontSize: '2.5rem', margin: '0 0 0.75rem' },
  emptyTitle: { margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text-h)' },
  emptySub: { margin: '0 0 1.5rem', fontSize: '0.83rem', color: 'var(--text)', lineHeight: 1.5, maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' },
  generateBigBtn: {
    padding: '0.65rem 1.75rem',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 'var(--btn-radius)',
    color: 'var(--text-h)',
    fontSize: '0.88rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
    transition: 'background 0.25s, border-color 0.25s, box-shadow 0.25s',
  },
  loadingWrap: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '0.85rem', padding: '2.5rem 1rem' },
  spinner: { width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid var(--primary)', borderRadius: '50%' },
  loadingText: { fontSize: '0.85rem', color: 'var(--text)', margin: 0 },
  errorBox: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#fca5a5', marginBottom: '1rem' },

  // Headline
  headline: { marginBottom: '1.5rem' },
  headlineText: { margin: '0 0 0.75rem', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-h)', lineHeight: 1.4 },
  scoreFrom: { color: '#fbbf24', fontWeight: 800 },
  scoreTo:   { color: '#34d399', fontWeight: 800 },
  hoursBadge: {
    display: 'inline-block',
    padding: '0.3rem 0.9rem',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '99px',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--text-m)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },

  // 7-day grid
  dayGrid: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '0.55rem', marginBottom: '1.5rem' },
  dayCol: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '0.7rem 0.55rem',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    transition: 'background 0.2s, border-color 0.2s',
  },
  dayName: {
    margin: '0 0 0.55rem',
    fontSize: '0.65rem',
    fontWeight: 800,
    color: 'var(--section-accent)',
    letterSpacing: '0.08em',
    textAlign: 'center' as const,
  },
  taskCard: { display: 'flex', gap: '0.35rem', alignItems: 'flex-start', marginBottom: '0.45rem' },
  taskDot: { width: '5px', height: '5px', borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: '5px' },
  taskText: { fontSize: '0.67rem', color: 'var(--text-m)', lineHeight: 1.45 },

  // Twin Report
  reportBox: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '1rem 1.1rem',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  reportTitle: { fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-m)', letterSpacing: '0.02em' },
  forecastText: { margin: 0, fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.6, fontStyle: 'italic' },
  downloadBtn: {
    padding: '0.3rem 0.8rem',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '8px',
    color: 'var(--text-m)',
    fontSize: '0.74rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    transition: 'background 0.2s, border-color 0.2s',
  },
};

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, FileText, BarChart2, Trophy, Brain, Zap,
  MessageCircle, Layers, Menu, Rocket, Mic2, ChevronDown, Video,
  Shield, TrendingUp, Sword, ShoppingBag, Dumbbell,
} from 'lucide-react';
import XPShopModal from '../components/XPShopModal';
import { XPStoreProvider } from '../contexts/XPStoreContext';
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
import {
  getLevelColor, getLevelGradient,
  type GamificationProgress,
} from '../utils/gamification';
import BurnoutWidget from '../components/BurnoutWidget';
import SubjectWidgets from '../components/SubjectWidgets';
import AICommandCenter from '../components/AICommandCenter';
import AITwinAssistant from '../components/AITwinAssistant';
import SmartDailyMission from '../components/SmartDailyMission';
import HeroPriorityCard from '../components/HeroPriorityCard';
import StreakShieldCard from '../components/StreakShieldCard';
import WeeklyChallengesModal from '../components/WeeklyChallengesModal';

const BACKEND = BACKEND_URL;

interface LearningEntry {
  date: string;
  study_hours: number;
  attendance_percentage: number;
  assignment_completion_rate: number;
  stress_level: number;
}

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

function useCounter(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    let start: number | null = null;
    let raf = 0;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.round(p * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/* ── 7-day bar chart ── */
function StudyChart({ data }: { data: { date: string; hours: number; label: string }[] }) {
  const max = Math.max(...data.map(d => d.hours), 1);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', paddingTop: '0.5rem' }}>
      {data.map((d, i) => {
        const isToday = d.date === today;
        const barH = Math.max((d.hours / max) * 80, d.hours > 0 ? 6 : 2);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.58rem', color: 'var(--text)', height: '12px', lineHeight: '12px', opacity: d.hours > 0 ? 1 : 0 }}>{d.hours}h</span>
            <div style={{ width: '100%', height: '80px', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{
                width: '100%', borderRadius: '4px 4px 0 0',
                height: `${barH}px`,
                background: isToday
                  ? 'var(--grad-primary)'
                  : d.hours > 0
                    ? 'linear-gradient(180deg,rgba(var(--primary-rgb),0.65),rgba(var(--primary-rgb),0.35))'
                    : 'var(--border)',
                boxShadow: isToday ? `0 0 14px rgba(var(--primary-rgb),0.55)` : 'none',
                transition: 'height 0.7s cubic-bezier(0.4,0,0.2,1)',
              }} />
            </div>
            <span style={{
              fontSize: '0.63rem', letterSpacing: '0.02em',
              color: isToday ? '#818cf8' : 'var(--text)',
              fontWeight: isToday ? 700 : 400,
            }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Quick Stat Card ── */
function QuickStatCard({ icon, label, value, unit = '', grad, delay }: {
  icon: string; label: string; value: number; unit?: string; grad: string; delay: number;
}) {
  const count = useCounter(value);
  return (
    <div
      className="quick-stat-card animate-slide-up"
      style={{ ...qs.card, animationDelay: `${delay}ms` }}
    >
      <div style={{ ...qs.iconWrap, background: grad }}>
        <span style={qs.icon}>{icon}</span>
      </div>
      <div>
        <p style={qs.value}>{count.toLocaleString()}{unit}</p>
        <p style={qs.label}>{label}</p>
      </div>
    </div>
  );
}

const qs: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex', flexDirection: 'column', gap: '0.85rem',
    padding: '1.3rem',
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--card-radius)',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    boxShadow: 'var(--card-shadow)',
  },
  iconWrap: {
    width: '44px', height: '44px', borderRadius: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
  },
  icon: { fontSize: '1.2rem' },
  value: {
    fontSize: '1.75rem', fontWeight: 900, lineHeight: 1.1, margin: '0 0 0.15rem',
    background: 'var(--grad-primary)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  label: {
    margin: 0, fontSize: '0.63rem', color: 'rgba(148,163,184,0.65)',
    fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
  },
};

/* ── Section Header ── */
function SectionHeader({ badge, title, cta, ctaTo }: {
  badge: string; title: string; cta?: string; ctaTo?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
      <div>
        <p className="section-badge-grad" style={{
          margin: '0 0 0.3rem', fontSize: '0.63rem', fontWeight: 800,
          letterSpacing: '0.14em', textTransform: 'uppercase' as const,
        }}>{badge}</p>
        <h2 style={{
          margin: 0, fontSize: '1.5rem', fontWeight: 800,
          color: 'var(--text-h)', letterSpacing: '-0.5px',
        }}>{title}</h2>
      </div>
      {cta && ctaTo && (
        <Link to={ctaTo} style={{
          fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none',
          fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem',
          paddingBottom: '0.15rem', opacity: 0.85, flexShrink: 0,
        }}>
          {cta} →
        </Link>
      )}
    </div>
  );
}

/* ── Dropdown Item ── */
function DDItem({ icon: Icon, label, desc, to }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>; label: string; desc: string; to: string;
}) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div className="dd-item" style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.6rem 0.85rem', borderRadius: '10px', cursor: 'pointer',
      }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
          background: 'rgba(var(--primary-rgb), 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--primary)',
        }}>
          <Icon size={15} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#f1f5f9' }}>{label}</p>
          <p style={{ margin: 0, fontSize: '0.67rem', color: 'rgba(148,163,184,0.65)' }}>{desc}</p>
        </div>
      </div>
    </Link>
  );
}

/* ── Data constants ── */
interface SavedPlan { id: number; plan_text: string; created_at: string }
interface CalEvent  { id: string; title: string; start: string; link: string }
interface DayPlan   { day: string; tasks: string[] }
interface SmartPlan {
  current_score: number;
  target_score: number;
  daily_hours: number;
  forecast: string;
  days: DayPlan[];
}

/* ══════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
   ══════════════════════════════════════════════ */
export default function Dashboard() {
  const { user, token, logout, studentProfile } = useAuth();
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
  const [savedPlan,         setSavedPlan]         = useState<SavedPlan | null>(null);
  const [showPlanModal,     setShowPlanModal]     = useState(false);
  const [calEvents,         setCalEvents]         = useState<CalEvent[]>([]);
  const [smartPlan,         setSmartPlan]         = useState<SmartPlan | null>(null);
  const [planLoading,       setPlanLoading]       = useState(false);
  const [planError,         setPlanError]         = useState<string | null>(null);
  const [gamProgress,     setGamProgress]     = useState<GamificationProgress | null>(null);
  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [shopOpen,        setShopOpen]        = useState(false);
  const [challengeOpen,   setChallengeOpen]   = useState(false);
  const [profileDropOpen, setProfileDropOpen] = useState(false);
  const profileDropRef = useRef<HTMLDivElement>(null);

  // Dropdown nav state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const ddTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ddOpen = (name: string) => {
    if (ddTimer.current) clearTimeout(ddTimer.current);
    setOpenDropdown(name);
  };
  const ddClose = () => {
    ddTimer.current = setTimeout(() => setOpenDropdown(null), 160);
  };
  const ddStay = () => {
    if (ddTimer.current) clearTimeout(ddTimer.current);
  };

  useEffect(() => {
    if (!profileDropOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileDropRef.current && !profileDropRef.current.contains(e.target as Node)) {
        setProfileDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileDropOpen]);

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
    api.get<SavedPlan>('/mentor/study-plan/saved').then(r => setSavedPlan(r.data)).catch(() => setSavedPlan(null));
    api.get<{ events: CalEvent[] }>('/calendar/upcoming').then(r => setCalEvents(r.data.events)).catch(() => {});
    api.get<GamificationProgress>('/gamification/progress').then(r => setGamProgress(r.data)).catch(() => {});
    api.get<SmartPlan>('/smart-plan/current').then(r => setSmartPlan(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id || !token) return;
    let dead = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      if (dead) return;
      const ws = new WebSocket(`${WS_URL}/ws/${user.id}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onopen = () => setWsConnected(true);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as { type: string };
          if (msg.type === 'checkin_update') refreshData();
        } catch { /* ignore */ }
      };
      ws.onclose = () => { setWsConnected(false); if (!dead) reconnectTimer = setTimeout(connect, 3000); };
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
    setPlanLoading(true); setPlanError(null);
    try {
      const { data } = await api.post<SmartPlan>('/smart-plan/generate');
      setSmartPlan(data);
      api.post('/smart-plan/save', data).catch(() => {});
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setPlanError(detail ?? 'Failed to generate plan. Please try again.');
    } finally { setPlanLoading(false); }
  }

  function downloadPDF(plan: SmartPlan) {
    const rows = plan.days.map(d => `
      <div class="day-col"><div class="day-name">${d.day.slice(0, 3)}</div>
      ${d.tasks.map(t => `<div class="task">${t}</div>`).join('')}</div>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>TwinMind Smart Plan</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:2rem;color:#0f172a;background:#fff}
h1{font-size:1.4rem;font-weight:800;color:#4338ca;margin:0 0 0.25rem}.sub{font-size:0.9rem;color:#475569;margin:0 0 1.5rem}
.badge{display:inline-block;background:#eef2ff;color:#4338ca;border-radius:99px;padding:0.25rem 0.85rem;font-size:0.82rem;font-weight:700;margin-bottom:1.5rem}
.grid{display:flex;gap:0.75rem;margin-bottom:1.5rem}.day-col{flex:1;background:#f8fafc;border-radius:10px;padding:0.75rem;border:1px solid #e2e8f0}
.day-name{font-size:0.75rem;font-weight:800;color:#4338ca;text-transform:uppercase;letter-spacing:.06em;margin-bottom:0.5rem}
.task{font-size:0.72rem;color:#334155;padding:0.35rem 0;border-bottom:1px solid #e2e8f0;line-height:1.4}.task:last-child{border-bottom:none}
.report{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1rem;margin-top:0.5rem}
.report-title{font-size:0.8rem;font-weight:700;color:#4338ca;margin:0 0 0.4rem}.forecast{font-size:0.82rem;color:#475569;line-height:1.5;margin:0}
@media print{body{padding:1rem}}</style></head><body>
<h1>TwinMind Smart Plan</h1>
<p class="sub">Raise expected performance from <strong>${plan.current_score}%</strong> to <strong>${plan.target_score}%</strong> over the next 3 weeks</p>
<div class="badge">${plan.daily_hours}h/day recommended</div>
<div class="grid">${rows}</div>
<div class="report"><p class="report-title">Twin Report</p><p class="forecast">${plan.forecast}</p></div>
</body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html); win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  }

  const streak     = computeStreak(entries);
  const totalHours = Math.round(entries.reduce((s, e) => s + e.study_hours, 0));
  const last7      = getLast7Days(entries);
  const health     = computeTwinHealth(entries);
  const weekHours  = last7.reduce((s, d) => s + d.hours, 0);

  /* ── NAV GROUPS ── */
  const navGroups = [
    {
      id: 'learning', label: t('nav_group_learning'),
      items: [
        { icon: BookOpen,      label: t('nav_sessions'),    desc: 'Track study sessions',       to: '/sessions',      tour: 'sessions'  },
        { icon: FileText,      label: t('nav_smart_notes'), desc: 'AI-enhanced notes',          to: '/notes'                           },
        { icon: Brain,         label: t('nav_quiz'),        desc: 'Adaptive practice quizzes',  to: '/quiz',          tour: 'quiz'      },
        { icon: Video,         label: t('nav_videos'),      desc: 'Video learning resources',   to: '/videos'                          },
      ],
    },
    {
      id: 'performance', label: t('nav_group_performance'),
      items: [
        { icon: BarChart2,     label: t('nav_progress'),      desc: 'Track your progress',        to: '/progress'                        },
        { icon: Trophy,        label: t('nav_achievements'),  desc: 'Badges & milestones',        to: '/achievements'                    },
        { icon: TrendingUp,    label: t('nav_predict'),       desc: 'AI score prediction',        to: '/predict'                         },
        { icon: Shield,        label: t('nav_burnout'),       desc: 'Monitor & prevent burnout',  to: '/burnout'                         },
      ],
    },
    {
      id: 'ai', label: t('nav_group_ai'),
      items: [
        { icon: Layers,        label: t('nav_twin'),        desc: 'Your digital study twin',    to: '/twin',          tour: 'twin'     },
        { icon: Rocket,        label: t('nav_career'),      desc: 'Career guidance & insights', to: '/career'                          },
        { icon: Mic2,          label: t('nav_comm_twin'),   desc: 'Communication practice',     to: '/comm-twin'                       },
        { icon: MessageCircle, label: t('nav_mentor'),      desc: 'Personalized AI mentor',     to: '/mentor',        tour: 'mentor'   },
        { icon: Zap,           label: t('nav_simulate'),    desc: 'Exam simulation',            to: '/simulate',      tour: 'simulate' },
        { icon: Sword,         label: t('nav_battles'),     desc: 'Competitive quiz battles',   to: '/battles'                         },
      ],
    },
  ];

  return (
    <XPStoreProvider>
    <div style={s.shell}>
      <XPShopModal isOpen={shopOpen} onClose={() => setShopOpen(false)} />
      <WeeklyChallengesModal isOpen={challengeOpen} onClose={() => setChallengeOpen(false)} />
      <MobileNav
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userName={user?.full_name ?? undefined}
        avatarSrc={avatarSrc ?? undefined}
        onLogout={logout}
      />

      {/* ══ NAVBAR ══ */}
      <header style={s.nav} className="nav-premium mob-nav">
        <div style={s.navLeft}>
          <button className="mob-hamburger" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
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

        {/* Grouped nav with dropdowns */}
        <nav style={s.navCenter} className="mob-nav-links">
          <Link to="/" className="nav-link" style={{ fontWeight: 700, color: 'var(--primary)' }}
                data-tour="dashboard">
            Dashboard
          </Link>
          <div style={s.navDivider} />
          {navGroups.flatMap((group, gi) => {
            const dropdown = (
              <div
                key={group.id}
                style={{ position: 'relative' }}
                onMouseEnter={() => ddOpen(group.id)}
                onMouseLeave={ddClose}
              >
                <button
                  className="nav-dd-btn nav-link"
                  style={s.ddTrigger}
                >
                  {group.label}
                  <ChevronDown
                    size={13}
                    style={{
                      opacity: 0.6,
                      transition: 'transform 0.22s ease',
                      transform: openDropdown === group.id ? 'rotate(180deg)' : 'none',
                    }}
                  />
                </button>
                {openDropdown === group.id && (
                  <div
                    style={s.ddMenu}
                    className="dd-menu-animate"
                    onMouseEnter={ddStay}
                    onMouseLeave={ddClose}
                  >
                    {group.items.map(item => (
                      <DDItem
                        key={item.to}
                        icon={item.icon}
                        label={item.label}
                        desc={item.desc}
                        to={item.to}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
            if (gi === 2) {
              return [
                <Link key="nav-checkin" to="/checkin" className="nav-link" style={{ fontWeight: 600 }}
                      data-tour="checkin">
                  Check-in
                </Link>,
                dropdown,
              ];
            }
            return [dropdown];
          })}
        </nav>

        <div style={s.navRight} className="mob-nav-right">
          <span className="mob-hide-mobile"><LanguageSwitcher /></span>
          <ThemeToggle />
          <button
            onClick={() => setChallengeOpen(true)}
            title="Weekly Challenges"
            aria-label="Open Weekly Challenges"
            style={{
              background: 'none', border: '1px solid rgba(var(--primary-rgb),0.2)',
              borderRadius: '9px', width: '34px', height: '34px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--primary)', transition: 'border-color 0.2s, box-shadow 0.2s',
              fontFamily: 'inherit',
            }}
          >
            <Dumbbell size={16} />
          </button>
          <button
            onClick={() => setShopOpen(true)}
            className="nav-shop-btn"
            title="XP Shop"
            aria-label="Open XP Shop"
            style={{
              background: 'none', border: '1px solid rgba(var(--primary-rgb),0.2)',
              borderRadius: '9px', width: '34px', height: '34px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--primary)', transition: 'border-color 0.2s, box-shadow 0.2s',
              fontFamily: 'inherit',
            }}
          >
            <ShoppingBag size={16} />
          </button>
          <span className="mob-hide-mobile"><NotificationBell /></span>
          {/* ── Profile avatar + dropdown ── */}
          <div ref={profileDropRef} style={{ position: 'relative' }} data-tour="profile">
            <button
              className="profile-avatar-btn"
              data-tooltip="Profile"
              onClick={() => setProfileDropOpen(o => !o)}
              aria-label="Profile menu"
              style={{
                width: '34px', height: '34px', borderRadius: '50%',
                boxShadow: profileDropOpen
                  ? '0 0 0 2px rgba(0,212,255,0.6), 0 0 18px rgba(0,212,255,0.35)'
                  : '0 0 0 2px rgba(0,212,255,0.3), 0 0 12px rgba(0,212,255,0.15)',
              }}
            >
              {avatarSrc
                ? <img src={avatarSrc} alt="" style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                : (
                  <span style={{
                    width: '34px', height: '34px', borderRadius: '50%',
                    background: 'linear-gradient(135deg,rgba(0,212,255,0.18),rgba(124,58,237,0.18))',
                    border: '2px solid rgba(0,212,255,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.72rem', fontWeight: 800, color: '#00D4FF',
                  }}>
                    {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                  </span>
                )
              }
            </button>

            {profileDropOpen && (
              <div
                className="profile-drop-animate"
                style={{
                  position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                  minWidth: '268px', zIndex: 500,
                  background: 'rgba(4,8,22,0.96)',
                  border: '1px solid rgba(0,212,255,0.16)',
                  borderRadius: '18px',
                  backdropFilter: 'blur(32px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(32px) saturate(200%)',
                  boxShadow: '0 0 0 1px rgba(0,212,255,0.06), 0 20px 60px rgba(0,0,0,0.65)',
                  overflow: 'hidden',
                }}
              >
                {/* User info header */}
                <div style={{ padding: '1.1rem 1.1rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ flexShrink: 0 }}>
                    {avatarSrc
                      ? <img src={avatarSrc} alt="" style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(0,212,255,0.35)', boxShadow: '0 0 14px rgba(0,212,255,0.25)' }} />
                      : (
                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg,rgba(0,212,255,0.2),rgba(124,58,237,0.2))', border: '2px solid rgba(0,212,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800, color: '#00D4FF', boxShadow: '0 0 16px rgba(0,212,255,0.25)' }}>
                          {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                        </div>
                      )
                    }
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: '0 0 0.08rem', fontSize: '0.88rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.full_name}</p>
                    <p style={{ margin: '0 0 0.05rem', fontSize: '0.67rem', color: 'rgba(148,163,184,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
                    {studentProfile?.course && (
                      <p style={{ margin: 0, fontSize: '0.67rem', color: 'rgba(0,212,255,0.65)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{studentProfile.course}</p>
                    )}
                  </div>
                </div>

                {/* XP / Level row */}
                {gamProgress && (
                  <div style={{ padding: '0.75rem 1.1rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: getLevelGradient(gamProgress.level), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: '#fff', flexShrink: 0 }}>{gamProgress.level}</div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: getLevelColor(gamProgress.level) }}>{gamProgress.level_name}</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b' }}>⭐ {(gamProgress.xp ?? 0).toLocaleString()} XP</span>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${gamProgress.progress_pct ?? 0}%`, background: getLevelGradient(gamProgress.level), borderRadius: '99px', transition: 'width 0.6s ease' }} />
                    </div>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.63rem', color: 'rgba(148,163,184,0.42)' }}>{(gamProgress.xp_to_next ?? 0) > 0 ? `${gamProgress.xp_to_next} XP to level up` : 'Max level reached!'}</p>
                  </div>
                )}

                {/* Navigation links */}
                <div style={{ padding: '0.45rem 0.45rem' }}>
                  <Link to="/profile" className="profile-drop-item" onClick={() => setProfileDropOpen(false)} style={{ textDecoration: 'none' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(var(--primary-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#f1f5f9' }}>Profile & Settings</p>
                      <p style={{ margin: 0, fontSize: '0.65rem', color: 'rgba(148,163,184,0.5)' }}>Edit your info & preferences</p>
                    </div>
                  </Link>
                  <Link to="/achievements" className="profile-drop-item" onClick={() => setProfileDropOpen(false)} style={{ textDecoration: 'none' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#f1f5f9' }}>Achievements</p>
                      <p style={{ margin: 0, fontSize: '0.65rem', color: 'rgba(148,163,184,0.5)' }}>Badges & milestones</p>
                    </div>
                  </Link>
                </div>

                {/* Sign out */}
                <div style={{ padding: '0.45rem 0.45rem 0.55rem', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <button
                    onClick={() => { setProfileDropOpen(false); logout(); }}
                    className="profile-drop-item"
                    style={{ width: '100%', background: 'none', border: 'none', fontFamily: 'inherit', textAlign: 'left' }}
                  >
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#fca5a5' }}>{t('sign_out')}</p>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ══ MAIN CONTENT ══ */}
      <main style={s.main} className="mob-dash-main">

        {/* ── S1: HERO AREA ── */}
        <section style={s.heroGrid} className="mob-hero-grid animate-slide-up" data-tour="dashboard">
          {/* LEFT: Welcome */}
          <div style={s.heroCard} className="hero-animated hero-card-left mob-hero-card">
            <div style={s.heroOrb1} />
            <div style={s.heroOrb2} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={s.greetingLabel}>{greeting} ✦</p>
              <h1 style={s.heroName}>
                {firstName}&nbsp;
                <span style={{ display: 'inline-block', animation: 'float 3s ease-in-out infinite' }}>👋</span>
              </h1>
              <p style={s.heroSub}>Your AI-powered learning companion is ready.</p>

              {gamProgress && (
                <div style={s.goalChip}>
                  <div style={{
                    ...s.goalLevelBadge,
                    background: getLevelGradient(gamProgress.level),
                    boxShadow: `0 4px 12px ${getLevelColor(gamProgress.level)}55`,
                  }}>
                    {gamProgress.level}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={s.goalLevelName}>{gamProgress.level_name}</p>
                    <div style={s.goalXpBar}>
                      <div style={{
                        ...s.goalXpFill,
                        width: `${gamProgress.progress_pct}%`,
                        background: getLevelGradient(gamProgress.level),
                      }} />
                    </div>
                    <p style={s.goalXpText}>{(gamProgress.xp ?? 0).toLocaleString()} XP · {(gamProgress.xp_to_next ?? 0) > 0 ? `${gamProgress.xp_to_next} to level up` : 'Max level!'}</p>
                  </div>
                </div>
              )}

              <div style={s.quoteBox}>
                <span style={s.quoteMark}>"</span>
                <div>
                  <p style={s.quoteText}>{quote.text}</p>
                  <p style={s.quoteAuthor}>— {quote.author}</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: AI Priority */}
          <div style={s.heroPriority} className="mob-hero-priority">
            <HeroPriorityCard />
          </div>
        </section>

        {/* ── S2: QUICK STATS STRIP ── */}
        <div style={s.statsStrip} className="mob-stats-strip">
          <QuickStatCard icon="⏱"  label="Study Hours"  value={totalHours}            unit="h"  grad="linear-gradient(135deg,#6366f1,#818cf8)" delay={0}   />
          <QuickStatCard icon="🔥" label="Day Streak"   value={streak}                          grad="linear-gradient(135deg,#f59e0b,#fbbf24)" delay={60}  />
          <QuickStatCard icon="▶"  label="Sessions"     value={sessionCount}                     grad="linear-gradient(135deg,#00D4FF,#3b82f6)" delay={120} />
          <QuickStatCard icon="📝" label="Smart Notes"  value={noteCount}                        grad="linear-gradient(135deg,#10b981,#34d399)" delay={180} />
          <QuickStatCard icon="🏆" label="Badges"       value={badgeCount}                       grad="linear-gradient(135deg,#f59e0b,#d97706)" delay={240} />
          <QuickStatCard icon="⭐" label="XP Points"    value={gamProgress?.xp ?? 0}             grad="linear-gradient(135deg,#8b5cf6,#a78bfa)" delay={300} />
        </div>

        {/* ── S3: PERFORMANCE ANALYTICS ── */}
        <section className="dash-section">
          <SectionHeader badge="PERFORMANCE" title="Analytics & Insights" cta="Full Report" ctaTo="/progress" />
          <div style={s.perfGrid} className="mob-mid-row">
            {/* 7-day chart */}
            <div style={s.panel} className="glass-panel">
              <div style={s.panelHead}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📈</span>
                  <h3 style={s.panelTitle}>{t('chart_title') || '7-Day Study Activity'}</h3>
                </div>
                <Link to="/checkin" style={s.panelCta}>{t('chart_log_today') || 'Log Today'}</Link>
              </div>
              {last7.some(d => d.hours > 0) ? (
                <>
                  <StudyChart data={last7} />
                  <div style={s.chartFooter}>
                    <span style={s.chartStat}>This Week&nbsp;<strong style={s.chartStatVal}>{weekHours.toFixed(1)}h</strong></span>
                    <span style={s.chartStat}>Daily Avg&nbsp;<strong style={s.chartStatVal}>{(weekHours / 7).toFixed(1)}h</strong></span>
                  </div>
                </>
              ) : (
                <div style={s.emptyState}>
                  <p style={s.emptyIcon}>📊</p>
                  <p style={s.emptyText}>{t('no_data_title') || 'No Data Yet'}</p>
                  <p style={s.emptySub}>{t('no_data_sub') || 'Log a check-in to activate your study chart'}</p>
                  <Link to="/checkin" style={s.emptyBtn}>Log Check-in</Link>
                </div>
              )}
            </div>

            {/* Subject Intelligence */}
            <div style={s.panel} className="glass-panel">
              <div style={s.panelHead}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📊</span>
                  <h3 style={s.panelTitle}>Subject Intelligence</h3>
                </div>
                <Link to="/subjects" style={s.panelCta}>Full Analysis →</Link>
              </div>
              <SubjectWidgets />
            </div>
          </div>
        </section>

        {/* ── S4: AI COMMAND CENTER (live metrics) ── */}
        <section className="dash-section">
          <SectionHeader badge="AI INTELLIGENCE" title="Live Performance Monitor" />
          <AICommandCenter brainReadiness={health.pct} streak={streak} level={gamProgress?.level} />
        </section>

        {/* ── S5: STREAK PROTECTION ── */}
        <section className="dash-section">
          <SectionHeader badge="STREAK PROTECTION" title="Streak Shield System" cta="XP Shop" ctaTo="/shop" />
          <StreakShieldCard />
        </section>

        {/* ── S6: WELLNESS CENTER ── */}
        <section className="dash-section">
          <SectionHeader badge="WELLNESS & FOCUS" title="Mental Health Center" cta="Full Report" ctaTo="/burnout" />
          <div style={s.wellnessGrid} className="mob-wellness-grid">
            <div style={s.panel} className="glass-panel">
              <div style={s.panelHead}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🧠</span>
                  <h3 style={s.panelTitle}>Burnout Risk Monitor</h3>
                </div>
                <Link to="/burnout" style={s.panelCta}>Full Analysis →</Link>
              </div>
              <BurnoutWidget />
              <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.45rem', flexWrap: 'wrap' as const }}>
                {[
                  { label: '0–39 Low',     color: '#10b981' },
                  { label: '40–69 Medium', color: '#f59e0b' },
                  { label: '70+ High',     color: '#ef4444' },
                ].map(r => (
                  <span key={r.label} style={{
                    padding: '0.2rem 0.6rem', borderRadius: '99px',
                    fontSize: '0.65rem', fontWeight: 600,
                    background: `${r.color}15`, color: r.color,
                    border: `1px solid ${r.color}30`,
                  }}>{r.label}</span>
                ))}
              </div>
            </div>
            <SmartDailyMission />
          </div>
        </section>

        {/* ── S7: AI TWIN ASSISTANT ── */}
        <section className="dash-section">
          <SectionHeader badge="DIGITAL TWIN" title="Twin Intelligence Hub" />
          <AITwinAssistant />
        </section>

        {/* ── S8: SMART PLAN ── */}
        <section style={sp.card} className="dash-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.15rem' }}>◈</span>
              <h2 style={sp.title}>Smart Study Plan</h2>
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
              <p style={sp.emptySub}>Generate a personalized 7-day study plan based on your performance data, weak areas, and academic goals.</p>
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

        {/* ── S9: CALENDAR EVENTS ── */}
        {calEvents.length > 0 && (
          <section style={s.panel} className="glass-panel dash-section">
            <div style={s.panelHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📅</span>
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

        {/* ── S10: MY STUDY PLAN ── */}
        <section style={s.panel} className="glass-panel dash-section">
          <div style={s.panelHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📋</span>
              <h2 style={s.panelTitle}>{t('my_study_plan') || 'My Study Plan'}</h2>
            </div>
            <Link to="/mentor" style={s.panelCta}>{t('generate_new') || 'Generate New'}</Link>
          </div>
          {savedPlan ? (
            <div>
              <p style={s.planDate}>
                {t('plan_saved') || 'Saved'}{' '}
                {new Date(savedPlan.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <div style={s.planPreview}>
                {savedPlan.plan_text.split('\n').filter(l => l.trim()).slice(0, 4).map((line, i) => {
                  const clean = line.replace(/^#{1,3}\s*/, '').replace(/\*\*/g, '');
                  return <p key={i} style={i === 0 ? s.planPreviewHead : s.planPreviewLine}>{clean}</p>;
                })}
                <p style={s.planFade}>…</p>
              </div>
              <button onClick={() => setShowPlanModal(true)} style={s.viewPlanBtn}>{t('view_full_plan') || 'View Full Plan'}</button>
            </div>
          ) : (
            <div style={s.emptyState}>
              <p style={s.emptyIcon}>📋</p>
              <p style={s.emptyText}>{t('no_plan_title') || 'No Plan Yet'}</p>
              <p style={s.emptySub}>{t('no_plan_sub') || 'Generate a personalized AI study plan to get started'}</p>
              <Link to="/mentor" style={s.emptyBtn}>{t('go_to_mentor') || 'Go to AI Mentor'}</Link>
            </div>
          )}
        </section>

      </main>

      <TutorialOverlay />

      {/* Full Plan Modal */}
      {showPlanModal && savedPlan && (
        <div style={s.modalOverlay} className="mob-modal-overlay" onClick={() => setShowPlanModal(false)}>
          <div style={s.modalBox} className="mob-modal-box" onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <p style={s.modalTitle}>{t('modal_plan_title') || 'My Study Plan'}</p>
                <p style={s.modalSub}>
                  {t('plan_saved') || 'Saved'}{' '}
                  {new Date(savedPlan.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setShowPlanModal(false)} style={s.modalClose}>✕</button>
            </div>
            <div style={s.modalBody}><PlanContent text={savedPlan.plan_text} /></div>
            <div style={s.modalFooter}>
              <Link to="/mentor" style={s.modalMentorLink} onClick={() => setShowPlanModal(false)}>
                {t('modal_regenerate') || 'Regenerate Plan'}
              </Link>
              <button onClick={() => setShowPlanModal(false)} style={s.modalCloseBtn}>{t('close') || 'Close'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </XPStoreProvider>
  );
}

/* ══════════════════════════════
   STYLES
   ══════════════════════════════ */

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
  navLeft:   { display: 'flex', alignItems: 'center', gap: '0.55rem' },
  logoIcon:  { fontSize: '1.25rem', color: '#00D4FF', filter: 'drop-shadow(0 0 8px rgba(0,212,255,0.7))' },
  navLogo: {
    fontSize: '1.1rem', fontWeight: 900, letterSpacing: '-0.5px',
    background: 'linear-gradient(135deg, #00D4FF 0%, #a78bfa 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  navCenter: { display: 'flex', alignItems: 'center', gap: '0.15rem' },
  navRight:  { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  navDivider: { width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', flexShrink: 0, margin: '0 0.35rem' },
  liveBadge: { display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.22rem 0.7rem', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.28)', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 800, color: '#00D4FF', letterSpacing: '0.06em' },
  liveDot:   { width: '6px', height: '6px', borderRadius: '50%', background: '#00D4FF', boxShadow: '0 0 8px rgba(0,212,255,0.9)', flexShrink: 0 },

  /* Dropdown */
  ddTrigger: {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.38rem 0.65rem', borderRadius: '8px',
    background: 'transparent', border: 'none',
    fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)',
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'color 0.18s, background 0.18s',
    whiteSpace: 'nowrap' as const, letterSpacing: '0.01em',
  },
  ddMenu: {
    position: 'absolute' as const, top: 'calc(100% + 10px)', left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(4, 8, 22, 0.98)',
    border: '1px solid rgba(var(--primary-rgb), 0.16)',
    borderRadius: '16px', padding: '0.5rem',
    minWidth: '230px',
    backdropFilter: 'blur(28px) saturate(200%)',
    WebkitBackdropFilter: 'blur(28px) saturate(200%)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(var(--primary-rgb), 0.06)',
    zIndex: 100,
  },

  /* Main */
  main: { flex: 1, padding: '2rem 2rem 5rem', maxWidth: '1200px', width: '100%', margin: '0 auto', boxSizing: 'border-box' as const, display: 'flex', flexDirection: 'column', gap: '2rem' },

  /* Hero 2-col layout */
  heroGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'stretch' },

  /* Hero left card */
  heroCard: {
    position: 'relative', overflow: 'hidden',
    border: '1px solid rgba(0,212,255,0.14)',
    borderRadius: '24px', padding: '2.5rem 2.25rem',
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

  /* Hero text */
  greetingLabel: {
    margin: '0 0 0.6rem', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    background: 'linear-gradient(90deg, #00D4FF, #7C3AED)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  heroName: {
    fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', fontWeight: 900, letterSpacing: '-1.5px',
    margin: '0 0 0.4rem', lineHeight: 1.05,
    background: 'linear-gradient(135deg, #f8fafc 0%, #c7d2fe 45%, #00D4FF 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  heroSub: { margin: '0 0 1.5rem', fontSize: '0.95rem', color: 'rgba(148,163,184,0.85)', lineHeight: 1.55 },

  /* Goal / Level chip */
  goalChip: {
    display: 'flex', alignItems: 'center', gap: '0.85rem',
    padding: '0.85rem 1.1rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px', marginBottom: '1.25rem',
  },
  goalLevelBadge: {
    width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.82rem', fontWeight: 900, color: '#fff',
  },
  goalLevelName: { margin: '0 0 0.35rem', fontSize: '0.8rem', fontWeight: 700, color: '#f1f5f9' },
  goalXpBar:  { height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden', marginBottom: '0.25rem' },
  goalXpFill: { height: '100%', borderRadius: '99px', transition: 'width 0.8s ease' },
  goalXpText: { margin: 0, fontSize: '0.62rem', color: 'rgba(148,163,184,0.55)' },

  /* Quote */
  quoteBox:   { display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem 1.15rem', background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.14)', borderRadius: '14px', backdropFilter: 'blur(10px)' },
  quoteMark:  { fontSize: '1.6rem', color: '#00D4FF', lineHeight: 1, flexShrink: 0, marginTop: '-4px', opacity: 0.75 },
  quoteText:  { margin: '0 0 0.22rem', fontSize: '0.85rem', color: 'rgba(203,213,225,0.82)', lineHeight: 1.6, fontStyle: 'italic' },
  quoteAuthor:{ margin: 0, fontSize: '0.72rem', color: '#00D4FF', fontWeight: 700, opacity: 0.75 },

  /* Hero right */
  heroPriority: { display: 'flex', flexDirection: 'column' as const },

  /* Quick Stats Strip */
  statsStrip: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem' },

  /* Performance Grid */
  perfGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' },

  /* Wellness Grid */
  wellnessGrid: { display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: '1.5rem', alignItems: 'start' },

  /* Panels */
  panel: {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--card-radius)',
    padding: '1.6rem',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    boxShadow: 'var(--card-shadow)',
  },
  panelHead:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' },
  panelTitle: { fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-h)', margin: 0, letterSpacing: '-0.2px' },
  panelCta:   { fontSize: '0.75rem', color: 'var(--section-accent)', textDecoration: 'none', fontWeight: 700, opacity: 0.85, transition: 'opacity 0.2s' },

  /* Chart footer */
  chartFooter: { display: 'flex', gap: '1rem', marginTop: '0.85rem', paddingTop: '0.7rem', borderTop: '1px solid rgba(255,255,255,0.06)' },
  chartStat:   { fontSize: '0.75rem', color: 'var(--text)' },
  chartStatVal:{ color: 'var(--text-h)', fontWeight: 700 },

  /* Empty state */
  emptyState: { textAlign: 'center' as const, padding: '2rem 0' },
  emptyIcon:  { fontSize: '2.25rem', marginBottom: '0.6rem' },
  emptyText:  { fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-h)', marginBottom: '0.35rem' },
  emptySub:   { fontSize: '0.8rem', color: 'var(--text)', marginBottom: '1.25rem', lineHeight: 1.55 },
  emptyBtn: {
    display: 'inline-block', padding: '0.52rem 1.3rem',
    background: 'linear-gradient(135deg, rgba(0,212,255,0.14), rgba(124,58,237,0.14))',
    border: '1px solid rgba(0,212,255,0.3)',
    borderRadius: '10px', color: '#00D4FF', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none',
  },

  /* Study plan */
  planDate:        { fontSize: '0.72rem', color: 'rgba(148,163,184,0.55)', marginBottom: '0.85rem', fontWeight: 600 },
  planPreview:     { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1rem 1.1rem', marginBottom: '1rem' },
  planPreviewHead: { fontSize: '0.83rem', fontWeight: 700, color: 'var(--text-h)', margin: '0 0 0.3rem', lineHeight: 1.35 },
  planPreviewLine: { fontSize: '0.78rem', color: 'var(--text)', margin: '0 0 0.15rem', lineHeight: 1.45 },
  planFade:        { fontSize: '0.78rem', color: 'var(--text)', margin: '0.2rem 0 0', opacity: 0.4 },
  viewPlanBtn: {
    padding: '0.52rem 1.3rem',
    background: 'var(--grad-primary)', color: '#fff', border: 'none',
    borderRadius: 'var(--btn-radius)', fontSize: '0.8rem', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: 'var(--btn-shadow)', transition: 'box-shadow 0.2s, transform 0.18s',
  },

  /* Modals */
  modalOverlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' },
  modalBox:     { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--card-radius)', width: '100%', maxWidth: '780px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--card-hover-shadow)', backdropFilter: 'blur(var(--glass-blur))' },
  modalHeader:  { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '1.4rem 1.6rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
  modalTitle:   { margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-h)' },
  modalSub:     { margin: '0.25rem 0 0', fontSize: '0.78rem', color: 'var(--text)' },
  modalClose:   { background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '1.15rem', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '8px', lineHeight: 1 },
  modalBody:    { flex: 1, overflowY: 'auto' as const, padding: '1.4rem 1.6rem' },
  modalFooter:  { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', padding: '1.1rem 1.6rem', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
  modalMentorLink: { fontSize: '0.82rem', color: '#00D4FF', textDecoration: 'none', fontWeight: 700 },
  modalCloseBtn:   { padding: '0.52rem 1.4rem', background: 'linear-gradient(135deg, #00D4FF, #7C3AED)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,212,255,0.32)' },
};

/* ── Smart Plan styles ── */
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
  title: { margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-h)', letterSpacing: '-0.2px' },
  regenBtn: {
    padding: '0.4rem 1rem',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '99px', color: 'var(--text-m)',
    fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', letterSpacing: '0.01em',
    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
    transition: 'background 0.25s, border-color 0.25s',
  },
  emptyWrap:     { textAlign: 'center' as const, padding: '2rem 1rem' },
  emptyIcon:     { fontSize: '2.5rem', margin: '0 0 0.75rem' },
  emptyTitle:    { margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text-h)' },
  emptySub:      { margin: '0 0 1.5rem', fontSize: '0.83rem', color: 'var(--text)', lineHeight: 1.5, maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' },
  generateBigBtn: {
    padding: '0.65rem 1.75rem',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 'var(--btn-radius)', color: 'var(--text-h)',
    fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
    transition: 'background 0.25s, border-color 0.25s, box-shadow 0.25s',
  },
  loadingWrap: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '0.85rem', padding: '2.5rem 1rem' },
  spinner:     { width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid var(--primary)', borderRadius: '50%' },
  loadingText: { fontSize: '0.85rem', color: 'var(--text)', margin: 0 },
  errorBox:    { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#fca5a5', marginBottom: '1rem' },
  headline:    { marginBottom: '1.5rem' },
  headlineText:{ margin: '0 0 0.75rem', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-h)', lineHeight: 1.4 },
  scoreFrom:   { color: '#fbbf24', fontWeight: 800 },
  scoreTo:     { color: '#34d399', fontWeight: 800 },
  hoursBadge: {
    display: 'inline-block', padding: '0.3rem 0.9rem',
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '99px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-m)',
    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
  },
  dayGrid: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '0.55rem', marginBottom: '1.5rem' },
  dayCol: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', padding: '0.7rem 0.55rem',
    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
    transition: 'background 0.2s, border-color 0.2s',
  },
  dayName: { margin: '0 0 0.55rem', fontSize: '0.65rem', fontWeight: 800, color: 'var(--section-accent)', letterSpacing: '0.08em', textAlign: 'center' as const },
  taskCard:{ display: 'flex', gap: '0.35rem', alignItems: 'flex-start', marginBottom: '0.45rem' },
  taskDot: { width: '5px', height: '5px', borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: '5px' },
  taskText:{ fontSize: '0.67rem', color: 'var(--text-m)', lineHeight: 1.45 },
  reportBox: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px', padding: '1rem 1.1rem',
    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
  },
  reportTitle:  { fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-m)', letterSpacing: '0.02em' },
  forecastText: { margin: 0, fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.6, fontStyle: 'italic' },
  downloadBtn: {
    padding: '0.3rem 0.8rem',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '8px', color: 'var(--text-m)', fontSize: '0.74rem', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
    transition: 'background 0.2s, border-color 0.2s',
  },
};

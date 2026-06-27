import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, FileText, BarChart2, Trophy, Brain, Zap,
  MessageCircle, Layers, Menu, Rocket, Mic2, ChevronDown, Video,
  Shield, TrendingUp, Sword, Dumbbell,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { BrainIcon } from '../components/TwinMindLogo';
import { XPStoreProvider } from '../contexts/XPStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NotificationBell from '../components/NotificationBell';
import TutorialOverlay from '../components/TutorialOverlay';
import MobileNav from '../components/MobileNav';
import api from '../services/api';
import { BACKEND_URL, WS_URL } from '../lib/config';
import {
  getLevelColor, getLevelGradient,
  type GamificationProgress,
} from '../utils/gamification';
import BurnoutWidget from '../components/BurnoutWidget';

import AICommandCenter from '../components/AICommandCenter';

import SmartDailyMission from '../components/SmartDailyMission';
import HeroDigitalTwinCard from '../components/HeroDigitalTwinCard';
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

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } }
};

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
            <span style={{ fontSize: '0.58rem', color: '#64748b', height: '12px', lineHeight: '12px', opacity: d.hours > 0 ? 1 : 0 }}>{d.hours}h</span>
            <div style={{ width: '100%', height: '80px', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{
                width: '100%', borderRadius: '4px 4px 0 0',
                height: `${barH}px`,
                background: isToday
                  ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                  : d.hours > 0
                    ? 'linear-gradient(180deg, rgba(99,102,241,0.6), rgba(99,102,241,0.2))'
                    : '#e2e8f0',
                boxShadow: isToday ? `0 0 14px rgba(59,130,246,0.3)` : 'none',
                transition: 'height 0.7s cubic-bezier(0.4,0,0.2,1)',
              }} />
            </div>
            <span style={{
              fontSize: '0.63rem', letterSpacing: '0.02em',
              color: isToday ? '#4f46e5' : '#64748b',
              fontWeight: isToday ? 700 : 500,
            }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Quick Stat Card ── */
function QuickStatCard({ icon, label, value, unit = '', grad: _grad, delay }: {
  icon: string; label: string; value: number; unit?: string; grad: string; delay: number;
}) {
  const count = useCounter(value);
  return (
    <div
      className="quick-stat-card animate-slide-up"
      style={{ ...qs.card, animationDelay: `${delay}ms` }}
    >
      <div style={qs.iconWrap}>
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
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
    padding: '1.25rem',
    background: 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(226, 232, 240, 0.9)',
    borderRadius: '1.25rem',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)',
  },
  iconWrap: {
    width: '40px', height: '40px', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  },
  icon: { fontSize: '1.1rem' },
  value: {
    fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.15, margin: '0 0 0.15rem',
    color: '#0f172a',
  },
  label: {
    margin: 0, fontSize: '0.68rem', color: '#64748b',
    fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const,
  },
};

/* ── Section Header ── */
function SectionHeader({ badge, title, cta, ctaTo }: {
  badge: string; title: string; cta?: string; ctaTo?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
      <div>
        <p style={{
          margin: '0 0 0.3rem', fontSize: '0.7rem', fontWeight: 600,
          letterSpacing: '0.06em', textTransform: 'uppercase' as const,
          color: '#6366f1',
        }}>{badge}</p>
        <h2 style={{
          margin: 0, fontSize: '1.125rem', fontWeight: 700,
          color: '#0f172a', letterSpacing: '-0.02em',
        }}>{title}</h2>
      </div>
      {cta && ctaTo && (
        <Link to={ctaTo} style={{
          fontSize: '0.8rem', color: '#4f46e5', textDecoration: 'none',
          fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem',
          flexShrink: 0, opacity: 0.9,
          transition: 'opacity 0.18s',
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
      <div className="hm-dropdown-item">
        <div className="hm-dropdown-item-icon">
          <Icon size={14} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-high)' }}>{label}</p>
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{desc}</p>
        </div>
      </div>
    </Link>
  );
}

/* ── Data constants ── */
interface CalEvent  { id: string; title: string; start: string; link: string }

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
  const [calEvents,         setCalEvents]         = useState<CalEvent[]>([]);
  const [gamProgress,     setGamProgress]     = useState<GamificationProgress | null>(null);
  const [drawerOpen,      setDrawerOpen]      = useState(false);
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
    api.get<{ events: CalEvent[] }>('/calendar/upcoming').then(r => setCalEvents(r.data.events)).catch(() => {});
    api.get<GamificationProgress>('/gamification/progress').then(r => setGamProgress(r.data)).catch(() => {});
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

  const streak     = computeStreak(entries);
  const totalHours = Math.round(entries.reduce((s, e) => s + e.study_hours, 0));
  const last7      = getLast7Days(entries);
  const health     = computeTwinHealth(entries);
  const weekHours  = last7.reduce((s, d) => s + d.hours, 0);

  /* ── NAV GROUPS ── */
  const navGroups = [
    {
      id: 'learning', label: 'Learning',
      items: [
        { icon: FileText,      label: 'Notes',             desc: 'AI-enhanced note-taking',                    to: '/notes'                       },
        { icon: Brain,         label: 'Assessment Hub',    desc: 'AI-powered quizzes, exam preparation, and assessment tools', to: '/quiz', tour: 'quiz' },
        { icon: Zap,           label: 'Focus Session',     desc: 'Focus timer & study sessions',               to: '/sessions',   tour: 'sessions'},
        { icon: Video,         label: 'Video Recommender', desc: 'AI-powered YouTube study recommendations',   to: '/videos'                      },
      ],
    },
    {
      id: 'performance', label: 'Performance',
      items: [
        { icon: Layers,        label: 'Subject Analysis',   desc: 'AI subject performance analysis', to: '/subjects'                },
        { icon: BarChart2,     label: 'Progress Analytics', desc: 'Full progress report',            to: '/progress'                },
        { icon: TrendingUp,    label: 'Performance Trends', desc: 'AI score prediction & trends',    to: '/predict'                 },
        { icon: Trophy,        label: 'Reports',            desc: 'Achievements & milestones',       to: '/achievements'            },
      ],
    },
    {
      id: 'ai', label: 'AI Tools',
      items: [
        { icon: Layers,        label: 'Digital Twin',        desc: 'AI-powered replica of the learner',              to: '/twin',      tour: 'twin'    },
        { icon: Zap,           label: 'What-If Simulator',   desc: 'Explore future academic outcomes based on different study decisions', to: '/simulate', tour: 'simulate' },
        { icon: Mic2,          label: 'Communication Twin',  desc: 'AI communication and interview coach',           to: '/comm-twin'                  },
        { icon: Rocket,        label: 'Career Twin',         desc: 'AI career guidance and career forecasting',      to: '/career'                     },
        { icon: Shield,        label: 'Burnout Analysis',    desc: 'Monitor focus, stress and burnout risk',         to: '/burnout'                    },
        { icon: MessageCircle, label: 'AI Mentor',           desc: 'Personalised AI learning coach',                 to: '/mentor',    tour: 'mentor'  },
      ],
    },
  ];

  return (
    <XPStoreProvider>
    <div className="saasable-root" style={s.shell}>
      <WeeklyChallengesModal isOpen={challengeOpen} onClose={() => setChallengeOpen(false)} />
      <MobileNav
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userName={user?.full_name ?? undefined}
        avatarSrc={avatarSrc ?? undefined}
        onLogout={logout}
      />

      {/* ══ NAVBAR ══ */}
      <header style={s.nav}>
        <div style={s.navLeft}>
          <button className="mob-hamburger" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <BrainIcon size={28} />
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
          <Link to="/" className="nav-link" style={{ ...s.navStandaloneLink, fontWeight: 700, color: 'var(--primary)' }}
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
                dropdown,
                <Link key="nav-planner" to="/study-planner" className="nav-link" style={s.navStandaloneLink}>
                  Study Planner
                </Link>,
                <Link key="nav-checkin" to="/checkin" className="nav-link" style={s.navStandaloneLink} data-tour="checkin">
                  Check-in
                </Link>,
              ];
            }
            return [dropdown];
          })}
        </nav>

        <div style={s.navRight} className="mob-nav-right">
          <span className="mob-hide-mobile"><LanguageSwitcher /></span>
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
          <Link
            to="/shield"
            title="Shield Center"
            aria-label="Shield Center"
            style={{
              background: 'none', border: '1px solid rgba(var(--primary-rgb),0.2)',
              borderRadius: '9px', width: '34px', height: '34px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--primary)', transition: 'border-color 0.2s, box-shadow 0.2s',
              textDecoration: 'none',
            }}
          >
            <Shield size={16} />
          </Link>
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
                  ? '0 0 0 2px #bfdbfe, 0 0 18px rgba(59,130,246,0.15)'
                  : '0 0 0 2px #e2e8f0, 0 0 12px rgba(0,0,0,0.05)',
              }}
            >
              {avatarSrc
                ? <img src={avatarSrc} alt="" style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                : (
                  <span style={{
                    width: '34px', height: '34px', borderRadius: '50%',
                    background: '#dbeafe',
                    border: '2px solid #bfdbfe',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.72rem', fontWeight: 800, color: '#3b82f6',
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
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '18px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  overflow: 'hidden',
                }}
              >
                {/* User info header */}
                <div style={{ padding: '1.1rem 1.1rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.8rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ flexShrink: 0 }}>
                    {avatarSrc
                      ? <img src={avatarSrc} alt="" style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #bfdbfe', boxShadow: '0 0 14px rgba(59,130,246,0.1)' }} />
                      : (
                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#dbeafe', border: '2px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800, color: '#3b82f6' }}>
                          {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                        </div>
                      )
                    }
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: '0 0 0.08rem', fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.full_name}</p>
                    <p style={{ margin: '0 0 0.05rem', fontSize: '0.67rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
                    {studentProfile?.course && (
                      <p style={{ margin: 0, fontSize: '0.67rem', color: '#3b82f6', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{studentProfile.course}</p>
                    )}
                  </div>
                </div>

                {/* XP / Level row */}
                {gamProgress && (
                  <div style={{ padding: '0.75rem 1.1rem', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: getLevelGradient(gamProgress.level), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: '#fff', flexShrink: 0 }}>{gamProgress.level}</div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: getLevelColor(gamProgress.level) }}>{gamProgress.level_name}</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b' }}>⭐ {(gamProgress.xp ?? 0).toLocaleString()} XP</span>
                    </div>
                    <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${gamProgress.progress_pct ?? 0}%`, background: getLevelGradient(gamProgress.level), borderRadius: '99px', transition: 'width 0.6s ease' }} />
                    </div>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.63rem', color: '#64748b' }}>{(gamProgress.xp_to_next ?? 0) > 0 ? `${gamProgress.xp_to_next} XP to level up` : 'Max level reached!'}</p>
                  </div>
                )}

                {/* Navigation links */}
                <div style={{ padding: '0.45rem 0.45rem' }}>
                  <Link to="/profile" className="profile-drop-item" onClick={() => setProfileDropOpen(false)} style={{ textDecoration: 'none' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>Profile & Settings</p>
                      <p style={{ margin: 0, fontSize: '0.65rem', color: '#64748b' }}>Edit your info & preferences</p>
                    </div>
                  </Link>
                  <Link to="/achievements" className="profile-drop-item" onClick={() => setProfileDropOpen(false)} style={{ textDecoration: 'none' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>Achievements</p>
                      <p style={{ margin: 0, fontSize: '0.65rem', color: '#64748b' }}>Badges & milestones</p>
                    </div>
                  </Link>
                </div>

                {/* Sign out */}
                <div style={{ padding: '0.45rem 0.45rem 0.55rem', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    onClick={() => { setProfileDropOpen(false); logout(); }}
                    className="profile-drop-item"
                    style={{ width: '100%', background: 'none', border: 'none', fontFamily: 'inherit', textAlign: 'left' }}
                  >
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#ef4444' }}>{t('sign_out')}</p>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ══ MAIN CONTENT ══ */}
      <motion.main initial="hidden" animate="visible" variants={staggerContainer} style={s.main}>
        {/* Background blobs removed for crisp SaaSable look */}

        {/* ── S1: HERO AREA ── */}
        <motion.section variants={fadeUp} style={s.heroGrid} className="mob-hero-grid" data-tour="dashboard">
          {/* LEFT: Welcome */}
          <div style={s.heroCard}>
            <div style={s.heroOrb1} />
            <div style={s.heroOrb2} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={s.greetingLabel}>{greeting} ✦</p>
              <h1 style={s.heroName}>
                {firstName}
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

          {/* RIGHT: Digital Twin */}
          <div style={s.heroPriority} className="mob-hero-priority">
            <HeroDigitalTwinCard />
          </div>
        </motion.section>

        {/* ── S2: QUICK STATS STRIP ── */}
        <motion.div variants={fadeUp} style={s.statsStrip} className="mob-stats-strip">
          <QuickStatCard icon="⏱"  label="Study Hours"  value={totalHours}          unit="h"  grad="linear-gradient(135deg,#6366f1,#818cf8)" delay={0}   />
          <QuickStatCard icon="🔥" label="Day Streak"   value={streak}                        grad="linear-gradient(135deg,#f59e0b,#fbbf24)" delay={60}  />
          <QuickStatCard icon="▶"  label="Sessions"     value={sessionCount}                   grad="linear-gradient(135deg,#00D4FF,#3b82f6)" delay={120} />
          <QuickStatCard icon="⭐" label="XP Points"    value={gamProgress?.xp ?? 0}           grad="linear-gradient(135deg,#8b5cf6,#a78bfa)" delay={180} />
        </motion.div>

        {/* ── S3: PERFORMANCE ANALYTICS ── */}
        <motion.section variants={fadeUp} className="dash-section">
          <SectionHeader badge="PERFORMANCE" title="Analytics & Insights" cta="Full Report" ctaTo="/progress" />
          <div style={s.panel}>
            <div style={s.panelHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📈</span>
                <h3 style={s.panelTitle}>{t('chart_title') || '7-Day Study Activity'}</h3>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <Link to="/subjects" style={{ ...s.panelCta, color: '#10b981', borderColor: 'rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.08)' }}>📊 Subject Analysis →</Link>
                <Link to="/checkin"  style={s.panelCta}>{t('chart_log_today') || 'Log Today'}</Link>
              </div>
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
        </motion.section>

        {/* ── S4: AI COMMAND CENTER (live metrics) ── */}
        <motion.section variants={fadeUp} className="dash-section">
          <SectionHeader badge="AI INTELLIGENCE" title="Live Performance Monitor" />
          <AICommandCenter brainReadiness={health.pct} streak={streak} level={gamProgress?.level} />
        </motion.section>

        {/* ── S6: WELLNESS CENTER ── */}
        <motion.section variants={fadeUp} className="dash-section">
          <SectionHeader badge="WELLNESS & FOCUS" title="Mental Health Center" cta="Full Report" ctaTo="/burnout" />
          <div style={s.wellnessGrid} className="mob-wellness-grid">
            <div style={s.panel}>
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
        </motion.section>

        {/* ── S9: CALENDAR EVENTS ── */}
        {calEvents.length > 0 && (
          <motion.section variants={fadeUp} style={s.panel} className="dash-section">
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
                      <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{ev.title}</p>
                      <p style={{ margin: '0.1rem 0 0', fontSize: '0.65rem', color: '#64748b' }}>{label}</p>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#818cf8', flexShrink: 0 }}>↗</span>
                  </a>
                );
              })}
            </div>
          </motion.section>
        )}

      </motion.main>

      <TutorialOverlay />
    </div>
    </XPStoreProvider>
  );
}

/* ══════════════════════════════
   STYLES
   ══════════════════════════════ */

const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100svh', display: 'flex', flexDirection: 'column' }, // bg handled by saasly-root

  /* Navbar */
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 1.5rem', height: '60px',
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(226, 232, 240, 0.8)',
    borderRadius: '9999px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
    position: 'sticky', top: '1.5rem', zIndex: 50,
    maxWidth: '1200px', margin: '1.5rem auto 0',
  },
  navLeft:   { display: 'flex', alignItems: 'center', gap: '0.55rem' },
  logoIcon:  { fontSize: '1.25rem', color: '#6366f1' },
  navLogo: {
    fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.3px',
    color: '#0f172a',
  },
  navCenter: { display: 'flex', alignItems: 'center', gap: '0.2rem' },
  navRight:  { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  navDivider: { width: '1px', height: '14px', background: '#e2e8f0', flexShrink: 0, margin: '0 0.45rem' },
  navStandaloneLink: { display: 'flex', alignItems: 'center', padding: '0.38rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' as const, letterSpacing: '0.01em', color: '#475569' },
  liveBadge: { display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.18rem 0.6rem', background: '#dbeafe', border: '1px solid #bfdbfe', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 600, color: '#3b82f6', letterSpacing: '0.04em' },
  liveDot:   { width: '5px', height: '5px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0 },

  /* Dropdown */
  ddTrigger: {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.38rem 0.65rem', borderRadius: '8px',
    background: 'transparent', border: 'none',
    fontSize: '0.78rem', fontWeight: 600, color: '#475569',
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'color 0.18s, background 0.18s',
    whiteSpace: 'nowrap' as const, letterSpacing: '0.01em',
  },
  ddMenu: {
    position: 'absolute' as const, top: 'calc(100% + 8px)', left: '50%',
    transform: 'translateX(-50%)',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px', padding: '6px',
    minWidth: '240px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    zIndex: 100,
  },

  /* Main */
  main: { flex: 1, padding: '2rem 2rem 5rem', maxWidth: '1200px', width: '100%', margin: '0 auto', boxSizing: 'border-box' as const, display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative', zIndex: 1 },

  /* Hero 2-col layout */
  heroGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'stretch' },

  /* Hero left card */
  heroCard: {
    position: 'relative', overflow: 'hidden',
    background: 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(226, 232, 240, 0.9)',
    borderRadius: '1.5rem', padding: '2.5rem 2.25rem',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
  },
  heroOrb1: { display: 'none' },
  heroOrb2: { display: 'none' },

  /* Hero text */
  greetingLabel: {
    margin: '0 0 0.5rem', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
    color: '#6366f1',
  },
  heroName: {
    fontSize: 'clamp(1.875rem, 3.5vw, 2.625rem)', fontWeight: 800, letterSpacing: '-0.03em',
    margin: '0 0 0.4rem', lineHeight: 1.15,
    color: '#0f172a',
  },
  heroSub: { margin: '0 0 1.5rem', fontSize: '0.95rem', color: '#64748b', lineHeight: 1.55 },

  /* Goal / Level chip */
  goalChip: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.75rem 1rem',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px', marginBottom: '1.25rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  },
  goalLevelBadge: {
    width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.82rem', fontWeight: 900, color: '#fff',
  },
  goalLevelName: { margin: '0 0 0.35rem', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' },
  goalXpBar:  { height: '4px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden', marginBottom: '0.25rem' },
  goalXpFill: { height: '100%', borderRadius: '99px', transition: 'width 0.8s ease' },
  goalXpText: { margin: 0, fontSize: '0.62rem', color: '#64748b' },

  /* Quote */
  quoteBox:   { display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.875rem 1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderLeft: '3px solid #3b82f6', borderRadius: '12px' },
  quoteMark:  { fontSize: '1.4rem', color: '#3b82f6', lineHeight: 1, flexShrink: 0, marginTop: '-2px', opacity: 0.55, fontStyle: 'normal' },
  quoteText:  { margin: '0 0 0.2rem', fontSize: '0.8rem', color: '#1e293b', lineHeight: 1.6 },
  quoteAuthor:{ margin: 0, fontSize: '0.7rem', color: '#3b82f6', fontWeight: 600, opacity: 0.9 },

  /* Hero right */
  heroPriority: { display: 'flex', flexDirection: 'column' as const },

  /* Quick Stats Strip */
  statsStrip: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem' },

  /* Performance Grid */
  perfGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' },

  /* Wellness Grid */
  wellnessGrid: { display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: '1.5rem', alignItems: 'start' },

  /* Panels */
  panel: {
    background: 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(226, 232, 240, 0.9)',
    borderRadius: '1.5rem',
    padding: '1.5rem',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
  },
  panelHead:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' },
  panelTitle: { fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' },
  panelCta:   { fontSize: '0.75rem', color: '#6366f1', textDecoration: 'none', fontWeight: 600, transition: 'opacity 0.18s' },

  /* Chart footer */
  chartFooter: { display: 'flex', gap: '1rem', marginTop: '0.85rem', paddingTop: '0.7rem', borderTop: '1px solid #f1f5f9' },
  chartStat:   { fontSize: '0.75rem', color: '#64748b' },
  chartStatVal:{ color: '#0f172a', fontWeight: 700 },

  /* Empty state */
  emptyState: { textAlign: 'center' as const, padding: '2rem 0' },
  emptyIcon:  { fontSize: '2.25rem', marginBottom: '0.6rem' },
  emptyText:  { fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' },
  emptySub:   { fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem', lineHeight: 1.55 },
  emptyBtn: {
    display: 'inline-block', padding: '0.52rem 1.3rem',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '10px', color: '#3b82f6', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none',
  },

  /* Modals */
  modalOverlay: { position: 'fixed' as const, inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' },
  modalBox:     { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', width: '100%', maxWidth: '780px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  modalHeader:  { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '1.4rem 1.6rem', borderBottom: '1px solid #f1f5f9', flexShrink: 0 },
  modalTitle:   { margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' },
  modalSub:     { margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#64748b' },
  modalClose:   { background: 'transparent', border: 'none', color: '#64748b', fontSize: '1.15rem', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '8px', lineHeight: 1 },
  modalBody:    { flex: 1, overflowY: 'auto' as const, padding: '1.4rem 1.6rem' },
  modalFooter:  { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', padding: '1.1rem 1.6rem', borderTop: '1px solid #f1f5f9', flexShrink: 0 },
  modalMentorLink: { fontSize: '0.82rem', color: '#6366f1', textDecoration: 'none', fontWeight: 700 },
  modalCloseBtn:   { padding: '0.52rem 1.4rem', background: '#3b82f6', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' },
};

/* ── Smart Plan styles ── */

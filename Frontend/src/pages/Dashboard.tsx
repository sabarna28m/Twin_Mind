import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  Clock, Flame, Play, Star, Activity, Heart,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { XPStoreProvider } from '../contexts/XPStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import TutorialOverlay from '../components/TutorialOverlay';
import api from '../services/api';
import { WS_URL } from '../lib/config';
import {
  getLevelColor, getLevelGradient,
  type GamificationProgress,
} from '../utils/gamification';
import BurnoutWidget from '../components/BurnoutWidget';
import SmartDailyMission from '../components/SmartDailyMission';
import HeroDigitalTwinCard from '../components/HeroDigitalTwinCard';

/* ── Types ── */
interface LearningEntry {
  date: string;
  study_hours: number;
  attendance_percentage: number;
  assignment_completion_rate: number;
  stress_level: number;
}
interface CalEvent { id: string; title: string; start: string; link: string }

/* ── Constants ── */
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

/* ── Helpers ── */
function computeStreak(entries: LearningEntry[]): number {
  const dateSet = new Set(entries.map(e => e.date));
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (dateSet.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

function getLast7Days(entries: LearningEntry[]) {
  const map = new Map(entries.map(e => [e.date, e.study_hours]));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { date: key, hours: map.get(key) ?? 0, label: d.toLocaleDateString('en', { weekday: 'short' }) };
  });
}

function formatTrendPct(current: number, prev: number | null): string | null {
  if (prev === null) return null;
  const diff = Math.round(current - prev);
  if (diff === 0) return '→ Same as last week';
  return `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff)}% vs last week`;
}

function useCounter(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) {
      const t = setTimeout(() => setVal(0), 0);
      return () => clearTimeout(t);
    }
    let start: number | null = null; let raf = 0;
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

/* ── Animation variants ── */
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } }
};

/* ═══════════════════════════════════════════════
   STUDY CHART (Area / Line style)
   ═══════════════════════════════════════════════ */
function StudyAreaChart({ data }: { data: { date: string; hours: number; label: string }[] }) {
  const max = Math.max(...data.map(d => d.hours), 1);
  const w = 500, h = 200, px = 40, py = 20;
  const chartW = w - px * 2, chartH = h - py * 2;
  const points = data.map((d, i) => ({
    x: px + (i / (data.length - 1)) * chartW,
    y: py + chartH - (d.hours / max) * chartH,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = linePath + ` L${points[points.length - 1].x},${py + chartH} L${points[0].x},${py + chartH} Z`;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div style={{ width: '100%', aspectRatio: '2.5', position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00D4FF" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {gridLines.map((g, i) => {
          const y = py + chartH - g * chartH;
          return (
            <g key={i}>
              <line x1={px} y1={y} x2={w - px} y2={y} style={{ stroke: 'var(--ui-text-muted)', opacity: 0.4 }} strokeWidth="1.5" strokeDasharray="4,4" />
              <text x={px - 8} y={y + 4} textAnchor="end" fontSize="10" style={{ fill: 'var(--ui-text-muted)' }}>{(max * g).toFixed(1)}h</text>
            </g>
          );
        })}
        {/* Area */}
        <path d={areaPath} fill="url(#areaGrad)" />
        {/* Line */}
        <path d={linePath} fill="none" stroke="#00D4FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" style={{ fill: 'var(--ui-surface)', stroke: '#00D4FF' }} strokeWidth="2" />
            <text x={p.x} y={py + chartH + 16} textAnchor="middle" fontSize="11" style={{ fill: 'var(--ui-text-muted)' }} fontWeight="500">{data[i].label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CIRCULAR PROGRESS
   ═══════════════════════════════════════════════ */
function CircularProgress({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'var(--ui-border)' }} strokeWidth="6" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="central"
        fontSize="13" fontWeight="700" fill={color}>
        {pct}%
      </text>
    </svg>
  );
}

/* ═══════════════════════════════════════════════
   KPI CARD
   ═══════════════════════════════════════════════ */
function KPICard({ icon: Icon, label, value, unit, gradient, trend, delay }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>; label: string; value: number; unit?: string;
  gradient: string; trend?: string; delay: number;
}) {
  const count = useCounter(value);
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{
        background: gradient, borderRadius: '16px', padding: '24px',
        color: '#fff', position: 'relative', overflow: 'hidden', cursor: 'default',
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        animationDelay: delay + 'ms',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={22} />
        </div>
      </div>
      <p style={{ margin: '0 0 4px', fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
        {count.toLocaleString()}{unit || ''}
      </p>
      <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.85, fontWeight: 500 }}>{label}</p>
      {trend && (
        <p style={{ margin: '8px 0 0', fontSize: '0.75rem', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '4px' }}>
          {trend}
        </p>
      )}
      {/* Decorative circle */}
      <div style={{
        position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px',
        borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
      }} />
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
   ═══════════════════════════════════════════════ */
export default function Dashboard() {
  const { user, token } = useAuth();
  const { colorScheme } = useTheme();
  const { t } = useLanguage();
  const hour = new Date().getHours();
  const greeting = hour < 5 ? t('greeting_midnight') : hour < 12 ? t('greeting_morning') : hour < 17 ? t('greeting_afternoon') : t('greeting_evening');
  const firstName = user?.full_name?.split(' ')[0] ?? '';
  const quote = getDailyQuote();
  const isDark = colorScheme === 'dark';

  const [now] = useState(() => Date.now());
  const [entries, setEntries] = useState<LearningEntry[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [noteCount, setNoteCount] = useState(0);
  const [badgeCount, setBadgeCount] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [gamProgress, setGamProgress] = useState<GamificationProgress | null>(null);

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
    }).catch(() => { });
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  useEffect(() => {
    api.get<{ events: CalEvent[] }>('/calendar/upcoming').then(r => setCalEvents(r.data.events)).catch(() => { });
    api.get<GamificationProgress>('/gamification/progress').then(r => setGamProgress(r.data)).catch(() => { });
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
      wsRef.current?.close(); wsRef.current = null;
    };
  }, [user?.id, token, refreshData]);

  const streak = computeStreak(entries);
  const totalHours = Math.round(entries.reduce((s, e) => s + e.study_hours, 0));
  const last7 = getLast7Days(entries);
  const weekHours = last7.reduce((s, d) => s + d.hours, 0);

  const last7Entries = entries.filter(e => {
    const daysAgo = Math.floor((now - new Date(e.date).getTime()) / 86400000);
    return daysAgo >= 0 && daysAgo <= 6;
  });
  const focusScore = last7Entries.length
    ? Math.round(last7Entries.reduce((s, e) => s + e.attendance_percentage, 0) / last7Entries.length)
    : 0;
  const consistencyScore = last7Entries.length
    ? Math.round(last7Entries.reduce((s, e) => s + e.assignment_completion_rate, 0) / last7Entries.length)
    : 0;

  const prev7Entries = entries.filter(e => {
    const daysAgo = Math.floor((now - new Date(e.date).getTime()) / 86400000);
    return daysAgo >= 7 && daysAgo <= 13;
  });
  const prevFocusScore = prev7Entries.length ? Math.round(prev7Entries.reduce((s, e) => s + e.attendance_percentage, 0) / prev7Entries.length) : null;
  const prevConsistency = prev7Entries.length ? Math.round(prev7Entries.reduce((s, e) => s + e.assignment_completion_rate, 0) / prev7Entries.length) : null;
  const prevWeekHours = prev7Entries.reduce((s, e) => s + e.study_hours, 0);

  const focusTrend = focusScore > 0 ? formatTrendPct(focusScore, prevFocusScore) : null;
  const consistencyTrend = consistencyScore > 0 ? formatTrendPct(consistencyScore, prevConsistency) : null;

  const studyHoursTrend = prevWeekHours > 0
    ? `${weekHours >= prevWeekHours ? '↑' : '↓'} ${Math.abs(Math.round((weekHours - prevWeekHours) / prevWeekHours * 100))}% vs last week`
    : totalHours > 0 ? 'First week tracked' : undefined;

  /* Suppress unused-var warnings for state that drives websocket reconnect logic */
  void wsConnected; void calEvents; void noteCount; void badgeCount;

  const cardStyle = {
    background: 'var(--ui-surface)',
    borderRadius: '16px',
    border: '1px solid var(--ui-border)',
    boxShadow: 'var(--ui-card-shadow)',
    transition: 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
  };

  return (
    <XPStoreProvider>
      <motion.main
        initial="hidden" animate="visible" variants={staggerContainer}
        style={{ padding: '24px 32px 48px' }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* ═══ ROW 1: GREETING + DIGITAL TWIN ═══ */}
          <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'stretch' }} className="mob-hero-grid">
            {/* Greeting Card */}
            <div style={{ ...cardStyle, padding: '28px', display: 'flex', flexDirection: 'column' }}>
              <p style={{ margin: '0 0 4px', fontSize: '0.875rem', color: 'var(--ui-text-muted)' }}>{greeting}</p>
              <h2 style={{ margin: '0 0 4px', fontSize: '1.75rem', fontWeight: 700, color: 'var(--ui-text-h)', letterSpacing: '-0.02em' }}>
                {firstName}
              </h2>
              <p style={{ margin: '0 0 20px', fontSize: '0.875rem', color: 'var(--ui-text-muted)' }}>
                Your AI-powered learning companion is ready.
              </p>

              {/* Level / XP */}
              {gamProgress && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                  background: 'var(--ui-surface-elevated)', borderRadius: '12px', marginBottom: '16px',
                  border: '1px solid var(--ui-border)',
                  transition: 'background 0.3s ease',
                }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                    background: getLevelGradient(gamProgress.level),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.9rem', fontWeight: 800, color: '#fff',
                    boxShadow: `0 4px 12px ${getLevelColor(gamProgress.level)}40`,
                  }}>
                    {gamProgress.level}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ui-text-h)' }}>{gamProgress.level_name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--ui-text-muted)' }}>Level {gamProgress.level}</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--ui-border)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${gamProgress.progress_pct}%`, borderRadius: '99px',
                        background: getLevelGradient(gamProgress.level), transition: 'width 0.8s ease',
                      }} />
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: 'var(--ui-text-muted)' }}>
                      {(gamProgress.xp ?? 0).toLocaleString()} XP · {(gamProgress.xp_to_next ?? 0) > 0 ? `${gamProgress.xp_to_next} XP to level up` : 'Max level!'}
                    </p>
                  </div>
                </div>
              )}

              {/* Quote */}
              <div style={{
                padding: '14px 16px',
                background: isDark ? 'rgba(0,212,255,0.06)' : '#f0f9ff',
                borderLeft: '3px solid #00D4FF',
                borderRadius: '0 10px 10px 0', marginTop: 'auto',
                transition: 'background 0.3s ease',
              }}>
                <p style={{ margin: '0 0 4px', fontSize: '0.8rem', color: 'var(--ui-text)', lineHeight: 1.5, fontStyle: 'italic' }}>
                  "{quote.text}"
                </p>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#00D4FF', fontWeight: 600 }}>— {quote.author}</p>
              </div>
            </div>

            {/* Digital Twin Card */}
            <div style={{ display: 'flex', flexDirection: 'column' }} className="mob-hero-priority">
              <HeroDigitalTwinCard />
            </div>
          </motion.div>

          {/* ═══ ROW 2: KPI CARDS ═══ */}
          <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '20px' }} className="mob-stats-strip">
            <KPICard icon={Clock} label="Study Hours" value={totalHours} unit="h" gradient="linear-gradient(135deg, #3B82F6, #00D4FF)" trend={studyHoursTrend} delay={0} />
            <KPICard icon={Flame} label="Day Streak" value={streak} gradient="linear-gradient(135deg, #06B6D4, #2DD4BF)" trend={streak > 0 ? `${streak} consecutive days` : undefined} delay={60} />
            <KPICard icon={Play} label="Sessions Completed" value={sessionCount} gradient="linear-gradient(135deg, #F59E0B, #FB923C)" trend={sessionCount > 0 ? 'All-time total' : undefined} delay={120} />
            <KPICard icon={Star} label="XP Points" value={gamProgress?.xp ?? 0} gradient="linear-gradient(135deg, #EC4899, #8B5CF6)" trend={gamProgress ? `Level ${gamProgress.level} · ${gamProgress.level_name}` : undefined} delay={180} />
          </motion.div>

          {/* ═══ ROW 3: ANALYTICS & INSIGHTS ═══ */}
          <motion.section variants={fadeUp}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} color="#00D4FF" />
                <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--ui-text-h)' }}>Analytics & Insights</h2>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['Study Activity', 'Focus', 'Performance'].map((tab, i) => (
                  <button key={tab} style={{
                    padding: '6px 14px', borderRadius: '8px',
                    border: '1px solid var(--ui-border)',
                    background: i === 0
                      ? (isDark ? 'rgba(0,212,255,0.15)' : '#0f172a')
                      : 'var(--ui-surface)',
                    color: i === 0
                      ? (isDark ? '#00D4FF' : '#fff')
                      : 'var(--ui-text-muted)',
                    fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}>{tab}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '20px', alignItems: 'start' }} className="mob-wellness-grid">
              {/* LEFT: Chart */}
              <div style={{ ...cardStyle, padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 2px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--ui-text-h)' }}>Study Activity</h3>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ui-text-muted)' }}>Hours studied per day</p>
                  </div>
                  <div style={{
                    padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--ui-border)',
                    fontSize: '0.8rem', color: 'var(--ui-text-muted)', display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'var(--ui-surface-elevated)',
                  }}>
                    Last 7 days <ChevronDown size={14} />
                  </div>
                </div>
                {last7.some(d => d.hours > 0) ? (
                  <>
                    <StudyAreaChart data={last7} />
                    <div style={{ display: 'flex', gap: '24px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--ui-border)' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>This Week</p>
                        <p style={{ margin: '2px 0 0', fontSize: '1.125rem', fontWeight: 700, color: 'var(--ui-text-h)' }}>{weekHours.toFixed(1)}h</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Daily Avg</p>
                        <p style={{ margin: '2px 0 0', fontSize: '1.125rem', fontWeight: 700, color: 'var(--ui-text-h)' }}>{(weekHours / 7).toFixed(1)}h</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <Activity size={32} style={{ marginBottom: '8px', color: 'var(--ui-text-muted)' }} />
                    <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ui-text-h)', marginBottom: '4px' }}>{t('no_data_title') || 'No Data Yet'}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--ui-text-muted)', marginBottom: '16px' }}>{t('no_data_sub') || 'Log a check-in to activate your study chart'}</p>
                    <Link to="/checkin" style={{
                      display: 'inline-block', padding: '8px 20px', background: '#00D4FF', color: '#fff',
                      borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
                    }}>Log Check-in</Link>
                  </div>
                )}
              </div>

              {/* RIGHT: Focus Score + Study Consistency + Burnout Risk Monitor */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Focus Score */}
                <motion.div
                  whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                  style={{
                    ...cardStyle, padding: '20px',
                    display: 'flex', alignItems: 'center', gap: '16px',
                  }}
                >
                  {focusScore > 0 ? (
                    <>
                      <CircularProgress pct={focusScore} color="#10b981" />
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ui-text-h)' }}>Focus Score</p>
                        <p style={{ margin: '0 0 2px', fontSize: '0.75rem', color: focusScore >= 70 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                          {focusScore >= 70 ? 'Good' : focusScore >= 40 ? 'Moderate' : 'Needs Work'}
                        </p>
                        {focusTrend && <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--ui-text-muted)' }}>{focusTrend}</p>}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '4px dashed var(--ui-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '1rem', color: 'var(--ui-text-muted)' }}>—</span>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ui-text-h)' }}>Focus Score</p>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--ui-text-muted)' }}>Log check-ins to see your score</p>
                      </div>
                    </>
                  )}
                </motion.div>

                {/* Study Consistency */}
                <motion.div
                  whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                  style={{
                    ...cardStyle, padding: '20px',
                    display: 'flex', alignItems: 'center', gap: '16px',
                  }}
                >
                  {consistencyScore > 0 ? (
                    <>
                      <CircularProgress pct={consistencyScore} color="#7C3AED" />
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ui-text-h)' }}>Study Consistency</p>
                        <p style={{ margin: '0 0 2px', fontSize: '0.75rem', color: consistencyScore >= 70 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                          {consistencyScore >= 70 ? 'Excellent' : consistencyScore >= 40 ? 'Moderate' : 'Needs Work'}
                        </p>
                        {consistencyTrend && <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--ui-text-muted)' }}>{consistencyTrend}</p>}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '4px dashed var(--ui-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '1rem', color: 'var(--ui-text-muted)' }}>—</span>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ui-text-h)' }}>Study Consistency</p>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--ui-text-muted)' }}>Log check-ins to see your score</p>
                      </div>
                    </>
                  )}
                </motion.div>

                {/* Burnout Risk Monitor */}
                <div style={{ ...cardStyle, padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Heart size={16} color="#ef4444" />
                    <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--ui-text-h)' }}>Burnout Risk Monitor</h3>
                  </div>
                  <BurnoutWidget />
                </div>
              </div>
            </div>
          </motion.section>

          {/* ═══ ROW 4: TODAY'S MISSION (full-width horizontal grid) ═══ */}
          <motion.div variants={fadeUp}>
            <SmartDailyMission layout="horizontal" />
          </motion.div>

        </div>
      </motion.main>
      <TutorialOverlay />
      <style>{`
        @media (max-width: 1024px) {
          .mob-hero-grid   { grid-template-columns: 1fr !important; }
          .mob-stats-strip { grid-template-columns: repeat(2, 1fr) !important; }
          .mob-wellness-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .mob-stats-strip { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </XPStoreProvider>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveBadge from '../components/LiveBadge';
import BackButton from '../components/BackButton';
import { getLevelColor, getLevelGradient, LEVEL_NAMES, LEVEL_COLORS, type GamificationProgress } from '../utils/gamification';

interface HistoryPoint { date: string; overall_score: number; }

interface FutureTwin {
  overall_score: number;
  consistency_score: number;
  wellness_score: number;
  academic_score: number;
  risk_level: 'low' | 'medium' | 'high';
  predicted_exam_score: number | null;
  motivational_message: string;
  tips: string[];
}

interface TwinState {
  overall_score: number;
  consistency_score: number;
  wellness_score: number;
  academic_score: number;
  risk_level: 'low' | 'medium' | 'high';
  trend: 'improving' | 'declining' | 'stable';
  twin_age: number;
  data_points: number;
  strengths: string[];
  areas_to_improve: string[];
  history: HistoryPoint[];
  future_twin: FutureTwin | null;
  future_twin_60: FutureTwin | null;
  future_twin_90: FutureTwin | null;
}

const RISK_COLOR  = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
const RISK_BG     = { low: 'rgba(16,185,129,0.12)', medium: 'rgba(245,158,11,0.12)', high: 'rgba(239,68,68,0.12)' };
const RISK_BORDER = { low: 'rgba(16,185,129,0.4)', medium: 'rgba(245,158,11,0.4)', high: 'rgba(239,68,68,0.4)' };

const TREND_ICON  = { improving: '↑', declining: '↓', stable: '→' };
const TREND_COLOR = { improving: '#10b981', declining: '#ef4444', stable: '#94a3b8' };
const TREND_LABEL = { improving: 'Improving', declining: 'Declining', stable: 'Stable' };

const MSG_COLOR  = { improving: '#6ee7b7', declining: '#fca5a5', stable: '#fde68a' };
const MSG_BG     = { improving: 'rgba(16,185,129,0.08)', declining: 'rgba(239,68,68,0.08)', stable: 'rgba(245,158,11,0.08)' };
const MSG_BORDER = { improving: 'rgba(16,185,129,0.25)', declining: 'rgba(239,68,68,0.25)', stable: 'rgba(245,158,11,0.25)' };

const SCORE_GRADS = [
  'linear-gradient(90deg,#6366f1,#8b5cf6)',
  'linear-gradient(90deg,#3b82f6,#6366f1)',
  'linear-gradient(90deg,#10b981,#06b6d4)',
  'linear-gradient(90deg,#8b5cf6,#d946ef)',
];

const GLOW_ANIM = {
  low:    'glow-pulse-green 2.5s ease-in-out infinite',
  medium: 'glow-pulse-amber 2s ease-in-out infinite',
  high:   'glow-pulse-red 1.5s ease-in-out infinite',
};

const PARTICLE_CONFIG = [
  { angle: 0,   r: 85, size: 3, dur: 3.2, delay: 0.0 },
  { angle: 45,  r: 82, size: 2, dur: 2.8, delay: 0.6 },
  { angle: 90,  r: 88, size: 4, dur: 3.6, delay: 1.2 },
  { angle: 135, r: 80, size: 2, dur: 2.5, delay: 0.3 },
  { angle: 180, r: 86, size: 3, dur: 3.0, delay: 0.9 },
  { angle: 225, r: 83, size: 2, dur: 2.7, delay: 1.5 },
  { angle: 270, r: 87, size: 4, dur: 3.4, delay: 0.5 },
  { angle: 315, r: 81, size: 2, dur: 2.9, delay: 1.1 },
];

function useCounter(target: number, duration = 1000, delay = 0): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    let startTime = -1;
    let rafId: number;
    const tid = setTimeout(() => {
      const tick = (now: number) => {
        if (startTime < 0) startTime = now;
        const t = Math.min((now - startTime) / duration, 1);
        setVal(Math.round((1 - Math.pow(1 - t, 3)) * target));
        if (t < 1) rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(tid); cancelAnimationFrame(rafId); };
  }, [target, duration, delay]);
  return val;
}

function Particles({ riskLevel }: { riskLevel: 'low' | 'medium' | 'high' }) {
  const color = RISK_COLOR[riskLevel];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {PARTICLE_CONFIG.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const x = Math.round(p.r * Math.sin(rad));
        const y = Math.round(-p.r * Math.cos(rad));
        return (
          <div key={i} style={{
            position: 'absolute',
            width: `${p.size}px`, height: `${p.size}px`,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 ${p.size * 3}px ${color}`,
            top: `calc(50% + ${y}px)`, left: `calc(50% + ${x}px)`,
            marginTop: `-${p.size / 2}px`, marginLeft: `-${p.size / 2}px`,
            animation: `particle-float ${p.dur}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }} />
        );
      })}
    </div>
  );
}

function ScoreBar({ label, value, grad, delay = 0 }: { label: string; value: number; grad: string; delay?: number }) {
  const count = useCounter(value, 1200, delay);
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9' }}>{count}</span>
      </div>
      <div className="score-bar-track">
        <div
          className="score-bar-fill"
          style={{ width: `${value}%`, background: grad, animationDelay: `${delay}ms`, boxShadow: `0 0 8px rgba(99,102,241,0.4)` }}
        />
      </div>
    </div>
  );
}

function SparkLine({ history }: { history: HistoryPoint[] }) {
  if (history.length < 2) return null;
  const W = 340, H = 90, pad = 10;
  const vals = history.map(h => h.overall_score);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const firstPt = pts.split(' ')[0];
  const [fx, fy] = firstPt.split(',').map(Number);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Glow copy */}
      <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" opacity="0.3" filter="url(#glow)" />
      {/* Main line */}
      <polyline points={pts} fill="none" stroke="url(#sparkGrad)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Dots */}
      {vals.map((v, i) => {
        const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
        const y = H - pad - ((v - min) / range) * (H - pad * 2);
        return <circle key={i} cx={x} cy={y} r="4" fill="#8b5cf6" stroke="#1e1b4b" strokeWidth="2" />;
      })}
      {/* Start label */}
      <text x={fx} y={fy - 10} fill="#64748b" fontSize="9" textAnchor="middle">{Math.round(vals[0])}</text>
      {/* End label */}
      {(() => {
        const lx = pad + (W - pad * 2);
        const ly = H - pad - ((vals[vals.length - 1] - min) / range) * (H - pad * 2);
        return <text x={lx} y={ly - 10} fill="#f1f5f9" fontSize="9" textAnchor="middle" fontWeight="700">{Math.round(vals[vals.length - 1])}</text>;
      })()}
    </svg>
  );
}

const TAB_CONFIG = {
  30: {
    label: '+30 days',
    accent: '#6366f1',
    accentBg: 'rgba(99,102,241,0.12)',
    accentBorder: 'rgba(99,102,241,0.25)',
    accentGrad: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    examGrad: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    examBg: 'rgba(99,102,241,0.08)',
    examBorder: 'rgba(99,102,241,0.2)',
    tipArrow: '#6366f1',
    activeGrad: 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(139,92,246,0.18))',
    activeBorder: 'rgba(99,102,241,0.35)',
  },
  60: {
    label: '+60 days',
    accent: '#3b82f6',
    accentBg: 'rgba(59,130,246,0.12)',
    accentBorder: 'rgba(59,130,246,0.25)',
    accentGrad: 'linear-gradient(135deg,#3b82f6,#6366f1)',
    examGrad: 'linear-gradient(135deg,#3b82f6,#6366f1)',
    examBg: 'rgba(59,130,246,0.08)',
    examBorder: 'rgba(59,130,246,0.2)',
    tipArrow: '#3b82f6',
    activeGrad: 'linear-gradient(135deg,rgba(59,130,246,0.22),rgba(99,102,241,0.15))',
    activeBorder: 'rgba(59,130,246,0.35)',
  },
  90: {
    label: '+90 days',
    accent: '#a855f7',
    accentBg: 'rgba(168,85,247,0.12)',
    accentBorder: 'rgba(168,85,247,0.25)',
    accentGrad: 'linear-gradient(135deg,#a855f7,#d946ef)',
    examGrad: 'linear-gradient(135deg,#a855f7,#d946ef)',
    examBg: 'rgba(168,85,247,0.08)',
    examBorder: 'rgba(168,85,247,0.2)',
    tipArrow: '#a855f7',
    activeGrad: 'linear-gradient(135deg,rgba(168,85,247,0.22),rgba(217,70,239,0.12))',
    activeBorder: 'rgba(168,85,247,0.35)',
  },
} as const;

type TabDays = 30 | 60 | 90;

function FutureTwinCard({ twin }: { twin: TwinState }) {
  const [activeTab, setActiveTab] = useState<TabDays>(30);
  const prevFt = useRef<FutureTwin | null>(null);

  const ftMap: Record<TabDays, FutureTwin | null> = {
    30: twin.future_twin,
    60: twin.future_twin_60,
    90: twin.future_twin_90,
  };
  const ft = ftMap[activeTab] ?? prevFt.current;
  if (ft) prevFt.current = ft;
  if (!ft) return null;

  const cfg = TAB_CONFIG[activeTab];

  const metrics = [
    { label: 'Overall',     cur: twin.overall_score,     fut: ft.overall_score,     grad: SCORE_GRADS[0] },
    { label: 'Academic',    cur: twin.academic_score,    fut: ft.academic_score,    grad: SCORE_GRADS[1] },
    { label: 'Wellness',    cur: twin.wellness_score,    fut: ft.wellness_score,    grad: SCORE_GRADS[2] },
    { label: 'Consistency', cur: twin.consistency_score, fut: ft.consistency_score, grad: SCORE_GRADS[3] },
  ];

  return (
    <div style={{ ...s.card, ...s.fullWidth, padding: '1.25rem 1.5rem' }}>
      {/* Header row with tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.6rem' }}>
        <h3 style={{ ...s.cardTitle, marginBottom: 0 }}>Future Twin</h3>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '0.25rem', padding: '3px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
          {([30, 60, 90] as TabDays[]).map(days => {
            const c = TAB_CONFIG[days];
            const isActive = activeTab === days;
            return (
              <button
                key={days}
                onClick={() => setActiveTab(days)}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '9px',
                  border: isActive ? `1px solid ${c.activeBorder}` : '1px solid transparent',
                  background: isActive ? c.activeGrad : 'transparent',
                  color: isActive ? c.accent : '#475569',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  letterSpacing: '0.02em',
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2×2 metric grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.9rem' }}>
        {metrics.map(m => {
          const delta = m.fut - m.cur;
          const dc = delta >= 2 ? '#10b981' : delta <= -2 ? '#ef4444' : '#64748b';
          return (
            <div key={m.label} style={{ padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{m.label}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: dc }}>{delta >= 0 ? '+' : ''}{Math.round(delta)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#475569' }}>{Math.round(m.cur)}</span>
                <span style={{ fontSize: '0.7rem', color: '#334155' }}>→</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9' }}>{Math.round(m.fut)}</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                <div className="score-bar-fill" style={{ height: '100%', width: `${m.fut}%`, background: delta >= 0 ? m.grad : 'linear-gradient(90deg,#ef4444,#f87171)', borderRadius: '99px' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Exam score + message side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: ft.predicted_exam_score !== null ? '140px 1fr' : '1fr', gap: '0.6rem', marginBottom: ft.tips.length > 0 ? '0.75rem' : 0 }}>
        {ft.predicted_exam_score !== null && (
          <div style={{ padding: '0.6rem 0.75rem', background: cfg.examBg, border: `1px solid ${cfg.examBorder}`, borderRadius: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Exam Score</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem' }}>
              <span key={activeTab} style={{ fontSize: '1.5rem', fontWeight: 800, display: 'inline-block', background: cfg.examGrad, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {ft.predicted_exam_score}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#475569' }}>/100</span>
            </div>
          </div>
        )}
        <div style={{ padding: '0.6rem 0.75rem', background: MSG_BG[twin.trend], border: `1px solid ${MSG_BORDER[twin.trend]}`, borderRadius: '10px', display: 'flex', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: MSG_COLOR[twin.trend], lineHeight: 1.5 }}>
            {ft.motivational_message}
          </p>
        </div>
      </div>

      {/* Tips — compact inline list */}
      {ft.tips.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {ft.tips.map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <span style={{ color: cfg.tipArrow, fontWeight: 700, fontSize: '0.75rem', flexShrink: 0, marginTop: '0.1rem' }}>→</span>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>{tip}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Twin() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [twin,     setTwin]     = useState<TwinState | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [progress, setProgress] = useState<GamificationProgress | null>(null);

  const ageCount  = useCounter(twin?.twin_age ?? 0, 900);
  const dataCount = useCounter(twin?.data_points ?? 0, 800);

  const refreshTwin = useCallback(() => {
    api.get('/twin', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setTwin(r.data))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    api.get('/twin', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setTwin(r.data))
      .catch(() => setError('Failed to load twin data.'))
      .finally(() => setLoading(false));
    api.get<GamificationProgress>('/gamification/progress')
      .then(r => setProgress(r.data))
      .catch(() => {});
  }, [token]);

  const wsConnected = useWebSocket(user?.id, token, refreshTwin);

  const initials = user?.full_name
    ? user.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const avatarColor = progress ? getLevelColor(progress.level) : (twin ? RISK_COLOR[twin.risk_level] : '#6366f1');

  return (
    <div style={s.shell}>
      {/* Background orb */}
      <div style={s.bgOrb} />

      {/* Navbar */}
      <header style={s.nav}>
        <div style={s.navLeft}>
          <BackButton />
          <span style={{ fontSize: '1rem', color: '#6366f1' }}>◈</span>
          <span style={s.navLogo}>TwinMind</span>
          {wsConnected && <LiveBadge />}
        </div>
        <div style={s.navRight}>
          <Link to="/checkin" className="nav-link" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8' }}>Log Check-in</Link>
        </div>
      </header>

      <main style={s.main}>
        <div style={{ marginBottom: '2rem' }} className="animate-slide-up">
          <h1 style={s.pageTitle}>{t('twin_title')}</h1>
          <p style={s.pageSub}>A living model of your academic self, built from your data.</p>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#475569' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'float 2s ease-in-out infinite' }}>◈</div>
            <p>Loading your twin…</p>
          </div>
        )}
        {error && <p style={{ color: '#f87171', textAlign: 'center', marginTop: '3rem' }}>{error}</p>}

        {twin && (
          <div style={s.grid} className="mob-twin-row">

            {/* ── Level & XP card ── */}
            {progress && (
              <div style={{ ...s.card, ...s.fullWidth, marginBottom: 0 }} className="animate-slide-up">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' as const }}>
                  {/* Level badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                    <div style={{
                      width: '56px', height: '56px', borderRadius: '50%',
                      background: getLevelGradient(progress.level),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.4rem', fontWeight: 800, color: '#fff',
                      boxShadow: `0 0 0 4px ${getLevelColor(progress.level)}30, 0 0 24px ${getLevelColor(progress.level)}40`,
                    }}>
                      {progress.level}
                    </div>
                    <div>
                      <p style={{ margin: '0 0 0.1rem', fontSize: '0.65rem', fontWeight: 700, color: getLevelColor(progress.level), textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                        Level {progress.level}
                      </p>
                      <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.3px' }}>
                        {progress.level_name}
                      </p>
                    </div>
                  </div>

                  {/* XP progress */}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                        {progress.xp.toLocaleString()} XP
                      </span>
                      {progress.level < 10 && (
                        <span style={{ fontSize: '0.72rem', color: '#475569' }}>
                          {progress.xp_to_next} XP to {LEVEL_NAMES[progress.level + 1]}
                        </span>
                      )}
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${progress.progress_pct}%`,
                        background: getLevelGradient(progress.level),
                        borderRadius: '99px', transition: 'width 1s ease',
                        boxShadow: `0 0 8px ${getLevelColor(progress.level)}60`,
                      }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' as const }}>
                      {[
                        { label: 'Check-ins', xp: progress.breakdown.checkins },
                        { label: 'Quizzes',   xp: progress.breakdown.quizzes + progress.breakdown.high_scores },
                        { label: 'Streak',    xp: progress.breakdown.streak },
                        { label: 'Badges',    xp: progress.breakdown.achievements },
                      ].map(b => b.xp > 0 && (
                        <span key={b.label} style={{
                          padding: '0.15rem 0.5rem', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 600,
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                          color: '#64748b',
                        }}>
                          {b.label} +{b.xp}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Level progression strip */}
                  <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                    {LEVEL_COLORS.slice(1).map((c, i) => {
                      const lv = i + 1;
                      return (
                        <div key={lv} title={`Level ${lv}`} style={{
                          width: '18px', height: '18px', borderRadius: '4px',
                          background: lv <= progress.level ? c : 'rgba(255,255,255,0.06)',
                          border: lv === progress.level ? `2px solid ${c}` : '1px solid rgba(255,255,255,0.05)',
                          transition: 'all 0.2s',
                          boxShadow: lv === progress.level ? `0 0 8px ${c}80` : 'none',
                        }} />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Avatar card */}
            <div style={s.avatarCard} className="animate-slide-up mob-twin-avatar">
              {/* Avatar with rings + particles */}
              <div style={{ position: 'relative', width: '130px', height: '130px', marginBottom: '1rem' }}>
                <Particles riskLevel={twin.risk_level} />

                {/* Outer spinning ring — level color */}
                <div style={{
                  position: 'absolute', inset: '-8px', borderRadius: '50%',
                  border: '2px solid transparent',
                  borderTopColor: avatarColor,
                  borderRightColor: avatarColor,
                  animation: 'ring-spin 3s linear infinite',
                  opacity: 0.65,
                }} />
                {/* Middle glow ring */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: `2px solid ${avatarColor}`,
                  boxShadow: `0 0 16px ${avatarColor}60`,
                  animation: GLOW_ANIM[twin.risk_level],
                }} />
                {/* Inner ring counter-spin */}
                <div style={{
                  position: 'absolute', inset: '8px', borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderBottomColor: `${avatarColor}60`,
                  animation: 'ring-spin-rev 6s linear infinite',
                }} />
                {/* Avatar circle */}
                <div style={{
                  position: 'absolute', inset: '4px', borderRadius: '50%',
                  background: `radial-gradient(circle at 35% 35%, ${avatarColor}35 0%, rgba(15,23,42,0.95) 70%)`,
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2rem', fontWeight: 800, color: avatarColor,
                  letterSpacing: '-1px',
                  textShadow: `0 0 20px ${avatarColor}90`,
                  animation: 'breathe 4s ease-in-out infinite',
                }}>
                  {initials}
                </div>
              </div>

              {/* Level badge under avatar */}
              {progress && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.25rem 0.75rem', borderRadius: '99px',
                  background: `${avatarColor}18`,
                  border: `1px solid ${avatarColor}40`,
                  marginBottom: '0.5rem',
                }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: avatarColor }}>Lv.{progress.level}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: avatarColor }}>{progress.level_name}</span>
                </div>
              )}

              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.6rem' }}>
                {user?.full_name?.split(' ')[0]}'s Twin
              </h2>

              {/* Risk badge */}
              <div style={{
                padding: '0.3rem 0.9rem', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
                color: RISK_COLOR[twin.risk_level], background: RISK_BG[twin.risk_level], border: `1px solid ${RISK_BORDER[twin.risk_level]}`,
                marginBottom: '0.5rem',
              }}>
                {twin.risk_level.toUpperCase()} RISK
              </div>

              {/* Trend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem', color: TREND_COLOR[twin.trend], fontWeight: 700, fontSize: '0.95rem' }}>
                <span style={{ fontSize: '1.1rem' }}>{TREND_ICON[twin.trend]}</span>
                <span>{TREND_LABEL[twin.trend]}</span>
              </div>

              {/* Meta */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{ageCount}</p>
                  <p style={{ fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginTop: '0.25rem' }}>days old</p>
                </div>
                <div style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.08)' }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{dataCount}</p>
                  <p style={{ fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginTop: '0.25rem' }}>check-ins</p>
                </div>
              </div>

              {twin.data_points === 0 && (
                <Link to="/checkin" style={{ display: 'inline-block', marginTop: '1.25rem', padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700, boxShadow: '0 4px 15px rgba(99,102,241,0.4)' }}>
                  Log first check-in →
                </Link>
              )}
            </div>

            {/* Vitals card */}
            <div style={s.card} className="animate-slide-up mob-twin-vitals">
              <h3 style={s.cardTitle}>Twin Vitals</h3>
              <ScoreBar label="Overall Score"       value={twin.overall_score}    grad={SCORE_GRADS[0]} delay={0} />
              <ScoreBar label="Academic Performance" value={twin.academic_score}   grad={SCORE_GRADS[1]} delay={100} />
              <ScoreBar label="Wellness"             value={twin.wellness_score}   grad={SCORE_GRADS[2]} delay={200} />
              <ScoreBar label="Consistency"          value={twin.consistency_score} grad={SCORE_GRADS[3]} delay={300} />

              {twin.strengths.length > 0 && (
                <div style={{ marginTop: '1.25rem' }}>
                  <p style={s.tagHeading}>Strengths</p>
                  <div style={s.tagRow}>
                    {twin.strengths.map(str => (
                      <span key={str} style={{ ...s.tag, background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>{str}</span>
                    ))}
                  </div>
                </div>
              )}
              {twin.areas_to_improve.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <p style={s.tagHeading}>Focus Areas</p>
                  <div style={s.tagRow}>
                    {twin.areas_to_improve.map(a => (
                      <span key={a} style={{ ...s.tag, background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>{a}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Evolution card */}
            <div style={{ ...s.card, ...s.fullWidth }}>
              <h3 style={s.cardTitle}>Twin Evolution</h3>
              {twin.history.length < 2 ? (
                <p style={{ color: '#475569', fontSize: '0.875rem' }}>
                  Log at least 2 check-ins to see your twin evolving over time.
                </p>
              ) : (
                <>
                  <SparkLine history={twin.history} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#475569' }}>{twin.history[0].date}</span>
                    <span style={{ fontSize: '0.72rem', color: '#475569' }}>{twin.history[twin.history.length - 1].date}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {[...twin.history].reverse().slice(0, 5).map(h => {
                      const barColor = h.overall_score >= 70 ? '#10b981' : h.overall_score >= 50 ? '#f59e0b' : '#ef4444';
                      return (
                        <div key={h.date} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#475569', width: '90px', flexShrink: 0 }}>{h.date}</span>
                          <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                            <div className="score-bar-fill" style={{ width: `${h.overall_score}%`, height: '100%', background: barColor, borderRadius: '99px' }} />
                          </div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f1f5f9', width: '28px', textAlign: 'right' as const }}>{Math.round(h.overall_score)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Future Twin card */}
            <FutureTwinCard twin={twin} />
          </div>
        )}
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100svh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(180deg,#080d1a 0%,#0a0f20 100%)',
    position: 'relative',
  },
  bgOrb: {
    position: 'fixed', width: '800px', height: '800px', borderRadius: '50%',
    background: 'radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 70%)',
    top: '-200px', right: '-200px', pointerEvents: 'none', zIndex: 0,
  },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 1.75rem', height: '60px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(8,13,26,0.85)',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    position: 'sticky', top: 0, zIndex: 50,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '0.45rem' },
  navLogo: { fontSize: '1.05rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.3px' },
  navRight: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  main: {
    flex: 1, padding: '2.5rem 2rem', maxWidth: '1000px',
    width: '100%', margin: '0 auto', boxSizing: 'border-box', position: 'relative', zIndex: 1,
  },
  pageTitle: { fontSize: '1.9rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.5px', marginBottom: '0.4rem' },
  pageSub: { color: '#475569', fontSize: '0.95rem' },
  grid: { display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1.25rem', alignItems: 'start' },
  avatarCard: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px', padding: '2rem 1.5rem',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center', backdropFilter: 'blur(20px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  card: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px', padding: '1.75rem',
    backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  fullWidth: { gridColumn: '1 / -1' },
  cardTitle: { fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '1.25rem', letterSpacing: '-0.1px' },
  tagHeading: { margin: '0 0 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.07em' },
  tagRow: { display: 'flex', flexWrap: 'wrap' as const, gap: '0.4rem' },
  tag: { padding: '0.25rem 0.65rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600 },

  /* Future Twin comparison */
  cmpHeader: {
    display: 'grid', gridTemplateColumns: '1fr 52px 72px 56px 1fr',
    gap: '0.5rem', paddingBottom: '0.6rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '0.25rem',
    fontSize: '0.68rem', fontWeight: 700, color: '#475569',
    textTransform: 'uppercase' as const, letterSpacing: '0.07em',
  },
  cmpRow: {
    display: 'grid', gridTemplateColumns: '1fr 52px 72px 56px 1fr',
    gap: '0.5rem', padding: '0.6rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center',
  },
  cmpLabelCol: { fontSize: '0.83rem', color: '#94a3b8' },
  cmpNowCol:   { fontSize: '0.83rem', textAlign: 'right' as const },
  cmpFutCol:   { fontSize: '0.9rem',  textAlign: 'right' as const },
  cmpDeltaCol: { fontSize: '0.83rem', textAlign: 'right' as const },
  cmpBarCol:   { paddingLeft: '0.5rem' },
  examBox: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.85rem 1.1rem', margin: '0 0 1rem',
    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: '12px',
  },
  msgBox: { padding: '0.9rem 1.1rem', borderRadius: '12px', border: '1px solid', marginBottom: '1rem' },
};

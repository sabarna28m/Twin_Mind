import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveBadge from '../components/LiveBadge';
import BackButton from '../components/BackButton';
import TwinGauge from '../components/TwinGauge';
import KnowledgeGraph from '../components/KnowledgeGraph';
import TwinSimulator from '../components/TwinSimulator';
import { getLevelColor, getLevelGradient, LEVEL_NAMES, LEVEL_COLORS, type GamificationProgress } from '../utils/gamification';

// ── Types ─────────────────────────────────────────────────────────────

interface HistoryPoint { date: string; overall_score: number }
interface FutureTwin {
  overall_score: number; consistency_score: number; wellness_score: number;
  academic_score: number; risk_level: 'low'|'medium'|'high';
  predicted_exam_score: number | null; motivational_message: string; tips: string[];
}
interface TwinState {
  overall_score: number; consistency_score: number; wellness_score: number;
  academic_score: number; risk_level: 'low'|'medium'|'high';
  trend: 'improving'|'declining'|'stable';
  twin_age: number; data_points: number;
  strengths: string[]; areas_to_improve: string[];
  history: HistoryPoint[];
  future_twin: FutureTwin|null; future_twin_60: FutureTwin|null; future_twin_90: FutureTwin|null;
}
interface TwinProfile {
  knowledge_scores: Record<string,number>; learning_speed: number; retention_rate: number;
  quiz_accuracy: number; focus_duration_avg: number; burnout_risk: number;
  study_consistency: number; engagement_score: number;
  twin_maturity: string; maturity_pct: number;
  learning_velocity: number; prediction_confidence: number;
  total_study_sessions: number; total_quiz_attempts: number;
}
interface KNode { id: string; label: string; score: number; mastery: string; records: number; last_updated: string|null }
interface KEdge { source: string; target: string }
interface KGraph { nodes: KNode[]; edges: KEdge[]; maturity_pct: number }
interface TwinSnapshot {
  date: string; overall_score: number; academic_score: number;
  wellness_score: number; consistency_score: number; risk_level: string;
  data_points: number; label: string;
}
interface ForecastResult {
  exam_readiness: number; burnout_probability: number; failure_risk: number;
  expected_completion_pct: number; confidence: number; trend_direction: string;
  explanations: string[];
}

// ── Constants ─────────────────────────────────────────────────────────

const RISK_COLOR  = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
const RISK_BG     = { low: 'rgba(16,185,129,0.12)', medium: 'rgba(245,158,11,0.12)', high: 'rgba(239,68,68,0.12)' };
const RISK_BORDER = { low: 'rgba(16,185,129,0.4)', medium: 'rgba(245,158,11,0.4)', high: 'rgba(239,68,68,0.4)' };
const TREND_ICON  = { improving: '↑', declining: '↓', stable: '→' };
const TREND_COLOR = { improving: '#10b981', declining: '#ef4444', stable: '#94a3b8' };
const TREND_LABEL = { improving: 'Improving', declining: 'Declining', stable: 'Stable' };
const MSG_COLOR   = { improving: '#6ee7b7', declining: '#fca5a5', stable: '#fde68a' };
const MSG_BG      = { improving: 'rgba(16,185,129,0.08)', declining: 'rgba(239,68,68,0.08)', stable: 'rgba(245,158,11,0.08)' };
const MSG_BORDER  = { improving: 'rgba(16,185,129,0.25)', declining: 'rgba(239,68,68,0.25)', stable: 'rgba(245,158,11,0.25)' };
const SCORE_GRADS = [
  'linear-gradient(90deg,#6366f1,#8b5cf6)', 'linear-gradient(90deg,#3b82f6,#6366f1)',
  'linear-gradient(90deg,#10b981,#06b6d4)', 'linear-gradient(90deg,#8b5cf6,#d946ef)',
];
const GLOW_ANIM = {
  low:    'glow-pulse-green 2.5s ease-in-out infinite',
  medium: 'glow-pulse-amber 2s ease-in-out infinite',
  high:   'glow-pulse-red 1.5s ease-in-out infinite',
};
const MATURITY_COLOR: Record<string,string> = {
  Seed: '#64748b', Growing: '#6366f1', Developing: '#f59e0b',
  Mature: '#10b981', Advanced: '#00D4FF',
};
const TAB_CFG = {
  30: { label: '+30 days', accent: '#6366f1', activeGrad: 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(139,92,246,0.18))', activeBorder: 'rgba(99,102,241,0.35)' },
  60: { label: '+60 days', accent: '#3b82f6', activeGrad: 'linear-gradient(135deg,rgba(59,130,246,0.22),rgba(99,102,241,0.15))', activeBorder: 'rgba(59,130,246,0.35)' },
  90: { label: '+90 days', accent: '#a855f7', activeGrad: 'linear-gradient(135deg,rgba(168,85,247,0.22),rgba(217,70,239,0.12))', activeBorder: 'rgba(168,85,247,0.35)' },
} as const;
type TabDays = 30|60|90;

const PARTICLE_CONFIG = [
  { angle: 0, r: 85, size: 3, dur: 3.2, delay: 0.0 }, { angle: 45, r: 82, size: 2, dur: 2.8, delay: 0.6 },
  { angle: 90, r: 88, size: 4, dur: 3.6, delay: 1.2 }, { angle: 135, r: 80, size: 2, dur: 2.5, delay: 0.3 },
  { angle: 180, r: 86, size: 3, dur: 3.0, delay: 0.9 }, { angle: 225, r: 83, size: 2, dur: 2.7, delay: 1.5 },
  { angle: 270, r: 87, size: 4, dur: 3.4, delay: 0.5 }, { angle: 315, r: 81, size: 2, dur: 2.9, delay: 1.1 },
];

// ── Hooks ─────────────────────────────────────────────────────────────

function useCounter(target: number, duration = 1000, delay = 0): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    let startTime = -1; let rafId: number;
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

// ── Sub-components ────────────────────────────────────────────────────

function Particles({ riskLevel }: { riskLevel: 'low'|'medium'|'high' }) {
  const color = RISK_COLOR[riskLevel];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {PARTICLE_CONFIG.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const x = Math.round(p.r * Math.sin(rad)), y = Math.round(-p.r * Math.cos(rad));
        return (
          <div key={i} style={{
            position: 'absolute', width: `${p.size}px`, height: `${p.size}px`,
            borderRadius: '50%', background: color, boxShadow: `0 0 ${p.size * 3}px ${color}`,
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
        <div className="score-bar-fill" style={{ width: `${value}%`, background: grad, animationDelay: `${delay}ms`, boxShadow: '0 0 8px rgba(99,102,241,0.4)' }} />
      </div>
    </div>
  );
}

function SparkLine({ history }: { history: HistoryPoint[] }) {
  if (history.length < 2) return null;
  const W = 340, H = 90, pad = 10;
  const vals = history.map(h => h.overall_score);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const [fx, fy] = pts.split(' ')[0].split(',').map(Number);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <filter id="sparkGlow"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" opacity="0.3" filter="url(#sparkGlow)" />
      <polyline points={pts} fill="none" stroke="url(#sparkGrad)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {vals.map((v, i) => {
        const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
        const y = H - pad - ((v - min) / range) * (H - pad * 2);
        return <circle key={i} cx={x} cy={y} r="4" fill="#8b5cf6" stroke="#1e1b4b" strokeWidth="2" />;
      })}
      <text x={fx} y={fy - 10} fill="#64748b" fontSize="9" textAnchor="middle">{Math.round(vals[0])}</text>
      {(() => {
        const lx = pad + (W - pad * 2), ly = H - pad - ((vals[vals.length-1] - min) / range) * (H - pad * 2);
        return <text x={lx} y={ly - 10} fill="#f1f5f9" fontSize="9" textAnchor="middle" fontWeight="700">{Math.round(vals[vals.length-1])}</text>;
      })()}
    </svg>
  );
}

function FutureTwinCard({ twin }: { twin: TwinState }) {
  const [activeTab, setActiveTab] = useState<TabDays>(30);
  const prevFt = useRef<FutureTwin | null>(null);
  const ftMap: Record<TabDays, FutureTwin|null> = { 30: twin.future_twin, 60: twin.future_twin_60, 90: twin.future_twin_90 };
  const ft = ftMap[activeTab] ?? prevFt.current;
  if (ft) prevFt.current = ft;
  if (!ft) return null;
  const cfg = TAB_CFG[activeTab];
  const metrics = [
    { label: 'Overall',     cur: twin.overall_score,     fut: ft.overall_score,     grad: SCORE_GRADS[0] },
    { label: 'Academic',    cur: twin.academic_score,    fut: ft.academic_score,    grad: SCORE_GRADS[1] },
    { label: 'Wellness',    cur: twin.wellness_score,    fut: ft.wellness_score,    grad: SCORE_GRADS[2] },
    { label: 'Consistency', cur: twin.consistency_score, fut: ft.consistency_score, grad: SCORE_GRADS[3] },
  ];
  return (
    <div style={{ ...s.card, ...s.fullWidth }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.6rem' }}>
        <h3 style={s.cardTitle}>📈 Future Twin Projections</h3>
        <div style={{ display: 'flex', gap: '0.25rem', padding: '3px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
          {([30,60,90] as TabDays[]).map(days => {
            const c = TAB_CFG[days]; const isActive = activeTab === days;
            return (
              <button key={days} onClick={() => setActiveTab(days)} style={{ padding: '0.3rem 0.75rem', borderRadius: '9px', border: isActive ? `1px solid ${c.activeBorder}` : '1px solid transparent', background: isActive ? c.activeGrad : 'transparent', color: isActive ? c.accent : '#475569', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.18s ease', fontFamily: 'inherit' }}>
                {c.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.9rem' }}>
        {metrics.map(m => {
          const delta = m.fut - m.cur; const dc = delta >= 2 ? '#10b981' : delta <= -2 ? '#ef4444' : '#64748b';
          return (
            <div key={m.label} style={{ padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: ft.predicted_exam_score !== null ? '140px 1fr' : '1fr', gap: '0.6rem', marginBottom: ft.tips.length > 0 ? '0.75rem' : 0 }}>
        {ft.predicted_exam_score !== null && (
          <div style={{ padding: '0.6rem 0.75rem', background: `${cfg.accent}14`, border: `1px solid ${cfg.accent}30`, borderRadius: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Exam Score</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, background: `linear-gradient(135deg,${cfg.accent},#8b5cf6)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{ft.predicted_exam_score}</span>
          </div>
        )}
        <div style={{ padding: '0.6rem 0.75rem', background: MSG_BG[twin.trend], border: `1px solid ${MSG_BORDER[twin.trend]}`, borderRadius: '10px', display: 'flex', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: MSG_COLOR[twin.trend], lineHeight: 1.5 }}>{ft.motivational_message}</p>
        </div>
      </div>
      {ft.tips.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {ft.tips.map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <span style={{ color: cfg.accent, fontWeight: 700, fontSize: '0.75rem', flexShrink: 0, marginTop: '0.1rem' }}>→</span>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>{tip}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export default function Twin() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [twin,      setTwin]      = useState<TwinState | null>(null);
  const [profile,   setProfile]   = useState<TwinProfile | null>(null);
  const [kGraph,    setKGraph]    = useState<KGraph | null>(null);
  const [snapshots, setSnapshots] = useState<TwinSnapshot[]>([]);
  const [forecast,  setForecast]  = useState<ForecastResult | null>(null);
  const [progress,  setProgress]  = useState<GamificationProgress | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [xaiOpen,   setXaiOpen]   = useState(false);

  const ageCount  = useCounter(twin?.twin_age   ?? 0, 900);
  const dataCount = useCounter(twin?.data_points ?? 0, 800);

  const refreshTwin = useCallback(() => {
    api.get('/twin').then(r => setTwin(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/twin').then(r => setTwin(r.data)).catch(() => {}),
      api.get('/twin/profile').then(r => setProfile(r.data)).catch(() => {}),
      api.get('/twin/knowledge-graph').then(r => setKGraph(r.data)).catch(() => {}),
      api.get('/twin/snapshots').then(r => setSnapshots(r.data)).catch(() => {}),
      api.get('/twin/forecast').then(r => setForecast(r.data)).catch(() => {}),
      api.get<GamificationProgress>('/gamification/progress').then(r => setProgress(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const wsConnected = useWebSocket(user?.id, token, refreshTwin);

  const initials = user?.full_name
    ? user.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  const avatarColor = progress ? getLevelColor(progress.level) : (twin ? RISK_COLOR[twin.risk_level] : '#6366f1');
  const maturityColor = profile ? (MATURITY_COLOR[profile.twin_maturity] ?? '#6366f1') : '#6366f1';

  return (
    <div style={s.shell}>
      <div style={s.bgOrb} />

      {/* Navbar */}
      <header style={s.nav}>
        <div style={s.navLeft}>
          <BackButton />
          <span style={{ fontSize: '1rem', color: '#00D4FF' }}>◈</span>
          <span style={s.navLogo}>TwinMind</span>
          {wsConnected && <LiveBadge />}
        </div>
        <div style={s.navRight}>
          {profile && (
            <div style={{ ...s.maturityChip, borderColor: `${maturityColor}40`, color: maturityColor, background: `${maturityColor}14` }}>
              <span style={{ ...s.maturityDot, background: maturityColor }} />
              {profile.twin_maturity} Twin · {profile.maturity_pct.toFixed(0)}%
            </div>
          )}
          <Link to="/checkin" className="nav-link" style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)', color: '#00D4FF' }}>Log Check-in</Link>
        </div>
      </header>

      <main style={s.main}>

        {/* Page header */}
        <div style={{ marginBottom: '2rem' }} className="animate-slide-up">
          <h1 style={s.pageTitle}>◈ Digital Twin System</h1>
          <p style={s.pageSub}>A living virtual model of your academic self — updated continuously from your behavior and performance.</p>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#475569' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'float 2s ease-in-out infinite' }}>◈</div>
            <p>Initializing your Digital Twin…</p>
          </div>
        )}

        {!loading && twin && (
          <>

            {/* ── Section 1: Maturity + Avatar + Vitals ── */}
            <div style={s.topRow} className="mob-twin-row">

              {/* Avatar card */}
              <div style={s.avatarCard} className="animate-slide-up mob-twin-avatar">
                {/* Twin maturity level ring */}
                {profile && (
                  <div style={{ width: '100%', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: maturityColor, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Twin Maturity</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: maturityColor }}>{profile.twin_maturity}</span>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${profile.maturity_pct}%`, background: `linear-gradient(90deg, ${maturityColor}88, ${maturityColor})`, borderRadius: '99px', transition: 'width 1s ease', boxShadow: `0 0 8px ${maturityColor}60` }} />
                    </div>
                  </div>
                )}

                {/* Avatar orb */}
                <div style={{ position: 'relative', width: '130px', height: '130px', marginBottom: '1rem' }}>
                  <Particles riskLevel={twin.risk_level} />
                  <div style={{ position: 'absolute', inset: '-8px', borderRadius: '50%', border: '2px solid transparent', borderTopColor: avatarColor, borderRightColor: avatarColor, animation: 'ring-spin 3s linear infinite', opacity: 0.65 }} />
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${avatarColor}`, boxShadow: `0 0 16px ${avatarColor}60`, animation: GLOW_ANIM[twin.risk_level] }} />
                  <div style={{ position: 'absolute', inset: '8px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.07)', borderBottomColor: `${avatarColor}60`, animation: 'ring-spin-rev 6s linear infinite' }} />
                  <div style={{ position: 'absolute', inset: '4px', borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, ${avatarColor}35 0%, rgba(15,23,42,0.95) 70%)`, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 800, color: avatarColor, textShadow: `0 0 20px ${avatarColor}90`, animation: 'breathe 4s ease-in-out infinite' }}>
                    {initials}
                  </div>
                </div>

                {progress && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.75rem', borderRadius: '99px', background: `${avatarColor}18`, border: `1px solid ${avatarColor}40`, marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: avatarColor }}>Lv.{progress.level}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: avatarColor }}>{progress.level_name}</span>
                  </div>
                )}

                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.6rem' }}>{user?.full_name?.split(' ')[0]}'s Twin</h2>

                <div style={{ padding: '0.3rem 0.9rem', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: RISK_COLOR[twin.risk_level], background: RISK_BG[twin.risk_level], border: `1px solid ${RISK_BORDER[twin.risk_level]}`, marginBottom: '0.5rem' }}>
                  {twin.risk_level.toUpperCase()} RISK
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem', color: TREND_COLOR[twin.trend], fontWeight: 700, fontSize: '0.95rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>{TREND_ICON[twin.trend]}</span>
                  <span>{TREND_LABEL[twin.trend]}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div style={{ textAlign: 'center' as const }}>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{ageCount}</p>
                    <p style={{ fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginTop: '0.25rem' }}>days old</p>
                  </div>
                  <div style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.08)' }} />
                  <div style={{ textAlign: 'center' as const }}>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{dataCount}</p>
                    <p style={{ fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginTop: '0.25rem' }}>check-ins</p>
                  </div>
                </div>
                {twin.data_points === 0 && (
                  <Link to="/checkin" style={{ display: 'inline-block', marginTop: '1.25rem', padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700 }}>
                    Log first check-in →
                  </Link>
                )}
              </div>

              {/* Vitals card */}
              <div style={s.card} className="animate-slide-up mob-twin-vitals">
                <h3 style={s.cardTitle}>⚡ Twin Vitals</h3>
                <ScoreBar label="Overall Health"      value={twin.overall_score}    grad={SCORE_GRADS[0]} delay={0}   />
                <ScoreBar label="Academic Performance" value={twin.academic_score}   grad={SCORE_GRADS[1]} delay={100} />
                <ScoreBar label="Wellness"             value={twin.wellness_score}   grad={SCORE_GRADS[2]} delay={200} />
                <ScoreBar label="Consistency"          value={twin.consistency_score} grad={SCORE_GRADS[3]} delay={300} />

                {profile && (
                  <>
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '1rem 0' }} />
                    <ScoreBar label="Quiz Accuracy"    value={profile.quiz_accuracy}      grad="linear-gradient(90deg,#f59e0b,#fbbf24)" delay={400} />
                    <ScoreBar label="Engagement Score" value={profile.engagement_score}    grad="linear-gradient(90deg,#ec4899,#8b5cf6)" delay={500} />
                    <ScoreBar label="Study Consistency" value={profile.study_consistency}  grad="linear-gradient(90deg,#00D4FF,#6366f1)" delay={600} />
                  </>
                )}

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
            </div>

            {/* ── Section 2: XP / Level ── */}
            {progress && (
              <div style={{ ...s.card, ...s.fullWidth }} className="animate-slide-up">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' as const }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: getLevelGradient(progress.level), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, color: '#fff', boxShadow: `0 0 0 4px ${getLevelColor(progress.level)}30, 0 0 24px ${getLevelColor(progress.level)}40` }}>
                      {progress.level}
                    </div>
                    <div>
                      <p style={{ margin: '0 0 0.1rem', fontSize: '0.65rem', fontWeight: 700, color: getLevelColor(progress.level), textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Level {progress.level}</p>
                      <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9' }}>{progress.level_name}</p>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{progress.xp.toLocaleString()} XP</span>
                      {progress.level < 10 && <span style={{ fontSize: '0.72rem', color: '#475569' }}>{progress.xp_to_next} to {LEVEL_NAMES[progress.level + 1]}</span>}
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress.progress_pct}%`, background: getLevelGradient(progress.level), borderRadius: '99px', transition: 'width 1s ease', boxShadow: `0 0 8px ${getLevelColor(progress.level)}60` }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                    {LEVEL_COLORS.slice(1).map((c, i) => {
                      const lv = i + 1;
                      return (
                        <div key={lv} title={`Level ${lv}`} style={{ width: '18px', height: '18px', borderRadius: '4px', background: lv <= progress.level ? c : 'rgba(255,255,255,0.06)', border: lv === progress.level ? `2px solid ${c}` : '1px solid rgba(255,255,255,0.05)', boxShadow: lv === progress.level ? `0 0 8px ${c}80` : 'none' }} />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Section 3: Twin Analytics Gauges ── */}
            {profile && (
              <div style={{ ...s.card, ...s.fullWidth }}>
                <h3 style={s.cardTitle}>📊 Twin Analytics</h3>
                <div style={s.gaugeGrid}>
                  <TwinGauge label="Learning Velocity"   value={Math.max(0, profile.learning_velocity + 50)} color="#00D4FF"  icon="⚡" description="Study intensity trend" />
                  <TwinGauge label="Retention Score"     value={profile.retention_rate}                       color="#6366f1"  icon="🧠" description="Knowledge retention" />
                  <TwinGauge label="Burnout Risk"        value={profile.burnout_risk}                         color="#ef4444"  icon="🔥" inverse description="Lower is better" />
                  <TwinGauge label="Engagement Score"    value={profile.engagement_score}                     color="#10b981"  icon="⭐" description="Platform activity" />
                  <TwinGauge label="Focus Quality"       value={Math.min(100, profile.focus_duration_avg * 1.5)} color="#f59e0b" icon="👁" description="Avg session length" />
                  <TwinGauge label="Prediction Confidence" value={profile.prediction_confidence}              color="#a78bfa"  icon="🎯" description="Data richness score" />
                </div>
                <div style={s.profileStats}>
                  {[
                    { label: 'Quiz Attempts',   value: profile.total_quiz_attempts },
                    { label: 'Study Sessions',  value: profile.total_study_sessions },
                    { label: 'Avg Focus Time',  value: `${profile.focus_duration_avg.toFixed(0)} min` },
                    { label: 'Knowledge Areas', value: Object.keys(profile.knowledge_scores).length },
                  ].map(stat => (
                    <div key={stat.label} style={s.profileStat}>
                      <p style={s.profileStatVal}>{stat.value}</p>
                      <p style={s.profileStatLbl}>{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Section 4: Knowledge Mastery Map ── */}
            {kGraph && kGraph.nodes.length > 0 && (
              <div style={{ ...s.card, ...s.fullWidth }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={s.cardTitle}>🗺️ Knowledge Mastery Map</h3>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Graph maturity: {kGraph.maturity_pct.toFixed(0)}%</span>
                    <Link to="/subjects" style={{ fontSize: '0.75rem', color: '#00D4FF', fontWeight: 700, textDecoration: 'none' }}>Add Records →</Link>
                  </div>
                </div>
                <KnowledgeGraph nodes={kGraph.nodes} edges={kGraph.edges} />
              </div>
            )}

            {/* ── Section 5: Predictive Simulation Engine ── */}
            <div style={{ ...s.card, ...s.fullWidth }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <h3 style={s.cardTitle}>🧪 Predictive Simulation Engine</h3>
              </div>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.55 }}>
                Simulate your academic future. Each scenario runs your real performance data through the AI predictor — see exactly how your choices impact outcomes.
              </p>
              <TwinSimulator />
            </div>

            {/* ── Section 6: Twin Timeline ── */}
            {snapshots.length > 0 && (
              <div style={{ ...s.card, ...s.fullWidth }}>
                <h3 style={s.cardTitle}>⏱ Digital Twin Timeline</h3>
                <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: '#64748b' }}>Compare your twin state across time. Snapshots are computed from your historical check-in data.</p>
                <div style={s.snapshotGrid}>
                  {snapshots.map((snap, i) => {
                    const rc = snap.risk_level === 'high' ? '#ef4444' : snap.risk_level === 'medium' ? '#f59e0b' : '#10b981';
                    const isLatest = i === 0;
                    return (
                      <div key={snap.date} style={{ ...s.snapshotCard, borderColor: isLatest ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)', background: isLatest ? 'rgba(0,212,255,0.05)' : 'rgba(255,255,255,0.03)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isLatest ? '#00D4FF' : '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{snap.label}</span>
                          <span style={{ fontSize: '0.65rem', color: '#475569' }}>{snap.date}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, color: '#f1f5f9', lineHeight: 1 }}>{snap.overall_score.toFixed(0)}</p>
                        <p style={{ margin: '0.1rem 0 0.5rem', fontSize: '0.62rem', color: '#475569' }}>Overall Score</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', marginBottom: '0.5rem' }}>
                          {[
                            { label: 'Academic',    value: snap.academic_score },
                            { label: 'Wellness',    value: snap.wellness_score },
                            { label: 'Consistency', value: snap.consistency_score },
                            { label: 'Check-ins',   value: snap.data_points },
                          ].map(m => (
                            <div key={m.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '0.3rem 0.4rem' }}>
                              <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#f1f5f9' }}>{typeof m.value === 'number' ? m.value.toFixed(0) : m.value}</p>
                              <p style={{ margin: 0, fontSize: '0.58rem', color: '#475569' }}>{m.label}</p>
                            </div>
                          ))}
                        </div>
                        <span style={{ display: 'inline-block', padding: '0.18rem 0.55rem', borderRadius: '99px', fontSize: '0.62rem', fontWeight: 700, color: rc, background: `${rc}14`, border: `1px solid ${rc}30` }}>
                          {snap.risk_level.toUpperCase()} RISK
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Section 7: Twin Evolution Chart ── */}
            <div style={{ ...s.card, ...s.fullWidth }}>
              <h3 style={s.cardTitle}>📈 Twin Evolution</h3>
              {twin.history.length < 2 ? (
                <p style={{ color: '#475569', fontSize: '0.875rem' }}>Log at least 2 check-ins to see your twin evolving over time.</p>
              ) : (
                <>
                  <SparkLine history={twin.history} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#475569' }}>{twin.history[0].date}</span>
                    <span style={{ fontSize: '0.72rem', color: '#475569' }}>{twin.history[twin.history.length-1].date}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {[...twin.history].reverse().slice(0, 5).map(h => {
                      const bc = h.overall_score >= 70 ? '#10b981' : h.overall_score >= 50 ? '#f59e0b' : '#ef4444';
                      return (
                        <div key={h.date} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#475569', width: '90px', flexShrink: 0 }}>{h.date}</span>
                          <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                            <div className="score-bar-fill" style={{ width: `${h.overall_score}%`, height: '100%', background: bc, borderRadius: '99px' }} />
                          </div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f1f5f9', width: '28px', textAlign: 'right' as const }}>{Math.round(h.overall_score)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* ── Section 8: AI Forecasting + XAI ── */}
            {forecast && (
              <div style={{ ...s.card, ...s.fullWidth }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
                  <h3 style={s.cardTitle}>🔮 AI Forecasting</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Confidence: {forecast.confidence.toFixed(0)}%</span>
                    <button onClick={() => setXaiOpen(x => !x)} style={{ padding: '0.25rem 0.7rem', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '99px', background: 'rgba(99,102,241,0.1)', color: '#818cf8', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {xaiOpen ? 'Hide XAI' : '🔍 Explain AI'}
                    </button>
                  </div>
                </div>

                <div style={s.forecastGrid}>
                  {[
                    { label: 'Exam Readiness',   value: forecast.exam_readiness,          color: '#10b981', icon: '🎓', desc: 'Prepared for exams' },
                    { label: 'Burnout Probability', value: forecast.burnout_probability,  color: '#ef4444', icon: '🔥', desc: 'Risk of burnout', inverse: true },
                    { label: 'Failure Risk',      value: forecast.failure_risk,            color: '#f59e0b', icon: '⚠️', desc: 'Academic failure chance', inverse: true },
                    { label: 'Curriculum Progress', value: forecast.expected_completion_pct, color: '#6366f1', icon: '📚', desc: 'Expected completion' },
                  ].map(m => {
                    const color = m.inverse
                      ? (m.value <= 30 ? '#10b981' : m.value <= 60 ? '#f59e0b' : '#ef4444')
                      : m.color;
                    return (
                      <div key={m.label} style={{ ...s.forecastCard, borderColor: `${color}25` }}>
                        <div style={{ ...s.forecastGlow, background: `radial-gradient(circle, ${color}15 0%, transparent 70%)` }} />
                        <span style={{ fontSize: '1.3rem' }}>{m.icon}</span>
                        <p style={{ margin: '0.3rem 0 0', fontSize: '0.6rem', fontWeight: 700, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{m.label}</p>
                        <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900, color, lineHeight: 1 }}>{m.value.toFixed(0)}%</p>
                        <p style={{ margin: 0, fontSize: '0.62rem', color: '#475569' }}>{m.desc}</p>
                      </div>
                    );
                  })}
                </div>

                {/* XAI Explainability */}
                {xaiOpen && (
                  <div style={s.xaiPanel} className="animate-slide-up">
                    <p style={{ margin: '0 0 0.6rem', fontSize: '0.7rem', fontWeight: 800, color: '#818cf8', letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>🔍 Explainable AI — Why These Predictions?</p>
                    {forecast.explanations.map((exp, i) => (
                      <div key={i} style={s.xaiLine}>
                        <span style={{ color: '#6366f1', fontSize: '0.75rem', flexShrink: 0, fontWeight: 700 }}>→</span>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.55 }}>{exp}</p>
                      </div>
                    ))}
                    <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.85rem', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px' }}>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#818cf8', lineHeight: 1.55 }}>
                        <strong>Model:</strong> XGBoost regression trained on academic correlations. Features: study hours, attendance, assignment completion, quiz scores, stress level, sleep duration. Prediction confidence increases with more data points.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Section 9: Future Twin Projections ── */}
            <FutureTwinCard twin={twin} />

            {/* ── Section 10: AI Twin Coach ── */}
            {profile && twin.areas_to_improve.length > 0 && (
              <div style={{ ...s.card, ...s.fullWidth }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={s.coachAvatar}>◈</div>
                  <div>
                    <h3 style={{ ...s.cardTitle, marginBottom: 0 }}>🤖 AI Twin Coach</h3>
                    <p style={{ margin: 0, fontSize: '0.68rem', color: '#475569' }}>Personalized recommendations based on your twin profile</p>
                  </div>
                </div>
                <div style={s.coachGrid}>
                  {[
                    {
                      area: '📚 Study Plan',
                      insight: `Your twin shows ${twin.trend} performance with ${twin.data_points} data points. ${
                        profile.learning_velocity < 0 ? 'Learning velocity is declining — focus on consistent daily sessions.' :
                        profile.learning_velocity > 20 ? 'Strong momentum detected! Capitalize by increasing depth.' :
                        'Steady pace. Increase to 3+ hours/day to accelerate growth.'
                      }`,
                      action: 'Generate Study Plan', link: '/mentor',
                      why: `Based on twin trend: ${twin.trend}, velocity: ${profile.learning_velocity.toFixed(0)}%`,
                    },
                    {
                      area: '🎯 Weak Areas',
                      insight: `Focus areas identified: ${twin.areas_to_improve.join(', ')}. ${
                        profile.quiz_accuracy < 60 ? 'Quiz accuracy below 60% — practice quizzes will accelerate learning.' :
                        'Consider increasing subject-specific practice sessions.'
                      }`,
                      action: 'View Subject Analysis', link: '/subjects',
                      why: `Based on quiz accuracy: ${profile.quiz_accuracy.toFixed(0)}%`,
                    },
                    {
                      area: '🧘 Wellness',
                      insight: `Burnout risk at ${profile.burnout_risk.toFixed(0)}/100. ${
                        profile.burnout_risk > 70 ? '⚠️ High burnout detected — reduce study intensity and take breaks.' :
                        profile.burnout_risk > 40 ? 'Medium stress — ensure 7+ hours sleep and regular breaks.' :
                        'Wellness looks good. Maintain current work-rest balance.'
                      }`,
                      action: 'Check Burnout Status', link: '/burnout',
                      why: `Based on burnout score: ${profile.burnout_risk.toFixed(0)}/100`,
                    },
                    {
                      area: '👁 Focus',
                      insight: `Average focus session: ${profile.focus_duration_avg.toFixed(0)} min. ${
                        profile.focus_duration_avg < 20 ? 'Sessions too short — aim for 25+ minute Pomodoro blocks.' :
                        profile.focus_duration_avg > 60 ? 'Long sessions noted — consider breaks every 50 minutes.' :
                        'Focus duration is optimal. Try AI Focus Detector for deeper analytics.'
                      }`,
                      action: 'Start AI Focus', link: '/ai-focus',
                      why: `Based on avg session: ${profile.focus_duration_avg.toFixed(0)} min`,
                    },
                  ].map(rec => (
                    <div key={rec.area} style={s.coachCard}>
                      <p style={s.coachArea}>{rec.area}</p>
                      <p style={s.coachInsight}>{rec.insight}</p>
                      <p style={s.coachWhy}>Why: {rec.why}</p>
                      <Link to={rec.link} style={s.coachAction}>{rec.action} →</Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </>
        )}

        {!loading && !twin && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#475569' }}>
            <p style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>◈</p>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.5rem' }}>Your Digital Twin hasn't been created yet.</p>
            <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>Log your first check-in to activate your twin.</p>
            <Link to="/checkin" style={{ padding: '0.65rem 1.5rem', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', borderRadius: '12px', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 700 }}>Log Check-in →</Link>
          </div>
        )}

      </main>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg,#080d1a 0%,#0a0f20 100%)', position: 'relative' },
  bgOrb: { position: 'fixed', width: '800px', height: '800px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,212,255,0.05) 0%,transparent 70%)', top: '-200px', right: '-200px', pointerEvents: 'none', zIndex: 0 },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.75rem', height: '60px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(8,13,26,0.88)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 50 },
  navLeft: { display: 'flex', alignItems: 'center', gap: '0.45rem' },
  navLogo: { fontSize: '1.05rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.3px' },
  navRight: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  maturityChip: { display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.22rem 0.7rem', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 700, border: '1px solid', letterSpacing: '0.04em' },
  maturityDot: { display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0 },
  main: { flex: 1, padding: '2.5rem 2rem', maxWidth: '1060px', width: '100%', margin: '0 auto', boxSizing: 'border-box', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  pageTitle: { fontSize: '1.9rem', fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.7px', marginBottom: '0.4rem' },
  pageSub: { color: '#475569', fontSize: '0.92rem' },
  topRow: { display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1.25rem', alignItems: 'start' },
  avatarCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '1.75rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '1.75rem', backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
  fullWidth: { gridColumn: '1 / -1' },
  cardTitle: { fontSize: '0.95rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '1.25rem', letterSpacing: '-0.1px', margin: 0 },
  tagHeading: { margin: '0 0 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.07em' },
  tagRow: { display: 'flex', flexWrap: 'wrap' as const, gap: '0.4rem' },
  tag: { padding: '0.25rem 0.65rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600 },

  // Analytics gauges
  gaugeGrid: { display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '0.75rem', marginBottom: '1.25rem' },
  profileStats: { display: 'flex', gap: '0', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' },
  profileStat: { flex: 1, textAlign: 'center' as const },
  profileStatVal: { margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#f1f5f9' },
  profileStatLbl: { margin: 0, fontSize: '0.62rem', color: '#475569', fontWeight: 600 },

  // Timeline snapshots
  snapshotGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' },
  snapshotCard: { position: 'relative', border: '1px solid', borderRadius: '16px', padding: '1.1rem' },

  // Forecast
  forecastGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.85rem', marginBottom: '1rem' },
  forecastCard: { position: 'relative', overflow: 'hidden', border: '1px solid', borderRadius: '14px', padding: '1.1rem 0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', textAlign: 'center' as const },
  forecastGlow: { position: 'absolute', top: '-30%', right: '-20%', width: '100px', height: '100px', borderRadius: '50%', pointerEvents: 'none' },

  // XAI panel
  xaiPanel: { padding: '1rem', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px' },
  xaiLine: { display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '0.5rem' },

  // Coach
  coachAvatar: { width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#00D4FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: '#fff', flexShrink: 0, boxShadow: '0 0 18px rgba(99,102,241,0.4)', animation: 'breathe 3.5s ease-in-out infinite' },
  coachGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.85rem' },
  coachCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  coachArea:    { margin: 0, fontSize: '0.78rem', fontWeight: 800, color: '#f1f5f9' },
  coachInsight: { margin: 0, fontSize: '0.77rem', color: '#64748b', lineHeight: 1.55, flex: 1 },
  coachWhy:     { margin: 0, fontSize: '0.65rem', color: 'rgba(99,102,241,0.6)', fontStyle: 'italic' },
  coachAction: { display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, color: '#818cf8', textDecoration: 'none', padding: '0.3rem 0.75rem', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', alignSelf: 'flex-start' as const, marginTop: '0.2rem' },
};

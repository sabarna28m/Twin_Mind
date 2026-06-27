import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { BrainIcon } from '../components/TwinMindLogo';
import { useWebSocket } from '../hooks/useWebSocket';
import TwinHeroBanner from '../components/TwinHeroBanner';
import LiveBadge from '../components/LiveBadge';
import BackButton from '../components/BackButton';
import { getLevelColor, getLevelGradient, LEVEL_NAMES, LEVEL_COLORS, type GamificationProgress } from '../utils/gamification';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import HumanVsTwinDashboard from '../components/HumanVsTwinDashboard';

interface HistoryPoint {
  date: string;
  overall_score: number;
  twin_intelligence_score: number;
  knowledge_growth: number;
  consistency_level: number;
  focus_quality: number;
  study_hours: number;
  notes_created: number;
  quiz_accuracy: number | null;
  focus_sessions: number;
  score_delta: number | null;
  ai_explanation: string;
}

interface CognitiveHeatmap {
  knowledge_areas: number;
  memory_strength: number;
  focus_stability: number;
  learning_speed: number;
  prediction_confidence: number;
}

interface EvolutionEvent {
  date: string;
  icon: string;
  description: string;
}

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
  twin_intelligence_score: number;
  confidence_level: number;
  twin_maturity_level: number;
  prediction_reliability: number;
  behavior_understanding: string;
  current_state_label: string;
  cognitive_heatmap: CognitiveHeatmap | null;
  ai_insights: string[];
  evolution_timeline: EvolutionEvent[];
}

/* ── Extended model interfaces ───────────────────────────────────────── */
interface SubjectSummary  { subject: string; avg_score: number; recommended_daily_minutes: number; trend?: string }
interface SubjectAnalysis { weakest: SubjectSummary | null; strongest: SubjectSummary | null; focus_today: SubjectSummary | null }
interface BurnoutData     { burnout_score: number; risk_level: 'low' | 'medium' | 'high' }
interface LearningEntry   { study_hours: number; quiz_accuracy?: number | null; notes_created: number; focus_sessions: number; stress_level: number; sleep_duration: number; assignment_completion_rate: number }
interface StreakStatus     { streak_days: number; shield_count: number; last_checkin: string | null }

const RISK_COLOR  = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
const RISK_BG     = { low: 'rgba(16,185,129,0.1)', medium: 'rgba(245,158,11,0.1)', high: 'rgba(239,68,68,0.1)' };
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
        <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{count}</span>
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
        <div style={{ display: 'flex', gap: '0.25rem', padding: '3px', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
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
            <div key={m.label} style={{ padding: '0.6rem 0.75rem', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{m.label}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: dc }}>{delta >= 0 ? '+' : ''}{Math.round(delta)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{Math.round(m.cur)}</span>
                <span style={{ fontSize: '0.7rem', color: '#334155' }}>→</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{Math.round(m.fut)}</span>
              </div>
              <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
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
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>/100</span>
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

// ── Layer config for the multi-layer graph ─────────────────────────────
const LAYERS = [
  { key: 'twin_intelligence_score', label: 'Twin Intelligence', color: '#0052cc', dashed: false },
  { key: 'knowledge_growth',        label: 'Knowledge Growth',  color: '#34d399', dashed: false },
  { key: 'consistency_level',       label: 'Consistency',       color: '#f59e0b', dashed: false },
  { key: 'focus_quality',           label: 'Focus Quality',     color: '#06b6d4', dashed: false },
] as const;

type LayerKey = typeof LAYERS[number]['key'];

// ── Custom Recharts tooltip ────────────────────────────────────────────
function EvoTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const pt = (payload[0] as unknown as { payload: HistoryPoint }).payload;
  return (
    <div style={{
      background: 'rgba(8,13,26,0.97)', border: '1px solid rgba(129,140,248,0.3)',
      borderRadius: '14px', padding: '0.85rem 1rem', maxWidth: '280px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      <p style={{ margin: '0 0 0.55rem', fontSize: '0.78rem', fontWeight: 800, color: '#0052cc' }}>{pt.date}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem 0.75rem', marginBottom: '0.6rem' }}>
        {payload.map(l => (
          <div key={l.dataKey}>
            <span style={{ fontSize: '0.62rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {LAYERS.find(x => x.key === l.dataKey)?.label ?? l.dataKey}
            </span>
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: l.color }}>{Math.round(l.value)}</p>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', marginBottom: '0.45rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 0.75rem', fontSize: '0.7rem' }}>
          <span style={{ color: '#64748b' }}>Study: <strong style={{ color: '#0f172a' }}>{pt.study_hours}h</strong></span>
          <span style={{ color: '#64748b' }}>Notes: <strong style={{ color: '#0f172a' }}>{pt.notes_created}</strong></span>
          {pt.quiz_accuracy !== null && (
            <span style={{ color: '#64748b' }}>Quiz: <strong style={{ color: '#10b981' }}>{pt.quiz_accuracy?.toFixed(0)}%</strong></span>
          )}
          <span style={{ color: '#64748b' }}>Sessions: <strong style={{ color: '#0f172a' }}>{pt.focus_sessions}</strong></span>
        </div>
      </div>
      {pt.ai_explanation && (
        <div style={{ padding: '0.45rem 0.6rem', background: 'rgba(129,140,248,0.08)', borderRadius: '8px', border: '1px solid rgba(129,140,248,0.2)' }}>
          <p style={{ margin: '0 0 0.2rem', fontSize: '0.6rem', fontWeight: 700, color: '#0052cc', letterSpacing: '0.08em' }}>AI INSIGHT</p>
          <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', lineHeight: 1.5 }}>{pt.ai_explanation}</p>
        </div>
      )}
    </div>
  );
}

// ── Cognitive heatmap bar ──────────────────────────────────────────────
function HeatBar({ label, value, desc }: { label: string; value: number; desc: string }) {
  const color = value >= 70 ? '#10b981' : value >= 45 ? '#f59e0b' : '#ef4444';
  const band  = value >= 70 ? 'Strong' : value >= 45 ? 'Developing' : 'Needs Work';
  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
        <div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>{label}</span>
          <span style={{ marginLeft: '0.5rem', fontSize: '0.62rem', color: '#64748b' }}>{desc}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.12rem 0.5rem', borderRadius: '99px', background: `${color}18`, color, border: `1px solid ${color}30` }}>{band}</span>
          <span style={{ fontSize: '0.88rem', fontWeight: 800, color }}>{Math.round(value)}</span>
        </div>
      </div>
      <div style={{ height: '7px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
        <div className="score-bar-fill" style={{ width: `${value}%`, height: '100%', background: color, borderRadius: '99px', boxShadow: `0 0 8px ${color}60` }} />
      </div>
    </div>
  );
}

// ── Main Evolution Dashboard ───────────────────────────────────────────
function DigitalTwinEvolutionDashboard({ twin }: { twin: TwinState }) {
  const [activeLayers, setActiveLayers] = useState<Set<LayerKey>>(
    new Set(LAYERS.map(l => l.key))
  );

  function toggleLayer(key: LayerKey) {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  }

  const hasHistory = twin.history.length >= 2;
  const hm = twin.cognitive_heatmap;

  const tisDelta = twin.history.length >= 2
    ? twin.history[twin.history.length - 1].twin_intelligence_score
      - twin.history[twin.history.length - 2].twin_intelligence_score
    : null;

  const MATURITY_LABELS = ['', 'Infant', 'Developing', 'Maturing', 'Advanced', 'Expert'];
  const maturityColor = ['', '#ef4444', '#f59e0b', '#06b6d4', '#8b5cf6', '#10b981'][twin.twin_maturity_level] || '#818cf8';

  return (
    <>
      {/* ── 1. Twin Intelligence Score header ── */}
      <div style={{ ...s.card, ...s.fullWidth, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '1.1rem' }}>◈</span>
          <h3 style={{ ...s.cardTitle, marginBottom: 0 }}>Digital Twin Evolution Dashboard</h3>
          <span style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', padding: '0.18rem 0.55rem', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '99px' }}>
            Real-time · {twin.data_points} data pts
          </span>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.75rem' }} className="mob-4-col">
          {/* TIS */}
          <div style={{ padding: '1rem', background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: '14px' }}>
            <p style={{ margin: '0 0 0.2rem', fontSize: '0.62rem', fontWeight: 700, color: '#0052cc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Twin Intelligence Score</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{Math.round(twin.twin_intelligence_score)}</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>/100</span>
              {tisDelta !== null && (
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: tisDelta >= 0 ? '#10b981' : '#ef4444' }}>
                  {tisDelta >= 0 ? '+' : ''}{tisDelta.toFixed(1)}
                </span>
              )}
            </div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.65rem', color: '#64748b', lineHeight: 1.4 }}>
              A composite score measuring how well the twin understands your learning behavior.
            </p>
          </div>

          {/* Confidence */}
          <div style={{ padding: '1rem', background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '14px' }}>
            <p style={{ margin: '0 0 0.2rem', fontSize: '0.62rem', fontWeight: 700, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Confidence Level</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{Math.round(twin.confidence_level)}</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>%</span>
            </div>
            <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden', marginTop: '0.4rem' }}>
              <div style={{ width: `${twin.confidence_level}%`, height: '100%', background: '#06b6d4', borderRadius: '99px', transition: 'width 1s ease' }} />
            </div>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.65rem', color: '#64748b' }}>How sure the twin is about its predictions based on your data density.</p>
          </div>

          {/* Maturity */}
          <div style={{ padding: '1rem', background: `${maturityColor}0d`, border: `1px solid ${maturityColor}30`, borderRadius: '14px' }}>
            <p style={{ margin: '0 0 0.2rem', fontSize: '0.62rem', fontWeight: 700, color: maturityColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Twin Maturity</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>L{twin.twin_maturity_level}</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: maturityColor }}>{MATURITY_LABELS[twin.twin_maturity_level]}</span>
            </div>
            <div style={{ display: 'flex', gap: '3px' }}>
              {[1,2,3,4,5].map(l => (
                <div key={l} style={{ flex: 1, height: '4px', borderRadius: '99px', background: l <= twin.twin_maturity_level ? maturityColor : '#e2e8f0' }} />
              ))}
            </div>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.65rem', color: '#64748b' }}>Grows as you log more data over time. Expert at Level 5.</p>
          </div>

          {/* State */}
          <div style={{ padding: '1rem', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
            <p style={{ margin: '0 0 0.2rem', fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current State</p>
            <p style={{ margin: '0 0 0.35rem', fontSize: '1rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>{twin.current_state_label}</p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.62rem', padding: '0.12rem 0.45rem', borderRadius: '99px', background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
                Reliability {Math.round(twin.prediction_reliability)}%
              </span>
              <span style={{ fontSize: '0.62rem', padding: '0.12rem 0.45rem', borderRadius: '99px', background: 'rgba(99,102,241,0.1)', color: '#0052cc', border: '1px solid rgba(99,102,241,0.2)' }}>
                Behavior: {twin.behavior_understanding}
              </span>
            </div>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.65rem', color: '#64748b' }}>The twin's assessment of your current academic mode.</p>
          </div>
        </div>
      </div>

      {/* ── 2. Multi-layer evolution graph ── */}
      <div style={{ ...s.card, ...s.fullWidth }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ ...s.cardTitle, marginBottom: '0.2rem' }}>Multi-Layer Evolution Graph</h3>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
              Each line is a different dimension of how your twin is evolving. Hover a point to see what drove the change.
            </p>
          </div>
          {/* Layer toggles */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {LAYERS.map(l => {
              const on = activeLayers.has(l.key);
              return (
                <button key={l.key} onClick={() => toggleLayer(l.key)}
                  style={{ padding: '0.25rem 0.65rem', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', background: on ? `${l.color}20` : 'rgba(255,255,255,0.03)', color: on ? l.color : '#475569', border: `1px solid ${on ? l.color + '50' : '#e2e8f0'}` }}>
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>

        {!hasHistory ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
            <p style={{ fontSize: '1.5rem', margin: '0 0 0.5rem' }}>◈</p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Log at least 2 check-ins to activate the evolution graph.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={twin.history} margin={{ top: 5, right: 16, bottom: 5, left: -20 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                axisLine={false} tickLine={false}
                tickFormatter={d => {
                  const parts = d.split('-');
                  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
                }}
              />
              <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<EvoTooltip />} cursor={{ stroke: '#e2e8f0' }} />
              {LAYERS.filter(l => activeLayers.has(l.key)).map(l => (
                <Line
                  key={l.key} type="monotone" dataKey={l.key}
                  stroke={l.color} strokeWidth={activeLayers.size === 1 ? 2.5 : 1.8}
                  dot={{ fill: l.color, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 6, stroke: l.color, strokeWidth: 2, fill: '#08131a' }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Legend explanation */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.4rem', marginTop: '0.85rem' }}>
          {LAYERS.map(l => (
            <div key={l.key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', opacity: activeLayers.has(l.key) ? 1 : 0.35, transition: 'opacity 0.2s' }}>
              <div style={{ width: '12px', height: '3px', background: l.color, borderRadius: '99px', marginTop: '6px', flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: l.color }}>{l.label}</span>
                <p style={{ margin: 0, fontSize: '0.62rem', color: '#64748b', lineHeight: 1.4 }}>
                  {l.key === 'twin_intelligence_score' && 'Composite score of all learning dimensions.'}
                  {l.key === 'knowledge_growth' && 'How much new knowledge you acquired this session.'}
                  {l.key === 'consistency_level' && 'Attendance and assignment completion regularity.'}
                  {l.key === 'focus_quality' && 'Study intensity balanced with stress levels.'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Evolution Timeline + Cognitive Heatmap (side by side) ── */}
      <div style={{ ...s.fullWidth, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }} className="mob-twin-row">

        {/* Timeline */}
        <div style={s.card}>
          <h3 style={s.cardTitle}>Evolution Timeline</h3>
          {twin.evolution_timeline.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.82rem' }}>Log more check-ins to build your evolution story.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {twin.evolution_timeline.map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', paddingBottom: i < twin.evolution_timeline.length - 1 ? '0.9rem' : 0 }}>
                  {/* Timeline line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0 }}>{ev.icon}</div>
                    {i < twin.evolution_timeline.length - 1 && (
                      <div style={{ width: '1px', flex: 1, background: '#e2e8f0', marginTop: '4px' }} />
                    )}
                  </div>
                  <div style={{ paddingTop: '4px' }}>
                    <p style={{ margin: '0 0 0.2rem', fontSize: '0.65rem', fontWeight: 700, color: '#0052cc', letterSpacing: '0.06em' }}>
                      {ev.date}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.77rem', color: '#64748b', lineHeight: 1.5 }}>{ev.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cognitive Heatmap */}
        <div style={s.card}>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ ...s.cardTitle, marginBottom: '0.2rem' }}>Cognitive Heatmap</h3>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
              How your brain's learning dimensions are performing.
            </p>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {[['#10b981','Strong ≥70'],['#f59e0b','Developing 45–69'],['#ef4444','Needs Work <45']].map(([c,l]) => (
              <span key={l} style={{ fontSize: '0.62rem', fontWeight: 600, color: c, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c, display: 'inline-block' }} />{l}
              </span>
            ))}
          </div>
          {hm ? (
            <>
              <HeatBar label="Knowledge Areas"       value={hm.knowledge_areas}      desc="Academic depth across subjects" />
              <HeatBar label="Memory Strength"       value={hm.memory_strength}       desc="Quiz & assignment retention" />
              <HeatBar label="Focus Stability"       value={hm.focus_stability}       desc="Consistency of focused sessions" />
              <HeatBar label="Learning Speed"        value={hm.learning_speed}        desc="Rate of score improvement" />
              <HeatBar label="Prediction Confidence" value={hm.prediction_confidence} desc="Data density for reliable forecasts" />
            </>
          ) : (
            <p style={{ color: '#64748b', fontSize: '0.82rem' }}>Log check-ins to build your cognitive profile.</p>
          )}
        </div>
      </div>

      {/* ── 4. AI Insights ── */}
      {twin.ai_insights.length > 0 && (
        <div style={{ ...s.card, ...s.fullWidth }}>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ ...s.cardTitle, marginBottom: '0.2rem' }}>AI Twin Insights</h3>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
              Observations generated by the digital twin based on your actual behavioral patterns.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.7rem' }} className="mob-twin-row">
            {twin.ai_insights.map((insight, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.6rem', padding: '0.85rem', background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.15)', borderRadius: '12px' }}>
                <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '1px' }}>
                  {i === 0 ? '🔮' : i === 1 ? '📊' : i === 2 ? '🎯' : '💡'}
                </span>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 }}>{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. Twin Evolution Explanation card ── */}
      <div style={{ ...s.card, ...s.fullWidth }}>
        <h3 style={{ ...s.cardTitle, marginBottom: '1rem' }}>What These Metrics Mean</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.7rem' }} className="mob-twin-row">
          {[
            {
              label: 'Twin Intelligence Score',
              value: `${Math.round(twin.twin_intelligence_score)}/100`,
              color: '#0052cc',
              explain: 'A composite score from your study hours, quiz performance, assignment completion, and focus quality. Higher = the twin knows you better.',
            },
            {
              label: 'Twin Maturity Level',
              value: `Level ${twin.twin_maturity_level}/5 — ${MATURITY_LABELS[twin.twin_maturity_level]}`,
              color: maturityColor,
              explain: 'Grows as you log more data over longer periods. A mature twin makes more accurate predictions and generates deeper insights.',
            },
            {
              label: 'Prediction Reliability',
              value: `${Math.round(twin.prediction_reliability)}%`,
              color: '#a78bfa',
              explain: 'How confident the twin is in its future predictions. Increases with more consistent and complete check-in data.',
            },
            {
              label: 'Behavior Understanding',
              value: twin.behavior_understanding,
              color: '#34d399',
              explain: 'How deeply the twin understands your patterns. Ranges from Low (just started) to Expert (30+ data points with consistent logging).',
            },
          ].map(m => (
            <div key={m.label} style={{ padding: '0.85rem', background: `${m.color}08`, border: `1px solid ${m.color}20`, borderRadius: '12px' }}>
              <p style={{ margin: '0 0 0.15rem', fontSize: '0.62rem', fontWeight: 700, color: m.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{m.label}</p>
              <p style={{ margin: '0 0 0.4rem', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{m.value}</p>
              <p style={{ margin: 0, fontSize: '0.73rem', color: '#64748b', lineHeight: 1.5 }}>{m.explain}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TWIN FIDELITY BANNER
══════════════════════════════════════════════════════════════════════ */
function TwinFidelityBanner({
  twin, subjects, burnout, learningData, progress,
}: {
  twin: TwinState;
  subjects: SubjectAnalysis | null;
  burnout: BurnoutData | null;
  learningData: LearningEntry[];
  progress: import('../utils/gamification').GamificationProgress | null;
}) {
  const knowledgeFid = subjects ? Math.min(95, 55 + (subjects.strongest ? 15 : 0) + (subjects.weakest ? 15 : 0)) : 18;
  const behaviorFid  = Math.min(95, 25 + learningData.length * 2.8);
  const predFid      = twin.prediction_reliability;
  const goalFid      = progress ? Math.min(88, 35 + progress.level * 5 + Math.min(progress.breakdown.achievements / 5, 10)) : 22;
  const prodFid      = burnout ? Math.min(92, 62 + (burnout.burnout_score > 0 ? 20 : 0)) : 30;
  const overall      = Math.round((knowledgeFid + behaviorFid + predFid + goalFid + prodFid) / 5);

  const models = [
    { label: 'Knowledge',    value: Math.round(knowledgeFid), color: '#0052cc' },
    { label: 'Behavior',     value: Math.round(behaviorFid),  color: '#06b6d4' },
    { label: 'Prediction',   value: Math.round(predFid),      color: '#0052cc' },
    { label: 'Goal',         value: Math.round(goalFid),      color: '#f59e0b' },
    { label: 'Productivity', value: Math.round(prodFid),      color: '#10b981' },
  ];

  const fidelityColor = overall >= 80 ? '#10b981' : overall >= 55 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ ...x.card, ...x.fullWidth, padding: '1.25rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        {/* Overall score */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          <div style={{ position: 'relative', width: '76px', height: '76px' }}>
            <svg width="76" height="76" viewBox="0 0 76 76" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="38" cy="38" r="32" fill="none" stroke="'#e2e8f0'" strokeWidth="7" />
              <circle cx="38" cy="38" r="32" fill="none" stroke={fidelityColor} strokeWidth="7"
                strokeDasharray={`${2 * Math.PI * 32 * overall / 100} ${2 * Math.PI * 32 * (1 - overall / 100)}`}
                strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: fidelityColor, lineHeight: 1 }}>{overall}</span>
              <span style={{ fontSize: '0.5rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>%</span>
            </div>
          </div>
          <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Twin Fidelity</span>
        </div>

        <div style={{ flex: 1, minWidth: '260px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>Digital Twin Accuracy System</span>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: fidelityColor, padding: '0.12rem 0.5rem', borderRadius: '99px', background: `${fidelityColor}18`, border: `1px solid ${fidelityColor}30` }}>
              {overall >= 80 ? 'HIGH FIDELITY' : overall >= 55 ? 'DEVELOPING' : 'CALIBRATING'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
            {models.map(m => (
              <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>{m.label}</span>
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: m.color }}>{m.value}%</span>
                </div>
                <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${m.value}%`, background: m.color, borderRadius: '99px', transition: 'width 1s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flexShrink: 0, fontSize: '0.72rem', color: '#64748b', maxWidth: '180px', lineHeight: 1.6 }}>
          The twin's accuracy improves automatically as you log more check-ins, quizzes, and study sessions. Target 100% fidelity for fully personalized predictions.
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   EXTENDED MODELS SECTION (Knowledge + Behavior + Learning Style +
   Personality + Productivity)
══════════════════════════════════════════════════════════════════════ */
type ModelTab = 'knowledge' | 'behavior' | 'style' | 'personality' | 'productivity';

function ExtendedModelsSection({
  twin, subjects, burnout, learningData, streakData, progress,
}: {
  twin: TwinState;
  subjects: SubjectAnalysis | null;
  burnout: BurnoutData | null;
  learningData: LearningEntry[];
  streakData: StreakStatus | null;
  progress: import('../utils/gamification').GamificationProgress | null;
}) {
  const [tab, setTab] = useState<ModelTab>('knowledge');

  const tabs: { key: ModelTab; label: string; icon: string; color: string }[] = [
    { key: 'knowledge',   label: 'Knowledge',   icon: '🧠', color: '#0052cc' },
    { key: 'behavior',    label: 'Behavior',    icon: '📊', color: '#06b6d4' },
    { key: 'style',       label: 'Learning Style', icon: '🎯', color: '#0052cc' },
    { key: 'personality', label: 'Personality', icon: '⚡', color: '#f59e0b' },
    { key: 'productivity',label: 'Productivity',icon: '🚀', color: '#10b981' },
  ];

  /* ── derived metrics ── */
  const totalSessions    = learningData.length;
  const avgStudyHours    = totalSessions ? learningData.reduce((s, d) => s + d.study_hours, 0) / totalSessions : 0;
  const avgStress        = totalSessions ? learningData.reduce((s, d) => s + d.stress_level, 0) / totalSessions : 3;
  const avgSleep         = totalSessions ? learningData.reduce((s, d) => s + d.sleep_duration, 0) / totalSessions : 7;
  const quizSessions     = learningData.filter(d => d.quiz_accuracy != null && d.quiz_accuracy > 0).length;
  const noteSessions     = learningData.filter(d => d.notes_created > 0).length;
  const focusSessions    = learningData.reduce((s, d) => s + (d.focus_sessions || 0), 0);
  const avgQuizAccuracy  = quizSessions ? learningData.filter(d => d.quiz_accuracy).reduce((s, d) => s + (d.quiz_accuracy ?? 0), 0) / quizSessions : 0;
  const avgCompletion    = totalSessions ? learningData.reduce((s, d) => s + d.assignment_completion_rate, 0) / totalSessions * 100 : 0;
  const sessionStyleTotal = quizSessions + noteSessions + Math.min(focusSessions, totalSessions);

  const styleScores = {
    quiz:     sessionStyleTotal ? Math.round(quizSessions / sessionStyleTotal * 100) : 0,
    reading:  sessionStyleTotal ? Math.round(noteSessions / sessionStyleTotal * 100) : 0,
    practice: sessionStyleTotal ? Math.round(Math.min(focusSessions, totalSessions) / sessionStyleTotal * 100) : 0,
    video:    0,
    mixed:    0,
  };
  styleScores.video = Math.max(0, 25 - Math.round((styleScores.quiz + styleScores.reading + styleScores.practice) / 6));
  styleScores.mixed = Math.max(0, 100 - styleScores.quiz - styleScores.reading - styleScores.practice - styleScores.video);

  const dominantStyle = Object.entries(styleScores).reduce((a, b) => b[1] > a[1] ? b : a, ['mixed', 0])[0];
  const styleLabels: Record<string, string> = {
    quiz: 'Quiz Learner', reading: 'Reading Learner', practice: 'Practice Learner',
    video: 'Video Learner', mixed: 'Mixed Learner',
  };

  const streakDays   = streakData?.streak_days ?? 0;
  const personality  = {
    Discipline:       Math.round(twin.consistency_score),
    Persistence:      Math.min(100, Math.round(streakDays * 3 + 10)),
    Curiosity:        Math.min(100, Math.round(noteSessions * 8 + (twin.academic_score / 3))),
    Consistency:      Math.round(twin.consistency_score),
    Competitiveness:  Math.min(100, Math.round((progress?.level ?? 0) * 10 + (progress?.breakdown.achievements ?? 0) * 3)),
    Adaptability:     twin.trend === 'improving' ? 82 : twin.trend === 'stable' ? 62 : 42,
    Focus:            Math.round(Math.max(0, 100 - (burnout?.burnout_score ?? 35))),
  };

  const PERS_COLORS: Record<string, string> = {
    Discipline: '#6366f1', Persistence: '#f97316', Curiosity: '#06b6d4',
    Consistency: '#8b5cf6', Competitiveness: '#f59e0b', Adaptability: '#10b981', Focus: '#ec4899',
  };

  const focusScore     = Math.round(Math.max(0, 100 - (burnout?.burnout_score ?? 30)));
  const efficiency     = Math.min(100, Math.round(avgCompletion * 0.6 + avgQuizAccuracy * 0.4));
  const burnoutRisk    = burnout?.burnout_score ?? 30;
  const energyTrend    = twin.trend === 'improving' ? 78 : twin.trend === 'stable' ? 60 : 38;
  const dailyProd      = Math.round((focusScore * 0.35 + efficiency * 0.35 + (100 - burnoutRisk) * 0.3));
  const weeklyProd     = Math.round(dailyProd * 0.9);
  const monthlyProd    = Math.round(dailyProd * 0.85);

  function MBar({ label, value, color, note }: { label: string; value: number; color: string; note?: string }) {
    return (
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {note && <span style={{ fontSize: '0.62rem', color: '#64748b' }}>{note}</span>}
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color }}>{value}</span>
          </div>
        </div>
        <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
          <div className="score-bar-fill" style={{ width: `${value}%`, height: '100%', background: color, borderRadius: '99px', boxShadow: `0 0 6px ${color}60` }} />
        </div>
      </div>
    );
  }

  const activeColor = tabs.find(t => t.key === tab)?.color ?? '#6366f1';

  return (
    <div style={{ ...x.card, ...x.fullWidth }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '1rem' }}>🤖</span>
        <h3 style={{ ...x.cardTitle, marginBottom: 0 }}>Twin Model Analytics</h3>
        <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: '#64748b' }}>8 adaptive models</span>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1.5rem', padding: '4px', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '14px', flexWrap: 'wrap' }}>
        {tabs.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '0.42rem 0.6rem', borderRadius: '10px', border: 'none', fontFamily: 'inherit',
              background: active ? `${t.color}22` : 'transparent',
              color: active ? t.color : '#475569',
              fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
              borderBottom: active ? `2px solid ${t.color}` : '2px solid transparent',
              transition: 'all 0.18s', whiteSpace: 'nowrap',
            }}>
              {t.icon} {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Knowledge Model ── */}
      {tab === 'knowledge' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }} className="mob-twin-row">
          <div>
            <p style={{ ...x.sectionLabel, color: activeColor }}>Subject Mastery</p>
            {subjects?.strongest && (
              <MBar label={`${subjects.strongest.subject} (Strongest)`} value={Math.round(subjects.strongest.avg_score)} color="#10b981" note="Strong" />
            )}
            {subjects?.focus_today && subjects.focus_today.subject !== subjects.weakest?.subject && (
              <MBar label={`${subjects.focus_today.subject} (Focus Today)`} value={Math.round(subjects.focus_today.avg_score)} color="#6366f1" />
            )}
            {subjects?.weakest && (
              <MBar label={`${subjects.weakest.subject} (Priority)`} value={Math.round(subjects.weakest.avg_score)} color="#ef4444" note="Weak" />
            )}
            {!subjects && <p style={{ color: '#64748b', fontSize: '0.82rem' }}>Log subject sessions to build your knowledge model.</p>}
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px' }}>
              <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 600, color: '#0052cc' }}>
                🧠 Knowledge Velocity: <strong>{twin.trend === 'improving' ? 'Accelerating' : twin.trend === 'stable' ? 'Steady' : 'Decelerating'}</strong>
              </p>
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.68rem', color: '#64748b' }}>
                Based on {twin.data_points} data points over {twin.twin_age} days
              </p>
            </div>
          </div>
          <div>
            <p style={{ ...x.sectionLabel, color: activeColor }}>Memory & Retention</p>
            <MBar label="Memory Strength"     value={twin.cognitive_heatmap?.memory_strength ?? Math.round(twin.academic_score * 0.9)}      color="#8b5cf6" />
            <MBar label="Learning Speed"      value={twin.cognitive_heatmap?.learning_speed ?? Math.round(twin.twin_intelligence_score * 0.85)} color="#06b6d4" />
            <MBar label="Knowledge Areas"     value={twin.cognitive_heatmap?.knowledge_areas ?? Math.round(twin.academic_score)}              color="#6366f1" />
            <MBar label="Prediction Confidence" value={twin.cognitive_heatmap?.prediction_confidence ?? Math.round(twin.confidence_level)}   color="#10b981" />
            {subjects?.weakest && (
              <div style={{ marginTop: '1rem', padding: '0.65rem 0.85rem', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '10px' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#f87171' }}>⚠ Forgetting Risk: {subjects.weakest.subject}</p>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.67rem', color: '#64748b' }}>
                  Not studied recently — review every {subjects.weakest.recommended_daily_minutes} min/day to prevent decay.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Behavior Model ── */}
      {tab === 'behavior' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }} className="mob-twin-row">
          <div>
            <p style={{ ...x.sectionLabel, color: activeColor }}>Study Patterns</p>
            <MBar label="Session Consistency" value={Math.round(twin.consistency_score)} color={activeColor} />
            <MBar label="Assignment Completion" value={Math.round(avgCompletion)} color="#8b5cf6" />
            <MBar label="Focus Stability" value={twin.cognitive_heatmap?.focus_stability ?? Math.round(focusScore * 0.9)} color="#10b981" />
            <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              {[
                { label: 'Avg Study', value: `${avgStudyHours.toFixed(1)}h`, sub: 'per session' },
                { label: 'Avg Sleep', value: `${avgSleep.toFixed(1)}h`, sub: 'per night' },
                { label: 'Avg Stress', value: `${avgStress.toFixed(1)}/10`, sub: 'stress level' },
              ].map(stat => (
                <div key={stat.label} style={{ padding: '0.6rem', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '10px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{stat.value}</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p style={{ ...x.sectionLabel, color: activeColor }}>Behavioral Insights</p>
            {[
              { icon: '⏰', title: 'Peak Productivity', text: avgStudyHours >= 2.5 ? 'Long focused sessions — deep work oriented.' : 'Short distributed sessions — sprint learner.' },
              { icon: '📈', title: 'Habit Trend', text: twin.trend === 'improving' ? 'Positive habit formation detected. Keep going.' : twin.trend === 'stable' ? 'Stable patterns — consider adding variety.' : 'Habit disruption detected. Re-anchor your routine.' },
              { icon: '🔁', title: 'Consistency Forecast', text: `${Math.round(twin.consistency_score)}% consistency score. ${twin.consistency_score >= 70 ? 'Excellent — sustain this rhythm.' : 'Needs improvement — aim for daily check-ins.'}` },
              { icon: '🎯', title: 'Preferred Method', text: `Your twin detects ${styleLabels[dominantStyle]} tendencies based on session data.` },
            ].map(ins => (
              <div key={ins.title} style={{ display: 'flex', gap: '0.6rem', padding: '0.7rem 0.85rem', background: `${activeColor}08`, border: `1px solid ${activeColor}18`, borderRadius: '12px', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{ins.icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#0f172a' }}>{ins.title}</p>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.68rem', color: '#64748b', lineHeight: 1.5 }}>{ins.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Learning Style Model ── */}
      {tab === 'style' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }} className="mob-twin-row">
          <div>
            <p style={{ ...x.sectionLabel, color: activeColor }}>Learning Style Detection</p>
            <div style={{ marginBottom: '1rem', padding: '0.85rem 1rem', background: `${activeColor}10`, border: `1px solid ${activeColor}28`, borderRadius: '14px' }}>
              <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 700, color: activeColor, letterSpacing: '0.08em' }}>DETECTED STYLE</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>{styleLabels[dominantStyle]}</p>
            </div>
            {Object.entries(styleScores).map(([key, val]) => (
              <MBar key={key} label={styleLabels[key]} value={val} color={key === dominantStyle ? activeColor : '#334155'} />
            ))}
          </div>
          <div>
            <p style={{ ...x.sectionLabel, color: activeColor }}>Style-Based Recommendations</p>
            {[
              dominantStyle === 'quiz'     && { icon: '🧩', text: 'Your twin recommends short daily quizzes of 5–10 questions. Spaced repetition is your superpower.' },
              dominantStyle === 'reading'  && { icon: '📖', text: 'Your twin recommends structured note-taking and summary writing. Review notes within 24h.' },
              dominantStyle === 'practice' && { icon: '💪', text: 'Your twin recommends long focus sessions with deliberate practice. Use the Focus Timer daily.' },
              dominantStyle === 'video'    && { icon: '🎥', text: 'Your twin recommends curated video playlists. Pair with notes for maximum retention.' },
              { icon: '🔄', text: 'Your twin adapts its study plan recommendations based on your evolving learning style profile.' },
              { icon: '📊', text: `You have completed ${totalSessions} sessions analyzed. Your style accuracy improves with more data.` },
              { icon: '🎯', text: `${dominantStyle === 'mixed' ? 'Mixed learners benefit from variety.' : `${styleLabels[dominantStyle]}s retain best through ${dominantStyle === 'quiz' ? 'active recall' : dominantStyle === 'practice' ? 'deliberate practice' : 'structured review'}.`}` },
            ].filter(Boolean).slice(0, 4).map((ins: unknown, i) => {
              const item = ins as { icon: string; text: string };
              return (
                <div key={i} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.85rem', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '0.5rem' }}>
                  <span style={{ flexShrink: 0 }}>{item.icon}</span>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: 1.55 }}>{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Personality Model ── */}
      {tab === 'personality' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }} className="mob-twin-row">
          <div>
            <p style={{ ...x.sectionLabel, color: activeColor }}>Personality Profile (0–100)</p>
            {Object.entries(personality).map(([trait, score]) => (
              <MBar key={trait} label={trait} value={score} color={PERS_COLORS[trait] ?? activeColor} />
            ))}
          </div>
          <div>
            <p style={{ ...x.sectionLabel, color: activeColor }}>Trait Insights</p>
            {[
              { trait: 'Discipline', icon: '🔒', note: personality.Discipline >= 70 ? 'Strong. Your twin sees structured study habits.' : 'Developing. Build daily routines to strengthen this.' },
              { trait: 'Persistence', icon: '🔥', note: streakDays >= 7 ? `${streakDays}-day streak proves your persistence.` : 'Build a 7-day streak to unlock persistence recognition.' },
              { trait: 'Focus', icon: '🎯', note: burnout?.risk_level === 'low' ? 'Excellent focus health detected.' : 'Focus is under pressure — manage burnout risk.' },
              { trait: 'Curiosity', icon: '💡', note: noteSessions > 5 ? 'High note-taking activity signals strong curiosity.' : 'Take more notes to signal curiosity to your twin.' },
            ].map(({ trait, icon, note }) => (
              <div key={trait} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.85rem', background: `${PERS_COLORS[trait] ?? activeColor}08`, border: `1px solid ${PERS_COLORS[trait] ?? activeColor}20`, borderRadius: '12px', marginBottom: '0.5rem' }}>
                <span>{icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#0f172a' }}>{trait}</p>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.67rem', color: '#64748b', lineHeight: 1.5 }}>{note}</p>
                </div>
              </div>
            ))}
            <div style={{ marginTop: '0.5rem', padding: '0.7rem', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px' }}>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#fbbf24' }}>
                ⚡ Scores update automatically based on your actions, goal completions, and study behavior.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Productivity Model ── */}
      {tab === 'productivity' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }} className="mob-twin-row">
          <div>
            <p style={{ ...x.sectionLabel, color: activeColor }}>Productivity Scores</p>
            <MBar label="Focus Score"       value={focusScore}                     color="#10b981" note={burnout?.risk_level ?? '—'} />
            <MBar label="Study Efficiency"  value={efficiency}                     color="#6366f1" />
            <MBar label="Task Completion"   value={Math.round(avgCompletion)}      color="#8b5cf6" />
            <MBar label="Energy Trend"      value={energyTrend}                    color="#f59e0b" />
            <div style={{ height: '1px', background: '#e2e8f0', margin: '0.85rem 0' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {[
                { label: 'Daily Score',   value: dailyProd,   color: '#10b981' },
                { label: 'Weekly Score',  value: weeklyProd,  color: '#06b6d4' },
                { label: 'Monthly Score', value: monthlyProd, color: '#0052cc' },
              ].map(s => (
                <div key={s.label} style={{ padding: '0.65rem', background: `${s.color}0d`, border: `1px solid ${s.color}22`, borderRadius: '10px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: s.color }}>{s.value}</p>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.58rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p style={{ ...x.sectionLabel, color: activeColor }}>Burnout & Predictions</p>
            <div style={{ padding: '0.85rem 1rem', background: `${burnout?.risk_level === 'high' ? '#ef4444' : burnout?.risk_level === 'medium' ? '#f59e0b' : '#10b981'}10`, border: `1px solid ${burnout?.risk_level === 'high' ? 'rgba(239,68,68,0.3)' : burnout?.risk_level === 'medium' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`, borderRadius: '12px', marginBottom: '0.85rem' }}>
              <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.07em' }}>BURNOUT RISK</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', margin: '0.2rem 0 0.35rem' }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 900, color: burnout?.risk_level === 'high' ? '#ef4444' : burnout?.risk_level === 'medium' ? '#f59e0b' : '#10b981' }}>{burnout?.burnout_score ?? '—'}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>/100 · {(burnout?.risk_level ?? 'unknown').toUpperCase()}</span>
              </div>
              <MBar label="Burnout Pressure" value={burnout?.burnout_score ?? 0} color={burnout?.risk_level === 'high' ? '#ef4444' : burnout?.risk_level === 'medium' ? '#f59e0b' : '#10b981'} />
            </div>
            {[
              { icon: '⚡', title: 'Burnout Probability (7d)', value: `${Math.min(95, Math.round((burnout?.burnout_score ?? 30) * 0.8 + 5))}%` },
              { icon: '📉', title: 'Productivity Decline Risk', value: twin.trend === 'declining' ? 'HIGH' : twin.trend === 'stable' ? 'MEDIUM' : 'LOW' },
              { icon: '🎯', title: 'Missed Study Probability', value: `${Math.max(5, Math.round(100 - twin.consistency_score * 0.9))}%` },
            ].map(p => (
              <div key={p.title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.75rem', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span>{p.icon}</span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{p.title}</span>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: activeColor }}>{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PREDICTION CENTER
══════════════════════════════════════════════════════════════════════ */
function PredictionCenterSection({
  twin, subjects, burnout, streakData,
}: {
  twin: TwinState;
  subjects: SubjectAnalysis | null;
  burnout: BurnoutData | null;
  streakData: StreakStatus | null;
}) {
  const streakDays = streakData?.streak_days ?? 0;
  const streakProb = Math.min(98, 50 + streakDays * 2);
  const syllabusProb = Math.round(twin.consistency_score * 0.85);
  const forgettingSubject = subjects?.weakest?.subject ?? 'Unknown';
  const forgettingRisk = subjects?.weakest ? Math.max(20, 100 - Math.round(subjects.weakest.avg_score)) : 40;
  const goalFailRisk = Math.max(5, Math.round(100 - twin.consistency_score * 0.9));
  const quizScoreNext = Math.min(98, Math.round((twin.academic_score * 0.85) + (twin.trend === 'improving' ? 5 : 0)));
  const examReadiness = Math.round(twin.academic_score);
  const burnoutProb = Math.min(95, Math.round((burnout?.burnout_score ?? 25) * 0.75 + 5));
  const focusProb = Math.round(Math.max(10, 100 - (burnout?.burnout_score ?? 25) * 0.7));

  const predictions = [
    { icon: '🔥', label: 'Maintain streak this week', prob: streakProb,      conf: Math.min(95, 55 + streakDays), color: '#f97316' },
    { icon: '📚', label: 'Complete syllabus on time',  prob: syllabusProb,   conf: Math.round(twin.confidence_level * 0.9), color: '#0052cc' },
    { icon: '🧠', label: `Forgetting risk: ${forgettingSubject}`, prob: forgettingRisk, conf: subjects ? 82 : 30, color: '#ef4444' },
    { icon: '🎯', label: 'Goal failure probability',   prob: goalFailRisk,   conf: Math.round(twin.prediction_reliability * 0.85), color: '#f59e0b' },
    { icon: '📝', label: 'Expected quiz score (next week)', prob: quizScoreNext, conf: Math.round(twin.confidence_level), color: '#10b981' },
    { icon: '🏆', label: 'Exam readiness',             prob: examReadiness,  conf: Math.round(twin.confidence_level * 0.95), color: '#0052cc' },
    { icon: '⚠️', label: 'Burnout probability',        prob: burnoutProb,    conf: burnout ? 88 : 40, color: '#ef4444' },
    { icon: '⚡', label: 'Focus probability (today)',   prob: focusProb,      conf: burnout ? 85 : 45, color: '#06b6d4' },
  ];

  return (
    <div style={{ ...x.card, ...x.fullWidth }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '1rem' }}>🔮</span>
        <h3 style={{ ...x.cardTitle, marginBottom: 0 }}>Predictive AI Engine</h3>
        <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: '#64748b' }}>Confidence-weighted predictions</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }} className="mob-4-col">
        {predictions.map(pred => (
          <div key={pred.label} style={{ padding: '0.85rem', background: `${pred.color}08`, border: `1px solid ${pred.color}1a`, borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>{pred.icon}</span>
              <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#64748b', padding: '0.12rem 0.4rem', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '99px' }}>
                {pred.conf}% conf.
              </span>
            </div>
            <p style={{ margin: '0 0 0.4rem', fontSize: '0.68rem', color: '#64748b', lineHeight: 1.4 }}>{pred.label}</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 900, color: pred.color, lineHeight: 1 }}>{pred.prob}</span>
              <span style={{ fontSize: '0.65rem', color: '#64748b' }}>%</span>
            </div>
            <div style={{ height: '3px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pred.prob}%`, background: pred.color, borderRadius: '99px', transition: 'width 1s ease' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ASK MY TWIN — Interactive Simulation Engine
══════════════════════════════════════════════════════════════════════ */
function AskMyTwinSection({
  twin, subjects, burnout, learningData, streakData,
}: {
  twin: TwinState;
  subjects: SubjectAnalysis | null;
  burnout: BurnoutData | null;
  learningData: LearningEntry[];
  streakData: StreakStatus | null;
}) {
  const [input,    setInput]    = useState('');
  const [messages, setMessages] = useState<{ q: string; a: string }[]>([]);
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const QUICK_ASK = [
    'If I skip studying today?',
    'If I study 2 extra hours daily?',
    `If I focus only on ${subjects?.weakest?.subject ?? 'my weakest subject'}?`,
    'If I increase quizzes by 50%?',
    'What is my exam readiness?',
    'Am I at risk of burnout?',
  ];

  function generate(q: string): string {
    const ql = q.toLowerCase();
    const streak = streakData?.streak_days ?? 0;
    const totalSessions = learningData.length;
    const avgQuiz = learningData.filter(d => d.quiz_accuracy).length
      ? learningData.reduce((s, d) => s + (d.quiz_accuracy ?? 0), 0) / learningData.filter(d => d.quiz_accuracy).length
      : 65;

    if ((ql.includes('skip') || ql.includes('miss')) && (ql.includes('study') || ql.includes('session') || ql.includes('today'))) {
      const streakMsg = streak > 0 ? ` Your ${streak}-day streak is at risk.` : '';
      const dropPct   = Math.round(2.5 + (100 - twin.consistency_score) * 0.08);
      const cascadePct = Math.round(12 + (100 - twin.consistency_score) * 0.18);
      return `⚠️ Simulating: "Skip studying today"\n\nMy twin model projects the following outcomes:\n\n• Academic score may drop by ~${dropPct}% within 3 days without recovery.${streakMsg}\n• ${cascadePct}% probability this leads to consecutive missed days based on your pattern.\n• Knowledge retention in ${subjects?.weakest?.subject ?? 'your weakest subject'} would decline fastest.\n\n✅ Recommendation: If unavoidable, activate a Streak Shield and schedule a recovery session tomorrow. Even 30 minutes is significantly better than nothing.`;
    }

    if (ql.includes('extra') || (ql.includes('more') && ql.includes('hour'))) {
      const match = ql.match(/(\d+(\.\d+)?)\s*(extra\s*)?(hour|hr)/);
      const hours  = match ? parseFloat(match[1]) : 2;
      const boost  = Math.min(15, Math.round(hours * 3.2));
      const burnRisk = Math.min(95, Math.round((burnout?.burnout_score ?? 25) + hours * 12));
      return `📈 Simulating: "Study ${hours} extra hours daily"\n\nProjected outcomes over 14 days:\n\n• Academic score: +${boost}% improvement (projected)\n• Consistency score: +${Math.round(hours * 2.5)} points\n• Burnout probability rises to ${burnRisk}% — monitor this closely.\n\n🎯 Sweet spot: ${hours <= 2 ? 'This is sustainable with proper breaks.' : 'Consider 1.5h extra maximum to balance performance and wellness.'}\n\n⚡ Recommendation: Use the Focus Timer, take 10-min breaks every 45 minutes, and log your wellness check-in daily.`;
    }

    if (ql.includes('quiz') && (ql.includes('more') || ql.includes('increase') || ql.includes('50'))) {
      const current = Math.round(avgQuiz);
      const projected = Math.min(97, Math.round(current * 1.1 + 5));
      return `🧩 Simulating: "Increase quizzes by 50%"\n\nBased on your current accuracy of ~${current}%:\n\n• Projected accuracy in 3 weeks: ~${projected}%\n• Knowledge retention: +18% improvement expected\n• Academic score boost: +${Math.round(6 + current * 0.04)} points\n• Twin fidelity: Will improve significantly with more quiz data\n\n📊 The spaced repetition effect kicks in after 10+ quiz sessions. Your twin learns your weak areas and will prioritize them automatically.`;
    }

    const weakSubj = subjects?.weakest?.subject;
    if (weakSubj && ql.includes(weakSubj.toLowerCase())) {
      const score    = subjects!.weakest!.avg_score;
      const dailyMin = subjects!.weakest!.recommended_daily_minutes;
      const boost    = Math.round(dailyMin * 0.45);
      return `🎯 Simulating: "Focus only on ${weakSubj}"\n\nCurrent mastery: ${score.toFixed(0)}%\n\nProjected after 7-day focused study (${dailyMin} min/day):\n\n• ${weakSubj} score: +${boost}% improvement\n• Overall academic score: +${Math.round(boost * 0.3)}% lift\n• Forgetting risk: Reduced significantly\n• Recommended daily minimum: ${dailyMin} minutes\n\n⚡ Warning: Neglecting other subjects for more than 10 days may cause regression. Balance is key.`;
    }

    if (ql.includes('burnout') || ql.includes('burn out') || ql.includes('tired') || ql.includes('exhausted')) {
      const score = burnout?.burnout_score ?? 40;
      const risk  = burnout?.risk_level ?? 'medium';
      return `🔥 Burnout Analysis:\n\nCurrent burnout score: ${score}/100 (${risk.toUpperCase()} RISK)\n\n${risk === 'high'
        ? `⚠️ HIGH RISK DETECTED.\n• Immediate action required: limit study to 1.5h today.\n• Sleep ≥8h tonight is critical.\n• ${Math.round(45 + score * 0.3)}% probability of performance drop within 5 days if unchecked.`
        : risk === 'medium'
        ? `🟡 MEDIUM RISK.\n• Sustainable with minor adjustments.\n• Add 10-min breaks every 45 minutes.\n• ${Math.round(25 + score * 0.2)}% burnout escalation risk if pattern continues.`
        : `✅ LOW RISK.\n• You are in a healthy productivity zone.\n• Maintain sleep, breaks, and current study rhythm.\n• ${Math.round(8 + score * 0.15)}% baseline burnout probability.`}\n\nLog your wellness check-in daily for the most accurate burnout tracking.`;
    }

    if (ql.includes('exam') || ql.includes('ready') || ql.includes('readiness') || ql.includes('prepared')) {
      const predScore = twin.future_twin?.predicted_exam_score ?? Math.round(twin.academic_score * 0.88);
      const readPct   = Math.round(twin.academic_score);
      return `🏆 Exam Readiness Report:\n\nCurrent readiness: ${readPct}%\nPredicted exam score (30 days): ${predScore}/100\n\nStrength areas: ${twin.strengths.slice(0, 2).join(', ') || 'Building up'}\nFocus areas: ${twin.areas_to_improve.slice(0, 2).join(', ') || 'Continue current progress'}\n${subjects?.weakest ? `\nHighest-impact improvement: ${subjects.weakest.subject} at ${subjects.weakest.avg_score.toFixed(0)}% (${subjects.weakest.recommended_daily_minutes} min/day recommended)` : ''}\n\nTo reach ${Math.min(95, predScore + 10)}%: Maintain streak, hit 80%+ quiz accuracy, and study consistently for ${Math.max(14, Math.round((90 - twin.academic_score) * 0.8))} more days.`;
    }

    if (ql.includes('streak') || ql.includes('maintain') || ql.includes('keep going')) {
      const prob = Math.min(98, 50 + streak * 2);
      return `🔥 Streak Analysis:\n\nCurrent streak: ${streak} days\nWeekly maintenance probability: ${prob}%\n\nStreak milestones:\n• 7 days → +1 Shield, +50 XP bonus\n• 30 days → +2 Shields, +150 XP bonus\n• 100 days → +3 Shields, +500 XP bonus\n\nYou are ${streak >= 7 ? 'above' : `${7 - streak} days away from`} the 7-day milestone.\n\n⚡ Your twin estimates a ${Math.round(100 - (100 - twin.consistency_score) * 0.7)}% probability of breaking your all-time record if you maintain current habits for ${Math.max(3, 30 - streak)} more days.`;
    }

    const insight = twin.ai_insights[Math.floor(Math.random() * Math.max(1, twin.ai_insights.length))]
      ?? `Your twin has analyzed ${twin.data_points} data points across ${twin.twin_age} days.`;
    return `◈ Twin Response:\n\nYour current twin state: ${twin.current_state_label} (${Math.round(twin.overall_score)}/100 overall, trending ${twin.trend}).\n\n${insight}\n\nStrengths detected: ${twin.strengths.slice(0, 2).join(', ') || 'Still building your profile.'}\nFocus areas: ${twin.areas_to_improve.slice(0, 1).join(', ') || 'Keep consistent.'}\n\nTry asking: "If I skip studying today?", "What is my exam readiness?", "If I focus on ${subjects?.weakest?.subject ?? 'a subject'}?"`;
  }

  function handleAsk(question?: string) {
    const q = (question ?? input).trim();
    if (!q) return;
    setInput('');
    setThinking(true);
    setTimeout(() => {
      const a = generate(q);
      setMessages(prev => [...prev, { q, a }]);
      setThinking(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }, 800);
  }

  return (
    <div style={{ ...x.card, ...x.fullWidth }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '1rem' }}>◈</span>
        <h3 style={{ ...x.cardTitle, marginBottom: 0 }}>Ask My Twin — What-If Simulator</h3>
        <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: '#64748b' }}>Scenario simulation engine</span>
      </div>

      {/* Quick Ask chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
        {QUICK_ASK.map(q => (
          <button key={q} onClick={() => handleAsk(q)} style={{
            padding: '0.3rem 0.75rem', borderRadius: '99px', border: '1px solid rgba(99,102,241,0.25)',
            background: 'rgba(99,102,241,0.08)', color: '#0052cc', fontSize: '0.7rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
          }}>
            {q}
          </button>
        ))}
      </div>

      {/* Message history */}
      {messages.length > 0 && (
        <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1rem', padding: '0.5rem' }}>
          {messages.map((m, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.35rem' }}>
                <div style={{ maxWidth: '75%', padding: '0.55rem 0.85rem', background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '14px 14px 4px 14px', fontSize: '0.78rem', color: '#475569' }}>
                  {m.q}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.55rem' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#00D4FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0, color: '#fff', fontWeight: 800 }}>◈</div>
                <div style={{ flex: 1, padding: '0.75rem 0.95rem', background: '#f8f9fa', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '4px 14px 14px 14px', fontSize: '0.77rem', color: '#64748b', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {m.a}
                </div>
              </div>
            </div>
          ))}
          {thinking && (
            <div style={{ display: 'flex', gap: '0.55rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#00D4FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0, color: '#fff', fontWeight: 800, animation: 'breathe 1.5s ease-in-out infinite' }}>◈</div>
              <div style={{ padding: '0.75rem 0.95rem', background: '#f8f9fa', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '4px 14px 14px 14px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[0, 0.2, 0.4].map(delay => (
                  <div key={delay} style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#818cf8', animation: `particle-float 1.2s ease-in-out infinite`, animationDelay: `${delay}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: '0.6rem' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAsk()}
          placeholder='Ask your twin anything… "If I skip studying today?"'
          style={{
            flex: 1, padding: '0.65rem 1rem', borderRadius: '12px',
            background: '#f8f9fa', border: '1px solid rgba(99,102,241,0.25)',
            color: '#0f172a', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button
          onClick={() => handleAsk()}
          disabled={!input.trim() || thinking}
          style={{
            padding: '0.65rem 1.25rem', borderRadius: '12px',
            background: '#0052cc', border: 'none',
            color: '#fff', fontWeight: 800, fontSize: '0.82rem', cursor: input.trim() ? 'pointer' : 'not-allowed',
            opacity: input.trim() ? 1 : 0.5, fontFamily: 'inherit', transition: 'opacity 0.15s',
          }}
        >
          Ask →
        </button>
      </div>
    </div>
  );
}

/* ── Extra styles for new sections ───────────────────────────────── */
const x: Record<string, React.CSSProperties> = {
  card: {
    background: '#ffffff', border: '1px solid #e2e8f0',
    borderRadius: '20px', padding: '1.75rem',
    backdropFilter: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
  },
  fullWidth: { gridColumn: '1 / -1' },
  cardTitle: { fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem', letterSpacing: '-0.1px' },
  sectionLabel: { margin: '0 0 0.85rem', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase' as const },
};

export default function Twin() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [twin,         setTwin]         = useState<TwinState | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [progress,     setProgress]     = useState<GamificationProgress | null>(null);
  const [subjects,     setSubjects]     = useState<SubjectAnalysis | null>(null);
  const [burnout,      setBurnout]      = useState<BurnoutData | null>(null);
  const [learningData, setLearningData] = useState<LearningEntry[]>([]);
  const [streakData,   setStreakData]   = useState<StreakStatus | null>(null);

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
    api.get('/subject-performance/analysis').then(r => setSubjects(r.data)).catch(() => {});
    api.get('/burnout/latest').then(r => setBurnout(r.data)).catch(() => {});
    api.get('/learning-data?limit=30').then(r => setLearningData(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get('/streak-protection/status').then(r => setStreakData(r.data)).catch(() => {});
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
          <BrainIcon size={24} />
          <span style={s.navLogo}>TwinMind</span>
          {wsConnected && <LiveBadge />}
        </div>
        <div style={s.navRight}>
          <Link to="/twin-profile" style={{ padding:'0.38rem 0.9rem', borderRadius:9, background:'rgba(129,140,248,0.1)', border:'1px solid rgba(129,140,248,0.3)', color:'#a5b4fc', fontSize:'0.78rem', fontWeight:700, textDecoration:'none' }}>Twin Profile →</Link>
          <Link to="/checkin" className="nav-link" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#0052cc' }}>{t('twin_log_checkin')}</Link>
        </div>
      </header>

      <main style={s.main}>
        {/* ── Hero banner ── */}
        <div className="animate-slide-up">
          <TwinHeroBanner
            fidelityScore={twin?.overall_score}
            userName={user?.full_name}
          />
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'float 2s ease-in-out infinite' }}>◈</div>
            <p>{t('twin_loading')}</p>
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
                        {t('twin_level_prefix')} {progress.level}
                      </p>
                      <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
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
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {progress.xp_to_next} XP to {LEVEL_NAMES[progress.level + 1]}
                        </span>
                      )}
                    </div>
                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
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
                          background: '#f8f9fa', border: '1px solid #e2e8f0',
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
                          background: lv <= progress.level ? c : '#e2e8f0',
                          border: lv === progress.level ? `2px solid ${c}` : '1px solid #e2e8f0',
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
                  border: '1px solid #e2e8f0',
                  borderBottomColor: `${avatarColor}60`,
                  animation: 'ring-spin-rev 6s linear infinite',
                }} />
                {/* Avatar circle */}
                <div style={{
                  position: 'absolute', inset: '4px', borderRadius: '50%',
                  background: `radial-gradient(circle at 35% 35%, ${avatarColor}35 0%, '#ffffff' 70%)`,
                  border: '1px solid #e2e8f0',
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

              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.6rem' }}>
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
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{ageCount}</p>
                  <p style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginTop: '0.25rem' }}>days old</p>
                </div>
                <div style={{ width: '1px', height: '36px', background: '#e2e8f0' }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{dataCount}</p>
                  <p style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginTop: '0.25rem' }}>check-ins</p>
                </div>
              </div>

              {twin.data_points === 0 && (
                <Link to="/checkin" style={{ display: 'inline-block', marginTop: '1.25rem', padding: '0.55rem 1.25rem', background: '#0052cc', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700, boxShadow: '0 4px 15px rgba(99,102,241,0.4)' }}>
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

            {/* ── Digital Twin Evolution Dashboard ── */}
            <DigitalTwinEvolutionDashboard twin={twin} />

            {/* Future Twin card */}
            <FutureTwinCard twin={twin} />

            {/* ── Human vs Twin Analysis ── */}
            <HumanVsTwinDashboard />

            {/* ── Twin Fidelity Banner ── */}
            <TwinFidelityBanner twin={twin} subjects={subjects} burnout={burnout} learningData={learningData} progress={progress} />

            {/* ── Extended Model Analytics ── */}
            <ExtendedModelsSection twin={twin} subjects={subjects} burnout={burnout} learningData={learningData} streakData={streakData} progress={progress} />

            {/* ── Prediction Center ── */}
            <PredictionCenterSection twin={twin} subjects={subjects} burnout={burnout} streakData={streakData} />

            {/* ── Ask My Twin ── */}
            <AskMyTwinSection twin={twin} subjects={subjects} burnout={burnout} learningData={learningData} streakData={streakData} />
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
    background: 'transparent',
    position: 'relative',
  },
  bgOrb: {
    position: 'fixed', width: '800px', height: '800px', borderRadius: '50%',
    background: 'radial-gradient(circle,rgba(99,102,241,0.015) 0%,transparent 70%)',
    top: '-200px', right: '-200px', pointerEvents: 'none', zIndex: 0,
  },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 1.75rem', height: '60px',
    borderBottom: '1px solid var(--glass-border)',
    background: '#ffffff',
    backdropFilter: 'none', WebkitBackdropFilter: 'none',
    position: 'sticky', top: 0, zIndex: 50,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '0.45rem' },
  navLogo: { fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' },
  navRight: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  main: {
    flex: 1, padding: '2.5rem 2rem', maxWidth: '1000px',
    width: '100%', margin: '0 auto', boxSizing: 'border-box', position: 'relative', zIndex: 1,
  },
  pageTitle: { fontSize: '1.9rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: '0.4rem' },
  pageSub: { color: '#64748b', fontSize: '0.95rem' },
  grid: { display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1.25rem', alignItems: 'start' },
  avatarCard: {
    background: '#ffffff', border: '1px solid #e2e8f0',
    borderRadius: '20px', padding: '2rem 1.5rem',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center', backdropFilter: 'none',
    boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
  },
  card: {
    background: '#ffffff', border: '1px solid #e2e8f0',
    borderRadius: '20px', padding: '1.75rem',
    backdropFilter: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
  },
  fullWidth: { gridColumn: '1 / -1' },
  cardTitle: { fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem', letterSpacing: '-0.1px' },
  tagHeading: { margin: '0 0 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.07em' },
  tagRow: { display: 'flex', flexWrap: 'wrap' as const, gap: '0.4rem' },
  tag: { padding: '0.25rem 0.65rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600 },

  /* Future Twin comparison */
  cmpHeader: {
    display: 'grid', gridTemplateColumns: '1fr 52px 72px 56px 1fr',
    gap: '0.5rem', paddingBottom: '0.6rem',
    borderBottom: '1px solid #e2e8f0', marginBottom: '0.25rem',
    fontSize: '0.68rem', fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase' as const, letterSpacing: '0.07em',
  },
  cmpRow: {
    display: 'grid', gridTemplateColumns: '1fr 52px 72px 56px 1fr',
    gap: '0.5rem', padding: '0.6rem 0',
    borderBottom: '1px solid #e2e8f0', alignItems: 'center',
  },
  cmpLabelCol: { fontSize: '0.83rem', color: '#64748b' },
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

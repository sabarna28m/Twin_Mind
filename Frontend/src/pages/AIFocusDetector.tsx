/*
 * AIFocusDetector.tsx — Real-time focus monitoring via webcam + face-api.js
 * Uses @vladmandic/face-api (TinyFaceDetector + 68 face landmarks).
 * Falls back to Demo Mode automatically if CDN models cannot be loaded.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye, Brain, AlertTriangle, Camera, CameraOff,
  Play, Square, Trophy, Zap, Activity, Award,
  BarChart2, TrendingUp,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import * as faceapi from '@vladmandic/face-api';
import BackButton from '../components/BackButton';

/* ═══════════════════════════════════════════════════════════════════
   Types
═══════════════════════════════════════════════════════════════════ */

type FocusState = 'focused' | 'distracted' | 'tired' | 'away' | 'idle';

interface FocusMetrics {
  score: number;
  state: FocusState;
  facePresent: boolean;
  earAvg: number;
  headYaw: number;
  headPitch: number;
  isYawning: boolean;
}

interface FocusSnapshot {
  ts: number;     // session-elapsed seconds
  score: number;
  state: FocusState;
}

interface AlertItem {
  id: number;
  message: string;
  kind: 'distracted' | 'tired' | 'away';
}

interface SessionSummary {
  duration: number;
  avgScore: number;
  maxScore: number;
  focusedTime: number;
  distractedTime: number;
  tiredTime: number;
  awayTime: number;
  xp: number;
  badges: string[];
  insight: string;
}

interface StoredSession {
  id: string;
  date: string;
  avgScore: number;
  duration: number;
  xp: number;
}

/* ═══════════════════════════════════════════════════════════════════
   Constants
═══════════════════════════════════════════════════════════════════ */

const MODEL_URL   = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
const DETECT_MS   = 500;
const EAR_LOW     = 0.22;
const MAR_HIGH    = 0.52;
const YAW_HIGH    = 0.20;
const PITCH_DOWN  = 0.16;
const STORAGE_KEY = 'twinmind_ai_focus_sessions';

const STATE_COLOR: Record<FocusState, string> = {
  focused:    '#10B981',
  distracted: '#EF4444',
  tired:      '#F59E0B',
  away:       '#6B7280',
  idle:       '#94a3b8',
};

const STATE_LABEL: Record<FocusState, string> = {
  focused:    'Focused',
  distracted: 'Distracted',
  tired:      'Tired',
  away:       'Away',
  idle:       'Idle',
};

/* ═══════════════════════════════════════════════════════════════════
   Math helpers
═══════════════════════════════════════════════════════════════════ */

function eucl(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function calcEAR(pts: { x: number; y: number }[]): number {
  if (pts.length < 6) return 0.30;
  return (eucl(pts[1], pts[5]) + eucl(pts[2], pts[4])) / (2 * eucl(pts[0], pts[3]) + 1e-9);
}

function calcMAR(pts: { x: number; y: number }[]): number {
  if (pts.length < 10) return 0;
  return eucl(pts[3], pts[9]) / (eucl(pts[0], pts[6]) + 1e-9);
}

function focusScore(earAvg: number, yaw: number, pitch: number, yawning: boolean): number {
  let s = 100;
  if (earAvg < EAR_LOW)         s -= Math.min(30, (EAR_LOW    - earAvg)         * 250);
  if (Math.abs(yaw) > YAW_HIGH) s -= Math.min(35, (Math.abs(yaw) - YAW_HIGH)    * 200);
  if (pitch > PITCH_DOWN)       s -= Math.min(20, (pitch - PITCH_DOWN)           * 180);
  if (yawning)                  s -= 15;
  return Math.round(Math.max(0, Math.min(100, s)));
}

function focusState(
  score: number, facePresent: boolean,
  earAvg: number, yaw: number, pitch: number, yawning: boolean,
): FocusState {
  if (!facePresent) return 'away';
  if (earAvg < EAR_LOW || yawning) return 'tired';
  if (Math.abs(yaw) > YAW_HIGH || pitch > PITCH_DOWN || score < 60) return 'distracted';
  return 'focused';
}

function scoreLabel(s: number): string {
  if (s >= 95) return 'Exceptional Focus';
  if (s >= 80) return 'Highly Focused';
  if (s >= 60) return 'Moderate Focus';
  if (s >= 40) return 'Distracted';
  return 'Very Low Focus';
}

function fmtSec(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/* ═══════════════════════════════════════════════════════════════════
   Gamification helpers
═══════════════════════════════════════════════════════════════════ */

function calcXP(avgScore: number, durationSec: number): number {
  let xp = Math.round(durationSec / 60) * 2;
  if (avgScore >= 85) xp += 20;
  else if (avgScore >= 70) xp += 10;
  return xp;
}

function calcBadges(avgScore: number, maxScore: number): string[] {
  const b: string[] = [];
  if (avgScore >= 85) b.push('Focus Master');
  if (maxScore >= 95) b.push('Zone State');
  if (avgScore >= 70) b.push('Deep Worker');
  return b;
}

function generateInsight(s: SessionSummary): string {
  const focusPct = Math.round((s.focusedTime / Math.max(s.duration, 1)) * 100);
  if (s.avgScore >= 85) return `Outstanding concentration! You maintained ${focusPct}% focused time. Your focus score improved significantly this session.`;
  if (s.avgScore >= 70) return `Good focus overall with ${focusPct}% focused time. Minor distractions noted — try removing your phone from the study area.`;
  if (s.tiredTime > s.distractedTime) return `Signs of fatigue were detected. Consider studying at a different time or using shorter 20-minute blocks with frequent breaks.`;
  if (s.distractedTime > s.duration * 0.4) return `Frequent distractions impacted this session. Try the Pomodoro technique: 25 minutes focused, 5 minutes break.`;
  return `Moderate focus achieved. Aim for consistent screen attention and minimize background distractions for better results.`;
}

/* ═══════════════════════════════════════════════════════════════════
   Local storage
═══════════════════════════════════════════════════════════════════ */

function loadSessions(): StoredSession[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

function persistSession(sess: StoredSession) {
  const all = loadSessions();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([sess, ...all].slice(0, 30)));
}

/* ═══════════════════════════════════════════════════════════════════
   ScoreRing sub-component
═══════════════════════════════════════════════════════════════════ */

function ScoreRing({ score, color, size = 174 }: { score: number; color: string; size?: number }) {
  const r  = size * 0.39;
  const cx = size / 2;
  const cy = size / 2;
  const C  = 2 * Math.PI * r;
  const offset = C * (1 - score / 100);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <filter id="rglow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        filter="url(#rglow)"
        style={{ transition: 'stroke-dashoffset 0.55s ease, stroke 0.35s ease' }}
      />
      <text x={cx} y={cy - 7} textAnchor="middle" fill={color}
        fontSize={size * 0.215} fontWeight="800" fontFamily="ui-monospace,monospace"
        style={{ transition: 'fill 0.35s' }}>
        {score}
      </text>
      <text x={cx} y={cy + 15} textAnchor="middle" fill="rgba(255,255,255,0.45)"
        fontSize={size * 0.073} fontWeight="600" letterSpacing="2">
        FOCUS
      </text>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BioPill sub-component
═══════════════════════════════════════════════════════════════════ */

function BioPill({ label, value, warn }: { label: string; value: string; warn: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.22rem',
      padding: '0.42rem 0.3rem', borderRadius: '10px',
      border: `1px solid ${warn ? '#F59E0B44' : 'rgba(255,255,255,0.08)'}`,
      background: warn ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.04)',
      transition: 'all 0.3s',
    }}>
      <span style={{ fontSize: '0.58rem', fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: warn ? '#F59E0B' : '#10B981', transition: 'color 0.3s' }}>{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AiRecommendations sub-component
═══════════════════════════════════════════════════════════════════ */

const RECS: Record<FocusState, string[]> = {
  focused:    ['Great focus! Tackle your hardest material now — you\'re in a peak state.', 'Extend this session: you\'re in the zone.'],
  distracted: ['Put your phone face-down or in another room.', 'Use a Pomodoro timer: 25 minutes focused, 5-minute break.', 'Close unneeded browser tabs and mute all notifications.'],
  tired:      ['Take a 5–10 minute break — walk around or stretch.', 'Drink water; avoid heavy snacks during study blocks.', 'Consider shorter 20-minute sessions with 5-minute breaks.'],
  away:       ['Return to your study area to resume focus tracking.'],
  idle:       [],
};

function AiRecommendations({ state, score }: { state: FocusState; score: number }) {
  const tips = RECS[state];
  if (!tips.length) return null;
  const col = STATE_COLOR[state];
  return (
    <div style={{ borderRadius: '18px', padding: '1rem 1.25rem', border: `1px solid ${col}33`, background: `${col}0e` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.65rem' }}>
        <Brain size={15} color={col} />
        <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: 700, color: col }}>
          AI Coach — {STATE_LABEL[state]} (Score: {score})
        </span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {tips.map((tip, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <Zap size={12} color={col} style={{ flexShrink: 0, marginTop: 3 }} />
            <span style={{ fontSize: '0.83rem', color: 'var(--text-h)', lineHeight: 1.5 }}>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SessionReport sub-component
═══════════════════════════════════════════════════════════════════ */

function SessionReport({ summary, onNew }: { summary: SessionSummary; onNew: () => void }) {
  const breakdown = [
    { label: 'Focused',     time: summary.focusedTime,    color: STATE_COLOR.focused    },
    { label: 'Distracted',  time: summary.distractedTime, color: STATE_COLOR.distracted },
    { label: 'Tired',       time: summary.tiredTime,      color: STATE_COLOR.tired      },
    { label: 'Away',        time: summary.awayTime,       color: STATE_COLOR.away       },
  ];
  return (
    <div style={{ borderRadius: '20px', padding: '1.5rem', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', backdropFilter: 'blur(var(--glass-blur))', WebkitBackdropFilter: 'blur(var(--glass-blur))', display: 'flex', flexDirection: 'column', gap: '1.1rem' }} className="glass-panel animate-slide-up">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <Trophy size={20} color="#F59E0B" />
        <h2 style={{ flex: 1, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>Session Report</h2>
        <div style={{ padding: '0.25rem 0.75rem', borderRadius: '999px', background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#fff', fontSize: '0.78rem', fontWeight: 800 }}>
          +{summary.xp} XP
        </div>
      </div>

      {/* Score row */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {[
          { num: summary.avgScore,    label: 'Avg Score'   },
          { num: summary.maxScore,    label: 'Best Score'  },
          { num: fmtSec(summary.duration), label: 'Duration' },
        ].map(item => (
          <div key={item.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', padding: '0.85rem 0.5rem', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-h)', fontFamily: 'ui-monospace,monospace' }}>{item.num}</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Time breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {breakdown.map(item => (
          <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.28rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: item.color, fontSize: '0.78rem', fontWeight: 700 }}>{item.label}</span>
              <span style={{ color: 'var(--text)', fontSize: '0.76rem', fontFamily: 'ui-monospace,monospace' }}>{fmtSec(item.time)}</span>
            </div>
            <div style={{ height: '7px', borderRadius: '999px', background: `${item.color}22`, border: `1px solid ${item.color}44`, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '999px',
                width: `${Math.max(2, Math.round((item.time / Math.max(summary.duration, 1)) * 100))}%`,
                background: item.color,
                transition: 'width 0.8s ease',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Badges */}
      {summary.badges.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {summary.badges.map(b => (
            <div key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.75rem', borderRadius: '999px', background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.35)', color: '#FCD34D', fontSize: '0.76rem', fontWeight: 700 }}>
              <Award size={12} /> {b}
            </div>
          ))}
        </div>
      )}

      {/* AI Insight */}
      <div style={{ display: 'flex', gap: '0.65rem', padding: '1rem', borderRadius: '14px', background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', alignItems: 'flex-start' }}>
        <Brain size={14} color="#00D4FF" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: '0.86rem', color: 'var(--text-h)', lineHeight: 1.6, margin: 0 }}>{summary.insight}</p>
      </div>

      <button onClick={onNew} style={{ ...btnPrimary }}>
        <Play size={14} fill="currentColor" /> New Session
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DailyStats sub-component
═══════════════════════════════════════════════════════════════════ */

function DailyStats() {
  const sessions = loadSessions();
  if (!sessions.length) return null;

  const recent  = sessions.slice(0, 7);
  const avgScore = Math.round(recent.reduce((a, r) => a + r.avgScore, 0) / recent.length);
  const totalXP  = sessions.reduce((a, r) => a + r.xp, 0);
  const totalMin = Math.round(sessions.reduce((a, r) => a + r.duration, 0) / 60);
  const maxScore = Math.max(...sessions.map(r => r.avgScore));

  return (
    <div style={{ borderRadius: '20px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(var(--glass-blur))', WebkitBackdropFilter: 'blur(var(--glass-blur))', overflow: 'hidden' }} className="glass-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <BarChart2 size={15} color="#00D4FF" />
        <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-h)' }}>Focus History</span>
        <span style={{ fontSize: '0.72rem', color: '#00D4FF', padding: '0.15rem 0.55rem', borderRadius: '999px', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}>
          {sessions.length} sessions
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', padding: '1rem 1.25rem' }}>
        {[
          { num: avgScore,   label: '7d Avg Score' },
          { num: maxScore,   label: 'Best Score'   },
          { num: `${totalMin}m`, label: 'Total Focus' },
          { num: `+${totalXP}`, label: 'XP Earned'  },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', padding: '0.7rem 0.3rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-h)', fontFamily: 'ui-monospace,monospace' }}>{item.num}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Mini bar chart — last 7 sessions */}
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-end', padding: '0.5rem 1.25rem 1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {[...recent].reverse().map((sess, i) => {
          const barH = Math.max(4, (sess.avgScore / 100) * 52);
          const barColor = sess.avgScore >= 70 ? '#10B981' : sess.avgScore >= 50 ? '#F59E0B' : '#EF4444';
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <div style={{ width: '100%', borderRadius: '4px 4px 0 0', height: `${barH}px`, background: barColor, opacity: 0.8, transition: 'height 0.6s ease' }} />
              <span style={{ fontSize: '0.58rem', color: 'var(--text)' }}>
                {new Date(sess.date).toLocaleDateString('en', { weekday: 'narrow' })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Shared button styles (used in multiple places)
═══════════════════════════════════════════════════════════════════ */

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.42rem',
  padding: '0.6rem 1.35rem', borderRadius: '12px', border: 'none',
  background: 'linear-gradient(135deg,#00D4FF,#7C3AED)',
  color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
  fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(0,212,255,0.28)',
  transition: 'transform 0.14s, box-shadow 0.18s', letterSpacing: '0.01em',
};

const btnDanger: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.42rem',
  padding: '0.6rem 1.35rem', borderRadius: '12px',
  border: '1px solid rgba(239,68,68,0.4)',
  background: 'rgba(239,68,68,0.12)', color: '#fca5a5',
  fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
  fontFamily: 'inherit', transition: 'all 0.15s',
};

/* ═══════════════════════════════════════════════════════════════════
   Main AIFocusDetector component
═══════════════════════════════════════════════════════════════════ */

export default function AIFocusDetector() {
  /* ── Model / detection setup ── */
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [demoMode,     setDemoMode]     = useState(false);

  /* ── Camera ── */
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraGranted, setCameraGranted] = useState<boolean | null>(null);

  /* ── Live detection metrics ── */
  const [metrics, setMetrics] = useState<FocusMetrics>({
    score: 0, state: 'idle', facePresent: false,
    earAvg: 0.30, headYaw: 0, headPitch: 0, isYawning: false,
  });

  /* ── Session ── */
  const [sessionActive, setSessionActive] = useState(false);
  const [elapsed,       setElapsed]       = useState(0);
  const [snapshots,     setSnapshots]     = useState<FocusSnapshot[]>([]);
  const [summary,       setSummary]       = useState<SessionSummary | null>(null);

  /* ── Alerts ── */
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const alertCtrRef   = useRef(0);
  const lastAlertRef  = useRef<Partial<Record<string, number>>>({});

  /* ── Refs ── */
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const detectRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const snapRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertIntRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef   = useRef(0);
  const metricsRef        = useRef(metrics);
  const snapshotsRef      = useRef(snapshots);
  const sessionActiveRef  = useRef(sessionActive);
  metricsRef.current      = metrics;
  snapshotsRef.current    = snapshots;
  sessionActiveRef.current = sessionActive;
  const streakRef = useRef<{ state: FocusState; since: number }>({ state: 'idle', since: Date.now() });

  /* ── Load face-api models ── */
  useEffect(() => {
    (async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch {
        setDemoMode(true);
        setModelsLoaded(true);
      }
    })();
  }, []);

  /* ── Camera open / close ── */
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraGranted(true);
      setCameraEnabled(true);
    } catch {
      setCameraGranted(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraEnabled(false);
    setMetrics(m => ({ ...m, facePresent: false, score: 0, state: 'idle' }));
  }, []);

  /* ── Core detection step ── */
  const runDetection = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    /* Demo mode: simulate realistic metrics */
    if (demoMode) {
      const t   = Date.now() / 1000;
      const base = 74 + 14 * Math.sin(t / 80);
      const noise = (Math.random() - 0.5) * 16;
      const score = Math.round(Math.max(20, Math.min(100, base + noise)));
      const state: FocusState = score >= 70 ? 'focused' : score >= 50 ? 'distracted' : 'tired';
      setMetrics({ score, state, facePresent: cameraEnabled, earAvg: 0.27 + Math.random() * 0.06, headYaw: (Math.random() - 0.5) * 0.15, headPitch: 0.05 + Math.random() * 0.05, isYawning: false });
      return;
    }

    try {
      const result = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
        .withFaceLandmarks(true);   // true = use tiny landmark model

      if (!result) {
        setMetrics(m => ({ ...m, facePresent: false, score: 0, state: sessionActiveRef.current ? 'away' : 'idle' }));
        const cv = canvasRef.current;
        if (cv) cv.getContext('2d')?.clearRect(0, 0, cv.width, cv.height);
        return;
      }

      const lm  = result.landmarks;
      /* Cast to plain {x,y} arrays — avoids dependency on internal Point type */
      type P = { x: number; y: number };
      const toArr = (arr: unknown) => arr as P[];
      const leftEye  = toArr(lm.getLeftEye());
      const rightEye = toArr(lm.getRightEye());
      const mouth    = toArr(lm.getMouth());
      const positions = toArr((lm as unknown as { positions: unknown }).positions);

      const earL   = calcEAR(leftEye);
      const earR   = calcEAR(rightEye);
      const earAvg = (earL + earR) / 2;
      const mar    = calcMAR(mouth);
      const isYawning = mar > MAR_HIGH;

      /* Head pose from nose-tip vs eye-centre displacement */
      const lEyeC  = { x: (leftEye[0].x  + leftEye[3].x)  / 2, y: (leftEye[0].y  + leftEye[3].y)  / 2 };
      const rEyeC  = { x: (rightEye[0].x + rightEye[3].x) / 2, y: (rightEye[0].y + rightEye[3].y) / 2 };
      const eyeC   = { x: (lEyeC.x + rEyeC.x) / 2, y: (lEyeC.y + rEyeC.y) / 2 };
      const nose   = positions[30] as P;
      const faceW  = eucl(positions[0] as P, positions[16] as P);
      const headYaw   = faceW > 0 ? (nose.x - eyeC.x) / faceW : 0;
      const headPitch = faceW > 0 ? (nose.y - eyeC.y) / faceW : 0;

      const score = focusScore(earAvg, headYaw, headPitch, isYawning);
      const state = focusState(score, true, earAvg, headYaw, headPitch, isYawning);

      setMetrics({ score, state, facePresent: true, earAvg, headYaw, headPitch, isYawning });

      /* Draw overlay on canvas */
      const canvas = canvasRef.current;
      if (canvas && video.videoWidth > 0) {
        canvas.width  = video.clientWidth  || 320;
        canvas.height = video.clientHeight || 240;
        const sx  = canvas.width  / video.videoWidth;
        const sy  = canvas.height / video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const { x, y, width, height } = result.detection.box;
          const col = STATE_COLOR[state];
          ctx.strokeStyle = col;
          ctx.lineWidth   = 2;
          ctx.shadowColor = col;
          ctx.shadowBlur  = 8;
          ctx.strokeRect(x * sx, y * sy, width * sx, height * sy);
          ctx.shadowBlur = 0;
          ctx.fillStyle  = 'rgba(0,212,255,0.75)';
          ([...leftEye, ...rightEye] as P[]).forEach(pt => {
            ctx.beginPath();
            ctx.arc(pt.x * sx, pt.y * sy, 2, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }
    } catch { /* silent — retry next tick */ }
  }, [demoMode, cameraEnabled]);

  /* ── Detection interval ── */
  useEffect(() => {
    if (!cameraEnabled || !modelsLoaded) return;
    detectRef.current = setInterval(runDetection, DETECT_MS);
    return () => { if (detectRef.current) clearInterval(detectRef.current); };
  }, [cameraEnabled, modelsLoaded, runDetection]);

  /* ── Alerts helper ── */
  const pushAlert = useCallback((message: string, kind: AlertItem['kind']) => {
    const now = Date.now();
    if ((lastAlertRef.current[kind] ?? 0) + 120_000 > now) return;
    lastAlertRef.current[kind] = now;
    const id = ++alertCtrRef.current;
    setAlerts(prev => [...prev.slice(-2), { id, message, kind }]);
    setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), 5500);
  }, []);

  /* ── Alert polling interval ── */
  useEffect(() => {
    if (!sessionActive) return;
    alertIntRef.current = setInterval(() => {
      const cur = metricsRef.current;
      const stk = streakRef.current;
      if (cur.state !== stk.state) { streakRef.current = { state: cur.state, since: Date.now() }; return; }
      const dur = (Date.now() - stk.since) / 1000;
      if (cur.state === 'distracted' && dur > 120) {
        pushAlert('You seem distracted. Try returning your attention to the current task.', 'distracted');
        streakRef.current.since = Date.now();
      } else if (cur.state === 'tired' && dur > 60) {
        pushAlert('Signs of fatigue detected. Consider taking a short break.', 'tired');
        streakRef.current.since = Date.now();
      } else if (cur.state === 'away' && dur > 30) {
        pushAlert('Study session paused — no user detected.', 'away');
        streakRef.current.since = Date.now();
      }
    }, 5000);
    return () => { if (alertIntRef.current) clearInterval(alertIntRef.current); };
  }, [sessionActive, pushAlert]);

  /* ── Session start ── */
  const startSession = useCallback(() => {
    setSnapshots([]);
    setSummary(null);
    setElapsed(0);
    sessionStartRef.current = Date.now();
    streakRef.current = { state: metricsRef.current.state, since: Date.now() };
    setSessionActive(true);

    elapsedRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStartRef.current) / 1000));
    }, 1000);

    snapRef.current = setInterval(() => {
      const el = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      setSnapshots(prev => [...prev, { ts: el, score: metricsRef.current.score, state: metricsRef.current.state }]);
    }, 3000);
  }, []);

  /* ── Session stop ── */
  const stopSession = useCallback(() => {
    [elapsedRef, snapRef].forEach(r => { if (r.current) clearInterval(r.current); });
    setSessionActive(false);

    const duration = Math.floor((Date.now() - sessionStartRef.current) / 1000);
    const snaps    = snapshotsRef.current;
    if (!snaps.length) return;

    const scores   = snaps.map(s => s.score).filter(s => s > 0);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const maxScore = scores.length ? Math.max(...scores) : 0;
    const cnts     = { focused: 0, distracted: 0, tired: 0, away: 0 };
    snaps.forEach(s => { if (s.state in cnts) cnts[s.state as keyof typeof cnts]++; });
    const T = snaps.length;

    const partial: Omit<SessionSummary, 'xp' | 'badges' | 'insight'> = {
      duration,
      avgScore,
      maxScore,
      focusedTime:    Math.round((cnts.focused    / T) * duration),
      distractedTime: Math.round((cnts.distracted / T) * duration),
      tiredTime:      Math.round((cnts.tired      / T) * duration),
      awayTime:       Math.round((cnts.away       / T) * duration),
    };
    const xp     = calcXP(avgScore, duration);
    const badges = calcBadges(avgScore, maxScore);
    const full: SessionSummary = { ...partial, xp, badges, insight: '' };
    full.insight = generateInsight(full);
    setSummary(full);

    persistSession({ id: Date.now().toString(), date: new Date().toISOString(), avgScore, duration, xp });
  }, []);

  /* ── Cleanup on unmount ── */
  useEffect(() => () => {
    stopCamera();
    [detectRef, elapsedRef, snapRef, alertIntRef].forEach(r => { if (r.current) clearInterval(r.current); });
  }, [stopCamera]);

  /* ── Derived values ── */
  const { score, state } = metrics;
  const color    = STATE_COLOR[state];
  const chartData = snapshots.map(snap => ({ t: fmtSec(snap.ts), score: snap.score }));
  const canStart = cameraEnabled || demoMode;

  /* ════════════════ Render ════════════════ */
  return (
    <div style={s.shell}>

      {/* ── Alert toast stack ── */}
      <div style={s.alertStack}>
        {alerts.map(al => (
          <div key={al.id} style={{
            ...s.alert,
            borderColor:  al.kind === 'distracted' ? '#EF444455' : al.kind === 'tired' ? '#F59E0B55' : '#6B728055',
            background:   al.kind === 'distracted' ? 'rgba(239,68,68,0.12)' : al.kind === 'tired' ? 'rgba(245,158,11,0.12)' : 'rgba(107,114,128,0.12)',
          }} className="animate-slide-up">
            <AlertTriangle size={15} color={al.kind === 'distracted' ? '#EF4444' : al.kind === 'tired' ? '#F59E0B' : '#9CA3AF'} />
            <span style={s.alertText}>{al.message}</span>
            <button onClick={() => setAlerts(p => p.filter(a => a.id !== al.id))} style={s.alertClose}>✕</button>
          </div>
        ))}
      </div>

      {/* ── Navbar ── */}
      <header style={s.nav} className="nav-premium">
        <div style={s.navLeft}>
          <BackButton />
          <div style={{ width: 28, height: 20, overflow: 'hidden', flexShrink: 0 }}>
            <img src="/assets/twinmind-logo.png" alt="" style={{ width: 28, height: 'auto', display: 'block' }} />
          </div>
          <Link to="/" style={s.navLogo}>TwinMind</Link>
        </div>
        <div style={s.navRight}>
          {demoMode && <span style={s.demoBadge}>Demo Mode</span>}
          {sessionActive && (
            <div style={{ ...s.pill, borderColor: '#00D4FF44', color: '#00D4FF', background: '#00D4FF14' }}>
              <span style={{ ...s.pillDot, background: '#00D4FF', boxShadow: '0 0 6px #00D4FF80', animation: 'pulse 2s infinite' }} />
              {fmtSec(elapsed)}
            </div>
          )}
          <div style={{ ...s.pill, borderColor: color + '44', color, background: color + '14' }}>
            <span style={{ ...s.pillDot, background: color, transition: 'background 0.3s' }} />
            {STATE_LABEL[state]}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={s.main}>
        <div style={s.content} className="animate-slide-up">

          {/* Page header */}
          <div style={s.pageHeader}>
            <div style={s.pageIcon}><Eye size={24} color="#00D4FF" /></div>
            <div>
              <h1 style={s.pageTitle} className="grad-text-cyan">AI Focus Detector</h1>
              <p style={s.pageSub}>Real-time attention monitoring powered by computer vision</p>
            </div>
          </div>

          {/* Loading */}
          {!modelsLoaded && (
            <div style={s.loadCard} className="glass-panel">
              <div style={s.spinner} />
              <p style={s.loadTitle}>Loading AI Models</p>
              <p style={s.loadSub}>Downloading face detection weights… this may take a moment on first load.</p>
            </div>
          )}

          {modelsLoaded && (
            <>
              {/* ── Main 2-col grid ── */}
              <div style={s.grid}>

                {/* Camera panel */}
                <div className="glass-panel" style={s.cameraCard}>
                  <div style={s.cardHdr}>
                    <Camera size={14} color="#00D4FF" />
                    <span style={s.cardHdrLabel}>Camera Feed</span>
                    {demoMode && <span style={s.demoBadge}>Simulated</span>}
                    <button
                      onClick={cameraEnabled ? stopCamera : startCamera}
                      style={{
                        ...s.camBtn,
                        background:  cameraEnabled ? 'rgba(239,68,68,0.14)' : 'rgba(16,185,129,0.14)',
                        borderColor: cameraEnabled ? '#EF444433'            : '#10B98133',
                        color:       cameraEnabled ? '#EF4444'              : '#10B981',
                      }}
                    >
                      {cameraEnabled ? <><CameraOff size={12} /> Off</> : <><Camera size={12} /> On</>}
                    </button>
                  </div>

                  <div style={s.cameraView}>
                    {!cameraEnabled && (
                      <div style={s.camPH}>
                        <Camera size={36} color="rgba(255,255,255,0.18)" />
                        <p style={s.camPHText}>
                          {cameraGranted === false
                            ? 'Camera access denied — please allow camera permissions in your browser.'
                            : demoMode
                              ? 'Enable camera for live detection, or use simulated mode without it.'
                              : 'Enable camera to start real-time AI focus detection.'}
                        </p>
                        {cameraGranted !== false && (
                          <button onClick={startCamera} style={btnPrimary}>
                            <Camera size={14} /> Enable Camera
                          </button>
                        )}
                      </div>
                    )}
                    <video
                      ref={videoRef}
                      style={{ ...s.video, opacity: cameraEnabled ? 1 : 0, pointerEvents: 'none' }}
                      autoPlay muted playsInline
                    />
                    <canvas ref={canvasRef} style={s.canvas} />
                  </div>

                  {/* Biometrics row */}
                  <div style={s.bios}>
                    <BioPill label="Eye Ratio"  value={metrics.earAvg.toFixed(2)}                           warn={metrics.earAvg < EAR_LOW} />
                    <BioPill label="Head Yaw"   value={`${Math.round(Math.abs(metrics.headYaw) * 100)}%`}   warn={Math.abs(metrics.headYaw) > YAW_HIGH} />
                    <BioPill label="Pitch"      value={`${Math.round(metrics.headPitch * 100)}%`}           warn={metrics.headPitch > PITCH_DOWN} />
                    <BioPill label="Mouth"      value={metrics.isYawning ? 'Open' : 'Normal'}               warn={metrics.isYawning} />
                  </div>
                </div>

                {/* Score panel */}
                <div className="glass-panel glass-card glass-hover glass-lavender" style={s.scoreCard}>
                  <div style={{ ...s.orb, background: `radial-gradient(circle, ${color}22 0%, transparent 70%)` }} />
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <ScoreRing score={score} color={color} size={174} />
                  </div>
                  <p style={{ ...s.stateTag, color }}>{STATE_LABEL[state]}</p>
                  <p style={s.scoreDesc}>{(metrics.facePresent || demoMode) ? scoreLabel(score) : '—'}</p>

                  {/* State chips */}
                  <div style={s.chips}>
                    {(['focused', 'distracted', 'tired', 'away'] as FocusState[]).map(st => (
                      <div key={st} style={{
                        ...s.chip,
                        borderColor: state === st ? STATE_COLOR[st] + '55' : 'transparent',
                        background:  state === st ? STATE_COLOR[st] + '18' : 'rgba(255,255,255,0.03)',
                      }}>
                        <span style={{ ...s.chipDot, background: state === st ? STATE_COLOR[st] : 'rgba(255,255,255,0.2)', transition: 'background 0.3s' }} />
                        <span style={{ color: state === st ? STATE_COLOR[st] : 'var(--text)', fontSize: '0.74rem', fontWeight: 600, transition: 'color 0.3s' }}>
                          {STATE_LABEL[st]}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Controls */}
                  <div style={s.ctrlRow}>
                    {!sessionActive && !summary && (
                      <button onClick={startSession} disabled={!canStart} style={{ ...btnPrimary, opacity: canStart ? 1 : 0.45 }}>
                        <Play size={14} fill="currentColor" /> Start Session
                      </button>
                    )}
                    {sessionActive && (
                      <button onClick={stopSession} style={btnDanger}>
                        <Square size={14} fill="currentColor" /> End Session
                      </button>
                    )}
                    {summary && !sessionActive && (
                      <button onClick={() => { setSummary(null); setSnapshots([]); }} style={btnPrimary}>
                        <Play size={14} fill="currentColor" /> New Session
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Timeline chart ── */}
              {chartData.length > 3 && (
                <div className="glass-panel" style={s.chartCard}>
                  <div style={s.cardHdr}>
                    <Activity size={14} color="#00D4FF" />
                    <span style={s.cardHdrLabel}>Focus Timeline</span>
                    <span style={s.cardBadge}>
                      <TrendingUp size={11} /> {fmtSec(elapsed)} elapsed
                    </span>
                  </div>
                  <div style={{ padding: '0.5rem 0.75rem 0.75rem' }}>
                    <ResponsiveContainer width="100%" height={120}>
                      <AreaChart data={chartData} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                        <defs>
                          <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor="#00D4FF" stopOpacity={0.26} />
                            <stop offset="100%" stopColor="#00D4FF" stopOpacity={0}    />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="t" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 9 }} interval="preserveStartEnd" />
                        <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 9 }} />
                        <Tooltip
                          contentStyle={{ background: 'rgba(10,16,32,0.95)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: 8, fontSize: 12 }}
                          formatter={(v: unknown) => [`${v}`, 'Focus Score']}
                        />
                        <Area type="monotone" dataKey="score" stroke="#00D4FF" strokeWidth={2} fill="url(#fcGrad)" dot={false} activeDot={{ r: 4, fill: '#00D4FF' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── AI Coach recommendations ── */}
              {sessionActive && state !== 'idle' && (
                <AiRecommendations state={state} score={score} />
              )}

              {/* ── Session report ── */}
              {summary && (
                <SessionReport summary={summary} onNew={() => { setSummary(null); setSnapshots([]); }} />
              )}

              {/* ── Historical stats ── */}
              <DailyStats />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Styles
═══════════════════════════════════════════════════════════════════ */

const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', fontFamily: 'var(--sans)' },

  /* Alerts */
  alertStack: { position: 'fixed', top: '68px', right: '1rem', zIndex: 1100, display: 'flex', flexDirection: 'column', gap: '0.45rem', maxWidth: '340px', pointerEvents: 'none' },
  alert:      { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.9rem', borderRadius: '12px', border: '1px solid', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)', pointerEvents: 'all' },
  alertText:  { flex: 1, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)', lineHeight: 1.4 },
  alertClose: { background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '0.78rem', padding: '0 0.15rem', fontFamily: 'inherit' },

  /* Nav */
  nav:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', height: '60px', position: 'sticky', top: 0, zIndex: 20, flexShrink: 0 },
  navLeft: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  navRight: { display: 'flex', alignItems: 'center', gap: '0.55rem' },
  navLogo: { fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.5px', textDecoration: 'none' },
  pill:    { display: 'flex', alignItems: 'center', gap: '0.38rem', padding: '0.27rem 0.75rem', borderRadius: '999px', border: '1px solid', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const },
  pillDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  demoBadge: { fontSize: '0.68rem', fontWeight: 700, padding: '0.18rem 0.55rem', borderRadius: '999px', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#A78BFA', letterSpacing: '0.06em' },

  /* Layout */
  main:    { flex: 1, display: 'flex', justifyContent: 'center', padding: '2rem 1.25rem 3rem', boxSizing: 'border-box' as const },
  content: { width: '100%', maxWidth: '920px', display: 'flex', flexDirection: 'column', gap: '1.4rem' },

  /* Page header */
  pageHeader: { display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.2rem' },
  pageIcon:   { width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg,rgba(0,212,255,0.18) 0%,rgba(124,58,237,0.18) 100%)', border: '1px solid rgba(0,212,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pageTitle:  { fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 },
  pageSub:    { margin: '0.1rem 0 0', fontSize: '0.84rem', color: 'var(--text)' },

  /* Loading */
  loadCard:  { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', padding: '3rem', borderRadius: '20px', textAlign: 'center' as const },
  spinner:   { width: '38px', height: '38px', border: '3px solid rgba(0,212,255,0.15)', borderTop: '3px solid #00D4FF', borderRadius: '50%', animation: 'spin 0.9s linear infinite' },
  loadTitle: { fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-h)', margin: 0 },
  loadSub:   { fontSize: '0.82rem', color: 'var(--text)', margin: 0 },

  /* Main grid */
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' },

  /* Camera card */
  cameraCard: { borderRadius: '20px', background: 'rgba(10,16,32,0.82)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  cardHdr:    { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.9rem 1.2rem', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  cardHdrLabel: { flex: 1, fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-h)' },
  cardBadge:  { display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text)', padding: '0.16rem 0.5rem', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' },
  camBtn:     { display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.28rem 0.65rem', borderRadius: '8px', border: '1px solid', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s' },
  cameraView: { position: 'relative' as const, width: '100%', aspectRatio: '4/3' as unknown as string, background: 'rgba(0,0,0,0.55)', overflow: 'hidden', flexShrink: 0 },
  camPH:      { position: 'absolute' as const, inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.9rem', padding: '1.5rem', zIndex: 2 },
  camPHText:  { fontSize: '0.81rem', color: 'var(--text)', textAlign: 'center' as const, lineHeight: 1.5, margin: 0 },
  video:      { width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block', transform: 'scaleX(-1)' },
  canvas:     { position: 'absolute' as const, top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'scaleX(-1)' },
  bios:       { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.45rem', padding: '0.7rem 1rem' },

  /* Score card */
  scoreCard: { borderRadius: '20px', background: 'rgba(10,16,32,0.82)', border: '1px solid rgba(0,212,255,0.1)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', padding: '1.5rem 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', position: 'relative' as const, overflow: 'hidden' },
  orb:       { position: 'absolute' as const, top: '-50px', right: '-50px', width: '200px', height: '200px', borderRadius: '50%', pointerEvents: 'none', transition: 'background 0.5s' },
  stateTag:  { fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, textTransform: 'uppercase' as const, transition: 'color 0.35s' },
  scoreDesc: { fontSize: '0.78rem', color: 'var(--text)', margin: '0 0 0.2rem', fontWeight: 600 },
  chips:     { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.45rem', width: '100%' },
  chip:      { display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.38rem 0.6rem', borderRadius: '8px', border: '1px solid', transition: 'all 0.3s' },
  chipDot:   { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  ctrlRow:   { display: 'flex', gap: '0.6rem', width: '100%', justifyContent: 'center', flexWrap: 'wrap' as const },

  /* Chart */
  chartCard: { borderRadius: '20px', background: 'rgba(10,16,32,0.82)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', overflow: 'hidden' },
};

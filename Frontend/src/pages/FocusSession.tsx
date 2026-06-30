import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Timer, Play, Pause, Square, RotateCcw,
  Clock, Zap, CheckCircle, Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveBadge from '../components/LiveBadge';
import BackButton from '../components/BackButton';

/* ─── Types ─── */
type Status = 'ready' | 'running' | 'paused' | 'completed';

interface FocusRecord {
  id: string;
  duration: number;   // total seconds
  completedAt: string;
}

/* ─── SVG circle math ─── */
const RADIUS       = 88;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/* ─── Presets (seconds) ─── */
const PRESETS = [
  { label: '25 min', seconds: 25 * 60 },
  { label: '45 min', seconds: 45 * 60 },
  { label: '90 min', seconds: 90 * 60 },
  { label: '2 hrs',  seconds: 120 * 60 },
] as const;

/* ─── AI Coach messages keyed by milestone ─── */
const COACH_MSGS = {
  ready:     ['Set your timer and enter the Focus Zone. I\'ll coach you in real-time. 🎯',
              'Deep work begins with a single session. Ready when you are.',
              'Your brain performs best in focused bursts. Let\'s build that habit.'],
  start:     ['Great start! Your brain is warming up — stay with it.',
              'Focus session initiated. I\'m tracking your progress.'],
  min5:      ['You\'re entering the flow state. This is where real learning happens!',
              'First 5 minutes done. Deep focus kicks in now — keep going.'],
  min15:     ['Outstanding! 15 minutes of deep focus. You\'re in the zone. 🔥',
              'Flow state achieved. Excellent concentration — don\'t stop!'],
  min25:     ['25 minutes! Pomodoro complete. You may take a 5-minute break.',
              'Excellent deep work session. Your brain is absorbing information well.'],
  min45:     ['45 minutes of deep focus! Consider a 10-min break to consolidate learning.',
              'Extended focus session — your retention is at peak right now.'],
  min60:     ['One full hour! Exceptional performance. Schedule a proper break now.',
              'World-class focus for 60 minutes. Take care of your brain — rest first.'],
  paused:    ['Session paused. Breathe. Resume whenever you\'re ready — I\'ll be here.',
              'Take a moment, then come back stronger. You\'re doing great.'],
  completed: ['🎉 Session complete! You crushed it. Rest well — you earned it.',
              '✅ Excellent work! Your focus score is looking strong today.'],
};

const HISTORY_KEY = 'twinmind_focus_history';

/* ─── Helpers ─── */
function loadHistory(): FocusRecord[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); }
  catch { return []; }
}
function saveHistory(r: FocusRecord[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(r));
}
function pad(n: number) { return String(n).padStart(2, '0'); }
function toHMS(sec: number) {
  return {
    h: Math.floor(sec / 3600),
    m: Math.floor((sec % 3600) / 60),
    s: sec % 60,
  };
}
function fmtDuration(sec: number) {
  const { h, m, s } = toHMS(sec);
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}
function playBeeps() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.connect(ctx.destination);
    [0, 0.35, 0.7].forEach((off, i) => {
      const osc = ctx.createOscillator();
      osc.connect(gain);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440 + i * 220, ctx.currentTime + off);
      osc.start(ctx.currentTime + off);
      osc.stop(ctx.currentTime + off + 0.25);
    });
  } catch { /* audio unavailable */ }
}

/* ─── Numeric input with adj buttons ─── */
interface TimeFieldProps {
  label: string;
  value: number;
  max: number;
  disabled: boolean;
  onChange: (v: number) => void;
}
function TimeField({ label, value, max, disabled, onChange }: TimeFieldProps) {
  function clamp(v: number) { return Math.max(0, Math.min(max, v)); }
  return (
    <div style={tf.wrap}>
      <span style={tf.label}>{label}</span>
      <button
        style={{ ...tf.adj, opacity: disabled ? 0.4 : 1 }}
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled}
        aria-label={`Increase ${label}`}
      >▲</button>
      <input
        type="number"
        value={value}
        min={0}
        max={max}
        onChange={e => onChange(clamp(Number(e.target.value) || 0))}
        disabled={disabled}
        style={{ ...tf.input, opacity: disabled ? 0.45 : 1 }}
        aria-label={label}
      />
      <button
        style={{ ...tf.adj, opacity: disabled ? 0.4 : 1 }}
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled}
        aria-label={`Decrease ${label}`}
      >▼</button>
    </div>
  );
}

/* ═══════════════════════════════════════ */
export default function FocusSession() {
  const { user, token } = useAuth();
  const wsConnected = useWebSocket(user?.id, token, () => {});

  /* input fields */
  const [inputH, setInputH] = useState(0);
  const [inputM, setInputM] = useState(25);
  const [inputS, setInputS] = useState(0);

  /* timer core */
  const [status,       setStatus]       = useState<Status>('ready');
  const [totalSec,     setTotalSec]     = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);

  /* history */
  const [history, setHistory] = useState<FocusRecord[]>(() => loadHistory());

  /* notification banner */
  const [showNotif, setShowNotif] = useState(false);

  /* AI coach */
  const [coachMsg, setCoachMsg] = useState(COACH_MSGS.ready[0]);
  const coachTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const intervalRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedDurRef     = useRef(0);

  /* ── derived ── */
  const isActive   = status === 'running' || status === 'paused';
  const progress   = totalSec > 0 ? (totalSec - remainingSec) / totalSec : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const { h: rH, m: rM, s: rS } = toHMS(remainingSec);

  const statusColor: Record<Status, string> = {
    ready:     'var(--text-m)',
    running:   'var(--accent)',
    paused:    '#F59E0B',
    completed: '#10B981',
  };
  const arcColor = statusColor[status];

  /* ── tick ── */
  useEffect(() => {
    if (status === 'running') {
      intervalRef.current = setInterval(() => {
        setRemainingSec(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setStatus('completed');
            playBeeps();
            setShowNotif(true);
            const rec: FocusRecord = {
              id: Date.now().toString(),
              duration: startedDurRef.current,
              completedAt: new Date().toISOString(),
            };
            setHistory(ph => {
              const updated = [rec, ...ph].slice(0, 100);
              saveHistory(updated);
              return updated;
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [status]);

  /* ── auto-dismiss notification ── */
  useEffect(() => {
    if (!showNotif) return;
    const t = setTimeout(() => setShowNotif(false), 6000);
    return () => clearTimeout(t);
  }, [showNotif]);

  /* ── AI coach messages driven by elapsed time ── */
  useEffect(() => {
    if (coachTimerRef.current) clearTimeout(coachTimerRef.current);
    if (status === 'ready' || status === 'completed') {
      const pool = status === 'completed' ? COACH_MSGS.completed : COACH_MSGS.ready;
      setCoachMsg(pool[Math.floor(Math.random() * pool.length)]);
      return;
    }
    if (status === 'paused') {
      setCoachMsg(COACH_MSGS.paused[Math.floor(Math.random() * COACH_MSGS.paused.length)]);
      return;
    }
    // running — pick message based on elapsed seconds
    const elapsed = totalSec - remainingSec;
    const pick = (pool: string[]) => pool[Math.floor(Math.random() * pool.length)];
    if      (elapsed < 30)     setCoachMsg(pick(COACH_MSGS.start));
    else if (elapsed < 5*60)   setCoachMsg(pick(COACH_MSGS.start));
    else if (elapsed < 15*60)  setCoachMsg(pick(COACH_MSGS.min5));
    else if (elapsed < 25*60)  setCoachMsg(pick(COACH_MSGS.min15));
    else if (elapsed < 45*60)  setCoachMsg(pick(COACH_MSGS.min25));
    else if (elapsed < 60*60)  setCoachMsg(pick(COACH_MSGS.min45));
    else                        setCoachMsg(pick(COACH_MSGS.min60));

    // Refresh every 5 minutes while running
    coachTimerRef.current = setTimeout(() => {}, 300_000);
  }, [status, Math.floor((totalSec - remainingSec) / 300)]);

  /* ── actions ── */
  function handleStart() {
    const total = inputH * 3600 + inputM * 60 + inputS;
    if (total <= 0) return;
    startedDurRef.current = total;
    setTotalSec(total);
    setRemainingSec(total);
    setStatus('running');
  }
  function handlePause()  { setStatus('paused');  }
  function handleResume() { setStatus('running'); }
  function handleStop()   {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStatus('ready');
    setTotalSec(0);
    setRemainingSec(0);
  }
  function handleReset()  {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStatus('ready');
    setTotalSec(0);
    setRemainingSec(0);
  }
  function applyPreset(seconds: number) {
    if (isActive) return;
    const { h, m, s } = toHMS(seconds);
    setInputH(h); setInputM(m); setInputS(s);
  }
  function deleteRecord(id: string) {
    setHistory(ph => {
      const updated = ph.filter(r => r.id !== id);
      saveHistory(updated);
      return updated;
    });
  }

  /* ── center display text ── */
  const displayTime = isActive || status === 'completed'
    ? `${pad(rH)}:${pad(rM)}:${pad(rS)}`
    : `${pad(inputH)}:${pad(inputM)}:${pad(inputS)}`;

  /* ══════════ Render ══════════ */
  return (
    <div style={s.shell}>

      {/* Completion notification */}
      {showNotif && (
        <div style={s.notif} className="animate-slide-up">
          <CheckCircle size={18} color="#10B981" />
          <span style={s.notifText}>Focus session complete — great work!</span>
          <button onClick={() => setShowNotif(false)} style={s.notifClose}>✕</button>
        </div>
      )}

      {/* Navbar */}
      <header style={s.nav} className="nav-premium">
        <div style={s.navLeft}>
          <BackButton />
          <div style={{ width: 28, height: 20, overflow: 'hidden', flexShrink: 0 }}>
            <img src="/assets/twinmind-logo.png" alt="" style={{ width: 28, height: 'auto', display: 'block' }} />
          </div>
          <Link to="/" style={s.navLogo}>TwinMind</Link>
          {wsConnected && <LiveBadge />}
        </div>
        <div style={s.navRight}>
          <div style={{
            ...s.statusPill,
            borderColor: arcColor + '55',
            color: arcColor,
            background: arcColor + '14',
          }}>
            <span style={{ ...s.statusDot, background: arcColor, boxShadow: `0 0 6px ${arcColor}` }} />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </div>
        </div>
      </header>

      <main style={s.main}>
        <div className="animate-slide-up" style={s.content}>

          {/* Page header */}
          <div style={s.pageHeader}>
            <div style={s.pageIconWrap}>
              <Timer size={24} color="var(--accent)" />
            </div>
            <div>
              <h1 style={s.pageTitle} className="grad-text-cyan">Focus Session</h1>
              <p style={s.pageSub}>Deep work timer with session tracking</p>
            </div>
          </div>

          {/* ─── Timer card ─── */}
          <div style={s.timerCard} className="glass-panel stat-card-premium">
            {/* Ambient orbs */}
            <div style={s.orb1} />
            <div style={s.orb2} />

            {/* Circular progress */}
            <div style={s.circleOuter}>
              <svg width={220} height={220} viewBox="0 0 220 220" aria-hidden>
                {/* Glow filter */}
                <defs>
                  <filter id="arc-glow">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                {/* Track ring */}
                <circle cx={110} cy={110} r={RADIUS}
                  fill="none" stroke="var(--border)" strokeWidth={10} />
                {/* Progress arc */}
                <circle cx={110} cy={110} r={RADIUS}
                  fill="none"
                  stroke={arcColor}
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 110 110)"
                  filter={status === 'running' ? 'url(#arc-glow)' : undefined}
                  style={{ transition: 'stroke-dashoffset 0.95s ease, stroke 0.45s ease' }}
                />
              </svg>

              {/* Centered time display */}
              <div style={s.circleInner}>
                <span style={{ ...s.timeDisplay, color: isActive || status === 'completed' ? arcColor : 'var(--text-h)' }}>
                  {displayTime}
                </span>
                {totalSec > 0 && (
                  <span style={s.timeSub}>
                    {Math.round(progress * 100)}% complete
                  </span>
                )}
                {status === 'ready' && totalSec === 0 && (
                  <span style={s.timeHint}>set time above</span>
                )}
              </div>
            </div>

            {/* ── Input fields ── */}
            <div style={{ ...s.fieldsRow, opacity: isActive ? 0.45 : 1, pointerEvents: isActive ? 'none' : undefined }}>
              <TimeField label="Hours"   value={inputH} max={23} disabled={isActive} onChange={setInputH} />
              <div style={s.fieldSep}>:</div>
              <TimeField label="Minutes" value={inputM} max={59} disabled={isActive} onChange={setInputM} />
              <div style={s.fieldSep}>:</div>
              <TimeField label="Seconds" value={inputS} max={59} disabled={isActive} onChange={setInputS} />
            </div>

            {/* ── Quick presets ── */}
            <div style={s.presets}>
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.seconds)}
                  disabled={isActive}
                  style={{ ...s.presetBtn, opacity: isActive ? 0.4 : 1 }}
                  className="focus-preset-btn"
                >
                  <Zap size={12} />
                  {p.label}
                </button>
              ))}
            </div>

            {/* ── Linear progress bar ── */}
            {totalSec > 0 && (
              <div style={s.barWrap}>
                <div style={s.barTrack}>
                  <div style={{
                    ...s.barFill,
                    width: `${progress * 100}%`,
                    background: `linear-gradient(90deg, ${arcColor}, ${arcColor}88)`,
                    boxShadow: status === 'running' ? `0 0 14px ${arcColor}66` : 'none',
                    transition: 'width 0.95s ease, box-shadow 0.4s ease',
                  }} />
                </div>
                <span style={s.barPct}>{Math.round(progress * 100)}%</span>
              </div>
            )}

            {/* ── Controls ── */}
            <div style={s.controls}>
              {status === 'ready' && (
                <button
                  style={{ ...s.ctrlBtn, ...s.ctrlPrimary }}
                  onClick={handleStart}
                  disabled={(inputH + inputM + inputS) === 0}
                  className="focus-ctrl-btn"
                >
                  <Play size={17} fill="currentColor" />
                  Start Session
                </button>
              )}

              {status === 'running' && (
                <>
                  <button style={{ ...s.ctrlBtn, ...s.ctrlAmber }} onClick={handlePause} className="focus-ctrl-btn">
                    <Pause size={17} fill="currentColor" />
                    Pause
                  </button>
                  <button style={{ ...s.ctrlBtn, ...s.ctrlDanger }} onClick={handleStop} className="focus-ctrl-btn">
                    <Square size={17} fill="currentColor" />
                    Stop
                  </button>
                </>
              )}

              {status === 'paused' && (
                <>
                  <button style={{ ...s.ctrlBtn, ...s.ctrlPrimary }} onClick={handleResume} className="focus-ctrl-btn">
                    <Play size={17} fill="currentColor" />
                    Resume
                  </button>
                  <button style={{ ...s.ctrlBtn, ...s.ctrlDanger }} onClick={handleStop} className="focus-ctrl-btn">
                    <Square size={17} fill="currentColor" />
                    Stop
                  </button>
                </>
              )}

              {status === 'completed' && (
                <button style={{ ...s.ctrlBtn, ...s.ctrlSuccess }} onClick={handleReset} className="focus-ctrl-btn">
                  <RotateCcw size={17} />
                  New Session
                </button>
              )}

              {(status === 'ready' || status === 'paused') && (
                <button style={{ ...s.ctrlBtn, ...s.ctrlGhost }} onClick={handleReset} className="focus-ctrl-btn">
                  <RotateCcw size={17} />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* ─── AI Focus Coach + Live Analytics ─── */}
          <div style={coach.wrap} className="glass-panel animate-fade-in">
            <div style={coach.orb} />

            {/* Coach header */}
            <div style={coach.header}>
              <div style={coach.avatarWrap}>
                <div style={coach.avatar}>◈</div>
                <div style={coach.avatarRing} />
              </div>
              <div>
                <p style={coach.name}>AI Focus Coach</p>
                <p style={coach.statusLine}>
                  <span style={{ ...coach.dot, background: status === 'running' ? '#10b981' : status === 'completed' ? '#6366f1' : '#f59e0b' }} className={status === 'running' ? 'live-dot' : undefined} />
                  {status === 'running' ? 'Monitoring your session' : status === 'completed' ? 'Session complete' : status === 'paused' ? 'Session paused' : 'Ready to coach'}
                </p>
              </div>
            </div>

            {/* Coach message */}
            <div style={coach.msgBox}>
              <p style={coach.msgText}>{coachMsg}</p>
            </div>

            {/* Live analytics row */}
            <div style={coach.analyticsRow}>
              {[
                {
                  icon: '⏱', label: 'Elapsed',
                  value: isActive || status === 'completed'
                    ? fmtDuration(totalSec - remainingSec)
                    : '—',
                  color: 'var(--accent)',
                },
                {
                  icon: '🎯', label: 'Focus Score',
                  value: status === 'running'
                    ? `${Math.min(99, 60 + Math.round((totalSec - remainingSec) / 60 * 0.65))}%`
                    : status === 'completed' ? '✅ Done' : '—',
                  color: '#10b981',
                },
                {
                  icon: '📊', label: 'Productivity',
                  value: status === 'running' && totalSec > 0
                    ? `${Math.round(progress * 100)}%`
                    : status === 'completed' ? '100%' : '—',
                  color: '#f59e0b',
                },
                {
                  icon: '🔥', label: 'Sessions Done',
                  value: String(history.length),
                  color: '#ef4444',
                },
              ].map((m, i) => (
                <div key={i} style={coach.metricCard}>
                  <span style={{ fontSize: '1rem' }}>{m.icon}</span>
                  <p style={{ ...coach.metricValue, color: m.color }}>{m.value}</p>
                  <p style={coach.metricLabel}>{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ─── History card ─── */}
          <div style={s.historyCard} className="glass-panel">
            <div style={s.historyHeader}>
              <div style={s.historyIconWrap}>
                <Clock size={18} color="var(--accent)" />
              </div>
              <h2 style={s.historyTitle}>Session History</h2>
              {history.length > 0 && (
                <span style={s.historyBadge}>{history.length}</span>
              )}
            </div>

            {history.length === 0 ? (
              <div style={s.historyEmpty}>
                <p style={s.historyEmptyIcon}>⏱</p>
                <p style={s.historyEmptyText}>No completed sessions yet.</p>
                <p style={s.historyEmptyHint}>Start your first focus session to see history here.</p>
              </div>
            ) : (
              <div style={s.historyList}>
                {history.map((rec, i) => (
                  <div
                    key={rec.id}
                    style={{
                      ...s.historyItem,
                      animationDelay: `${i * 0.04}s`,
                    }}
                    className="animate-fade-in"
                  >
                    <div style={s.historyDot} />
                    <div style={s.historyInfo}>
                      <span style={s.historyDur}>{fmtDuration(rec.duration)}</span>
                      <span style={s.historyDate}>
                        {new Date(rec.completedAt).toLocaleString(undefined, {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteRecord(rec.id)}
                      style={s.historyDel}
                      title="Remove"
                      aria-label="Delete record"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

/* ══════════════════════════════════════
   AI Coach styles
   ══════════════════════════════════════ */
const coach: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative', overflow: 'hidden',
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(var(--glass-blur))', WebkitBackdropFilter: 'blur(var(--glass-blur))',
    border: '1px solid var(--glass-border)',
    borderRadius: '20px', padding: '1.5rem',
    display: 'flex', flexDirection: 'column' as const, gap: '1rem',
  },
  orb: {
    position: 'absolute', width: '250px', height: '250px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
    top: '-80px', right: '-60px', pointerEvents: 'none',
    animation: 'orb-drift-3 12s ease-in-out infinite',
  },
  header: { display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative', zIndex: 1 },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: {
    width: '44px', height: '44px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #00D4FF)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.2rem', color: '#fff',
    boxShadow: '0 0 20px rgba(99,102,241,0.4)',
    animation: 'breathe 3.5s ease-in-out infinite',
  },
  avatarRing: {
    position: 'absolute', inset: '-5px', borderRadius: '50%',
    border: '1.5px solid rgba(99,102,241,0.28)',
    animation: 'breathe 3.5s ease-in-out infinite',
  },
  name:       { margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-h)' },
  statusLine: { margin: 0, fontSize: '0.67rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.3rem' },
  dot:        { display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  msgBox: {
    padding: '0.85rem 1rem',
    background: 'rgba(99,102,241,0.07)',
    border: '1px solid rgba(99,102,241,0.16)',
    borderRadius: '14px', borderLeft: '2px solid rgba(99,102,241,0.45)',
    position: 'relative', zIndex: 1,
  },
  msgText: {
    margin: 0, fontSize: '0.82rem', color: 'var(--text-m)', lineHeight: 1.6,
    fontStyle: 'italic',
  },
  analyticsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.65rem',
    position: 'relative', zIndex: 1,
  },
  metricCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px', padding: '0.75rem 0.6rem',
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '0.2rem',
  },
  metricValue: { margin: 0, fontSize: '1rem', fontWeight: 800, lineHeight: 1.1 },
  metricLabel: { margin: 0, fontSize: '0.6rem', color: 'var(--text)', fontWeight: 600, letterSpacing: '0.05em' },
};

/* ══════════════════════════════════════
   TimeField sub-styles
   ══════════════════════════════════════ */
const tf: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.28rem',
  },
  label: {
    fontSize: '0.68rem',
    fontWeight: 600,
    color: 'var(--text)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: '0.1rem',
  },
  adj: {
    width: '36px',
    height: '24px',
    background: 'rgba(0,212,255,0.08)',
    border: '1px solid rgba(0,212,255,0.18)',
    borderRadius: '6px',
    color: 'var(--accent)',
    fontSize: '0.65rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.18s, transform 0.12s',
    fontFamily: 'inherit',
  },
  input: {
    width: '64px',
    textAlign: 'center' as const,
    padding: '0.45rem 0.3rem',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    color: 'var(--text-h)',
    fontSize: '1.35rem',
    fontWeight: 700,
    fontFamily: 'ui-monospace, Consolas, monospace',
    outline: 'none',
    MozAppearance: 'textfield' as unknown as undefined,
  },
};

/* ══════════════════════════════════════
   Page styles
   ══════════════════════════════════════ */
const s: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100svh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
    fontFamily: 'var(--sans)',
  },

  /* Nav */
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 2rem',
    height: '60px',
    position: 'sticky',
    top: 0,
    zIndex: 20,
    flexShrink: 0,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  navRight: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  navLogo: {
    fontSize: '1.18rem',
    fontWeight: 700,
    color: 'var(--primary)',
    letterSpacing: '-0.5px',
    textDecoration: 'none',
  },
  statusPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.3rem 0.85rem',
    borderRadius: '999px',
    border: '1px solid',
    fontSize: '0.76rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
  statusDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
  },

  /* Main layout */
  main: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    padding: '2rem 1.25rem 3rem',
    boxSizing: 'border-box' as const,
  },
  content: {
    width: '100%',
    maxWidth: '640px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.6rem',
  },

  /* Page header */
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    marginBottom: '0.25rem',
  },
  pageIconWrap: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pageTitle: {
    fontSize: '1.7rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    margin: 0,
  },
  pageSub: {
    margin: '0.1rem 0 0',
    fontSize: '0.84rem',
    color: 'var(--text)',
  },

  /* Timer card */
  timerCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: '2rem 1.75rem 1.75rem',
    borderRadius: '24px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--glow-card)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.4rem',
  },

  /* Ambient orbs */
  orb1: {
    position: 'absolute',
    top: '-60px',
    right: '-60px',
    width: '220px',
    height: '220px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
    animation: 'orb-drift-1 12s ease-in-out infinite',
  },
  orb2: {
    position: 'absolute',
    bottom: '-50px',
    left: '-50px',
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
    animation: 'orb-drift-2 15s ease-in-out infinite',
  },

  /* SVG circle */
  circleOuter: {
    position: 'relative',
    width: '220px',
    height: '220px',
    flexShrink: 0,
  },
  circleInner: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.25rem',
  },
  timeDisplay: {
    fontFamily: 'ui-monospace, Consolas, monospace',
    fontSize: '2.1rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 1,
    transition: 'color 0.4s ease',
  },
  timeSub: {
    fontSize: '0.72rem',
    color: 'var(--text)',
    fontWeight: 600,
    letterSpacing: '0.06em',
  },
  timeHint: {
    fontSize: '0.68rem',
    color: 'var(--text)',
  },

  /* Time input fields row */
  fieldsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.6rem',
    flexWrap: 'wrap' as const,
    transition: 'opacity 0.3s ease',
  },
  fieldSep: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: 'var(--text)',
    marginTop: '1.2rem',
    lineHeight: 1,
    userSelect: 'none' as const,
  },

  /* Presets */
  presets: {
    display: 'flex',
    gap: '0.55rem',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },
  presetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.38rem 0.85rem',
    border: '1px solid var(--accent-border)',
    borderRadius: '999px',
    background: 'var(--accent-bg)',
    color: 'var(--accent)',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.18s, border-color 0.18s, transform 0.14s, opacity 0.2s',
  },

  /* Progress bar */
  barWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    width: '100%',
    maxWidth: '420px',
  },
  barTrack: {
    flex: 1,
    height: '8px',
    background: 'var(--border)',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '999px',
    minWidth: '0%',
  },
  barPct: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text)',
    minWidth: '34px',
    textAlign: 'right' as const,
  },

  /* Controls */
  controls: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
    width: '100%',
  },
  ctrlBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.42rem',
    padding: '0.62rem 1.4rem',
    borderRadius: '12px',
    border: 'none',
    fontSize: '0.9rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'transform 0.18s ease, box-shadow 0.2s ease, opacity 0.2s',
    letterSpacing: '0.01em',
  },
  ctrlPrimary: {
    background: 'linear-gradient(135deg, #00D4FF 0%, #7C3AED 100%)',
    color: '#fff',
    boxShadow: '0 4px 24px rgba(0,212,255,0.35)',
  },
  ctrlAmber: {
    background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    color: '#fff',
    boxShadow: '0 4px 20px rgba(245,158,11,0.3)',
  },
  ctrlDanger: {
    background: 'rgba(239,68,68,0.14)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#dc2626',
    boxShadow: 'none',
  },
  ctrlSuccess: {
    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    color: '#fff',
    boxShadow: '0 4px 20px rgba(16,185,129,0.35)',
  },
  ctrlGhost: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    boxShadow: 'none',
  },

  /* Notification */
  notif: {
    position: 'fixed',
    top: '72px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.75rem 1.25rem',
    borderRadius: '12px',
    background: 'rgba(16,185,129,0.14)',
    border: '1px solid rgba(16,185,129,0.4)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    zIndex: 1000,
    maxWidth: '90vw',
  },
  notifText: {
    fontSize: '0.88rem',
    fontWeight: 600,
    color: '#059669',
    whiteSpace: 'nowrap' as const,
  },
  notifClose: {
    background: 'none',
    border: 'none',
    color: '#059669',
    cursor: 'pointer',
    fontSize: '0.8rem',
    padding: '0 0.2rem',
    fontFamily: 'inherit',
  },

  /* History card */
  historyCard: {
    borderRadius: '20px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--glow-card)',
    overflow: 'hidden',
  },
  historyHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--border-subtle)',
  },
  historyIconWrap: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    background: 'rgba(0,212,255,0.1)',
    border: '1px solid rgba(0,212,255,0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  historyTitle: {
    flex: 1,
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-h)',
    margin: 0,
  },
  historyBadge: {
    padding: '0.18rem 0.6rem',
    borderRadius: '999px',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    color: 'var(--accent)',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  historyEmpty: {
    padding: '3rem 1.5rem',
    textAlign: 'center' as const,
  },
  historyEmptyIcon: {
    fontSize: '2rem',
    marginBottom: '0.5rem',
  },
  historyEmptyText: {
    margin: '0 0 0.3rem',
    fontWeight: 600,
    color: 'var(--text-h)',
    fontSize: '0.95rem',
  },
  historyEmptyHint: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '0.82rem',
  },
  historyList: {
    padding: '0.6rem 0',
  },
  historyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '0.75rem 1.5rem',
    transition: 'background 0.18s',
  },
  historyDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #00D4FF, #7C3AED)',
    flexShrink: 0,
    boxShadow: '0 0 6px rgba(0,212,255,0.5)',
  },
  historyInfo: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap' as const,
    minWidth: 0,
  },
  historyDur: {
    fontWeight: 700,
    color: 'var(--text-h)',
    fontSize: '0.9rem',
    fontFamily: 'ui-monospace, Consolas, monospace',
  },
  historyDate: {
    color: 'var(--text)',
    fontSize: '0.78rem',
  },
  historyDel: {
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    padding: '0.3rem',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    opacity: 0.5,
    transition: 'opacity 0.18s, color 0.18s',
    flexShrink: 0,
    fontFamily: 'inherit',
  },
};

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, RotateCcw, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import type { Session } from '../../types/sessions';

/* ── Constants ── */
const RADIUS       = 82;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const PRESETS = [
  { label: '25 min', seconds: 25 * 60 },
  { label: '45 min', seconds: 45 * 60 },
  { label: '90 min', seconds: 90 * 60 },
  { label: '2 hrs',  seconds: 120 * 60 },
] as const;

const COACH_MSGS = {
  ready:     ['Set a title, choose a subject, and enter the zone.',
              'Deep work begins with a single session. Ready when you are.'],
  start:     ['Great start! Your brain is warming up — stay with it.',
              'Focus session initiated. Tracking your progress.'],
  min5:      ['First 5 minutes done. Deep focus kicks in now — keep going.',
              'You\'re entering the flow state. This is where real learning happens!'],
  min15:     ['15 minutes of deep focus. You\'re in the zone.',
              'Flow state achieved. Excellent concentration — don\'t stop!'],
  min25:     ['25 minutes! Pomodoro complete. Take a 5-minute break.',
              'Excellent deep work session. Your brain is absorbing information well.'],
  min45:     ['45 minutes of deep focus! Consider a 10-min break.',
              'Extended focus session — your retention is at peak right now.'],
  min60:     ['One full hour! Exceptional performance. Schedule a proper break now.',
              'World-class focus for 60 minutes. Rest first.'],
  paused:    ['Session paused. Breathe. Resume when ready — I\'ll be here.',
              'Take a moment, then come back stronger. You\'re doing great.'],
  completed: ['Session complete! You crushed it. Saved to your history.',
              'Excellent work! Your focus score is looking strong today.'],
};

type Status = 'ready' | 'running' | 'paused' | 'completed';

interface Props {
  subjects: string[];
  onComplete: (session: Session) => void;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function toHMS(sec: number) {
  return { h: Math.floor(sec / 3600), m: Math.floor((sec % 3600) / 60), s: sec % 60 };
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

interface TimeFieldProps {
  label: string; value: number; max: number; disabled: boolean;
  onChange: (v: number) => void;
}
function TimeField({ label, value, max, disabled, onChange }: TimeFieldProps) {
  const clamp = (v: number) => Math.max(0, Math.min(max, v));
  return (
    <div style={tf.wrap}>
      <span style={tf.label}>{label}</span>
      <button style={{ ...tf.adj, opacity: disabled ? 0.4 : 1 }} onClick={() => onChange(clamp(value + 1))} disabled={disabled} aria-label={`Increase ${label}`}>▲</button>
      <input type="number" value={value} min={0} max={max}
        onChange={e => onChange(clamp(Number(e.target.value) || 0))}
        disabled={disabled}
        style={{ ...tf.input, opacity: disabled ? 0.45 : 1 }}
        aria-label={label}
      />
      <button style={{ ...tf.adj, opacity: disabled ? 0.4 : 1 }} onClick={() => onChange(clamp(value - 1))} disabled={disabled} aria-label={`Decrease ${label}`}>▼</button>
    </div>
  );
}

export default function SessionTimer({ subjects, onComplete }: Props) {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionSubject, setSessionSubject] = useState('');

  const [inputH, setInputH] = useState(0);
  const [inputM, setInputM] = useState(25);
  const [inputS, setInputS] = useState(0);

  const [status,       setStatus]       = useState<Status>('ready');
  const [totalSec,     setTotalSec]     = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [saving,       setSaving]       = useState(false);
  const [coachMsg,     setCoachMsg]     = useState(COACH_MSGS.ready[0]);
  const [showDone,     setShowDone]     = useState(false);

  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const startDurRef   = useRef(0);

  const isActive   = status === 'running' || status === 'paused';
  const progress   = totalSec > 0 ? (totalSec - remainingSec) / totalSec : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const { h: rH, m: rM, s: rS } = toHMS(remainingSec);

  const statusColor: Record<Status, string> = {
    ready: '#64748b', running: '#00D4FF', paused: '#F59E0B', completed: '#10B981',
  };
  const arcColor = statusColor[status];

  /* ── Tick ── */
  useEffect(() => {
    if (status === 'running') {
      intervalRef.current = setInterval(() => {
        setRemainingSec(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            handleCompletion();
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

  /* ── Auto-dismiss done banner ── */
  useEffect(() => {
    if (!showDone) return;
    const t = setTimeout(() => setShowDone(false), 6000);
    return () => clearTimeout(t);
  }, [showDone]);

  /* ── Coach messages ── */
  useEffect(() => {
    if (status === 'completed') { setCoachMsg(COACH_MSGS.completed[Math.floor(Math.random() * COACH_MSGS.completed.length)]); return; }
    if (status === 'ready')     { setCoachMsg(COACH_MSGS.ready[Math.floor(Math.random() * COACH_MSGS.ready.length)]); return; }
    if (status === 'paused')    { setCoachMsg(COACH_MSGS.paused[Math.floor(Math.random() * COACH_MSGS.paused.length)]); return; }
    const elapsed = totalSec - remainingSec;
    const pick = (pool: string[]) => pool[Math.floor(Math.random() * pool.length)];
    if      (elapsed < 30)     setCoachMsg(pick(COACH_MSGS.start));
    else if (elapsed < 5*60)   setCoachMsg(pick(COACH_MSGS.start));
    else if (elapsed < 15*60)  setCoachMsg(pick(COACH_MSGS.min5));
    else if (elapsed < 25*60)  setCoachMsg(pick(COACH_MSGS.min15));
    else if (elapsed < 45*60)  setCoachMsg(pick(COACH_MSGS.min25));
    else if (elapsed < 60*60)  setCoachMsg(pick(COACH_MSGS.min45));
    else                        setCoachMsg(pick(COACH_MSGS.min60));
  }, [status, Math.floor((totalSec - remainingSec) / 300)]);

  /* ── Notification permission ── */
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  async function handleCompletion() {
    setStatus('completed');
    playBeeps();
    setShowDone(true);

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Focus Session Complete!', {
        body: `${sessionTitle || 'Focus Session'} — ${fmtDuration(startDurRef.current)} of deep work.`,
      });
    }

    setSaving(true);
    try {
      const durationMins = Math.max(1, Math.round(startDurRef.current / 60));
      const { data } = await api.post<Session>(
        '/sessions',
        {
          title: sessionTitle || 'Focus Session',
          subject: sessionSubject || null,
          duration_minutes: durationMins,
          status: 'completed',
        },
        { headers },
      );
      onComplete(data);
    } catch {
      /* silently fail — session still shows locally */
    } finally {
      setSaving(false);
    }
  }

  function handleStart() {
    const total = inputH * 3600 + inputM * 60 + inputS;
    if (total <= 0) return;
    startDurRef.current = total;
    setTotalSec(total);
    setRemainingSec(total);
    setStatus('running');
  }
  function handlePause()  { setStatus('paused'); }
  function handleResume() { setStatus('running'); }
  function handleStop()   { if (intervalRef.current) clearInterval(intervalRef.current); setStatus('ready'); setTotalSec(0); setRemainingSec(0); }
  function handleReset()  { if (intervalRef.current) clearInterval(intervalRef.current); setStatus('ready'); setTotalSec(0); setRemainingSec(0); }
  function applyPreset(secs: number) {
    if (isActive) return;
    const { h, m, s } = toHMS(secs);
    setInputH(h); setInputM(m); setInputS(s);
  }

  const displayTime = isActive || status === 'completed'
    ? `${pad(rH)}:${pad(rM)}:${pad(rS)}`
    : `${pad(inputH)}:${pad(inputM)}:${pad(inputS)}`;

  return (
    <div style={s.card} className="glass-panel stat-card-premium">
      {/* Ambient orbs */}
      <div style={s.orb1} /><div style={s.orb2} />

      {/* Completion banner */}
      {showDone && (
        <div style={s.doneBanner} className="animate-slide-up">
          {saving ? 'Saving session…' : 'Session saved!'} Great work!
        </div>
      )}

      {/* ── Session meta inputs ── */}
      <div style={{ ...s.metaRow, pointerEvents: isActive ? 'none' : undefined, opacity: isActive ? 0.5 : 1 }}>
        <input
          type="text"
          placeholder="Session title (e.g. Calculus Chapter 4)"
          value={sessionTitle}
          onChange={e => setSessionTitle(e.target.value)}
          style={s.metaInput}
          disabled={isActive}
        />
        {subjects.length > 0 ? (
          <select
            value={sessionSubject}
            onChange={e => setSessionSubject(e.target.value)}
            style={{ ...s.metaInput, ...s.metaSelect }}
            disabled={isActive}
          >
            <option value="">Subject (optional)</option>
            {subjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
          </select>
        ) : (
          <input
            type="text"
            placeholder="Subject (optional)"
            value={sessionSubject}
            onChange={e => setSessionSubject(e.target.value)}
            style={s.metaInput}
            disabled={isActive}
          />
        )}
      </div>

      {/* ── Circular progress ── */}
      <div style={s.circleOuter}>
        <svg width={200} height={200} viewBox="0 0 200 200" aria-hidden>
          <defs>
            <filter id="arc-glow-st">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <circle cx={100} cy={100} r={RADIUS} fill="none" stroke="#e2e8f0" strokeWidth={9} />
          <circle cx={100} cy={100} r={RADIUS}
            fill="none"
            stroke={arcColor}
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 100 100)"
            filter={status === 'running' ? 'url(#arc-glow-st)' : undefined}
            style={{ transition: 'stroke-dashoffset 0.95s ease, stroke 0.45s ease' }}
          />
        </svg>
        <div style={s.circleInner}>
          <span style={{ ...s.timeDisplay, color: isActive || status === 'completed' ? arcColor : 'var(--text-h)' }}>
            {displayTime}
          </span>
          {totalSec > 0 && <span style={s.timeSub}>{Math.round(progress * 100)}% done</span>}
          {status === 'ready' && totalSec === 0 && <span style={s.timeHint}>set time below</span>}
        </div>
      </div>

      {/* ── Time inputs ── */}
      <div style={{ ...s.fieldsRow, opacity: isActive ? 0.4 : 1, pointerEvents: isActive ? 'none' : undefined }}>
        <TimeField label="H" value={inputH} max={23} disabled={isActive} onChange={setInputH} />
        <div style={s.sep}>:</div>
        <TimeField label="M" value={inputM} max={59} disabled={isActive} onChange={setInputM} />
        <div style={s.sep}>:</div>
        <TimeField label="S" value={inputS} max={59} disabled={isActive} onChange={setInputS} />
      </div>

      {/* ── Presets ── */}
      <div style={s.presets}>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => applyPreset(p.seconds)} disabled={isActive}
            style={{ ...s.presetBtn, opacity: isActive ? 0.4 : 1 }} className="focus-preset-btn">
            <Zap size={11} />{p.label}
          </button>
        ))}
      </div>

      {/* ── Progress bar ── */}
      {totalSec > 0 && (
        <div style={s.barWrap}>
          <div style={s.barTrack}>
            <div style={{ ...s.barFill, width: `${progress * 100}%`, background: `linear-gradient(90deg, ${arcColor}, ${arcColor}88)`, boxShadow: status === 'running' ? `0 0 12px ${arcColor}55` : 'none', transition: 'width 0.95s ease' }} />
          </div>
          <span style={s.barPct}>{Math.round(progress * 100)}%</span>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={s.controls}>
        {status === 'ready' && (
          <button style={{ ...s.btn, ...s.btnPrimary }} onClick={handleStart} disabled={(inputH + inputM + inputS) === 0} className="focus-ctrl-btn">
            <Play size={16} fill="currentColor" />Start
          </button>
        )}
        {status === 'running' && (<>
          <button style={{ ...s.btn, ...s.btnAmber }} onClick={handlePause} className="focus-ctrl-btn"><Pause size={16} fill="currentColor" />Pause</button>
          <button style={{ ...s.btn, ...s.btnDanger }} onClick={handleStop} className="focus-ctrl-btn"><Square size={16} fill="currentColor" />Stop</button>
        </>)}
        {status === 'paused' && (<>
          <button style={{ ...s.btn, ...s.btnPrimary }} onClick={handleResume} className="focus-ctrl-btn"><Play size={16} fill="currentColor" />Resume</button>
          <button style={{ ...s.btn, ...s.btnDanger }} onClick={handleStop} className="focus-ctrl-btn"><Square size={16} fill="currentColor" />Stop</button>
        </>)}
        {status === 'completed' && (
          <button style={{ ...s.btn, ...s.btnSuccess }} onClick={handleReset} className="focus-ctrl-btn"><RotateCcw size={16} />New Session</button>
        )}
        {(status === 'ready' || status === 'paused') && (
          <button style={{ ...s.btn, ...s.btnGhost }} onClick={handleReset} className="focus-ctrl-btn"><RotateCcw size={16} />Reset</button>
        )}
      </div>

      {/* ── AI Coach ── */}
      <div style={s.coach}>
        <div style={s.coachLeft}>
          <div style={s.coachAvatar}>◈</div>
          <div>
            <p style={s.coachName}>AI Focus Coach</p>
            <span style={{ ...s.coachDot, background: status === 'running' ? '#10b981' : '#f59e0b' }} className={status === 'running' ? 'live-dot' : undefined} />
          </div>
        </div>
        <p style={s.coachMsg}>{coachMsg}</p>
      </div>
    </div>
  );
}

/* ── Styles ── */
const tf: Record<string, React.CSSProperties> = {
  wrap:  { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' },
  label: { fontSize: '0.6rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  adj:   { width: '32px', height: '22px', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.18)', borderRadius: '5px', color: '#00D4FF', fontSize: '0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' },
  input: { width: '56px', textAlign: 'center', padding: '0.38rem 0.2rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '9px', color: 'var(--text-h)', fontSize: '1.2rem', fontWeight: 700, fontFamily: 'ui-monospace,Consolas,monospace', outline: 'none' },
};

const s: Record<string, React.CSSProperties> = {
  card: {
    position: 'relative', overflow: 'hidden',
    background: 'rgba(10,16,32,0.82)',
    border: '1px solid rgba(0,212,255,0.12)',
    borderRadius: '22px', padding: '1.5rem 1.25rem',
    backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
    boxShadow: '0 8px 48px rgba(0,0,0,0.1)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.1rem',
  },
  orb1: { position: 'absolute', top: '-50px', right: '-50px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.1) 0%, transparent 70%)', pointerEvents: 'none' },
  orb2: { position: 'absolute', bottom: '-40px', left: '-40px', width: '150px', height: '150px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)', pointerEvents: 'none' },

  doneBanner: {
    width: '100%', padding: '0.6rem 0.9rem', borderRadius: '10px',
    background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
    fontSize: '0.82rem', fontWeight: 700, color: '#6ee7b7', textAlign: 'center',
    position: 'relative', zIndex: 2,
  },

  metaRow: { display: 'flex', flexDirection: 'column', gap: '0.55rem', width: '100%', position: 'relative', zIndex: 2, transition: 'opacity 0.3s' },
  metaInput: {
    width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.85rem',
    background: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: '10px', color: 'var(--text-h)', fontSize: '0.82rem', fontFamily: 'inherit',
    outline: 'none',
  },
  metaSelect: { cursor: 'pointer' },

  circleOuter: { position: 'relative', width: '200px', height: '200px', flexShrink: 0 },
  circleInner: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' },
  timeDisplay: { fontFamily: 'ui-monospace,Consolas,monospace', fontSize: '1.9rem', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', transition: 'color 0.4s' },
  timeSub:    { fontSize: '0.68rem', color: 'var(--text)', fontWeight: 600, letterSpacing: '0.06em' },
  timeHint:   { fontSize: '0.64rem', color: 'var(--text)', opacity: 0.55 },

  fieldsRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', flexWrap: 'wrap', transition: 'opacity 0.3s' },
  sep: { fontSize: '1.4rem', fontWeight: 700, color: 'rgba(255,255,255,0.18)', marginTop: '1rem', lineHeight: 1, userSelect: 'none' },

  presets: { display: 'flex', gap: '0.45rem', flexWrap: 'wrap', justifyContent: 'center' },
  presetBtn: {
    display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.7rem',
    border: '1px solid rgba(0,212,255,0.22)', borderRadius: '99px',
    background: 'rgba(0,212,255,0.07)', color: '#00D4FF',
    fontSize: '0.73rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background 0.18s, transform 0.12s',
  },

  barWrap: { display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%' },
  barTrack: { flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: '99px', minWidth: 0 },
  barPct:   { fontSize: '0.68rem', fontWeight: 700, color: 'var(--text)', minWidth: '30px', textAlign: 'right' },

  controls: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%' },
  btn: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.55rem 1.15rem', borderRadius: '10px', border: 'none',
    fontSize: '0.84rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
    transition: 'transform 0.18s, box-shadow 0.2s',
  },
  btnPrimary: { background: 'linear-gradient(135deg, #00D4FF 0%, #7C3AED 100%)', color: '#fff', boxShadow: '0 4px 20px rgba(0,212,255,0.3)' },
  btnAmber:   { background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', color: '#fff', boxShadow: '0 4px 16px rgba(245,158,11,0.25)' },
  btnDanger:  { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' },
  btnSuccess: { background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#fff', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' },
  btnGhost:   { background: '#ffffff', border: '1px solid #e2e8f0', color: 'var(--text)' },

  coach: {
    width: '100%', padding: '0.85rem', borderRadius: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
    background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
    display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative', zIndex: 1,
  },
  coachLeft:   { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  coachAvatar: {
    width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, #6366f1, #00D4FF)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1rem', color: '#fff', boxShadow: '0 0 16px rgba(99,102,241,0.35)',
  },
  coachName: { margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#334155' },
  coachDot:  { display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', marginLeft: '0.3rem' },
  coachMsg:  { margin: 0, fontSize: '0.78rem', color: 'rgba(226,232,240,0.82)', lineHeight: 1.55, fontStyle: 'italic' },
};

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import IntegrityMonitor, { type FocusMetrics } from './IntegrityMonitor';
import WarningSystem from './WarningSystem';
import FocusReport from './FocusReport';
import { startCamera } from '../../services/cameraMonitor';
import { startMicrophoneMonitor } from '../../services/microphoneMonitor';
import { createTabSwitchDetector } from '../../services/tabSwitchDetector';
import { createIntegrityEngine, MAX_WARNINGS, type IntegrityWarning } from '../../services/integrityEngine';

// ── Types ─────────────────────────────────────────────────────────────
interface Question {
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
}

type FocusPhase = 'permission' | 'setup' | 'generating' | 'active' | 'report';
type Difficulty = 'Easy' | 'Medium' | 'Hard';

const MULTIPLIERS: Record<string, number> = { Easy: 1.0, Medium: 0.75, Hard: 0.5 };
function getQuestionCount(mins: number, diff: string) {
  return Math.max(1, Math.round(mins * (MULTIPLIERS[diff] ?? 1.0)));
}

const DURATIONS = [
  { value: 10, label: '10 min' },
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
];

const DIFFICULTIES: { value: Difficulty; color: string; desc: string }[] = [
  { value: 'Easy',   color: '#10b981', desc: 'Basic recall & straightforward concepts' },
  { value: 'Medium', color: '#f59e0b', desc: 'Applied understanding & moderate reasoning' },
  { value: 'Hard',   color: '#ef4444', desc: 'Deep analysis & multi-step reasoning' },
];

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface Props {
  onBack: () => void;
}

export default function FocusModeQuiz({ onBack }: Props) {
  const { token } = useAuth();
  const { t } = useLanguage();

  // ── Phase ──
  const [phase, setPhase] = useState<FocusPhase>('permission');

  // ── Permission state ──
  const [camGranted,  setCamGranted]  = useState(false);
  const [micGranted,  setMicGranted]  = useState(false);
  const [permError,   setPermError]   = useState('');
  const [requesting,  setRequesting]  = useState(false);
  const [demoMode,    setDemoMode]    = useState(false);

  // ── Devices ──
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const micHandleRef   = useRef<{ getVolume: () => number; stop: () => void } | null>(null);
  const tabDetachRef   = useRef<(() => void) | null>(null);

  // ── Integrity engine ──
  const integrityRef   = useRef(createIntegrityEngine());
  const [warnings,     setWarnings]    = useState<IntegrityWarning[]>([]);
  const [latestWarn,   setLatestWarn]  = useState<IntegrityWarning | null>(null);
  const [terminated,   setTerminated]  = useState(false);

  // ── Focus metrics from IntegrityMonitor ──
  const metricsRef = useRef<FocusMetrics>({ score: 0, state: 'idle', facePresent: false });
  const faceAbsentSince    = useRef<number | null>(null);
  const distractedSince    = useRef<number | null>(null);
  const lastAudioWarnAt    = useRef<number>(0);

  // ── Quiz config ──
  const [subjects,  setSubjects]  = useState<string[]>([]);
  const [subject,   setSubject]   = useState('');
  const [duration,  setDuration]  = useState<number>(10);
  const [difficulty,setDifficulty]= useState<Difficulty>('Medium');
  const [genError,  setGenError]  = useState('');

  // ── Quiz state ──
  const [questions,  setQuestions]  = useState<Question[]>([]);
  const [current,    setCurrent]    = useState(0);
  const [selected,   setSelected]   = useState<(number | null)[]>([]);
  const [answered,   setAnswered]   = useState(false);
  const [timeLeft,   setTimeLeft]   = useState(0);
  const [timeTaken,  setTimeTaken]  = useState(0);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // ── Load subjects ──
  useEffect(() => {
    api.get<{ subjects: string[] }>('/student-profile')
      .then(r => { const s = r.data.subjects ?? []; setSubjects(s); if (s.length) setSubject(s[0]); })
      .catch(() => {});
  }, [token]);

  // ── Cleanup on unmount ──
  useEffect(() => () => {
    cameraStream?.getTracks().forEach(t => t.stop());
    micHandleRef.current?.stop();
    tabDetachRef.current?.();
    if (timerRef.current) clearInterval(timerRef.current);
  }, [cameraStream]);

  // ── Push warning ──
  const pushWarning = useCallback((type: Parameters<ReturnType<typeof createIntegrityEngine>['addWarning']>[0]) => {
    const engine = integrityRef.current;
    if (engine.isTerminated()) return;
    const w = engine.addWarning(type);
    const ws = engine.getWarnings();
    setWarnings(ws);
    setLatestWarn(w);
    if (engine.isTerminated()) setTerminated(true);
  }, []);

  // ── Request permissions ──
  async function requestPermissions() {
    setRequesting(true);
    setPermError('');
    let cam = false;
    let mic = false;
    let stream: MediaStream | null = null;

    try {
      const handle = await startCamera();
      stream = handle.stream;
      setCameraStream(handle.stream);
      cam = true;
    } catch {
      setPermError('Camera access denied. Enable camera permissions or use Demo Mode.');
      setRequesting(false);
      return;
    }

    try {
      const micHandle = await startMicrophoneMonitor();
      micHandleRef.current = micHandle;
      mic = true;
    } catch {
      stream?.getTracks().forEach(t => t.stop());
      setPermError('Microphone access denied. Enable microphone permissions or use Demo Mode.');
      setRequesting(false);
      return;
    }

    setCamGranted(cam);
    setMicGranted(mic);
    setRequesting(false);
    setPhase('setup');
  }

  function enterDemoMode() {
    setDemoMode(true);
    setCamGranted(true);
    setMicGranted(true);
    setPhase('setup');
  }

  // ── Generate quiz ──
  async function generate() {
    if (!subject) return;
    setGenError('');
    setPhase('generating');
    try {
      const res = await api.post<{ questions: Question[] }>('/quiz/generate', {
        subject, duration_minutes: duration, difficulty,
      });
      const qs = res.data.questions;
      setQuestions(qs);
      setSelected(new Array(qs.length).fill(null));
      setCurrent(0);
      setAnswered(false);

      // Start timer
      const total = duration * 60;
      setTimeLeft(total);
      startTimeRef.current = Date.now();
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setTimeTaken(total);
            endSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Start integrity monitoring
      integrityRef.current = createIntegrityEngine();
      setWarnings([]);
      setLatestWarn(null);
      setTerminated(false);

      // Tab switch detection
      tabDetachRef.current?.();
      tabDetachRef.current = createTabSwitchDetector(() => pushWarning('tab_switch'));

      setPhase('active');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to generate quiz. Try again.';
      setGenError(msg);
      setPhase('setup');
    }
  }

  // ── Focus metrics callback from IntegrityMonitor ──
  const handleMetrics = useCallback((m: FocusMetrics) => {
    metricsRef.current = m;

    const now = Date.now();

    // Face absent warning (after 15s)
    if (!m.facePresent) {
      if (!faceAbsentSince.current) faceAbsentSince.current = now;
      else if (now - faceAbsentSince.current > 15_000) {
        pushWarning('face_absent');
        faceAbsentSince.current = now; // reset clock
      }
    } else {
      faceAbsentSince.current = null;
    }

    // Distracted warning (after 60s)
    if (m.state === 'distracted') {
      if (!distractedSince.current) distractedSince.current = now;
      else if (now - distractedSince.current > 60_000) {
        pushWarning('distracted');
        distractedSince.current = now;
      }
    } else {
      distractedSince.current = null;
    }

    // Audio warning (3 min cooldown)
    if (!demoMode && micHandleRef.current) {
      const vol = micHandleRef.current.getVolume();
      if (vol > 60 && now - lastAudioWarnAt.current > 180_000) {
        pushWarning('suspicious_audio');
        lastAudioWarnAt.current = now;
      }
    }
  }, [pushWarning, demoMode]);

  // ── Pick answer ──
  function pick(idx: number) {
    if (answered || terminated) return;
    setSelected(prev => { const n = [...prev]; n[current] = idx; return n; });
    setAnswered(true);
  }

  function next() {
    if (current + 1 >= questions.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeTaken(Math.round((Date.now() - startTimeRef.current) / 1000));
      tabDetachRef.current?.();
      setPhase('report');
    } else {
      setCurrent(c => c + 1);
      setAnswered(selected[current + 1] !== null);
    }
  }

  function endSession() {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeTaken(Math.round((Date.now() - startTimeRef.current) / 1000));
    tabDetachRef.current?.();
    setPhase('report');
  }

  // ── Score ──
  const score   = selected.filter((a, i) => a !== null && a === questions[i]?.correct).length;
  const total   = questions.length;

  // ── PERMISSION phase ──
  if (phase === 'permission') {
    return (
      <div style={f.shell}>
        <header style={f.nav}>
          <button onClick={onBack} style={f.backBtn}>← Back</button>
          <span style={f.navTitle}>Focus Mode Quiz</span>
          <div style={{ width: 80 }} />
        </header>
        <div style={f.center}>
          <div style={f.permCard}>
            <div style={f.permIcon}>👁</div>
            <h2 style={f.permTitle}>Camera & Microphone Required</h2>
            <p style={f.permSub}>
              Focus Mode Quiz uses AI monitoring to verify your focus and integrity during the exam.
              Your camera and microphone will be active throughout the session.
            </p>
            <div style={f.permFeats}>
              {[
                { icon: '📷', label: 'Webcam monitoring', desc: 'Face detection tracks attention' },
                { icon: '🎤', label: 'Mic monitoring',    desc: 'Audio environment check' },
                { icon: '🔀', label: 'Tab detection',     desc: 'Stay on the exam page' },
                { icon: '⚠️', label: '6-strike system',   desc: 'Auto-terminates at limit' },
              ].map(f => (
                <div key={f.label} style={fp.feat}>
                  <span style={{ fontSize: '1.2rem' }}>{f.icon}</span>
                  <div>
                    <p style={fp.featLabel}>{f.label}</p>
                    <p style={fp.featDesc}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            {permError && <div style={f.errorBox}>{permError}</div>}
            <button onClick={requestPermissions} disabled={requesting} style={f.primaryBtn}>
              {requesting ? 'Requesting permissions…' : '🎯 Grant Permissions & Continue'}
            </button>
            <button onClick={enterDemoMode} style={f.demoBtn}>
              Use Demo Mode (no camera needed)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── SETUP phase ──
  if (phase === 'setup') {
    return (
      <div style={f.shell}>
        <header style={f.nav}>
          <button onClick={onBack} style={f.backBtn}>← Back</button>
          <span style={f.navTitle}>Focus Mode Quiz — Setup</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {demoMode   && <span style={f.demoBadge}>Demo Mode</span>}
            {camGranted && <span style={f.permBadge}>📷 Camera</span>}
            {micGranted && <span style={f.permBadge}>🎤 Mic</span>}
          </div>
        </header>
        <main style={f.main}>
          <div style={f.configCard}>
            <div style={f.cardHead}>
              <span style={{ fontSize: '2rem' }}>👁</span>
              <div>
                <h2 style={f.cardTitle}>Focus Mode Quiz</h2>
                <p style={f.cardSub}>Exam simulation with integrity monitoring</p>
              </div>
            </div>
            {genError && <div style={f.errorBox}>{genError}</div>}

            <div style={f.fieldGroup}>
              <label style={f.label}>{t('quiz_subject')}</label>
              {subjects.length > 0 ? (
                <div style={f.chipRow}>
                  {subjects.map(s => (
                    <button key={s} onClick={() => setSubject(s)} style={{ ...f.chip, background: subject === s ? 'rgba(0,212,255,0.12)' : 'var(--bg-surface)', border: `1.5px solid ${subject === s ? '#00D4FF' : 'var(--border)'}`, color: subject === s ? '#00D4FF' : 'var(--text-h)' }}>
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.83rem', color: 'var(--text)' }}>{t('quiz_no_subjects')} <Link to="/profile" style={{ color: '#00D4FF' }}>{t('quiz_add_subjects')}</Link></p>
              )}
            </div>

            <div style={f.fieldGroup}>
              <label style={f.label}>{t('quiz_duration')}</label>
              <div style={f.chipRow}>
                {DURATIONS.map(d => (
                  <button key={d.value} onClick={() => setDuration(d.value)} style={{ ...f.chip, flexDirection: 'column' as const, gap: '0.1rem', padding: '0.55rem 1.1rem', background: duration === d.value ? 'rgba(0,212,255,0.12)' : 'var(--bg-surface)', border: `1.5px solid ${duration === d.value ? '#00D4FF' : 'var(--border)'}`, color: duration === d.value ? '#00D4FF' : 'var(--text-h)' }}>
                    <span style={{ fontWeight: 700 }}>{d.label}</span>
                    <span style={{ fontSize: '0.68rem', opacity: 0.7 }}>{getQuestionCount(d.value, difficulty)} Qs</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={f.fieldGroup}>
              <label style={f.label}>{t('quiz_difficulty')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {DIFFICULTIES.map(d => (
                  <button key={d.value} onClick={() => setDifficulty(d.value)} style={{ ...f.diffBtn, background: difficulty === d.value ? `${d.color}14` : 'var(--bg-surface)', border: `1.5px solid ${difficulty === d.value ? d.color : 'var(--border)'}` }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <div style={{ textAlign: 'left' as const }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem', color: difficulty === d.value ? d.color : 'var(--text-h)' }}>{d.value}</p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text)' }}>{d.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div style={f.warningNotice}>
              <span style={{ fontSize: '0.85rem' }}>⚠️</span>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-h)', lineHeight: 1.5 }}>
                This session will be monitored. You have <strong>{MAX_WARNINGS} warnings</strong> before auto-termination.
                Tab switching, face absence, and distractions all count.
              </p>
            </div>

            <button onClick={generate} disabled={!subject} style={{ ...f.startBtn, opacity: subject ? 1 : 0.5, cursor: subject ? 'pointer' : 'not-allowed' }}>
              🎯 Start Focus Mode Exam
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── GENERATING phase ──
  if (phase === 'generating') {
    return (
      <div style={f.shell}>
        <header style={f.nav}>
          <button onClick={onBack} style={f.backBtn}>← Back</button>
          <span style={f.navTitle}>Focus Mode Quiz</span>
          <div style={{ width: 80 }} />
        </header>
        <div style={f.center}>
          <div style={f.genBox}>
            <div style={f.spinner} className="spin" />
            <p style={f.genTitle}>Preparing your exam…</p>
            <p style={f.genSub}>{getQuestionCount(duration, difficulty)} {difficulty.toLowerCase()} questions — <strong>{subject}</strong></p>
          </div>
        </div>
      </div>
    );
  }

  // ── REPORT phase ──
  if (phase === 'report') {
    return (
      <FocusReport
        quizScore={score}
        totalQuestions={total}
        integrityScore={integrityRef.current.getScore()}
        warnings={integrityRef.current.getWarnings()}
        subject={subject}
        difficulty={difficulty}
        duration={duration}
        timeTaken={timeTaken}
        terminated={terminated}
        onNewQuiz={() => {
          tabDetachRef.current?.();
          setPhase('setup');
          setQuestions([]);
          setSelected([]);
          setCurrent(0);
          setAnswered(false);
          integrityRef.current = createIntegrityEngine();
          setWarnings([]);
          setLatestWarn(null);
          setTerminated(false);
        }}
        onBack={onBack}
      />
    );
  }

  // ── ACTIVE phase ──
  const q = questions[current];
  const chosenIdx = selected[current];
  const timerPct = (timeLeft / (duration * 60)) * 100;
  const timerColor = timeLeft < 60 ? '#ef4444' : timeLeft < duration * 30 ? '#f59e0b' : '#00D4FF';
  const warnCount = warnings.length;

  return (
    <div style={f.shell}>
      {/* Nav */}
      <header style={f.nav}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={f.focusBadge}>👁 FOCUS MODE</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-h)', fontWeight: 600 }}>{subject}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ ...f.timerBadge, color: timerColor, borderColor: `${timerColor}44`, background: `${timerColor}11` }}>
            ⏱ {formatTime(timeLeft)}
          </span>
          <WarningSystem
            warnings={warnings}
            latestWarning={latestWarn}
            onDismiss={() => setLatestWarn(null)}
            terminated={terminated}
            onTerminationAcknowledge={() => {
              tabDetachRef.current?.();
              if (timerRef.current) clearInterval(timerRef.current);
              setTimeTaken(Math.round((Date.now() - startTimeRef.current) / 1000));
              setPhase('report');
            }}
            quizScore={score}
            totalQuestions={total}
          />
        </div>
      </header>

      {/* Timer bar */}
      <div style={{ height: '3px', background: 'var(--border)' }}>
        <div style={{ height: '100%', width: `${timerPct}%`, background: timerColor, transition: 'width 1s linear, background 0.5s' }} />
      </div>

      {/* Integrity color strip */}
      <div style={{ height: '2px', background: warnCount === 0 ? '#10b981' : warnCount < 3 ? '#f59e0b' : '#ef4444', transition: 'background 0.5s' }} />

      <main style={f.activeMain}>
        {/* Left: quiz */}
        <div style={f.quizArea}>
          {q && (
            <div style={f.quizCard}>
              <div style={f.progressRow}>
                <span style={f.progressLabel}>Q {current + 1}/{total}</span>
                <div style={f.progressTrack}>
                  <div style={{ ...f.progressFill, width: `${((current + 1) / total) * 100}%` }} />
                </div>
                <span style={{ ...f.diffBadge, background: DIFFICULTIES.find(d => d.value === difficulty)!.color + '22', color: DIFFICULTIES.find(d => d.value === difficulty)!.color }}>
                  {difficulty}
                </span>
              </div>
              <p style={f.questionText}>{q.question}</p>
              <div style={f.optionsGrid}>
                {q.options.map((opt, i) => {
                  let bg = 'var(--bg-surface)';
                  let border = 'var(--border)';
                  let color = 'var(--text-h)';
                  if (answered) {
                    if (i === q.correct)                   { bg = 'rgba(16,185,129,0.12)'; border = '#10b981'; color = '#10b981'; }
                    else if (i === chosenIdx)              { bg = 'rgba(239,68,68,0.1)';   border = '#ef4444'; color = '#ef4444'; }
                  } else if (i === chosenIdx) {
                    bg = 'rgba(0,212,255,0.1)'; border = '#00D4FF'; color = '#00D4FF';
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => pick(i)}
                      disabled={answered || terminated}
                      style={{ ...f.optionBtn, background: bg, border: `1.5px solid ${border}`, color, cursor: answered || terminated ? 'default' : 'pointer' }}
                    >
                      <span style={f.optionLetter}>{String.fromCharCode(65 + i)}</span>
                      <span style={{ flex: 1 }}>{opt}</span>
                      {answered && i === q.correct && <span style={{ marginLeft: 'auto' }}>✓</span>}
                      {answered && i === chosenIdx && i !== q.correct && <span style={{ marginLeft: 'auto' }}>✗</span>}
                    </button>
                  );
                })}
              </div>
              {!terminated && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
                  <button onClick={endSession} style={f.endBtn}>End Exam</button>
                  <button onClick={next} disabled={!answered} style={{ ...f.nextBtn, opacity: answered ? 1 : 0.4, cursor: answered ? 'pointer' : 'default' }}>
                    {current + 1 === total ? 'Submit Exam' : t('quiz_next')} →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: monitor */}
        <div style={f.monitorArea}>
          <IntegrityMonitor
            stream={cameraStream}
            demoMode={demoMode}
            sessionActive={true}
            onMetrics={handleMetrics}
          />

          {/* Integrity pulse */}
          <div style={{ ...f.integrityPulse, borderColor: warnCount === 0 ? 'rgba(16,185,129,0.3)' : warnCount < 3 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)', background: warnCount === 0 ? 'rgba(16,185,129,0.06)' : warnCount < 3 ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-h)' }}>Session Integrity</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 900, color: warnCount === 0 ? '#10b981' : warnCount < 3 ? '#f59e0b' : '#ef4444' }}>
                {integrityRef.current.getScore()}%
              </span>
            </div>
            <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '99px', width: `${integrityRef.current.getScore()}%`, background: warnCount === 0 ? '#10b981' : warnCount < 3 ? '#f59e0b' : '#ef4444', transition: 'width 0.5s' }} />
            </div>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.65rem', color: 'var(--text)' }}>
              {warnCount === 0 ? '✅ Clean session' : `${warnCount}/${MAX_WARNINGS} warnings — ${MAX_WARNINGS - warnCount} remaining`}
            </p>
          </div>

          {demoMode && (
            <div style={f.demoNotice}>Demo Mode — camera simulation active</div>
          )}
        </div>
      </main>
    </div>
  );
}

const f: Record<string, React.CSSProperties> = {
  shell:   { minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  nav:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.25rem', height: '52px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 50, flexShrink: 0 },
  navTitle:{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-h)' },
  backBtn: { padding: '0.35rem 0.8rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-h)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  demoBadge:{ padding: '0.2rem 0.6rem', borderRadius: '99px', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', color: '#a78bfa', fontSize: '0.7rem', fontWeight: 700 },
  permBadge:{ padding: '0.2rem 0.6rem', borderRadius: '99px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', fontSize: '0.7rem', fontWeight: 700 },
  focusBadge:{ padding: '0.22rem 0.7rem', borderRadius: '99px', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)', color: '#00D4FF', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em' },
  timerBadge:{ padding: '0.28rem 0.7rem', borderRadius: '99px', fontSize: '0.82rem', fontWeight: 700, border: '1px solid', fontVariantNumeric: 'tabular-nums' as const },
  center:  { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' },
  main:    { flex: 1, padding: '2rem 1.5rem 3rem', maxWidth: '700px', width: '100%', margin: '0 auto', boxSizing: 'border-box' as const },
  activeMain:{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 260px', gap: '1.25rem', padding: '1.25rem', maxWidth: '1100px', width: '100%', margin: '0 auto', boxSizing: 'border-box' as const, alignItems: 'start' },
  quizArea:  { display: 'flex', flexDirection: 'column', gap: '1rem' },
  monitorArea:{ display: 'flex', flexDirection: 'column', gap: '0.85rem', position: 'sticky' as const, top: '60px' },

  // Permission card
  permCard: { background: 'var(--bg-surface)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '24px', padding: '2.5rem', maxWidth: '480px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', textAlign: 'center' as const },
  permIcon: { fontSize: '3rem' },
  permTitle:{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-h)' },
  permSub:  { margin: 0, fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.65 },
  permFeats:{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', width: '100%', textAlign: 'left' as const },
  errorBox: { padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#ef4444', fontSize: '0.83rem', width: '100%', boxSizing: 'border-box' as const },
  primaryBtn:{ width: '100%', padding: '0.85rem', borderRadius: '12px', background: 'linear-gradient(135deg,#00D4FF,#7C3AED)', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' },
  demoBtn:   { background: 'none', border: 'none', color: 'var(--text)', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' },

  // Setup
  configCard: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '18px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  cardHead:   { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  cardTitle:  { margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-h)' },
  cardSub:    { margin: 0, fontSize: '0.75rem', color: 'var(--text)' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  label:      { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  chipRow:    { display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem' },
  chip:       { padding: '0.45rem 0.95rem', borderRadius: '99px', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.15s' },
  diffBtn:    { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  warningNotice: { display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.85rem 1rem', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px' },
  startBtn:   { padding: '0.9rem', borderRadius: '12px', background: 'linear-gradient(135deg,#00D4FF,#7C3AED)', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.01em', transition: 'opacity 0.15s' },

  // Generating
  genBox:    { textAlign: 'center' as const, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' },
  spinner:   { width: '48px', height: '48px', border: '4px solid var(--border)', borderTop: '4px solid #00D4FF', borderRadius: '50%' },
  genTitle:  { margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-h)' },
  genSub:    { margin: 0, fontSize: '0.85rem', color: 'var(--text)', maxWidth: '320px' },

  // Active quiz
  quizCard:     { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '18px', padding: '1.75rem' },
  progressRow:  { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' },
  progressLabel:{ fontSize: '0.78rem', color: 'var(--text)', flexShrink: 0, fontWeight: 500 },
  progressTrack:{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg,#00D4FF,#7C3AED)', borderRadius: '99px', transition: 'width 0.4s' },
  diffBadge:    { padding: '0.2rem 0.65rem', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 },
  questionText: { fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-h)', lineHeight: 1.55, margin: '0 0 1.25rem' },
  optionsGrid:  { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  optionBtn:    { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderRadius: '12px', fontFamily: 'inherit', fontSize: '0.88rem', textAlign: 'left' as const, transition: 'all 0.15s', width: '100%' },
  optionLetter: { width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 },
  nextBtn:      { padding: '0.7rem 1.4rem', borderRadius: '10px', background: 'linear-gradient(135deg,#00D4FF,#7C3AED)', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.15s' },
  endBtn:       { padding: '0.6rem 1rem', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' },
  integrityPulse: { border: '1px solid', borderRadius: '12px', padding: '0.85rem 0.95rem', transition: 'border-color 0.4s, background 0.4s' },
  demoNotice:   { textAlign: 'center' as const, fontSize: '0.68rem', color: 'var(--text)', padding: '0.4rem', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: '8px' },
};

const fp: Record<string, React.CSSProperties> = {
  feat: { display: 'flex', alignItems: 'flex-start', gap: '0.65rem', padding: '0.7rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px' },
  featLabel: { margin: '0 0 0.15rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-h)' },
  featDesc:  { margin: 0, fontSize: '0.68rem', color: 'var(--text)', lineHeight: 1.4 },
};

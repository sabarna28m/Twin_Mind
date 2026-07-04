import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Lightbulb, Clock } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import api from '../../services/api';

// ── Types ─────────────────────────────────────────────────────────────
interface Question {
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
}

interface HistoryItem {
  id: number;
  subject: string;
  duration_minutes: number;
  difficulty: string;
  score: number;
  total: number;
  percentage: number;
  time_taken: number;
  created_at: string;
}

type Phase = 'setup' | 'generating' | 'quiz' | 'results';
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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

interface Props {
  onBack: () => void;
}

export default function PracticeQuiz({ onBack }: Props) {
  const { token } = useAuth();
  const { t } = useLanguage();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const themeClass = isDark ? 'assessment-dark' : 'assessment-light';

  const [subjects, setSubjects]         = useState<string[]>([]);
  const [subject, setSubject]           = useState('');
  const [duration, setDuration]         = useState<number>(10);
  const [difficulty, setDifficulty]     = useState<Difficulty>('Medium');
  const [history, setHistory]           = useState<HistoryItem[]>([]);
  const [histLoading, setHistLoading]   = useState(true);

  const [phase, setPhase]               = useState<Phase>('setup');
  const [questions, setQuestions]       = useState<Question[]>([]);
  const [current, setCurrent]           = useState(0);
  const [selected, setSelected]         = useState<(number | null)[]>([]);
  const [answered, setAnswered]         = useState(false);
  const [timeLeft, setTimeLeft]         = useState(0);
  const [timeTaken, setTimeTaken]       = useState(0);
  const [error, setError]               = useState('');
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    api.get<{ subjects: string[] }>('/student-profile')
      .then(r => {
        const subs = r.data.subjects ?? [];
        setSubjects(subs);
        if (subs.length > 0) setSubject(subs[0]);
      })
      .catch(() => {});

    api.get<HistoryItem[]>('/quiz/history')
      .then(r => setHistory(r.data))
      .catch(() => {})
      .finally(() => setHistLoading(false));
  }, [token]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback((totalSeconds: number) => {
    stopTimer();
    setTimeLeft(totalSeconds);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          stopTimer();
          setTimeTaken(totalSeconds);
          setPhase('results');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopTimer]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  async function generate() {
    if (!subject) return;
    setError('');
    setPhase('generating');
    try {
      const res = await api.post<{ questions: Question[]; total: number }>('/quiz/generate', {
        subject, duration_minutes: duration, difficulty,
      });
      const qs = res.data.questions;
      setQuestions(qs);
      setSelected(new Array(qs.length).fill(null));
      setCurrent(0);
      setAnswered(false);
      startTimer(duration * 60);
      setPhase('quiz');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to generate quiz. Try again.';
      setError(msg);
      setPhase('setup');
    }
  }

  function pick(idx: number) {
    if (answered) return;
    setSelected(prev => { const n = [...prev]; n[current] = idx; return n; });
    setAnswered(true);
  }

  function next() {
    if (current + 1 >= questions.length) {
      stopTimer();
      setTimeTaken(Math.round((Date.now() - startTimeRef.current) / 1000));
      setPhase('results');
    } else {
      setCurrent(c => c + 1);
      setAnswered(selected[current + 1] !== null);
    }
  }

  async function submitResults() {
    try {
      await api.post('/quiz/submit', {
        subject, duration_minutes: duration, difficulty,
        questions, user_answers: selected, time_taken: timeTaken,
      });
      const r = await api.get<HistoryItem[]>('/quiz/history');
      setHistory(r.data);
    } catch { /* saved on next load */ }
  }

  useEffect(() => {
    if (phase === 'results') submitResults();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const score   = selected.filter((a, i) => a !== null && a === questions[i]?.correct).length;
  const total   = questions.length;
  const pct     = total > 0 ? Math.round((score / total) * 100) : 0;
  const skipped = selected.filter(a => a === null).length;
  const wrong   = total - score - skipped;

  function reset() {
    stopTimer();
    setPhase('setup');
    setQuestions([]);
    setSelected([]);
    setCurrent(0);
    setAnswered(false);
    setError('');
  }

  if (phase === 'generating') {
    return (
      <div className={themeClass} style={p.shell}>
        <header style={p.nav}>
          <button onClick={onBack} style={p.backBtn}>← Back</button>
          <span style={p.navTitle}>Practice Quiz</span>
          <div style={{ width: 80 }} />
        </header>
        <div style={p.center}>
          <div style={p.genBox}>
            <div style={p.spinner} className="spin" />
            <p style={p.genTitle}>Generating your quiz…</p>
            <p style={p.genSub}>
              {t('quiz_generating')} {getQuestionCount(duration, difficulty)} {difficulty.toLowerCase()} — <strong>{subject}</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'quiz') {
    const q = questions[current];
    const chosenIdx = selected[current];
    const timerPct = (timeLeft / (duration * 60)) * 100;
    const timerColor = timeLeft < 60 ? '#ef4444' : timeLeft < duration * 30 ? '#f59e0b' : '#6366f1';

    return (
      <div className={themeClass} style={p.shell}>
        <header style={p.nav}>
          <div style={p.navLeft}><span style={{ ...p.modeBadge, display:'flex', alignItems:'center', gap:4 }}><BookOpen size={12} style={{ flexShrink:0 }} /> Practice</span></div>
          <span style={p.navTitle}>{subject}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ ...p.timerBadge, color: timerColor, borderColor: `${timerColor}44`, background: `${timerColor}11` }}>
              <Clock size={12} style={{ display:'inline', marginRight:2, verticalAlign:'middle' }} />{formatTime(timeLeft)}
            </span>
          </div>
        </header>
        <div style={{ height: '3px', background: 'var(--border)' }}>
          <div style={{ height: '100%', width: `${timerPct}%`, background: timerColor, transition: 'width 1s linear, background 0.5s' }} />
        </div>
        <main style={p.main}>
          <div style={p.quizCard}>
            <div style={p.progressRow}>
              <span style={p.progressLabel}>Question {current + 1} of {total}</span>
              <div style={p.progressTrack}>
                <div style={{ ...p.progressFill, width: `${((current + 1) / total) * 100}%` }} />
              </div>
              <span style={{ ...p.diffBadge, background: DIFFICULTIES.find(d => d.value === difficulty)!.color + '22', color: DIFFICULTIES.find(d => d.value === difficulty)!.color }}>
                {difficulty}
              </span>
            </div>
            <p style={p.questionText}>{q.question}</p>
            <div style={p.optionsGrid}>
              {q.options.map((opt, i) => {
                let bg = 'var(--bg-surface)';
                let border = 'var(--border)';
                let color = 'var(--text-h)';
                if (answered) {
                  if (i === q.correct)                   { bg = 'rgba(16,185,129,0.12)'; border = '#10b981'; color = '#10b981'; }
                  else if (i === chosenIdx)              { bg = 'rgba(239,68,68,0.1)';   border = '#ef4444'; color = '#ef4444'; }
                } else if (i === chosenIdx) {
                  bg = 'rgba(99,102,241,0.12)'; border = '#6366f1'; color = '#818cf8';
                }
                return (
                  <button key={i} onClick={() => pick(i)} disabled={answered} style={{ ...p.optionBtn, background: bg, border: `1.5px solid ${border}`, color, cursor: answered ? 'default' : 'pointer' }}>
                    <span style={p.optionLetter}>{String.fromCharCode(65 + i)}</span>
                    <span style={p.optionText}>{opt}</span>
                    {answered && i === q.correct          && <span style={{ marginLeft: 'auto' }}>✓</span>}
                    {answered && i === chosenIdx && i !== q.correct && <span style={{ marginLeft: 'auto' }}>✗</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={next} disabled={!answered} style={{ ...p.nextBtn, opacity: answered ? 1 : 0.4, cursor: answered ? 'pointer' : 'default' }}>
                {current + 1 === total ? t('quiz_finish') : t('quiz_next')} →
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (phase === 'results') {
    const grade = pct >= 90 ? 'Excellent!' : pct >= 75 ? 'Great job!' : pct >= 60 ? 'Good effort!' : pct >= 40 ? 'Keep practicing!' : 'Needs more work';
    const gradeColor = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
    return (
      <div className={themeClass} style={p.shell}>
        <header style={p.nav}>
          <button onClick={onBack} style={p.backBtn}>← Back</button>
          <span style={p.navTitle}>Quiz Results</span>
          <button onClick={reset} style={p.retakeBtn}>{t('quiz_take_another')}</button>
        </header>
        <main style={p.main}>
          <div style={{ ...p.quizCard, textAlign: 'center' as const }}>
            <div style={{ ...p.scoreBig, color: gradeColor }}>{pct}%</div>
            <p style={{ ...p.gradeLabel, color: gradeColor }}>{grade}</p>
            <p style={p.scoreSub}>{subject} · {difficulty} · {total} questions</p>
            <div style={p.statsRow}>
              <div style={p.statItem}><span style={{ ...p.statNum, color: '#10b981' }}>{score}</span><span style={p.statLbl}>{t('quiz_correct')}</span></div>
              <div style={p.statItem}><span style={{ ...p.statNum, color: '#ef4444' }}>{wrong}</span><span style={p.statLbl}>{t('quiz_wrong')}</span></div>
              <div style={p.statItem}><span style={{ ...p.statNum, color: 'var(--text)' }}>{skipped}</span><span style={p.statLbl}>{t('quiz_skipped')}</span></div>
              <div style={p.statItem}><span style={{ ...p.statNum, color: '#818cf8' }}>{formatTime(timeTaken)}</span><span style={p.statLbl}>{t('quiz_time')}</span></div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
              <button onClick={reset} style={p.nextBtn}>{t('quiz_take_another_btn')}</button>
              <button onClick={onBack} style={{ ...p.nextBtn, background: 'var(--bg-surface)', color: 'var(--text-h)', border: '1px solid var(--border)' }}>← Change Mode</button>
              <Link to="/dashboard" style={{ ...p.nextBtn, background: 'var(--bg-surface)', color: 'var(--text-h)', border: '1px solid var(--border)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Dashboard</Link>
            </div>
          </div>
          <div style={p.reviewSection}>
            <h2 style={p.reviewTitle}>{t('quiz_review')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {questions.map((q, qi) => {
                const ua = selected[qi];
                const isCorrect = ua === q.correct;
                const isSkipped = ua === null;
                const statusColor = isSkipped ? 'var(--text)' : isCorrect ? '#10b981' : '#ef4444';
                const statusIcon  = isSkipped ? '–' : isCorrect ? '✓' : '✗';
                return (
                  <div key={qi} style={{ ...p.reviewCard, borderColor: `${statusColor}44` }}>
                    <div style={p.reviewHeader}>
                      <span style={{ ...p.reviewNum, background: `${statusColor}22`, color: statusColor }}>{statusIcon} Q{qi + 1}</span>
                      <p style={p.reviewQ}>{q.question}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.75rem' }}>
                      {q.options.map((opt, oi) => {
                        const isCorrectOpt = oi === q.correct;
                        const isUserOpt    = oi === ua;
                        let bg     = 'transparent';
                        let border = 'transparent';
                        let color  = 'var(--text)';
                        if (isCorrectOpt)                    { bg = 'rgba(16,185,129,0.1)'; border = '#10b981'; color = '#10b981'; }
                        else if (isUserOpt && !isCorrectOpt) { bg = 'rgba(239,68,68,0.08)'; border = '#ef4444'; color = '#ef4444'; }
                        return (
                          <div key={oi} style={{ ...p.reviewOpt, background: bg, border: `1px solid ${border}`, color }}>
                            <span style={p.reviewLetter}>{String.fromCharCode(65 + oi)}</span>
                            {opt}
                            {isCorrectOpt && <span style={{ marginLeft: 'auto', fontWeight: 700 }}>✓ Correct</span>}
                            {isUserOpt && !isCorrectOpt && <span style={{ marginLeft: 'auto', fontWeight: 700 }}>Your answer</span>}
                          </div>
                        );
                      })}
                    </div>
                    {!isCorrect && q.explanation && (
                      <div style={p.explanationBox}>
                        <Lightbulb size={16} style={{ color:'#f59e0b', flexShrink:0 }} />
                        <p style={p.explanationText}>{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Setup phase
  return (
    <div className={themeClass} style={p.shell}>
      <header style={p.nav}>
        <button onClick={onBack} style={p.backBtn}>← Back</button>
        <span style={p.navTitle}>{t('quiz_title')} — Practice Mode</span>
        <div style={{ width: 80 }} />
      </header>
      <main style={p.main}>
        <div style={p.setupGrid}>
          <div style={p.configCard}>
            <div style={p.cardHead}>
              <BookOpen size={22} style={{ color:'var(--accent)', flexShrink:0 }} />
              <div>
                <h2 style={p.cardTitle}>Configure Practice Quiz</h2>
                <p style={p.cardSub}>{t('quiz_powered')}</p>
              </div>
            </div>
            {error && <div style={p.errorBox}>{error}</div>}
            <div style={p.fieldGroup}>
              <label style={p.label}>{t('quiz_subject')}</label>
              {subjects.length > 0 ? (
                <div style={p.chipRow}>
                  {subjects.map(s => (
                    <button key={s} onClick={() => setSubject(s)} style={{ ...p.chip, background: subject === s ? 'rgba(99,102,241,0.15)' : 'var(--bg-surface)', border: `1.5px solid ${subject === s ? '#6366f1' : 'var(--border)'}`, color: subject === s ? '#818cf8' : 'var(--text-h)' }}>
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <p style={p.noProfile}>{t('quiz_no_subjects')} <Link to="/profile" style={{ color: '#818cf8' }}>{t('quiz_add_subjects')}</Link></p>
              )}
            </div>
            <div style={p.fieldGroup}>
              <label style={p.label}>{t('quiz_duration')}</label>
              <div style={p.chipRow}>
                {DURATIONS.map(d => (
                  <button key={d.value} onClick={() => setDuration(d.value)} style={{ ...p.chip, flexDirection: 'column' as const, gap: '0.1rem', padding: '0.55rem 1.1rem', background: duration === d.value ? 'rgba(99,102,241,0.15)' : 'var(--bg-surface)', border: `1.5px solid ${duration === d.value ? '#6366f1' : 'var(--border)'}`, color: duration === d.value ? '#818cf8' : 'var(--text-h)' }}>
                    <span style={{ fontWeight: 700 }}>{d.label}</span>
                    <span style={{ fontSize: '0.68rem', opacity: 0.7 }}>{getQuestionCount(d.value, difficulty)} questions</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={p.fieldGroup}>
              <label style={p.label}>{t('quiz_difficulty')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {DIFFICULTIES.map(d => (
                  <button key={d.value} onClick={() => setDifficulty(d.value)} style={{ ...p.diffBtn, background: difficulty === d.value ? `${d.color}14` : 'var(--bg-surface)', border: `1.5px solid ${difficulty === d.value ? d.color : 'var(--border)'}` }}>
                    <div style={{ ...p.diffDot, background: d.color }} />
                    <div style={{ textAlign: 'left' as const }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem', color: difficulty === d.value ? d.color : 'var(--text-h)' }}>{d.value}</p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text)' }}>{d.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={generate} disabled={!subject || subjects.length === 0} style={{ ...p.generateBtn, opacity: subject ? 1 : 0.5, cursor: subject ? 'pointer' : 'not-allowed' }}>
              {t('quiz_generate')}
            </button>
          </div>
          <div style={p.histCard}>
            <h2 style={p.histTitle}>{t('quiz_history')}</h2>
            {histLoading ? <p style={p.histEmpty}>Loading…</p> : history.length === 0 ? <p style={p.histEmpty}>{t('quiz_no_history')}</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {history.map(h => {
                  const col = h.percentage >= 75 ? '#10b981' : h.percentage >= 50 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={h.id} style={p.histItem}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <p style={p.histSubject}>{h.subject}</p>
                          <p style={p.histMeta}>{h.difficulty} · {h.duration_minutes} min · {timeAgo(h.created_at)}</p>
                        </div>
                        <div style={{ textAlign: 'right' as const }}>
                          <p style={{ ...p.histScore, color: col }}>{h.percentage}%</p>
                          <p style={p.histMeta}>{h.score}/{h.total}</p>
                        </div>
                      </div>
                      <div style={p.histBar}><div style={{ ...p.histBarFill, width: `${h.percentage}%`, background: col }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

const p: Record<string, React.CSSProperties> = {
  shell:    { minHeight: '100svh', display: 'flex', flexDirection: 'column', background: '#f8f9fa' },
  nav:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', height: '56px', borderBottom: '1px solid var(--border)', background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 50 },
  navLeft:  { display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 100 },
  navTitle: { fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-h)' },
  backBtn:  { padding: '0.35rem 0.8rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-h)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  modeBadge:{ padding: '0.22rem 0.7rem', borderRadius: '99px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', fontSize: '0.72rem', fontWeight: 700 },
  main:     { flex: 1, padding: '2rem 1.5rem 3rem', maxWidth: '960px', width: '100%', margin: '0 auto', boxSizing: 'border-box' as const },
  setupGrid:  { display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' },
  configCard: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.04)', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  cardHead:   { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  cardIcon:   { fontSize: '2rem', lineHeight: 1 },
  cardTitle:  { margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-h)' },
  cardSub:    { margin: 0, fontSize: '0.75rem', color: 'var(--text)' },
  errorBox:   { padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#ef4444', fontSize: '0.83rem' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  label:      { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  chipRow:    { display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem' },
  chip:       { padding: '0.45rem 0.95rem', borderRadius: '99px', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.15s' },
  noProfile:  { fontSize: '0.83rem', color: 'var(--text)', margin: 0 },
  diffBtn:    { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  diffDot:    { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  generateBtn:{ padding: '0.9rem', borderRadius: '12px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.01em', transition: 'opacity 0.15s' },
  histCard:    { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.04)', padding: '1.5rem', maxHeight: '640px', overflowY: 'auto' as const },
  histTitle:   { margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-h)' },
  histEmpty:   { color: 'var(--text)', fontSize: '0.83rem', margin: 0 },
  histItem:    { background: '#f8f9fa', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  histSubject: { margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-h)' },
  histMeta:    { margin: 0, fontSize: '0.72rem', color: 'var(--text)' },
  histScore:   { margin: 0, fontSize: '1.1rem', fontWeight: 800 },
  histBar:     { height: '4px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' },
  histBarFill: { height: '100%', borderRadius: '99px', transition: 'width 0.6s' },
  center:    { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  genBox:    { textAlign: 'center' as const, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' },
  spinner:   { width: '48px', height: '48px', border: '4px solid var(--border)', borderTop: '4px solid #6366f1', borderRadius: '50%' },
  genTitle:  { margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-h)' },
  genSub:    { margin: 0, fontSize: '0.85rem', color: 'var(--text)', maxWidth: '320px' },
  quizCard:     { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.04)', padding: '2rem' },
  progressRow:  { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' },
  progressLabel:{ fontSize: '0.78rem', color: 'var(--text)', flexShrink: 0, fontWeight: 500 },
  progressTrack:{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: '99px', transition: 'width 0.4s' },
  diffBadge:    { padding: '0.2rem 0.65rem', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 },
  questionText: { fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-h)', lineHeight: 1.55, margin: '0 0 1.5rem' },
  optionsGrid:  { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  optionBtn:    { display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', borderRadius: '12px', fontFamily: 'inherit', fontSize: '0.9rem', textAlign: 'left' as const, transition: 'all 0.15s', width: '100%' },
  optionLetter: { width: '26px', height: '26px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 },
  optionText:   { flex: 1 },
  nextBtn:      { padding: '0.75rem 1.5rem', borderRadius: '10px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.15s' },
  timerBadge:   { padding: '0.28rem 0.7rem', borderRadius: '99px', fontSize: '0.82rem', fontWeight: 700, border: '1px solid', fontVariantNumeric: 'tabular-nums' as const },
  scoreBig:     { fontSize: '4rem', fontWeight: 900, lineHeight: 1, marginBottom: '0.25rem' },
  gradeLabel:   { fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.4rem' },
  scoreSub:     { fontSize: '0.82rem', color: 'var(--text)', margin: '0 0 1.5rem' },
  statsRow:     { display: 'flex', justifyContent: 'center', gap: '2rem' },
  statItem:     { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' },
  statNum:      { fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 },
  statLbl:      { fontSize: '0.72rem', color: 'var(--text)', fontWeight: 500 },
  retakeBtn:    { padding: '0.42rem 0.9rem', borderRadius: '8px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' },
  reviewSection:{ marginTop: '1.5rem' },
  reviewTitle:  { fontSize: '1rem', fontWeight: 700, color: 'var(--text-h)', margin: '0 0 1rem' },
  reviewCard:   { background: 'var(--bg-surface)', border: '1px solid', borderRadius: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)', padding: '1.1rem 1.25rem' },
  reviewHeader: { display: 'flex', alignItems: 'flex-start', gap: '0.75rem' },
  reviewNum:    { padding: '0.2rem 0.55rem', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0, marginTop: '2px' },
  reviewQ:      { margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-h)', lineHeight: 1.5 },
  reviewOpt:    { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.82rem' },
  reviewLetter: { width: '20px', height: '20px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 700, flexShrink: 0 },
  explanationBox: { display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginTop: '0.65rem', padding: '0.65rem 0.85rem', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px' },
  explanationIcon:{ fontSize: '0.9rem', flexShrink: 0, marginTop: '1px' },
  explanationText:{ margin: 0, fontSize: '0.8rem', color: 'var(--text-h)', lineHeight: 1.55 },
};

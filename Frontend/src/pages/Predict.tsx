import { useCallback, useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveBadge from '../components/LiveBadge';

interface LearningEntry {
  study_hours: number; attendance_percentage: number;
  assignment_completion_rate: number; quiz_scores: number | null;
  stress_level: number; sleep_duration: number;
}

interface PredictionResult {
  predicted_score: number;
  risk_level: 'low' | 'medium' | 'high';
  risk_label: string;
  confidence_range: [number, number];
  recommendations: string[];
  feature_contributions: Record<string, number>;
  feature_importance: Record<string, number>;
}

const RISK_COLORS = { low: '#16a34a', medium: '#d97706', high: '#dc2626' };
const RISK_BG    = { low: 'rgba(34,197,94,0.1)', medium: 'rgba(217,119,6,0.1)', high: 'rgba(239,68,68,0.1)' };
const RISK_BORDER = { low: 'rgba(34,197,94,0.4)', medium: 'rgba(217,119,6,0.4)', high: 'rgba(239,68,68,0.4)' };

const FEATURE_LABELS: Record<string, string> = {
  study_hours: 'Study hours',
  attendance: 'Attendance',
  assignment_completion: 'Assignment completion',
  quiz_scores: 'Quiz performance',
  sleep: 'Sleep quality',
  stress: 'Stress management',
};

function ScoreGauge({ score }: { score: number }) {
  const angle = (score / 100) * 180 - 90; // -90 to +90 degrees
  const color = score >= 70 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  return (
    <div style={g.wrap}>
      <svg viewBox="0 0 200 110" style={g.svg}>
        {/* Track arc */}
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--border)" strokeWidth="14" strokeLinecap="round" />
        {/* Value arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${score * 2.51} 251`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        {/* Needle */}
        <line
          x1="100" y1="100"
          x2={100 + 65 * Math.cos((angle - 90) * Math.PI / 180)}
          y2={100 + 65 * Math.sin((angle - 90) * Math.PI / 180)}
          stroke={color} strokeWidth="3" strokeLinecap="round"
        />
        <circle cx="100" cy="100" r="5" fill={color} />
        {/* Labels */}
        <text x="18"  y="115" style={g.axisText}>0</text>
        <text x="90"  y="25"  style={g.axisText}>50</text>
        <text x="175" y="115" style={g.axisText}>100</text>
      </svg>
      <p style={{ ...g.scoreText, color }}>{score}</p>
      <p style={g.scoreLabel}>predicted exam score</p>
    </div>
  );
}

const g: Record<string, React.CSSProperties> = {
  wrap: { textAlign: 'center' },
  svg: { width: '180px', height: '100px' },
  axisText: { fontSize: '11px', fill: 'var(--text)', fontFamily: 'inherit' } as React.CSSProperties,
  scoreText: { margin: '0.25rem 0 0', fontSize: '2.5rem', fontWeight: 700, lineHeight: 1 },
  scoreLabel: { margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
};

export default function Predict() {
  const { user, token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [studyHours,  setStudyHours]  = useState('');
  const [attendance,  setAttendance]  = useState('');
  const [completion,  setCompletion]  = useState('');
  const [quizScore,   setQuizScore]   = useState('');
  const [sleep,       setSleep]       = useState('');
  const [stress,      setStress]      = useState(0);
  const [prefilled,   setPrefilled]   = useState(false);

  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<PredictionResult | null>(null);
  const [error,    setError]    = useState('');

  const prefillFromLatest = useCallback(() => {
    api.get<LearningEntry[]>('/learning-data?limit=1', { headers })
      .then(r => {
        if (r.data.length > 0) {
          const e = r.data[0];
          setStudyHours(String(e.study_hours));
          setAttendance(String(e.attendance_percentage));
          setCompletion(String(e.assignment_completion_rate));
          setQuizScore(e.quiz_scores != null ? String(e.quiz_scores) : '');
          setSleep(String(e.sleep_duration));
          setStress(e.stress_level);
          setPrefilled(true);
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => { prefillFromLatest(); }, [prefillFromLatest]);

  const wsConnected = useWebSocket(user?.id, token, prefillFromLatest);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stress) { setError('Please select a stress level.'); return; }
    setError(''); setLoading(true); setResult(null);
    try {
      const { data } = await api.post<PredictionResult>('/predict', {
        study_hours: parseFloat(studyHours),
        attendance_percentage: parseFloat(attendance),
        assignment_completion_rate: parseFloat(completion),
        quiz_scores: quizScore !== '' ? parseFloat(quizScore) : null,
        stress_level: stress,
        sleep_duration: parseFloat(sleep),
      }, { headers });
      setResult(data);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Prediction failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  }

  const maxContrib = result ? Math.max(...Object.values(result.feature_contributions)) : 1;
  const sortedImportance = result
    ? Object.entries(result.feature_importance).sort(([, a], [, b]) => b - a)
    : [];

  return (
    <div style={s.shell}>
      <header style={s.nav}>
        <div style={s.navLeft}>
          <Link to="/" style={s.navLogo}>TwinMind</Link>
          {wsConnected && <LiveBadge />}
        </div>
        <Link to="/" style={s.backLink}>← Dashboard</Link>
      </header>

      <main style={s.main}>
        <h1 style={s.pageTitle}>Predict Exam Score</h1>
        <p style={s.subtitle}>Enter your learning stats and TwinMind will predict your likely exam result.</p>

        <div style={result ? s.layout2 : s.layout1}>
          {/* ── Input form ──────────────────────────────────────── */}
          <section style={s.formCard}>
            {prefilled && <p style={s.prefillNote}>Pre-filled from your latest check-in</p>}
            {error && <p style={s.errorMsg}>{error}</p>}

            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.row2}>
                <label style={s.label}>
                  Study Hours
                  <input type="number" value={studyHours} onChange={e => setStudyHours(e.target.value)}
                    style={s.input} min={0} max={24} step={0.5} placeholder="e.g. 4" required />
                </label>
                <label style={s.label}>
                  Sleep (hrs)
                  <input type="number" value={sleep} onChange={e => setSleep(e.target.value)}
                    style={s.input} min={0} max={24} step={0.5} placeholder="e.g. 7" required />
                </label>
              </div>
              <div style={s.row2}>
                <label style={s.label}>
                  Attendance (%)
                  <input type="number" value={attendance} onChange={e => setAttendance(e.target.value)}
                    style={s.input} min={0} max={100} step={1} placeholder="e.g. 85" required />
                </label>
                <label style={s.label}>
                  Assignment Completion (%)
                  <input type="number" value={completion} onChange={e => setCompletion(e.target.value)}
                    style={s.input} min={0} max={100} step={1} placeholder="e.g. 90" required />
                </label>
              </div>
              <label style={s.label}>
                Quiz Score (%) <span style={s.optional}>optional — leave blank to estimate</span>
                <input type="number" value={quizScore} onChange={e => setQuizScore(e.target.value)}
                  style={s.input} min={0} max={100} step={0.5} placeholder="—" />
              </label>

              <div>
                <p style={s.stressLabel}>
                  Stress Level
                  {stress > 0 && <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: stress >= 8 ? '#dc2626' : stress >= 5 ? '#d97706' : '#16a34a' }}>{stress}/10</span>}
                </p>
                <div style={s.stressRow}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                    <button key={n} type="button" onClick={() => setStress(n)} style={{
                      ...s.stressBtn,
                      background: stress === n ? (n >= 8 ? '#dc2626' : n >= 5 ? '#d97706' : '#16a34a') : 'var(--bg)',
                      color: stress === n ? '#fff' : 'var(--text-h)',
                      borderColor: stress === n ? (n >= 8 ? '#dc2626' : n >= 5 ? '#d97706' : '#16a34a') : 'var(--border)',
                    }}>{n}</button>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={loading} style={s.submitBtn}>
                {loading ? 'Predicting…' : 'Predict my score →'}
              </button>
            </form>
          </section>

          {/* ── Result panel ────────────────────────────────────── */}
          {result && (
            <div style={s.resultCol}>
              {/* Score gauge */}
              <section style={s.panel}>
                <ScoreGauge score={result.predicted_score} />
                <p style={{ ...s.confRange, marginTop: '0.5rem' }}>
                  Confidence range: {result.confidence_range[0]}–{result.confidence_range[1]}
                </p>
                <div style={{
                  ...s.riskBadge,
                  background: RISK_BG[result.risk_level],
                  border: `1px solid ${RISK_BORDER[result.risk_level]}`,
                  color: RISK_COLORS[result.risk_level],
                }}>
                  {result.risk_level.toUpperCase()} RISK &nbsp;·&nbsp; {result.risk_label}
                </div>
              </section>

              {/* XGBoost Feature Importance */}
              <section style={s.panel}>
                <div style={s.panelHeader}>
                  <h2 style={s.panelTitle}>Feature Importance</h2>
                  <span style={s.xgbBadge}>XGBoost</span>
                </div>
                <p style={s.importanceDesc}>How much each factor influences the model's prediction (% of total importance)</p>
                <div style={s.barList}>
                  {sortedImportance.map(([key, pct], idx) => {
                    const barColor = idx === 0 ? '#6366f1' : idx === 1 ? '#8b5cf6' : idx === 2 ? '#06b6d4' : 'var(--accent)';
                    return (
                      <div key={key} style={s.barRow}>
                        <span style={s.barLabel}>{FEATURE_LABELS[key] ?? key}</span>
                        <div style={s.barTrack}>
                          <div style={{ ...s.barFill, width: `${pct}%`, background: barColor }} />
                        </div>
                        <span style={s.barPct}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Recommendations */}
              <section style={s.panel}>
                <h2 style={{ ...s.panelTitle, marginBottom: '1rem' }}>Recommendations</h2>
                <ul style={s.recList}>
                  {result.recommendations.map((rec, i) => (
                    <li key={i} style={s.recItem}>
                      <span style={s.recBullet}>→</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 2rem', height: '60px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10,
  },
  navLeft:  { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  navLogo: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px', textDecoration: 'none' },
  backLink: { fontSize: '0.875rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 },
  main: { flex: 1, padding: '2rem', maxWidth: '960px', width: '100%', margin: '0 auto', boxSizing: 'border-box', textAlign: 'left' },
  pageTitle: { margin: '0 0 0.375rem', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-h)' },
  subtitle: { margin: '0 0 1.5rem', color: 'var(--text)', fontSize: '0.9rem' },

  layout1: { display: 'grid', gridTemplateColumns: '1fr' },
  layout2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' },

  formCard: { border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', background: 'var(--bg)' },
  prefillNote: { margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 500 },
  errorMsg: {
    margin: '0 0 1rem', padding: '0.5rem 0.75rem',
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)',
    borderRadius: '8px', color: '#dc2626', fontSize: '0.875rem',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)' },
  optional: { fontWeight: 400, fontSize: '0.75rem' },
  input: { padding: '0.55rem 0.75rem', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.95rem', color: 'var(--text-h)', background: 'var(--bg)', outline: 'none' },
  stressLabel: { margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center' },
  stressRow: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap' as const },
  stressBtn: { width: '34px', height: '34px', borderRadius: '7px', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit' },
  submitBtn: { padding: '0.65rem 1.5rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' },

  resultCol: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  panel: { border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem', background: 'var(--bg)' },
  panelTitle: { margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-h)' },

  confRange: { margin: 0, fontSize: '0.78rem', color: 'var(--text)', textAlign: 'center' as const },
  riskBadge: { marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center' as const },

  panelHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' },
  xgbBadge: {
    fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em',
    padding: '0.2rem 0.55rem', borderRadius: '99px',
    background: 'rgba(99,102,241,0.15)', color: '#818cf8',
    border: '1px solid rgba(99,102,241,0.35)',
  },
  importanceDesc: { margin: '0 0 0.9rem', fontSize: '0.75rem', color: 'var(--text)' },
  barList: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  barRow: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  barLabel: { width: '150px', fontSize: '0.78rem', color: 'var(--text-h)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  barTrack: { flex: 1, height: '8px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '99px', transition: 'width 0.6s ease' },
  barPct: { width: '38px', fontSize: '0.75rem', color: 'var(--text)', textAlign: 'right' as const, flexShrink: 0 },

  recList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  recItem: { display: 'flex', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-h)', lineHeight: '1.4', alignItems: 'flex-start' },
  recBullet: { color: 'var(--accent)', fontWeight: 700, flexShrink: 0, marginTop: '0.05rem' },
};

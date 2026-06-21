import { useEffect, useState, useRef, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveBadge from '../components/LiveBadge';
import BackButton from '../components/BackButton';

interface SimParams {
  study_hours: number;
  attendance_percentage: number;
  assignment_completion_rate: number;
  quiz_scores: number | null;
  stress_level: number;
  sleep_duration: number;
}

interface PredDetail {
  predicted_score: number;
  risk_level: 'low' | 'medium' | 'high';
  risk_label: string;
  confidence_range: [number, number];
  recommendations: string[];
  feature_contributions: Record<string, number>;
}

interface SimResult {
  current: PredDetail;
  hypothetical: PredDetail;
  delta: number;
  improvement_pct: number;
  is_improvement: boolean;
}

const DEFAULTS: SimParams = {
  study_hours: 4,
  attendance_percentage: 80,
  assignment_completion_rate: 75,
  quiz_scores: null,
  stress_level: 5,
  sleep_duration: 7,
};

const RISK_COLOR = { low: '#16a34a', medium: '#d97706', high: '#dc2626' };
const RISK_BG    = { low: 'rgba(34,197,94,0.1)', medium: 'rgba(217,119,6,0.1)', high: 'rgba(239,68,68,0.1)' };

const FEATURE_LABELS: Record<string, string> = {
  study_hours: 'Study hours',
  attendance: 'Attendance',
  assignment_completion: 'Assignments',
  quiz_scores: 'Quiz score',
  sleep: 'Sleep',
  stress: 'Stress control',
};

function ScoreBadge({ label, detail, dim }: { label: string; detail: PredDetail; dim?: boolean }) {
  const color = RISK_COLOR[detail.risk_level];
  return (
    <div style={{ ...sc.scoreCard, opacity: dim ? 0.55 : 1 }}>
      <p style={sc.scoreCardLabel}>{label}</p>
      <p style={{ ...sc.scoreNum, color }}>{detail.predicted_score}</p>
      <p style={sc.scoreRange}>
        {detail.confidence_range[0]}–{detail.confidence_range[1]}
      </p>
      <div style={{ ...sc.riskPill, background: RISK_BG[detail.risk_level], color }}>
        {detail.risk_level.toUpperCase()}
      </div>
    </div>
  );
}

function DeltaBadge({ delta, pct }: { delta: number; pct: number }) {
  const up = delta >= 0;
  const color  = up ? '#16a34a' : '#dc2626';
  const bg     = up ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';
  const border = up ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)';
  const sign   = up ? '+' : '';
  return (
    <div style={{ ...sc.delta, background: bg, border: `1px solid ${border}`, color }}>
      <span style={sc.deltaNum}>{sign}{delta} pts</span>
      <span style={sc.deltaPct}>{sign}{pct}%</span>
    </div>
  );
}

function SliderRow({
  label, value, min, max, step, unit, onChange, color,
}: {
  label: string; value: number; min: number; max: number;
  step: number; unit: string; onChange: (v: number) => void; color?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={sc.sliderRow}>
      <div style={sc.sliderHeader}>
        <span style={sc.sliderLabel}>{label}</span>
        <span style={{ ...sc.sliderVal, color: color ?? 'var(--accent)' }}>
          {value}{unit}
        </span>
      </div>
      <div style={sc.sliderTrackWrap}>
        <div style={{ ...sc.sliderFill, width: `${pct}%`, background: color ?? 'var(--accent)' }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={sc.sliderInput}
        />
      </div>
      <div style={sc.sliderBounds}>
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

export default function Simulate() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const headers = { Authorization: `Bearer ${token}` };
  // No auto-refresh on checkin_update — would reset the user's slider state
  const wsConnected = useWebSocket(user?.id, token, () => {});

  const [current,     setCurrent]     = useState<SimParams>(DEFAULTS);
  const [hypothetical, setHypo]       = useState<SimParams>(DEFAULTS);
  const [result,       setResult]     = useState<SimResult | null>(null);
  const [loading,      setLoading]    = useState(false);
  const [hasData,      setHasData]    = useState(false);
  const [error,        setError]      = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load latest check-in data
  useEffect(() => {
    api.get<SimParams[]>('/learning-data?limit=1', { headers })
      .then(r => {
        if (r.data.length > 0) {
          const e = r.data[0];
          const params: SimParams = {
            study_hours: e.study_hours,
            attendance_percentage: e.attendance_percentage,
            assignment_completion_rate: e.assignment_completion_rate,
            quiz_scores: e.quiz_scores ?? null,
            stress_level: e.stress_level,
            sleep_duration: e.sleep_duration,
          };
          setCurrent(params);
          setHypo(params);
          setHasData(true);
        }
      })
      .catch(() => {});
  }, []);

  const runSim = useCallback(async (curr: SimParams, hypo: SimParams) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post<SimResult>('/simulate', {
        current: curr,
        hypothetical: hypo,
      }, { headers });
      setResult(data);
    } catch {
      setError('Simulation failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Debounced auto-run on any param change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSim(current, hypothetical), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [current, hypothetical, runSim]);

  function updateHypo(field: keyof SimParams, value: number | null) {
    setHypo(prev => ({ ...prev, [field]: value }));
  }

  const stressColor = (v: number) => v >= 8 ? '#dc2626' : v >= 5 ? '#d97706' : '#16a34a';

  return (
    <div style={sc.shell}>
      <header style={sc.nav}>
        <div style={sc.navLeft}>
          <BackButton />
          <Link to="/" style={sc.navLogo}>TwinMind</Link>
          {wsConnected && <LiveBadge />}
        </div>
        <nav style={sc.navRight}>
          <Link to="/predict" style={sc.navLink}>{t('nav_predict')}</Link>
        </nav>
      </header>

      <main style={sc.main}>
        <h1 style={sc.pageTitle}>{t('simulate_title')}</h1>
        <p style={sc.subtitle}>
          {hasData ? t('simulate_subtitle') : t('simulate_subtitle_nodata')}
        </p>

        {error && <p style={sc.errorMsg}>{error}</p>}

        <div style={sc.layout}>
          {/* ── Slider panel ─────────────────────────────────── */}
          <section style={sc.card}>
            <h2 style={sc.cardTitle}>{t('simulate_hypothetical')}</h2>
            <p style={sc.cardSub}>{t('simulate_card_hint')}</p>

            <SliderRow
              label={t('simulate_study_day')} value={hypothetical.study_hours}
              min={0} max={12} step={0.5} unit="h"
              onChange={v => updateHypo('study_hours', v)}
            />
            <SliderRow
              label={t('simulate_attendance')} value={hypothetical.attendance_percentage}
              min={40} max={100} step={1} unit="%"
              onChange={v => updateHypo('attendance_percentage', v)}
            />
            <SliderRow
              label={t('simulate_completion')} value={hypothetical.assignment_completion_rate}
              min={0} max={100} step={1} unit="%"
              onChange={v => updateHypo('assignment_completion_rate', v)}
            />
            <SliderRow
              label={t('simulate_sleep_h')} value={hypothetical.sleep_duration}
              min={3} max={11} step={0.5} unit="h"
              onChange={v => updateHypo('sleep_duration', v)}
            />
            <SliderRow
              label={t('simulate_stress')} value={hypothetical.stress_level}
              min={1} max={10} step={1} unit="/10"
              color={stressColor(hypothetical.stress_level)}
              onChange={v => updateHypo('stress_level', v)}
            />
            <SliderRow
              label={t('simulate_quiz')} value={hypothetical.quiz_scores ?? 0}
              min={0} max={100} step={1} unit="%"
              onChange={v => updateHypo('quiz_scores', v === 0 ? null : v)}
            />

            {/* Reset button */}
            <button
              onClick={() => setHypo(current)}
              style={sc.resetBtn}
            >
              {t('simulate_reset')}
            </button>
          </section>

          {/* ── Results panel ────────────────────────────────── */}
          <div style={sc.resultCol}>
            {/* Score comparison */}
            <section style={sc.card}>
              <h2 style={sc.cardTitle}>{t('simulate_score_compare')}</h2>
              {loading && !result && <p style={sc.loadingMsg}>{t('simulate_running')}</p>}
              {result && (
                <>
                  <div style={sc.scoreRow}>
                    <ScoreBadge label={t('simulate_current')} detail={result.current} />
                    <div style={sc.arrow}>→</div>
                    <ScoreBadge label={t('simulate_whatif')} detail={result.hypothetical} />
                  </div>
                  <div style={sc.deltaRow}>
                    <DeltaBadge delta={result.delta} pct={result.improvement_pct} />
                    {loading && <span style={sc.updatingText}>updating…</span>}
                  </div>
                  <p style={sc.riskLabel}>
                    {result.hypothetical.risk_label}
                  </p>
                </>
              )}
            </section>

            {/* Feature contributions comparison */}
            {result && (
              <section style={sc.card}>
                <h2 style={sc.cardTitle}>{t('simulate_impact_break')}</h2>
                <p style={sc.cardSub}>{t('simulate_impact_desc')}</p>
                <div style={sc.barList}>
                  {Object.entries(result.hypothetical.feature_contributions).map(([key, hypoVal]) => {
                    const currVal = result.current.feature_contributions[key] ?? 0;
                    const maxPossible = key === 'study_hours' ? 30 : key === 'attendance' || key === 'assignment_completion' ? 20 : key === 'quiz_scores' ? 15 : key === 'sleep' ? 10 : 5;
                    const improved = hypoVal > currVal;
                    return (
                      <div key={key} style={sc.barRow}>
                        <span style={sc.barLabel}>{FEATURE_LABELS[key] ?? key}</span>
                        <div style={sc.barTrackWrap}>
                          {/* Current bar (ghost) */}
                          <div style={{ ...sc.barTrack, position: 'relative' as const }}>
                            <div style={{ ...sc.barFillGhost, width: `${(currVal / maxPossible) * 100}%` }} />
                            <div style={{
                              ...sc.barFillMain,
                              width: `${(hypoVal / maxPossible) * 100}%`,
                              background: improved ? '#16a34a' : '#dc2626',
                            }} />
                          </div>
                        </div>
                        <span style={{
                          ...sc.barVal,
                          color: improved ? '#16a34a' : hypoVal < currVal ? '#dc2626' : 'var(--text)',
                        }}>
                          {hypoVal > currVal ? '+' : ''}{Math.round((hypoVal - currVal) * 10) / 10}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Recommendations */}
            {result && (
              <section style={sc.card}>
                <h2 style={sc.cardTitle}>{t('simulate_whatif_recs')}</h2>
                <ul style={sc.recList}>
                  {result.hypothetical.recommendations.map((rec, i) => (
                    <li key={i} style={sc.recItem}>
                      <span style={sc.recBullet}>→</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

const sc: Record<string, React.CSSProperties> = {
  shell:   { minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 2rem', height: '60px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10,
  },
  navLeft:  { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  navLogo:  { fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px', textDecoration: 'none' },
  navRight: { display: 'flex', alignItems: 'center', gap: '1.25rem' },
  navLink:  { fontSize: '0.875rem', color: 'var(--text)', textDecoration: 'none', fontWeight: 500 },
  backLink: { fontSize: '0.875rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 },

  main:      { flex: 1, padding: '2rem', maxWidth: '1040px', width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  pageTitle: { margin: '0 0 0.375rem', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-h)' },
  subtitle:  { margin: '0 0 1.5rem', color: 'var(--text)', fontSize: '0.9rem' },
  errorMsg:  {
    margin: '0 0 1rem', padding: '0.5rem 0.75rem',
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)',
    borderRadius: '8px', color: '#dc2626', fontSize: '0.875rem',
  },

  layout:    { display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem', alignItems: 'start' },
  card:      { border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem', background: 'var(--bg)' },
  cardTitle: { margin: '0 0 0.2rem', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-h)' },
  cardSub:   { margin: '0 0 1.2rem', fontSize: '0.78rem', color: 'var(--text)' },

  resultCol: { display: 'flex', flexDirection: 'column', gap: '1rem' },

  // Slider
  sliderRow:       { marginBottom: '1rem' },
  sliderHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' },
  sliderLabel:     { fontSize: '0.82rem', fontWeight: 500, color: 'var(--text)' },
  sliderVal:       { fontSize: '0.85rem', fontWeight: 700, minWidth: '48px', textAlign: 'right' as const },
  sliderTrackWrap: { position: 'relative' as const, height: '6px', background: 'var(--border)', borderRadius: '99px', marginBottom: '0.2rem' },
  sliderFill:      { position: 'absolute' as const, top: 0, left: 0, height: '100%', borderRadius: '99px', pointerEvents: 'none' as const },
  sliderInput:     {
    position: 'absolute' as const, top: '-5px', left: 0, width: '100%', height: '16px',
    opacity: 0, cursor: 'pointer', margin: 0, padding: 0,
  },
  sliderBounds: { display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text)', marginTop: '0.1rem' },

  resetBtn: {
    marginTop: '0.5rem', padding: '0.45rem 1rem',
    background: 'transparent', border: '1px solid var(--border)',
    borderRadius: '7px', fontSize: '0.8rem', color: 'var(--text)',
    cursor: 'pointer', fontFamily: 'inherit',
  },

  // Score comparison
  scoreRow:    { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' },
  scoreCard:   {
    flex: 1, textAlign: 'center' as const,
    border: '1px solid var(--border)', borderRadius: '10px', padding: '0.875rem 0.5rem',
  },
  scoreCardLabel: { margin: '0 0 0.25rem', fontSize: '0.72rem', textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: 'var(--text)', fontWeight: 600 },
  scoreNum:    { margin: '0 0 0.2rem', fontSize: '2.25rem', fontWeight: 700, lineHeight: 1 },
  scoreRange:  { margin: '0 0 0.4rem', fontSize: '0.72rem', color: 'var(--text)' },
  riskPill:    { display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 700, margin: '0 auto' },
  arrow:       { fontSize: '1.25rem', color: 'var(--text)', flexShrink: 0 },

  deltaRow:    { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' },
  delta:       { display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.4rem 0.9rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700 },
  deltaNum:    { fontSize: '1rem', fontWeight: 700 },
  deltaPct:    { fontSize: '0.82rem', fontWeight: 600 },
  updatingText: { fontSize: '0.75rem', color: 'var(--text)', fontStyle: 'italic' },
  riskLabel:   { margin: 0, fontSize: '0.8rem', color: 'var(--text)', fontStyle: 'italic' },
  loadingMsg:  { color: 'var(--text)', fontSize: '0.875rem', textAlign: 'center' as const, padding: '1.5rem 0' },

  // Impact breakdown
  barList: { display: 'flex', flexDirection: 'column', gap: '0.7rem' },
  barRow:  { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  barLabel: { width: '120px', fontSize: '0.78rem', color: 'var(--text-h)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  barTrackWrap: { flex: 1 },
  barTrack: { height: '8px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden', position: 'relative' as const },
  barFillGhost: { position: 'absolute' as const, top: 0, left: 0, height: '100%', background: 'var(--accent)', opacity: 0.25, borderRadius: '99px', transition: 'width 0.4s' },
  barFillMain:  { position: 'absolute' as const, top: 0, left: 0, height: '100%', borderRadius: '99px', transition: 'width 0.4s, background 0.3s' },
  barVal: { width: '40px', fontSize: '0.75rem', textAlign: 'right' as const, flexShrink: 0, fontWeight: 600 },

  // Recommendations
  recList:   { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  recItem:   { display: 'flex', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-h)', lineHeight: '1.4', alignItems: 'flex-start' },
  recBullet: { color: 'var(--accent)', fontWeight: 700, flexShrink: 0, marginTop: '0.05rem' },
};

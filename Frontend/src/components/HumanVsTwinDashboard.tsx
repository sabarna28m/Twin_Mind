import { useEffect, useState } from 'react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────

interface MetricComparison {
  actual: number; predicted: number; accuracy: number;
  unit: string; label: string; better_than_predicted: boolean; diff: number;
}
interface PredictionEvent {
  date: string; metric: string; predicted: number; actual: number;
  accuracy: number; unit: string; description: string;
}
interface WeeklyAccuracy { week_label: string; accuracy: number; data_points: number; }
interface ChartPoint    { date: string; actual: number; predicted: number; }

interface ComparisonData {
  has_sufficient_data: boolean; data_points: number;
  study_hours: MetricComparison; quiz_score: MetricComparison | null;
  focus_sessions: MetricComparison; notes_created: MetricComparison;
  consistency: MetricComparison; knowledge_growth: MetricComparison;
  twin_accuracy_score: number; accuracy_delta: number | null;
  ai_insights: string[]; prediction_history: PredictionEvent[];
  accuracy_trend: WeeklyAccuracy[];
  learning_status: string; learning_status_label: string; learning_status_detail: string;
  exceeded_predictions: string[]; missed_predictions: string[];
  twin_incorrect_assumptions: string[]; newly_learned_patterns: string[];
  prediction_confidence: number; confidence_factors: string[];
  study_hours_series: ChartPoint[]; quiz_score_series: ChartPoint[];
  focus_sessions_series: ChartPoint[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

const accColor = (a: number) => a >= 80 ? '#10b981' : a >= 60 ? '#f59e0b' : '#ef4444';
const accBg    = (a: number) => a >= 80 ? 'rgba(16,185,129,0.1)' : a >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
const diffStr  = (m: MetricComparison) =>
  m.diff === 0 ? '=' : `${m.diff > 0 ? '+' : ''}${Math.abs(m.diff) < 1 && m.unit === 'h' ? m.diff.toFixed(1) : Math.round(m.diff)}${m.unit}`;

// ── Custom tooltip for prediction charts ──────────────────────────────────

function PredTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const actual    = payload.find(p => p.name === 'actual');
  const predicted = payload.find(p => p.name === 'predicted');
  if (!actual || !predicted) return null;
  const acc = Math.max(0, Math.min(100, 100 - Math.abs(actual.value - predicted.value) / Math.max(actual.value, predicted.value, 1) * 100));
  return (
    <div style={{ background: 'rgba(8,13,26,0.97)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '12px', padding: '0.75rem 0.9rem', minWidth: '160px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', fontWeight: 700, color: '#818cf8' }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#475569' }}>You (actual)</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: actual.color }}>{actual.value}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#475569' }}>Twin predicted</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: predicted.color }}>{predicted.value}</span>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.3rem', marginTop: '0.1rem', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.68rem', color: '#475569' }}>Accuracy</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: accColor(acc) }}>{acc.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

// ── Accuracy trend tooltip ────────────────────────────────────────────────

function TrendTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const acc = payload[0].value;
  return (
    <div style={{ background: 'rgba(8,13,26,0.97)', border: `1px solid ${accColor(acc)}40`, borderRadius: '10px', padding: '0.6rem 0.8rem', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
      <p style={{ margin: '0 0 0.25rem', fontSize: '0.7rem', color: '#475569' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: accColor(acc) }}>Accuracy: {acc.toFixed(0)}%</p>
    </div>
  );
}

// ── Metric comparison card ────────────────────────────────────────────────

function MetricCard({ m, icon }: { m: MetricComparison; icon: string }) {
  const c = accColor(m.accuracy);
  const better = m.better_than_predicted;
  return (
    <div style={{ background: '#f8f9fa', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
      {/* Label row */}
      <div style={{ padding: '0.6rem 0.9rem 0.35rem', display: 'flex', alignItems: 'center', gap: '0.45rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize: '0.9rem' }}>{icon}</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{m.label}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.62rem', fontWeight: 700, padding: '0.12rem 0.5rem', borderRadius: '99px', background: accBg(m.accuracy), color: c, border: `1px solid ${c}30` }}>
          {m.accuracy.toFixed(0)}% match
        </span>
      </div>
      {/* Value columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr' }}>
        {/* Actual */}
        <div style={{ padding: '0.75rem 0.9rem' }}>
          <p style={{ margin: '0 0 0.15rem', fontSize: '0.6rem', fontWeight: 700, color: '#00D4FF', textTransform: 'uppercase', letterSpacing: '0.07em' }}>You</p>
          <p style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
            {m.actual % 1 === 0 ? m.actual : m.actual.toFixed(1)}
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#475569', marginLeft: '0.2rem' }}>{m.unit}</span>
          </p>
        </div>
        {/* Divider */}
        <div style={{ background: '#f8f9fa' }} />
        {/* Predicted */}
        <div style={{ padding: '0.75rem 0.9rem', position: 'relative' }}>
          <p style={{ margin: '0 0 0.15rem', fontSize: '0.6rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Twin</p>
          <p style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#64748b', lineHeight: 1 }}>
            {m.predicted % 1 === 0 ? m.predicted : m.predicted.toFixed(1)}
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#334155', marginLeft: '0.2rem' }}>{m.unit}</span>
          </p>
          {/* Delta badge */}
          <span style={{
            position: 'absolute', top: '0.6rem', right: '0.7rem',
            fontSize: '0.65rem', fontWeight: 800,
            color: better ? '#10b981' : '#ef4444',
          }}>
            {diffStr(m)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────

export default function HumanVsTwinDashboard() {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const glassStyle = {
    boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(0, 212, 255, 0.08)',
    background: isDark
      ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(124, 58, 237, 0.1) 100%), rgba(15, 23, 42, 0.65)'
      : 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(124, 58, 237, 0.15) 100%), rgba(255, 255, 255, 0.55)',
    backdropFilter: 'blur(24px) saturate(150%)', WebkitBackdropFilter: 'blur(24px) saturate(150%)',
    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255, 255, 255, 0.5)',
  };

  const [data,    setData]    = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<'study' | 'quiz' | 'sessions'>('study');

  useEffect(() => {
    api.get<ComparisonData>('/twin/comparison')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const card: React.CSSProperties = {
    ...glassStyle,
    borderRadius: '24px', padding: '1.5rem',
  };
  const fullWidth: React.CSSProperties = { gridColumn: '1 / -1' };
  const sectionTitle: React.CSSProperties = {
    margin: '0 0 0.25rem', fontSize: '0.95rem', fontWeight: 700,
    color: '#0f172a', letterSpacing: '-0.1px',
  };
  const sectionSub: React.CSSProperties = {
    margin: '0 0 1.1rem', fontSize: '0.72rem', color: '#475569',
  };

  if (loading) return (
    <div style={{ ...card, gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '36px', height: '36px', margin: '0 auto 0.75rem', border: '3px solid rgba(99,102,241,0.2)', borderTop: '3px solid #818cf8', borderRadius: '50%' }} className="spin" />
        <p style={{ color: '#475569', fontSize: '0.85rem', margin: 0 }}>Loading Human vs Twin analysis…</p>
      </div>
    </div>
  );

  if (!data || !data.has_sufficient_data) return (
    <div style={{ ...card, gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
      <p style={{ fontSize: '2.5rem', margin: '0 0 0.75rem' }}></p>
      <p style={{ margin: '0 0 0.4rem', fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>Activating Human vs Twin Analysis</p>
      <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: '#475569', lineHeight: 1.6, maxWidth: '360px', marginLeft: 'auto', marginRight: 'auto' }}>
        {data?.data_points === 1
          ? 'One more check-in needed — the Twin needs at least 2 data points to start comparing predictions with reality.'
          : 'Log your first check-in to give the Digital Twin its initial data for behavioral modeling.'}
      </p>
      <a href="/checkin" style={{ display: 'inline-block', padding: '0.6rem 1.5rem', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700 }}>
        Log Check-in →
      </a>
    </div>
  );

  const chartData = tab === 'study' ? data.study_hours_series
    : tab === 'quiz' ? data.quiz_score_series
    : data.focus_sessions_series;

  const chartLabel = tab === 'study' ? 'Study Hours' : tab === 'quiz' ? 'Quiz Accuracy (%)' : 'Focus Sessions';
  const actualColor = tab === 'study' ? '#00D4FF' : tab === 'quiz' ? '#10b981' : '#8b5cf6';
  const predColor   = '#475569';

  const deltaColor = data.accuracy_delta !== null
    ? (data.accuracy_delta > 0 ? '#10b981' : '#ef4444') : '#475569';

  const metrics: { m: MetricComparison; icon: string }[] = [
    { m: data.study_hours,    icon: 'TM' },
    { m: data.focus_sessions, icon: '' },
    { m: data.consistency,    icon: '' },
    { m: data.knowledge_growth, icon: '' },
    { m: data.notes_created,  icon: '' },
    ...(data.quiz_score ? [{ m: data.quiz_score, icon: '' }] : []),
  ];

  return (
    <>
      {/* ── 1. Status + Accuracy header ── */}
      <div className="synth-hover-card" style={{ ...card, ...fullWidth }}>
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.15rem' }}></span>
          <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Human vs Digital Twin Analysis</h3>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '99px', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: '#00D4FF', marginLeft: 'auto' }}>
            Live · {data.data_points} data pts
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem' }} className="mob-mid-row">
          {/* Twin Accuracy Score */}
          <div style={{ padding: '1.1rem', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '24px' }}>
            <p style={{ margin: '0 0 0.2rem', fontSize: '0.62rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Twin Accuracy Score</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{ fontSize: '2.4rem', fontWeight: 900, color: accColor(data.twin_accuracy_score), lineHeight: 1 }}>
                {Math.round(data.twin_accuracy_score)}
              </span>
              <span style={{ fontSize: '0.9rem', color: '#475569' }}>/ 100</span>
              {data.accuracy_delta !== null && (
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: deltaColor }}>
                  {data.accuracy_delta > 0 ? '+' : ''}{data.accuracy_delta.toFixed(0)}
                </span>
              )}
            </div>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.68rem', color: '#475569', lineHeight: 1.4 }}>
              The Twin accurately predicted {Math.round(data.twin_accuracy_score)}% of your learning behavior.
            </p>
          </div>

          {/* Learning Status */}
          <div style={{ padding: '1.1rem', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '24px' }}>
            <p style={{ margin: '0 0 0.4rem', fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Twin Learning Status</p>
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {data.learning_status_label}
            </p>
            <p style={{ margin: 0, fontSize: '0.68rem', color: '#475569', lineHeight: 1.5 }}>{data.learning_status_detail}</p>
          </div>

          {/* Confidence */}
          <div style={{ padding: '1.1rem', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: '24px' }}>
            <p style={{ margin: '0 0 0.2rem', fontSize: '0.62rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Prediction Confidence</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '2.4rem', fontWeight: 900, color: '#10b981', lineHeight: 1 }}>{Math.round(data.prediction_confidence)}</span>
              <span style={{ fontSize: '0.85rem', color: '#475569' }}>%</span>
            </div>
            <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden', marginBottom: '0.4rem' }}>
              <div style={{ width: `${data.prediction_confidence}%`, height: '100%', background: '#10b981', borderRadius: '99px', transition: 'width 1s ease' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              {data.confidence_factors.map((f, i) => (
                <span key={i} style={{ fontSize: '0.62rem', color: '#475569' }}>{f}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Side-by-side metric comparison cards ── */}
      <div className="synth-hover-card" style={{ ...card, ...fullWidth }}>
        <p style={sectionTitle}>Side-by-Side Comparison</p>
        <p style={sectionSub}>Your actual behavior vs what the Digital Twin predicted. The "match" score shows how accurate the prediction was.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }} className="mob-mid-row">
          {metrics.map(({ m, icon }) => (
            <MetricCard key={m.label} m={m} icon={icon} />
          ))}
        </div>
        {/* Column labels */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.68rem', color: '#00D4FF' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00D4FF', display: 'inline-block' }} />
            You (actual behavior)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.68rem', color: '#818cf8' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#818cf8', display: 'inline-block' }} />
            Twin (predicted behavior)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.68rem', color: '#10b981' }}>
            <span style={{ width: '24px', height: '3px', background: 'linear-gradient(90deg,#ef4444,#10b981)', display: 'inline-block', borderRadius: '99px' }} />
            Accuracy: &lt;60% red · 60–79% amber · ≥80% green
          </span>
        </div>
      </div>

      {/* ── 3. Prediction vs Reality charts ── */}
      <div className="synth-hover-card" style={{ ...card, ...fullWidth }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.6rem' }}>
          <div>
            <p style={sectionTitle}>Prediction vs Reality</p>
            <p style={{ ...sectionSub, marginBottom: 0 }}>Solid = you (actual), dashed = Twin (predicted). Hover for accuracy per point.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.3rem', background: 'rgba(255,255,255,0.04)', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '3px' }}>
            {(['study', 'quiz', 'sessions'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '0.28rem 0.7rem', borderRadius: '7px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: tab === t ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent', background: tab === t ? 'rgba(99,102,241,0.18)' : 'transparent', color: tab === t ? '#818cf8' : '#475569', transition: 'all 0.15s' }}>
                {t === 'study' ? 'Study Hrs' : t === 'quiz' ? 'Quiz Score' : 'Sessions'}
              </button>
            ))}
          </div>
        </div>

        {chartData.length < 2 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#475569', fontSize: '0.82rem' }}>
            {tab === 'quiz' ? 'Complete at least 2 quizzes to see the prediction chart.' : 'Log more check-ins to see the prediction vs reality chart.'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 16, bottom: 5, left: -18 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false}
                tickFormatter={d => { const p = d.split('-'); return p.length === 3 ? `${p[1]}/${p[2]}` : d; }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<PredTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.07)' }} />
              <Legend formatter={(val) => val === 'actual' ? 'You (actual)' : 'Twin (predicted)'}
                wrapperStyle={{ fontSize: '0.7rem', color: '#475569' }} />
              <Line type="monotone" dataKey="actual" name="actual" stroke={actualColor} strokeWidth={2.5}
                dot={{ fill: actualColor, r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="predicted" name="predicted" stroke={predColor} strokeWidth={1.8}
                strokeDasharray="5 3" dot={{ fill: predColor, r: 2, strokeWidth: 0 }} activeDot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 4. Accuracy trend + AI Insights (side by side) ── */}
      <div style={{ ...fullWidth, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }} className="mob-twin-row">

        {/* Accuracy Trend */}
        <div className="synth-hover-card" style={card}>
          <p style={sectionTitle}>Accuracy Trend</p>
          <p style={sectionSub}>How the Twin's prediction accuracy has improved over time.</p>
          {data.accuracy_trend.length < 2 ? (
            <p style={{ color: '#475569', fontSize: '0.82rem' }}>More data needed to show the accuracy trend.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={data.accuracy_trend} margin={{ top: 5, right: 8, bottom: 0, left: -22 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="week_label" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.07)' }} />
                <ReferenceLine y={80} stroke="#10b981" strokeDasharray="4 3" strokeOpacity={0.4}
                  label={{ value: '80%', fill: '#10b981', fontSize: 8, position: 'right' }} />
                <Bar dataKey="accuracy" fill="rgba(99,102,241,0.4)" radius={[4,4,0,0]}
                  label={{ position: 'top', fontSize: 8, fill: '#818cf8', formatter: (v: number) => `${Math.round(v)}%` }} />
                <Line type="monotone" dataKey="accuracy" stroke="#818cf8" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
          {/* Week labels */}
          {data.accuracy_trend.length >= 2 && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
              {data.accuracy_trend.map((w, i) => (
                <span key={i} style={{ fontSize: '0.62rem', padding: '0.12rem 0.5rem', borderRadius: '99px', background: accBg(w.accuracy), color: accColor(w.accuracy), border: `1px solid ${accColor(w.accuracy)}30` }}>
                  {w.week_label}: {w.accuracy.toFixed(0)}%
                </span>
              ))}
            </div>
          )}
        </div>

        {/* AI Insights */}
        <div className="synth-hover-card" style={card}>
          <p style={sectionTitle}>AI Insights</p>
          <p style={sectionSub}>Observations generated from comparing actual behavior with Twin predictions.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {data.ai_insights.map((insight, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.6rem', padding: '0.75rem', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.14)', borderRadius: '12px' }}>
                <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '1px' }}>
                  {i === 0 ? '' : i === 1 ? '' : i === 2 ? '' : i === 3 ? '' : ''}
                </span>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.6 }}>{insight}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 5. Prediction History Timeline ── */}
      {data.prediction_history.length > 0 && (
        <div className="synth-hover-card" style={{ ...card, ...fullWidth }}>
          <p style={sectionTitle}>Prediction History Timeline</p>
          <p style={sectionSub}>Notable events where the Twin's predictions diverged significantly from your actual behavior.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {data.prediction_history.map((ev, i) => {
              const c = accColor(ev.accuracy);
              const better = ev.actual > ev.predicted;
              return (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', paddingBottom: i < data.prediction_history.length - 1 ? '0.85rem' : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: `${c}15`, border: `1px solid ${c}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0 }}>
                      {better ? '' : ''}
                    </div>
                    {i < data.prediction_history.length - 1 && <div style={{ width: '1px', flex: 1, background: '#f8f9fa', marginTop: '4px' }} />}
                  </div>
                  <div style={{ paddingTop: '4px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#818cf8' }}>{ev.date}</span>
                      <span style={{ fontSize: '0.62rem', padding: '0.1rem 0.45rem', borderRadius: '99px', background: `${c}15`, color: c, border: `1px solid ${c}25` }}>{ev.metric}</span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: c, marginLeft: 'auto' }}>{ev.accuracy.toFixed(0)}% accurate</span>
                    </div>
                    <p style={{ margin: '0 0 0.25rem', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>{ev.description}</p>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.65rem' }}>
                      <span style={{ color: '#00D4FF' }}>Actual: <strong>{ev.actual}{ev.unit}</strong></span>
                      <span style={{ color: '#818cf8' }}>Predicted: <strong>{ev.predicted}{ev.unit}</strong></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 6. Difference Analysis ── */}
      {(data.exceeded_predictions.length + data.missed_predictions.length + data.twin_incorrect_assumptions.length + data.newly_learned_patterns.length) > 0 && (
        <div className="synth-hover-card" style={{ ...card, ...fullWidth }}>
          <p style={sectionTitle}>Difference Analysis</p>
          <p style={sectionSub}>Where you outperformed the Twin's model, where you fell short, incorrect assumptions, and what the Twin has recently learned.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.75rem' }} className="mob-twin-row">
            {[
              { title: 'You Exceeded Predictions', items: data.exceeded_predictions, color: '#10b981' },
              { title: 'Missed Predictions',       items: data.missed_predictions,   color: '#f59e0b' },
              { title: "Twin's Incorrect Assumptions", items: data.twin_incorrect_assumptions, color: '#ef4444' },
              { title: 'Newly Learned Patterns',   items: data.newly_learned_patterns, color: '#818cf8' },
            ].filter(s => s.items.length > 0).map(section => (
              <div key={section.title} style={{ padding: '0.9rem', background: `${section.color}06`, border: `1px solid ${section.color}20`, borderRadius: '14px' }}>
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.72rem', fontWeight: 700, color: section.color }}>{section.title}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {section.items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.4rem' }}>
                      <span style={{ color: section.color, flexShrink: 0, fontSize: '0.72rem', marginTop: '1px' }}>→</span>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

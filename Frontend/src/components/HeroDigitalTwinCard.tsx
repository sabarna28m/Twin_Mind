import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Target, Bot, ExternalLink } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';

interface SubjectSummary { subject: string; avg_score: number; recommended_daily_minutes: number }
interface SubjectAnalysis { weakest: SubjectSummary | null; strongest: SubjectSummary | null; focus_today: SubjectSummary | null }
interface BurnoutEntry   { burnout_score: number; risk_level: 'low' | 'medium' | 'high' }
interface PredictionData { predicted_score: number }

function focusLabel(burnout: BurnoutEntry | null): string {
  if (!burnout) return 'Calibrating…';
  if (burnout.risk_level === 'high')   return 'Rest recommended';
  if (burnout.risk_level === 'medium') return 'Moderate intensity';
  return 'Peak focus zone';
}

function focusColor(burnout: BurnoutEntry | null): string {
  if (!burnout) return '#94a3b8';
  if (burnout.risk_level === 'high')   return '#ef4444';
  if (burnout.risk_level === 'medium') return '#f59e0b';
  return '#10b981';
}

function buildInsight(
  subjects: SubjectAnalysis | null,
  burnout: BurnoutEntry | null,
  prediction: PredictionData | null,
): string {
  if (subjects?.focus_today) {
    const s = subjects.focus_today;
    return `Your Digital Twin recommends focusing on ${s.subject} today (${s.recommended_daily_minutes} min). Based on your recent patterns, this is where consistent effort yields the highest return.`;
  }
  if (subjects?.weakest) {
    const w = subjects.weakest;
    return `Your Digital Twin has identified ${w.subject} as the current recovery priority at ${w.avg_score.toFixed(0)}%. A daily ${w.recommended_daily_minutes}-min session will compound into measurable improvement.`;
  }
  if (burnout?.risk_level === 'high') {
    return `Your Digital Twin detects elevated burnout risk (${burnout.burnout_score}/100). It recommends a lighter study session today with intentional breaks to protect your long-term performance trajectory.`;
  }
  if (prediction?.predicted_score != null) {
    return `Your Digital Twin predicts a score of ${prediction.predicted_score.toFixed(0)}% based on current study habits. Keep your momentum and the twin will refine its forecast as you log more sessions.`;
  }
  return `Your Digital Twin is actively learning from your study sessions, quizzes, and check-ins. The more data you feed it, the sharper and more personalised its guidance becomes.`;
}

export default function HeroDigitalTwinCard() {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  const [subjects,   setSubjects]   = useState<SubjectAnalysis | null>(null);
  const [burnout,    setBurnout]    = useState<BurnoutEntry | null>(null);
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/subject-performance/analysis').then(r => setSubjects(r.data)).catch(() => {}),
      api.get('/burnout/latest').then(r => setBurnout(r.data)).catch(() => {}),
      api.get('/learning-data?limit=1').then(r => {
        const e = r.data?.[0];
        if (!e) return;
        return api.post('/predict', {
          study_hours: e.study_hours,
          attendance_percentage: e.attendance_percentage,
          assignment_completion_rate: e.assignment_completion_rate,
          quiz_scores: e.quiz_scores ?? null,
          stress_level: e.stress_level,
          sleep_duration: e.sleep_duration,
        }).then(pr => setPrediction(pr.data)).catch(() => {});
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const insight    = buildInsight(subjects, burnout, prediction);
  const fLabel     = focusLabel(burnout);
  const fColor     = focusColor(burnout);
  const predScore  = prediction?.predicted_score ?? null;
  const strongName = subjects?.strongest?.subject ?? '—';
  const weakName   = subjects?.weakest?.subject   ?? '—';

  /* ── Theme-aware styles ── */
  const s = getStyles(isDark);

  return (
    <div style={s.wrap} className="synth-hover-card">
      <div style={s.accentLine} />

      {/* Header */}
      <div style={s.header}>
        <div style={s.avatarWrap}>
          <div style={s.avatar} className="twin-avatar-pulse">◈</div>
          <div style={s.avatarRing} />
          <div style={s.avatarOuter} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={s.title}>Digital Twin</p>
          <p style={s.subtitle}>Your AI-powered learning replica</p>
        </div>
        <div style={s.statusBadge}>
          <span style={s.statusDot} className="live-dot" />
          Active
        </div>
      </div>

      {loading ? (
        <div style={s.loadingRow}>
          <div style={s.spinner} className="spin" />
          <span style={{ fontSize: '0.82rem', color: isDark ? 'rgba(148,163,184,0.5)' : '#94A3B8' }}>
            Twin is analysing your profile…
          </span>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div style={s.statsRow}>
            <div style={s.stat}>
              <span style={s.statLabel}>Predicted Score</span>
              <span style={s.statValue}>
                {predScore != null ? `${predScore.toFixed(0)}%` : '—'}
              </span>
            </div>
            <div style={s.statDivider} />
            <div style={s.stat}>
              <span style={s.statLabel}>Focus State</span>
              <span style={{ ...s.statValue, color: fColor }}>{fLabel}</span>
            </div>
            <div style={s.statDivider} />
            <div style={s.stat}>
              <span style={s.statLabel}>Burnout Risk</span>
              <span style={{ ...s.statValue, color: fColor }}>
                {burnout ? `${burnout.burnout_score}/100` : '—'}
              </span>
            </div>
          </div>

          {/* Strengths / Weaknesses */}
          <div style={s.swRow}>
            <div style={s.swCard}>
              <Zap size={20} style={{ color: '#10b981', flexShrink: 0 }} />
              <div>
                <p style={s.swLabel}>Strongest</p>
                <p style={s.swValue}>{strongName}</p>
              </div>
            </div>
            <div style={{
              ...s.swCard,
              background: isDark ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.06)',
              borderColor: isDark ? 'rgba(239,68,68,0.20)' : 'rgba(239,68,68,0.15)',
            }}>
              <Target size={20} style={{ color: '#fca5a5', flexShrink: 0 }} />
              <div>
                <p style={s.swLabel}>Priority Focus</p>
                <p style={{ ...s.swValue, color: '#fca5a5' }}>{weakName}</p>
              </div>
            </div>
          </div>

          {/* Insight */}
          <p style={s.insight}>{insight}</p>

          {/* Action buttons */}
          <div style={s.btnRow}>
            <Link to="/twin" style={s.primaryBtn}>
              <ExternalLink size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Open Digital Twin
            </Link>
            <Link to="/simulate" style={s.secondaryBtn}>
              <Zap size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />What-If Simulator
            </Link>
            <Link to="/mentor" style={s.ghostBtn}>
              <Bot size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />AI Mentor
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Theme-aware style factory ── */
function getStyles(isDark: boolean): Record<string, React.CSSProperties> {
  return {
    wrap: {
      position: 'relative', overflow: 'hidden',
      background: isDark
        ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(124, 58, 237, 0.1) 100%), rgba(15, 23, 42, 0.65)'
        : 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(124, 58, 237, 0.15) 100%), rgba(255, 255, 255, 0.55)',
      backdropFilter: 'blur(24px) saturate(150%)',
      WebkitBackdropFilter: 'blur(24px) saturate(150%)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255, 255, 255, 0.5)'}`,
      borderRadius: '1.5rem', padding: '1.75rem',
      boxShadow: isDark
        ? '0 20px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2)'
        : '0 8px 32px rgba(0, 212, 255, 0.08)',
      display: 'flex', flexDirection: 'column', gap: '1.1rem',
      height: '100%', boxSizing: 'border-box',
      transition: 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
    },
    accentLine: {
      position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
      background: 'linear-gradient(90deg, #6366f1, #00D4FF, transparent)',
      pointerEvents: 'none',
    },
    header: {
      display: 'flex', alignItems: 'center', gap: '0.9rem',
      position: 'relative', zIndex: 1,
    },
    avatarWrap: { position: 'relative', flexShrink: 0 },
    avatar: {
      width: '48px', height: '48px', borderRadius: '50%',
      background: 'linear-gradient(135deg, #6366f1 0%, #00D4FF 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1.35rem', color: '#fff',
      boxShadow: '0 0 28px rgba(99,102,241,0.5)',
      animation: 'breathe 3.5s ease-in-out infinite',
    },
    avatarRing: {
      position: 'absolute', inset: '-5px', borderRadius: '50%',
      border: '1.5px solid rgba(99,102,241,0.35)',
      animation: 'breathe 3.5s ease-in-out infinite',
    },
    avatarOuter: {
      position: 'absolute', inset: '-11px', borderRadius: '50%',
      border: '1px solid rgba(0,212,255,0.12)',
      animation: 'breathe 4.5s ease-in-out infinite',
    },
    title: {
      margin: 0, fontSize: '1.05rem', fontWeight: 800,
      color: isDark ? '#F1F5F9' : '#0f172a',
      letterSpacing: '-0.01em',
    },
    subtitle: {
      margin: 0, fontSize: '0.72rem',
      color: isDark ? '#94A3B8' : '#64748b',
      marginTop: '0.15rem',
    },
    statusBadge: {
      display: 'flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.25rem 0.7rem', borderRadius: '99px',
      background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
      fontSize: '0.62rem', fontWeight: 700, color: '#34d399', letterSpacing: '0.06em',
      flexShrink: 0,
    },
    statusDot: {
      width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', flexShrink: 0,
    },
    loadingRow: {
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      position: 'relative', zIndex: 1, padding: '1rem 0',
    },
    spinner: {
      width: '20px', height: '20px', flexShrink: 0,
      border: isDark ? '2px solid rgba(255,255,255,0.12)' : '2px solid #e2e8f0',
      borderTop: '2px solid #6366f1',
      borderRadius: '50%',
    },
    statsRow: {
      display: 'flex', alignItems: 'stretch', gap: '0',
      background: isDark ? 'rgba(30,41,59,0.5)' : '#f8fafc',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
      borderRadius: '14px', overflow: 'hidden',
      position: 'relative', zIndex: 1,
    },
    stat: {
      flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem',
      padding: '0.65rem 0.8rem',
    },
    statLabel: {
      fontSize: '0.6rem', fontWeight: 700,
      color: isDark ? '#94A3B8' : '#64748b',
      letterSpacing: '0.07em', textTransform: 'uppercase',
    },
    statValue: {
      fontSize: '0.92rem', fontWeight: 800,
      color: isDark ? '#F1F5F9' : '#0f172a',
    },
    statDivider: {
      width: '1px',
      background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
      flexShrink: 0,
    },
    swRow: {
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem',
      position: 'relative', zIndex: 1,
    },
    swCard: {
      display: 'flex', alignItems: 'center', gap: '0.6rem',
      padding: '0.6rem 0.75rem',
      background: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)',
      border: `1px solid ${isDark ? 'rgba(16,185,129,0.20)' : 'rgba(16,185,129,0.15)'}`,
      borderRadius: '12px',
    },
    swIcon:  { fontSize: '1rem', flexShrink: 0 },
    swLabel: {
      margin: 0, fontSize: '0.58rem', fontWeight: 700,
      color: isDark ? '#94A3B8' : '#64748b',
      letterSpacing: '0.06em', textTransform: 'uppercase',
    },
    swValue: {
      margin: 0, fontSize: '0.82rem', fontWeight: 700,
      color: isDark ? '#F1F5F9' : '#0f172a',
      marginTop: '0.1rem',
    },
    insight: {
      margin: 0,
      fontSize: '0.82rem', fontWeight: 500,
      color: isDark ? '#CBD5E1' : '#475569',
      lineHeight: 1.65,
      position: 'relative', zIndex: 1,
    },
    btnRow: {
      display: 'flex', gap: '0.6rem', flexWrap: 'wrap',
      position: 'relative', zIndex: 1, marginTop: 'auto',
    },
    primaryBtn: {
      padding: '0.62rem 1.2rem',
      background: 'linear-gradient(135deg, #6366f1, #00D4FF)',
      border: 'none', borderRadius: '10px',
      color: '#fff', fontSize: '0.82rem', fontWeight: 800,
      textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      boxShadow: '0 4px 18px rgba(99,102,241,0.38)',
      transition: 'box-shadow 0.2s, transform 0.18s',
      whiteSpace: 'nowrap',
    },
    secondaryBtn: {
      padding: '0.6rem 1rem',
      background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : '#e2e8f0'}`,
      borderRadius: '10px',
      color: isDark ? '#CBD5E1' : '#475569',
      fontSize: '0.82rem', fontWeight: 700,
      textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      transition: 'background 0.2s',
      whiteSpace: 'nowrap',
    },
    ghostBtn: {
      padding: '0.6rem 1rem',
      background: isDark ? 'rgba(124,58,237,0.12)' : '#f3e8ff',
      border: `1px solid ${isDark ? 'rgba(124,58,237,0.25)' : '#e9d5ff'}`,
      borderRadius: '10px',
      color: isDark ? '#C4B5FD' : '#7c3aed',
      fontSize: '0.82rem', fontWeight: 700,
      textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      transition: 'background 0.2s',
      whiteSpace: 'nowrap',
    },
  };
}

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

interface SubjectSummary { subject: string; avg_score: number; recommended_daily_minutes: number; trend?: string }
interface SubjectAnalysis { weakest: SubjectSummary | null; focus_today: SubjectSummary | null; strongest: SubjectSummary | null }
interface BurnoutEntry   { burnout_score: number; risk_level: 'low' | 'medium' | 'high' }
interface PredictionData { predicted_score: number; risk_level: string }

interface Recommendation { icon: string; text: string; xp: number; link: string }

function buildRecommendations(
  subjects: SubjectAnalysis | null,
  burnout: BurnoutEntry | null,
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (subjects?.focus_today) {
    recs.push({
      icon: '📚',
      text: `Study ${subjects.focus_today.subject} for ${subjects.focus_today.recommended_daily_minutes} min`,
      xp: 50, link: '/sessions',
    });
  } else if (subjects?.weakest) {
    recs.push({
      icon: '📚',
      text: `Study ${subjects.weakest.subject} for ${subjects.weakest.recommended_daily_minutes} min`,
      xp: 50, link: '/sessions',
    });
  }

  recs.push({ icon: '🧠', text: 'Complete 1 Practice Quiz', xp: 30, link: '/quiz' });

  if (burnout && (burnout.risk_level === 'medium' || burnout.risk_level === 'high')) {
    recs.push({ icon: '🧘', text: 'Log today\'s wellness check-in', xp: 20, link: '/checkin' });
  } else {
    recs.push({ icon: '🧠', text: 'Complete a quiz with focus score above 75%', xp: 40, link: '/quiz' });
  }

  return recs.slice(0, 3);
}

function buildInsight(subjects: SubjectAnalysis | null, burnout: BurnoutEntry | null, prediction: PredictionData | null): string {
  if (subjects?.weakest && subjects.weakest.avg_score < 60) {
    const drop = Math.round(Math.abs(70 - subjects.weakest.avg_score));
    return `Your ${subjects.weakest.subject} performance is at ${subjects.weakest.avg_score.toFixed(0)}% — ${drop}% below the target threshold. Today is the perfect time to recover.`;
  }
  if (burnout?.risk_level === 'high') {
    return `High burnout risk detected (score: ${burnout.burnout_score}/100). A focused but shorter study session today will protect your long-term performance.`;
  }
  if (prediction && prediction.predicted_score < 65) {
    return `Your predicted exam score is ${prediction.predicted_score.toFixed(0)}%. Focused effort now can significantly improve this before exams.`;
  }
  if (subjects?.weakest) {
    return `${subjects.weakest.subject} is your current weak point at ${subjects.weakest.avg_score.toFixed(0)}%. A daily ${subjects.weakest.recommended_daily_minutes}-min session will compound into real improvement.`;
  }
  return `Your AI twin has analyzed your patterns. Stay consistent with today's recommended actions to hit your academic goals.`;
}

function computeExpectedBoost(subjects: SubjectAnalysis | null): number {
  if (subjects?.weakest) return Math.max(8, Math.round((80 - subjects.weakest.avg_score) * 0.3));
  return 12;
}

export default function HeroPriorityCard() {
  const navigate = useNavigate();
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

  const recs    = buildRecommendations(subjects, burnout);
  const insight = buildInsight(subjects, burnout, prediction);
  const boost   = computeExpectedBoost(subjects);

  const urgency =
    burnout?.risk_level === 'high'               ? 'high'   :
    (subjects?.weakest?.avg_score ?? 100) < 55  ? 'high'   :
    burnout?.risk_level === 'medium'             ? 'medium' : 'normal';

  const urgencyColor = urgency === 'high' ? '#ef4444' : urgency === 'medium' ? '#f59e0b' : '#00D4FF';
  const urgencyLabel = urgency === 'high' ? '🔴 HIGH PRIORITY' : urgency === 'medium' ? '🟡 ATTENTION NEEDED' : '🎯 TODAY\'S PRIORITY';

  return (
    <div style={h.wrap}>
      <div style={h.orb1} />
      <div style={h.orb2} />
      <div style={{ ...h.accentLine, background: `linear-gradient(90deg, ${urgencyColor}, transparent)` }} />

      {/* Tag */}
      <div style={h.tagRow}>
        <span style={{ ...h.tag, color: urgencyColor, background: `${urgencyColor}18`, borderColor: `${urgencyColor}30` }}>
          {urgencyLabel}
        </span>
        {prediction && (
          <span style={h.scoreBadge}>
            Predicted: <strong>{prediction.predicted_score.toFixed(0)}%</strong>
          </span>
        )}
      </div>

      {loading ? (
        <div style={h.loadingRow}>
          <div style={h.spinner} className="spin" />
          <span style={{ fontSize: '0.82rem', color: 'rgba(148,163,184,0.55)' }}>Analyzing your performance data…</span>
        </div>
      ) : (
        <>
          {/* Main insight */}
          <p style={h.insight}>{insight}</p>

          {/* Recommendations */}
          <div style={h.recsWrap}>
            <p style={h.recsLabel}>Recommended actions:</p>
            <div style={h.recsList}>
              {recs.map((r, i) => (
                <Link key={i} to={r.link} style={{ textDecoration: 'none' }}>
                  <div style={h.recItem} className="priority-rec-item">
                    <div style={h.recCheck}>✓</div>
                    <span style={h.recText}>{r.icon} {r.text}</span>
                    <span style={h.recXP}>+{r.xp} XP</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Expected improvement */}
          <div style={h.improveRow}>
            <div style={h.improveBox}>
              <span style={h.improveIcon}>📈</span>
              <div>
                <p style={h.improveLabel}>Expected improvement</p>
                <p style={h.improveValue}>+{boost}% score boost</p>
              </div>
            </div>

            {/* Action buttons */}
            <div style={h.btnRow}>
              <button
                onClick={() => navigate(recs[0]?.link ?? '/sessions')}
                style={h.primaryBtn}
                className="priority-start-btn"
              >
                ▶ Start Now
              </button>
              <Link to="/mentor" style={h.secondaryBtn}>📋 View Plan</Link>
              <button
                onClick={() => {
                  const event = new CustomEvent('copilot:open');
                  window.dispatchEvent(event);
                }}
                style={h.ghostBtn}
              >
                🤖 Ask AI
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const h: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative', overflow: 'hidden',
    background: 'linear-gradient(135deg, rgba(4,8,24,0.97) 0%, rgba(10,4,28,0.97) 60%, rgba(4,10,24,0.97) 100%)',
    border: '1px solid rgba(0,212,255,0.15)',
    borderRadius: '22px', padding: '1.75rem',
    boxShadow: '0 8px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(0,212,255,0.06)',
  },
  orb1: {
    position: 'absolute', width: '450px', height: '450px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.09) 0%, transparent 60%)',
    top: '-160px', right: '-80px', pointerEvents: 'none',
    animation: 'orb-drift-1 18s ease-in-out infinite',
  },
  orb2: {
    position: 'absolute', width: '300px', height: '300px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 60%)',
    bottom: '-100px', left: '15%', pointerEvents: 'none',
    animation: 'orb-drift-2 14s ease-in-out infinite',
  },
  accentLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
    pointerEvents: 'none',
  },
  tagRow: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    marginBottom: '0.9rem', position: 'relative', zIndex: 1,
  },
  tag: {
    padding: '0.25rem 0.75rem', borderRadius: '99px',
    fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em',
    border: '1px solid',
  },
  scoreBadge: {
    fontSize: '0.72rem', color: 'rgba(148,163,184,0.6)', fontWeight: 600,
  },
  loadingRow: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '1rem 0',
    position: 'relative', zIndex: 1,
  },
  spinner: {
    width: '20px', height: '20px', flexShrink: 0,
    border: '2px solid rgba(99,102,241,0.2)', borderTop: '2px solid #818cf8',
    borderRadius: '50%',
  },
  insight: {
    margin: '0 0 1.25rem',
    fontSize: '1rem', fontWeight: 600, color: 'rgba(226,232,240,0.9)',
    lineHeight: 1.65, maxWidth: '680px',
    position: 'relative', zIndex: 1,
  },
  recsWrap: { marginBottom: '1.25rem', position: 'relative', zIndex: 1 },
  recsLabel: {
    margin: '0 0 0.55rem', fontSize: '0.68rem', fontWeight: 700,
    color: 'rgba(148,163,184,0.5)', letterSpacing: '0.07em', textTransform: 'uppercase' as const,
  },
  recsList: { display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' },
  recItem: {
    display: 'flex', alignItems: 'center', gap: '0.7rem',
    padding: '0.55rem 0.75rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px', cursor: 'pointer',
    transition: 'background 0.2s, border-color 0.2s',
  },
  recCheck: {
    width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
    background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.65rem', fontWeight: 800, color: '#00D4FF',
  },
  recText: { flex: 1, fontSize: '0.8rem', fontWeight: 600, color: 'rgba(226,232,240,0.88)' },
  recXP:   { fontSize: '0.65rem', fontWeight: 700, color: '#f59e0b', flexShrink: 0 },
  improveRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '1rem', flexWrap: 'wrap' as const,
    position: 'relative', zIndex: 1,
  },
  improveBox: {
    display: 'flex', alignItems: 'center', gap: '0.65rem',
    padding: '0.55rem 0.85rem',
    background: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.2)',
    borderRadius: '12px',
  },
  improveIcon:  { fontSize: '1.1rem' },
  improveLabel: { margin: 0, fontSize: '0.62rem', color: 'rgba(148,163,184,0.5)', fontWeight: 600 },
  improveValue: { margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#34d399' },
  btnRow: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' as const },
  primaryBtn: {
    padding: '0.6rem 1.25rem',
    background: 'linear-gradient(135deg, #6366f1, #00D4FF)',
    border: 'none', borderRadius: '10px',
    color: '#fff', fontSize: '0.82rem', fontWeight: 800,
    cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 4px 18px rgba(99,102,241,0.38)',
    transition: 'box-shadow 0.2s, transform 0.18s',
  },
  secondaryBtn: {
    padding: '0.58rem 1.1rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    color: 'rgba(226,232,240,0.8)', fontSize: '0.82rem', fontWeight: 700,
    textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
    transition: 'background 0.2s',
  },
  ghostBtn: {
    padding: '0.58rem 1.1rem',
    background: 'rgba(124,58,237,0.1)',
    border: '1px solid rgba(124,58,237,0.25)',
    borderRadius: '10px',
    color: '#c4b5fd', fontSize: '0.82rem', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background 0.2s',
  },
};

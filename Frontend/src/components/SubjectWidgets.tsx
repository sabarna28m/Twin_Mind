import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface SubjectSummary {
  subject: string; avg_score: number; risk_level: string;
  trend: string; improvement: number | null;
  recommended_daily_minutes: number;
}
interface Analysis {
  weakest: SubjectSummary | null;
  strongest: SubjectSummary | null;
  focus_today: SubjectSummary | null;
}

const ICONS: Record<string, string> = {
  Mathematics:'∑', Physics:'⚛', Chemistry:'⚗',
  Biology:'🧬', English:'📖', 'Computer Science':'💻',
};

function sc(s: number) { return s >= 75 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444' }
function rl(s: number) { return s >= 75 ? 'Strong' : s >= 50 ? 'Average' : 'Weak' }

function MiniCard({ icon, label, subject, score, detail, cta, color }: {
  icon: string; label: string; subject?: string | null; score?: number;
  detail: string; cta?: string; color: string;
}) {
  return (
    <div style={{ ...w.card, borderColor: `${color}28` }}>
      <div style={{ position: 'absolute', top: '-15%', right: '-10%', width: '80px', height: '80px', borderRadius: '50%', background: `radial-gradient(circle,${color}18 0%,transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ ...w.iconBox, background: `${color}20`, color }}>{icon}</div>
      <p style={{ ...w.label, color: `${color}bb` }}>{label}</p>
      {subject && <p style={{ ...w.subject, color }}>{ICONS[subject] ?? '📚'} {subject}</p>}
      {score !== undefined && <p style={{ ...w.score, color }}>{score.toFixed(0)}%</p>}
      <p style={w.detail}>{detail}</p>
      <Link to="/subjects" style={{ ...w.cta, color, borderColor: `${color}40`, background: `${color}10` }}>
        {cta ?? 'View Details →'}
      </Link>
    </div>
  );
}

export default function SubjectWidgets() {
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/subject-performance/analysis')
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.85rem' }} className="subj-widget-grid">
      {[0,1,2].map(i => (
        <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '1.25rem', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '24px', height: '24px', border: '2px solid rgba(99,102,241,0.2)', borderTop: '2px solid #818cf8', borderRadius: '50%' }} className="spin" />
        </div>
      ))}
    </div>
  );

  if (!data || (!data.weakest && !data.strongest && !data.focus_today)) return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '18px', padding: '1.5rem', textAlign: 'center' as const }}>
      <p style={{ margin: '0 0 0.6rem', fontSize: '1.5rem' }}>📚</p>
      <p style={{ margin: '0 0 0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-h)' }}>No subject data yet</p>
      <p style={{ margin: '0 0 0.85rem', fontSize: '0.75rem', color: 'var(--text)', lineHeight: 1.5 }}>
        Add your subjects in your profile, then log performance records to activate Subject Intelligence.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' as const }}>
        <Link to="/profile/setup" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#06b6d4', textDecoration: 'none', padding: '0.32rem 0.8rem', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)', borderRadius: '8px' }}>
          Configure Subjects →
        </Link>
        <Link to="/subjects" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8', textDecoration: 'none', padding: '0.32rem 0.8rem', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px' }}>
          Add Records →
        </Link>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.85rem' }} className="subj-widget-grid">
      {data.weakest && (
        <MiniCard icon="🔴" label="Weakest Subject" color="#ef4444"
          subject={data.weakest.subject} score={data.weakest.avg_score}
          detail={`${data.weakest.recommended_daily_minutes} min/day recommended`}
          cta="Focus Now →" />
      )}
      {data.strongest && (
        <MiniCard icon="🟢" label="Strongest Subject" color="#10b981"
          subject={data.strongest.subject} score={data.strongest.avg_score}
          detail={data.strongest.improvement != null ? `+${data.strongest.improvement.toFixed(0)}% improvement` : `Trend: ${data.strongest.trend}`}
          cta="Keep Going →" />
      )}
      {data.focus_today && (
        <MiniCard icon="🎯" label="Focus Today" color="#6366f1"
          subject={data.focus_today.subject}
          detail={`${data.focus_today.recommended_daily_minutes} min recommended · ${rl(data.focus_today.avg_score)}`}
          cta="Start Session →" />
      )}
    </div>
  );
}

const w: Record<string, React.CSSProperties> = {
  card: {
    position: 'relative', overflow: 'hidden',
    background: 'var(--glass-bg,rgba(255,255,255,0.04))',
    backdropFilter: 'blur(24px)',
    border: '1px solid',
    borderRadius: '18px', padding: '1.1rem',
    display: 'flex', flexDirection: 'column' as const, gap: '0.3rem',
  },
  iconBox: { width: '34px', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', marginBottom: '0.15rem', flexShrink: 0 },
  label: { margin: 0, fontSize: '0.63rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const },
  subject: { margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-h)' },
  score: { margin: 0, fontSize: '1.4rem', fontWeight: 900, lineHeight: 1 },
  detail: { margin: 0, fontSize: '0.7rem', color: 'var(--text)', lineHeight: 1.4, flex: 1 },
  cta: { display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, textDecoration: 'none', padding: '0.28rem 0.6rem', border: '1px solid', borderRadius: '7px', marginTop: '0.2rem', transition: 'opacity 0.2s', alignSelf: 'flex-start' },
};

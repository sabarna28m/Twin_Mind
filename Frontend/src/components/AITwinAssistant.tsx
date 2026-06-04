import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface BurnoutEntry { burnout_score: number; risk_level: 'low' | 'medium' | 'high' }
interface SubjectSummary { subject: string; avg_score: number; recommended_daily_minutes: number }
interface SubjectAnalysis {
  weakest: SubjectSummary | null;
  focus_today: SubjectSummary | null;
}

function buildMessages(burnout: BurnoutEntry | null, subjects: SubjectAnalysis | null): string[] {
  const msgs: string[] = [];

  if (subjects?.weakest) {
    msgs.push(
      `📉 Your ${subjects.weakest.subject} score is at ${subjects.weakest.avg_score.toFixed(0)}%. ` +
      `I recommend ${subjects.weakest.recommended_daily_minutes} min/day to recover it.`
    );
  }

  if (burnout?.risk_level === 'high') {
    msgs.push(
      `⚠️ High burnout risk detected (score: ${burnout.burnout_score}/100). ` +
      `Consider a lighter 30-min session with breaks today.`
    );
  } else if (burnout?.risk_level === 'medium') {
    msgs.push(
      `🟡 Medium burnout detected. I recommend a 10-minute break after every study block.`
    );
  }

  if (subjects?.focus_today) {
    msgs.push(
      `🎯 Based on your patterns, focus on ${subjects.focus_today.subject} today — ` +
      `${subjects.focus_today.recommended_daily_minutes} min will make a measurable difference.`
    );
  }

  if (msgs.length === 0) {
    msgs.push(
      `🤖 Log your daily check-in to help me understand your patterns and give smarter recommendations.`
    );
  }

  if (msgs.length < 2) {
    msgs.push(
      `📚 Regular spaced-repetition sessions improve retention by up to 40%. ` +
      `Start with a 25-minute Pomodoro session.`
    );
  }

  if (msgs.length < 3) {
    msgs.push(
      `🧠 Use the AI Focus Detector during your next session to maintain a focus score above 80%.`
    );
  }

  return msgs.slice(0, 3);
}

export default function AITwinAssistant() {
  const [burnout, setBurnout]   = useState<BurnoutEntry | null>(null);
  const [subjects, setSubjects] = useState<SubjectAnalysis | null>(null);
  const [loading, setLoading]   = useState(true);
  const [visible, setVisible]   = useState(0);

  useEffect(() => {
    Promise.all([
      api.get('/burnout/latest').then(r => setBurnout(r.data)).catch(() => {}),
      api.get('/subject-performance/analysis').then(r => setSubjects(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  // Reveal messages one-by-one after data loads
  useEffect(() => {
    if (loading) return;
    setVisible(1);
    const t1 = setTimeout(() => setVisible(2), 550);
    const t2 = setTimeout(() => setVisible(3), 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loading]);

  const messages = buildMessages(burnout, subjects);

  return (
    <div style={ta.wrap}>
      <div style={ta.orb} />

      {/* Header */}
      <div style={ta.header}>
        <div style={ta.avatarWrap}>
          <div style={ta.avatar}>◈</div>
          <div style={ta.avatarRing} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={ta.name}>TwinMind Twin</p>
          <p style={ta.status}>🟢 Active · AI Assistant</p>
        </div>
        <div style={ta.modelTag}>GPT-Powered</div>
      </div>

      {/* Message feed */}
      <div style={ta.feed}>
        {loading ? (
          <div style={ta.loadingBubble}>
            <span style={ta.typingDot} className="typing-dot" />
            <span style={{ ...ta.typingDot, animationDelay: '0.18s' }} className="typing-dot" />
            <span style={{ ...ta.typingDot, animationDelay: '0.36s' }} className="typing-dot" />
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              style={{
                ...ta.message,
                opacity: i < visible ? 1 : 0,
                transform: i < visible ? 'translateY(0)' : 'translateY(10px)',
                transition: 'opacity 0.45s ease, transform 0.45s ease',
              }}
            >
              {msg}
            </div>
          ))
        )}
      </div>

      {/* Quick actions */}
      <div style={ta.actions}>
        <Link to="/sessions"  style={ta.actionBtn}>▶ Start Session</Link>
        <Link to="/mentor"    style={ta.actionBtn}>📋 Generate Plan</Link>
        <Link to="/subjects"  style={ta.actionBtn}>📊 Weaknesses</Link>
      </div>
    </div>
  );
}

const ta: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative', overflow: 'hidden',
    background: 'linear-gradient(135deg, rgba(8,4,22,0.97) 0%, rgba(18,8,44,0.97) 100%)',
    border: '1px solid rgba(124,58,237,0.28)',
    borderRadius: '20px', padding: '1.5rem',
    display: 'flex', flexDirection: 'column' as const, gap: '1rem',
    boxShadow: '0 4px 40px rgba(124,58,237,0.1)',
  },
  orb: {
    position: 'absolute', width: '220px', height: '220px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 70%)',
    top: '-70px', right: '-50px', pointerEvents: 'none',
    animation: 'orb-drift-3 12s ease-in-out infinite',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    position: 'relative', zIndex: 1,
  },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: {
    width: '46px', height: '46px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1 0%, #00D4FF 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.3rem', color: '#fff',
    boxShadow: '0 0 22px rgba(99,102,241,0.45)',
    animation: 'breathe 3.5s ease-in-out infinite',
  },
  avatarRing: {
    position: 'absolute', inset: '-5px',
    borderRadius: '50%',
    border: '1.5px solid rgba(99,102,241,0.3)',
    animation: 'breathe 3.5s ease-in-out infinite',
  },
  name:     { margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#e2e8f0' },
  status:   { margin: 0, fontSize: '0.68rem', color: 'rgba(148,163,184,0.6)' },
  modelTag: {
    padding: '0.2rem 0.6rem',
    background: 'rgba(99,102,241,0.12)',
    border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: '99px',
    fontSize: '0.58rem', fontWeight: 700, color: '#a5b4fc',
    letterSpacing: '0.06em',
  },
  feed: {
    display: 'flex', flexDirection: 'column' as const, gap: '0.6rem',
    flex: 1, position: 'relative', zIndex: 1,
    minHeight: '140px',
  },
  loadingBubble: {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '0.75rem 0.9rem',
    background: 'rgba(99,102,241,0.07)',
    border: '1px solid rgba(99,102,241,0.15)',
    borderRadius: '12px', borderLeft: '2px solid rgba(99,102,241,0.4)',
  },
  typingDot: {
    display: 'inline-block',
    width: '7px', height: '7px', borderRadius: '50%',
    background: '#818cf8',
  },
  message: {
    padding: '0.75rem 0.9rem',
    background: 'rgba(99,102,241,0.07)',
    border: '1px solid rgba(99,102,241,0.16)',
    borderRadius: '12px',
    borderLeft: '2px solid rgba(99,102,241,0.45)',
    fontSize: '0.8rem', color: 'rgba(226,232,240,0.85)', lineHeight: 1.6,
  },
  actions: {
    display: 'flex', gap: '0.5rem',
    position: 'relative', zIndex: 1,
  },
  actionBtn: {
    flex: 1, textAlign: 'center' as const,
    padding: '0.44rem 0.4rem',
    background: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.22)',
    borderRadius: '10px',
    fontSize: '0.7rem', fontWeight: 700, color: '#a5b4fc',
    textDecoration: 'none', whiteSpace: 'nowrap' as const,
    transition: 'background 0.2s, border-color 0.2s',
  },
};

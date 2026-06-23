import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface BurnoutEntry { burnout_score: number; risk_level: 'low' | 'medium' | 'high' }

const GENERAL_INSIGHTS = [
  `📚 Regular spaced-repetition sessions improve long-term retention by up to 40%. Short daily sessions outperform long infrequent ones.`,
  `🎯 Try a Focus Mode quiz to track your attention score in real time. Consistent scores above 75% signal strong readiness.`,
  `🧠 Your Digital Twin improves its predictions each time you complete a session, quiz, or check-in. The more you study, the smarter it gets.`,
  `⚡ Students who review study material within 24 hours of learning it retain 70% more. Schedule a quick revision after every session.`,
  `📊 Open Subject Analysis under Performance to see your AI-ranked priority list and personalised recovery plans for each subject.`,
];

function buildMessages(burnout: BurnoutEntry | null): string[] {
  const msgs: string[] = [];

  if (burnout?.risk_level === 'high') {
    msgs.push(
      `⚠️ High burnout risk detected (score: ${burnout.burnout_score}/100). ` +
      `Consider a lighter 30-min session with breaks today.`
    );
  } else if (burnout?.risk_level === 'medium') {
    msgs.push(
      `🟡 Medium burnout detected. I recommend a 10-minute break after every study block and a rest day this week.`
    );
  } else if (burnout?.risk_level === 'low') {
    msgs.push(
      `✅ Your burnout score is healthy (${burnout.burnout_score}/100). You are in a good zone — maintain your current study rhythm.`
    );
  }

  const remaining = GENERAL_INSIGHTS.filter((_, i) => i < 3);
  for (const insight of remaining) {
    if (msgs.length >= 3) break;
    msgs.push(insight);
  }

  if (msgs.length === 0) {
    msgs.push(`🤖 Log your daily check-in to help me understand your patterns and give smarter recommendations.`);
    msgs.push(GENERAL_INSIGHTS[0]);
    msgs.push(GENERAL_INSIGHTS[1]);
  }

  return msgs.slice(0, 3);
}

export default function AITwinAssistant() {
  const [burnout, setBurnout] = useState<BurnoutEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    api.get('/burnout/latest').then(r => setBurnout(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    setVisible(1);
    const t1 = setTimeout(() => setVisible(2), 550);
    const t2 = setTimeout(() => setVisible(3), 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loading]);

  const messages = buildMessages(burnout);

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
        <Link to="/sessions"       style={ta.actionBtn}>▶ Start Session</Link>
        <Link to="/study-planner"  style={ta.actionBtn}>📋 Generate Study Plan</Link>
        <Link to="/subjects"       style={ta.actionBtn}>📊 View Weaknesses</Link>
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

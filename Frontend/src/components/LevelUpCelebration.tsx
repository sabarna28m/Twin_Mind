import { useEffect } from 'react';
import { getLevelColor, getLevelGradient, LEVEL_NAMES } from '../utils/gamification';

// Deterministic confetti
const CONFETTI = Array.from({ length: 72 }, (_, i) => ({
  left:     `${(i * 29 + 11) % 100}%`,
  delay:    `${((i * 19) % 38) / 20}s`,
  duration: `${2.3 + ((i * 11) % 18) / 10}s`,
  color:    ['#6366f1','#8b5cf6','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899','#fbbf24','#06b6d4','#f97316'][i % 10],
  size:     `${5 + (i % 8)}px`,
  rotate:   `${(i * 47) % 360}deg`,
  circle:   i % 3 !== 0,
}));

interface LevelUpProps {
  level: number;
  xp: number;
  onClose: () => void;
}

interface StreakProps {
  streak: number;
  onClose: () => void;
}

type Props = ({ type: 'level_up' } & LevelUpProps) | ({ type: 'streak' } & StreakProps);

export default function LevelUpCelebration(props: Props) {
  const color = props.type === 'level_up' ? getLevelColor(props.level) : '#f59e0b';
  const grad  = props.type === 'level_up' ? getLevelGradient(props.level) : 'linear-gradient(135deg,#f59e0b,#f97316)';

  // Inject CSS once
  useEffect(() => {
    if (document.getElementById('luc-css')) return;
    const el = document.createElement('style');
    el.id = 'luc-css';
    el.textContent = `
      @keyframes luc-fall { 0%{transform:translateY(-12px) rotate(0deg);opacity:1} 100%{transform:translateY(108vh) rotate(680deg);opacity:0} }
      @keyframes luc-pop  { 0%{transform:scale(0.6);opacity:0} 65%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
      @keyframes luc-glow { 0%,100%{opacity:0.7} 50%{opacity:1} }
    `;
    document.head.appendChild(el);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10001,
      background: 'rgba(0,0,0,0.88)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }} onClick={props.onClose}>

      {/* Confetti */}
      {CONFETTI.map((c, i) => (
        <div key={i} style={{
          position: 'absolute', left: c.left, top: '-12px',
          width: c.size, height: c.size, background: c.color,
          borderRadius: c.circle ? '50%' : '2px',
          transform: `rotate(${c.rotate})`,
          animation: `luc-fall ${c.duration} ${c.delay} ease-in forwards`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Card */}
      <div
        style={{
          background: 'var(--bg)', border: `1px solid ${color}44`,
          borderRadius: '20px', padding: '2.5rem 2rem',
          maxWidth: '400px', width: '100%', margin: '1rem',
          textAlign: 'center',
          boxShadow: `0 32px 80px rgba(0,0,0,0.7), 0 0 60px ${color}22`,
          animation: 'luc-pop 0.45s cubic-bezier(0.34,1.56,0.64,1)',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {props.type === 'level_up' ? (
          <>
            {/* Level badge */}
            <div style={{
              width: '88px', height: '88px', borderRadius: '50%',
              background: grad,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem',
              boxShadow: `0 0 0 8px ${color}20, 0 0 40px ${color}50`,
              animation: 'luc-glow 2s ease-in-out infinite',
              fontSize: '2rem',
            }}>
              ◈
            </div>

            <p style={{ margin: '0 0 0.3rem', fontSize: '0.7rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Level Up!
            </p>
            <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-h)', letterSpacing: '-0.5px' }}>
              Level {props.level}
            </h2>
            <p style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700, color }}>
              {LEVEL_NAMES[props.level]}
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.9rem', background: `${color}15`, border: `1px solid ${color}40`, borderRadius: '99px', marginBottom: '1.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color }}>✦</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-h)' }}>{props.xp.toLocaleString()} XP total</span>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem', lineHeight: 1 }}>🔥</div>
            <p style={{ margin: '0 0 0.3rem', fontSize: '0.7rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Streak Milestone!
            </p>
            <h2 style={{ margin: '0 0 0.25rem', fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-h)' }}>
              {props.streak} Days
            </h2>
            <p style={{ margin: '0 0 1.75rem', fontSize: '0.9rem', color: 'var(--text)' }}>
              Incredible consistency! Keep logging your check-ins every day.
            </p>
          </>
        )}

        <button
          onClick={props.onClose}
          style={{
            padding: '0.65rem 2rem', width: '100%',
            background: grad, border: 'none',
            borderRadius: '12px', color: '#fff',
            fontSize: '0.9rem', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: `0 6px 24px ${color}50`,
          }}
        >
          {props.type === 'level_up' ? 'Keep Going! 🚀' : 'Amazing! 🔥'}
        </button>

        <p style={{ margin: '0.9rem 0 0', fontSize: '0.7rem', color: 'var(--text)', opacity: 0.5 }}>
          Click anywhere to dismiss
        </p>
      </div>
    </div>
  );
}

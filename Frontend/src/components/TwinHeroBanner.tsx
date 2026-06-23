import { useMemo } from 'react';
import TwinRobotAvatar from './TwinRobotAvatar';

interface Props {
  fidelityScore?: number;
  userName?: string;
}

// Deterministic pseudo-RNG so particles stay stable across re-renders
function prng(seed: number): number {
  return ((seed * 9301 + 49297) % 233280) / 233280;
}

export default function TwinHeroBanner({ fidelityScore = 88, userName }: Props) {
  const stars = useMemo(() =>
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      x:    prng(i * 7  + 1) * 100,
      y:    prng(i * 13 + 3) * 100,
      size: 1.4 + prng(i * 5  + 7) * 1.6,
      dur:  2   + prng(i * 3  + 11) * 2,
      del:  prng(i * 11 + 5) * 3,
      twinkle: i % 3 !== 0,
    })),
  []);

  // Progress ring maths (r=30, viewBox 80x80, center 40,40)
  const R   = 30;
  const C   = 2 * Math.PI * R;           // ≈ 188.5
  const arc = (fidelityScore / 100) * C;

  const score = fidelityScore ?? 0;
  const scoreLabel = score > 0 ? `${score}%` : '--';

  return (
    <div style={hero} className="twin-hero-banner">
      {/* ── Star field ─────────────────────────────────────────────────── */}
      {stars.map(s => (
        <div
          key={s.id}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top:  `${s.y}%`,
            width:  `${s.size}px`,
            height: `${s.size}px`,
            borderRadius: '50%',
            background: 'white',
            opacity: 0.55,
            pointerEvents: 'none',
            animation: s.twinkle
              ? `twinkle ${s.dur.toFixed(1)}s ease-in-out ${s.del.toFixed(1)}s infinite`
              : undefined,
          }}
        />
      ))}

      {/* ── Robot avatar ───────────────────────────────────────────────── */}
      <div style={avatarWrap}>
        {/* Radial glow behind robot */}
        <div style={avatarGlow} />
        <TwinRobotAvatar size={140} />
      </div>

      {/* ── Centre text ────────────────────────────────────────────────── */}
      <div style={textBlock}>
        {/* Heading + Live badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' as const, marginBottom: '0.55rem' }}>
          <h2 style={heading}>
            {userName ? `${userName.split(' ')[0]}'s Twin is Active` : 'Your Twin is Active'}
          </h2>
          <span style={livePill}>
            <span style={liveDotOuter}>
              <span style={liveDotInner} />
            </span>
            Live
          </span>
        </div>

        {/* Subtitle */}
        <p style={subtitle}>
          Your Digital Persona Twin is learning, adapting and evolving
          to understand you better every day.
        </p>

        {/* Mini stats row */}
        <div style={statsRow}>
          <StatChip icon="🧠" label="AI Active" color="#00D4FF" />
          <StatChip icon="⚡" label="Learning" color="#A855F7" />
          <StatChip icon="🔄" label="Syncing" color="#22C55E" />
        </div>
      </div>

      {/* ── Fidelity score card ─────────────────────────────────────────── */}
      <div style={fidCard} className="twin-hero-fid-card">
        <p style={fidLabel}>✦ Twin Fidelity Score</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {/* Text side */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
              <span style={fidNumber}>{scoreLabel}</span>
              {score > 0 && <span style={fidArrow}>↗</span>}
            </div>
            <p style={fidSub}>Advanced • Evolving</p>
          </div>

          {/* Progress ring */}
          <svg
            viewBox="0 0 80 80"
            width={76}
            height={76}
            style={{ flexShrink: 0, overflow: 'visible' }}
          >
            <defs>
              {/* Gradient for the arc stroke */}
              <linearGradient id="thb-arc" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#00D4FF" />
                <stop offset="100%" stopColor="#A855F7" />
              </linearGradient>
              {/* Glow filter */}
              <filter id="thb-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b" />
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Track */}
            <circle
              cx="40" cy="40" r={R}
              fill="none"
              stroke="#2d2d5e"
              strokeWidth="6"
            />

            {/* Progress arc — slowly rotates */}
            <g style={{ animation: 'ring-spin 22s linear infinite', transformOrigin: '40px 40px' }}>
              <circle
                cx="40" cy="40" r={R}
                fill="none"
                stroke="url(#thb-arc)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${arc.toFixed(1)} ${C.toFixed(1)}`}
                strokeDashoffset={C / 4}   /* start from top */
                filter="url(#thb-glow)"
              />
            </g>

            {/* Centre label */}
            <text
              x="40" y="44"
              textAnchor="middle"
              fontSize="15"
              fontWeight="800"
              fill="white"
              style={{ letterSpacing: '-0.5px' }}
            >
              {scoreLabel}
            </text>
          </svg>
        </div>

        {/* Score bar */}
        {score > 0 && (
          <div style={{ marginTop: '0.75rem' }}>
            <div style={barTrack}>
              <div style={{ ...barFill, width: `${score}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
              <span style={barLabel}>Fidelity</span>
              <span style={barLabel}>{score}% complete</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatChip({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.2rem 0.6rem', borderRadius: '99px',
      background: `${color}14`,
      border: `1px solid ${color}30`,
    }}>
      <span style={{ fontSize: '0.72rem' }}>{icon}</span>
      <span style={{ fontSize: '0.7rem', fontWeight: 600, color, letterSpacing: '0.03em' }}>{label}</span>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
import type { CSSProperties } from 'react';

const hero: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  gap: '1.75rem',
  flexWrap: 'wrap' as const,
  padding: '24px 32px',
  minHeight: '160px',
  borderRadius: '16px',
  background: 'linear-gradient(135deg, #0D0D2B 0%, #130D35 40%, #1A0A3B 100%)',
  border: '1px solid rgba(99,102,241,0.2)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
  marginBottom: '1.5rem',
};

const avatarWrap: CSSProperties = {
  position: 'relative',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '150px',
  height: '150px',
};

const avatarGlow: CSSProperties = {
  position: 'absolute',
  inset: '-10px',
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.05) 55%, transparent 75%)',
  pointerEvents: 'none',
  animation: 'breathe 4s ease-in-out infinite',
};

const textBlock: CSSProperties = {
  flex: 1,
  minWidth: '200px',
  zIndex: 1,
};

const heading: CSSProperties = {
  margin: 0,
  fontSize: '1.85rem',
  fontWeight: 800,
  letterSpacing: '-0.5px',
  lineHeight: 1.15,
  background: 'linear-gradient(135deg, #00D4FF 0%, #818CF8 50%, #A855F7 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const livePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.2rem 0.65rem',
  borderRadius: '99px',
  background: '#0d2a14',
  border: '1px solid rgba(34,197,94,0.5)',
  color: '#22C55E',
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  flexShrink: 0,
};

const liveDotOuter: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '8px',
  height: '8px',
};

const liveDotInner: CSSProperties = {
  position: 'absolute',
  width: '7px',
  height: '7px',
  borderRadius: '50%',
  background: '#22C55E',
  animation: 'dot-ping 1.6s ease-out infinite',
};

const subtitle: CSSProperties = {
  margin: 0,
  fontSize: '0.9rem',
  color: '#94a3b8',
  lineHeight: 1.6,
  maxWidth: '440px',
  marginBottom: '0.85rem',
};

const statsRow: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap' as const,
};

const fidCard: CSSProperties = {
  flexShrink: 0,
  minWidth: '220px',
  padding: '18px 20px',
  borderRadius: '14px',
  background: '#12122a',
  border: '1px solid #2a2a50',
  boxShadow: '0 0 30px rgba(99,102,241,0.12), 0 4px 16px rgba(0,0,0,0.35)',
  zIndex: 1,
};

const fidLabel: CSSProperties = {
  margin: '0 0 0.65rem',
  fontSize: '0.7rem',
  fontWeight: 600,
  color: '#94a3b8',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const fidNumber: CSSProperties = {
  fontSize: '2.4rem',
  fontWeight: 800,
  color: '#f1f5f9',
  lineHeight: 1,
  letterSpacing: '-1px',
};

const fidArrow: CSSProperties = {
  fontSize: '1.1rem',
  color: '#22C55E',
  fontWeight: 700,
  marginLeft: '2px',
};

const fidSub: CSSProperties = {
  margin: '0.2rem 0 0',
  fontSize: '0.72rem',
  color: '#64748b',
  letterSpacing: '0.04em',
};

const barTrack: CSSProperties = {
  height: '5px',
  borderRadius: '99px',
  background: '#1e1e40',
  overflow: 'hidden',
};

const barFill: CSSProperties = {
  height: '100%',
  borderRadius: '99px',
  background: 'linear-gradient(90deg, #00D4FF, #A855F7)',
  transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)',
};

const barLabel: CSSProperties = {
  fontSize: '0.65rem',
  color: '#475569',
};

import type { CSSProperties } from 'react';

/* ═══════════════════════════════════════════════════════════════════════
   TwinMind Brain SVG — the core logo mark
   Left half:  electric blue / cyan  (#00D4FF → #0055CC)
   Right half: purple / magenta      (#8B5CF6 → #EC4899)
   Interior:   circuit-board traces + glowing AI nodes
═══════════════════════════════════════════════════════════════════════ */
export function BrainIcon({ size = 32, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="TwinMind logo"
      role="img"
    >
      <defs>
        {/* Left hemisphere gradient — electric blue */}
        <linearGradient id="tm-lg" x1="4" y1="8" x2="30" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#00D4FF" />
          <stop offset="55%"  stopColor="#0077DD" />
          <stop offset="100%" stopColor="#003899" />
        </linearGradient>
        {/* Right hemisphere gradient — purple → magenta */}
        <linearGradient id="tm-rg" x1="60" y1="8" x2="34" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#C084FC" />
          <stop offset="50%"  stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#D946EF" />
        </linearGradient>
        {/* Inner shadow overlay for depth */}
        <radialGradient id="tm-li" cx="70%" cy="20%" r="80%">
          <stop offset="0%"   stopColor="#00D4FF" stopOpacity="0.18" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tm-ri" cx="30%" cy="20%" r="80%">
          <stop offset="0%"   stopColor="#C084FC" stopOpacity="0.18" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        {/* Clip paths so circuit lines stay inside each hemisphere */}
        <clipPath id="tm-lc">
          <path d="M 30,12 C 24,5 11,7 5,17 C 1,26 2,40 7,50 C 11,60 22,64 30,62 L 30,12 Z" />
        </clipPath>
        <clipPath id="tm-rc">
          <path d="M 34,12 C 40,5 53,7 59,17 C 63,26 62,40 57,50 C 53,60 42,64 34,62 L 34,12 Z" />
        </clipPath>
      </defs>

      {/* ── LEFT HEMISPHERE ── */}
      <path
        d="M 30,12 C 24,5 11,7 5,17 C 1,26 2,40 7,50 C 11,60 22,64 30,62 L 30,12 Z"
        fill="url(#tm-lg)"
        opacity="0.9"
      />
      {/* Inner highlight */}
      <path
        d="M 30,12 C 24,5 11,7 5,17 C 1,26 2,40 7,50 C 11,60 22,64 30,62 L 30,12 Z"
        fill="url(#tm-li)"
      />
      {/* Outer glow border — cyan */}
      <path
        d="M 30,12 C 24,5 11,7 5,17 C 1,26 2,40 7,50 C 11,60 22,64 30,62"
        fill="none"
        stroke="#00D4FF"
        strokeWidth="1.4"
        strokeOpacity="0.85"
        strokeLinecap="round"
        style={{ filter: 'drop-shadow(0 0 3px #00D4FF)' }}
      />

      {/* Left circuit traces */}
      <g clipPath="url(#tm-lc)">
        <g stroke="#22D3EE" strokeWidth="0.9" strokeOpacity="0.9" strokeLinecap="round">
          {/* Horizontal lines */}
          <line x1="10" y1="22" x2="28" y2="22" />
          <line x1="7"  y1="36" x2="28" y2="36" />
          <line x1="10" y1="50" x2="28" y2="50" />
          {/* Vertical connectors */}
          <line x1="16" y1="22" x2="16" y2="50" />
          <line x1="22" y1="22" x2="22" y2="36" />
        </g>
        {/* Circuit nodes — glowing cyan */}
        <g fill="#00EEFF" style={{ filter: 'drop-shadow(0 0 2.5px #00D4FF)' }}>
          <circle cx="10" cy="22" r="1.6" />
          <circle cx="16" cy="22" r="2.1" />
          <circle cx="22" cy="22" r="1.6" />
          <circle cx="28" cy="22" r="1.3" />
          <circle cx="7"  cy="36" r="1.6" />
          <circle cx="16" cy="36" r="2.1" />
          <circle cx="22" cy="36" r="1.6" />
          <circle cx="28" cy="36" r="1.3" />
          <circle cx="10" cy="50" r="1.6" />
          <circle cx="16" cy="50" r="2.1" />
          <circle cx="28" cy="50" r="1.3" />
        </g>
      </g>

      {/* ── RIGHT HEMISPHERE ── */}
      <path
        d="M 34,12 C 40,5 53,7 59,17 C 63,26 62,40 57,50 C 53,60 42,64 34,62 L 34,12 Z"
        fill="url(#tm-rg)"
        opacity="0.9"
      />
      {/* Inner highlight */}
      <path
        d="M 34,12 C 40,5 53,7 59,17 C 63,26 62,40 57,50 C 53,60 42,64 34,62 L 34,12 Z"
        fill="url(#tm-ri)"
      />
      {/* Outer glow border — purple */}
      <path
        d="M 34,12 C 40,5 53,7 59,17 C 63,26 62,40 57,50 C 53,60 42,64 34,62"
        fill="none"
        stroke="#A855F7"
        strokeWidth="1.4"
        strokeOpacity="0.85"
        strokeLinecap="round"
        style={{ filter: 'drop-shadow(0 0 3px #8B5CF6)' }}
      />

      {/* Right circuit traces (mirror) */}
      <g clipPath="url(#tm-rc)">
        <g stroke="#A78BFA" strokeWidth="0.9" strokeOpacity="0.9" strokeLinecap="round">
          {/* Horizontal lines */}
          <line x1="36" y1="22" x2="54" y2="22" />
          <line x1="36" y1="36" x2="57" y2="36" />
          <line x1="36" y1="50" x2="54" y2="50" />
          {/* Vertical connectors */}
          <line x1="48" y1="22" x2="48" y2="50" />
          <line x1="42" y1="22" x2="42" y2="36" />
        </g>
        {/* Circuit nodes — glowing violet */}
        <g fill="#C4B5FD" style={{ filter: 'drop-shadow(0 0 2.5px #8B5CF6)' }}>
          <circle cx="36" cy="22" r="1.3" />
          <circle cx="42" cy="22" r="1.6" />
          <circle cx="48" cy="22" r="2.1" />
          <circle cx="54" cy="22" r="1.6" />
          <circle cx="36" cy="36" r="1.3" />
          <circle cx="42" cy="36" r="1.6" />
          <circle cx="48" cy="36" r="2.1" />
          <circle cx="57" cy="36" r="1.6" />
          <circle cx="36" cy="50" r="1.3" />
          <circle cx="48" cy="50" r="2.1" />
          <circle cx="54" cy="50" r="1.6" />
        </g>
      </g>

      {/* ── CENTER DIVIDER (corpus callosum) ── */}
      <line
        x1="32" y1="12" x2="32" y2="62"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />

      {/* Top highlight — where the two hemispheres meet */}
      <ellipse cx="32" cy="13" rx="4" ry="2.5" fill="rgba(255,255,255,0.12)" />

      {/* Bottom connection — brainstem hint */}
      <path
        d="M 28,61 C 29,64 31,66 32,66 C 33,66 35,64 36,61"
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TwinMindLogo — full brand component with icon + text lockup
═══════════════════════════════════════════════════════════════════════ */
type Variant = 'icon' | 'full' | 'compact' | 'stacked' | 'auth';

interface LogoProps {
  size?: number;
  variant?: Variant;
  className?: string;
  style?: CSSProperties;
}

export default function TwinMindLogo({ size = 32, variant = 'full', className, style }: LogoProps) {
  /* ── icon only ── */
  if (variant === 'icon') {
    return <BrainIcon size={size} className={className} style={style} />;
  }

  /* ── stacked (icon above text — for splash / loading screens) ── */
  if (variant === 'stacked') {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.65rem', ...style }} className={className}>
        <BrainIcon size={size} />
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:size*0.44, fontWeight:900, background:'linear-gradient(90deg,#00D4FF,#8B5CF6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', letterSpacing:'-0.5px', lineHeight:1.1 }}>
            TwinMind
          </div>
          <div style={{ fontSize:size*0.24, fontWeight:500, color:'#475569', letterSpacing:'0.05em', marginTop:'0.1em' }}>
            AI Learning Platform
          </div>
        </div>
      </div>
    );
  }

  /* ── auth (large centered, gradient text) ── */
  if (variant === 'auth') {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.5rem', ...style }} className={className}>
        <BrainIcon size={size} />
        <span style={{ fontSize:size*0.52, fontWeight:900, background:'linear-gradient(90deg,#00D4FF,#8B5CF6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', letterSpacing:'-0.4px', lineHeight:1 }}>
          TwinMind
        </span>
      </div>
    );
  }

  /* ── compact (icon + name, no tagline, tight) ── */
  if (variant === 'compact') {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:size*0.2, ...style }} className={className}>
        <BrainIcon size={size} />
        <span style={{ fontSize:size*0.5, fontWeight:900, color:'#f1f5f9', letterSpacing:'-0.4px' }}>TwinMind</span>
      </div>
    );
  }

  /* ── full (icon + name + tagline) — default ── */
  return (
    <div style={{ display:'flex', alignItems:'center', gap:size*0.22, ...style }} className={className}>
      <BrainIcon size={size} />
      <div style={{ lineHeight:1.15 }}>
        <div style={{ fontSize:size*0.5, fontWeight:900, color:'#f1f5f9', letterSpacing:'-0.4px' }}>TwinMind</div>
        <div style={{ fontSize:size*0.27, fontWeight:500, color:'#475569', letterSpacing:'0.04em', marginTop:'0.06em' }}>
          AI Learning Platform
        </div>
      </div>
    </div>
  );
}

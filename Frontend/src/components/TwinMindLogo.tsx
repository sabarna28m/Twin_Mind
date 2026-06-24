import type { CSSProperties } from 'react';

/* ═══════════════════════════════════════════════════════════════════════
   TwinMind Brain SVG — the core logo mark
   Left half:  cyan → blue   (#00D4FF → #4F7CFF)
   Right half: purple → pink (#A855F7 → #EC4899)
   Interior:   circuit-board traces + glowing AI nodes + corpus callosum
   Hover:      CSS class "brain-logo-icon" — glow amplifies on hover
═══════════════════════════════════════════════════════════════════════ */
export function BrainIcon({ size = 32, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`brain-logo-icon${className ? ` ${className}` : ''}`}
      style={{ overflow: 'visible', ...style }}
      aria-label="TwinMind logo"
      role="img"
    >
      <defs>
        {/* Left gradient — cyan → blue */}
        <linearGradient id="tm-lg" x1="3" y1="9" x2="32" y2="63" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#00D4FF" />
          <stop offset="100%" stopColor="#4F7CFF" />
        </linearGradient>
        {/* Right gradient — purple → pink */}
        <linearGradient id="tm-rg" x1="61" y1="9" x2="32" y2="63" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#A855F7" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
        {/* Inner highlight — left (lighter sheen near top-inner edge) */}
        <radialGradient id="tm-lh" cx="65%" cy="22%" r="70%">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        {/* Inner highlight — right */}
        <radialGradient id="tm-rh" cx="35%" cy="22%" r="70%">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        {/* Node glow — applies blur + merge for glowing dots */}
        <filter id="tm-ng" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Border stroke glow */}
        <filter id="tm-bg" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Clip paths — keep traces inside each hemisphere */}
        <clipPath id="tm-lc">
          <path d="M 32,9 C 26,5 12,6 5,16 C 0,25 1,39 5,50 C 9,59 20,64 28,63 L 32,63 L 32,9 Z" />
        </clipPath>
        <clipPath id="tm-rc">
          <path d="M 32,9 C 38,5 52,6 59,16 C 64,25 63,39 59,50 C 55,59 44,64 36,63 L 32,63 L 32,9 Z" />
        </clipPath>
      </defs>

      {/* ── LEFT HEMISPHERE ── */}
      <path
        d="M 32,9 C 26,5 12,6 5,16 C 0,25 1,39 5,50 C 9,59 20,64 28,63 L 32,63 L 32,9 Z"
        fill="url(#tm-lg)"
      />
      <path
        d="M 32,9 C 26,5 12,6 5,16 C 0,25 1,39 5,50 C 9,59 20,64 28,63 L 32,63 L 32,9 Z"
        fill="url(#tm-lh)"
      />
      {/* Glowing left border */}
      <path
        d="M 32,9 C 26,5 12,6 5,16 C 0,25 1,39 5,50 C 9,59 20,64 28,63 L 32,63"
        fill="none" stroke="#00D4FF" strokeWidth="1.3" strokeOpacity="0.9" strokeLinecap="round"
        filter="url(#tm-bg)"
      />

      {/* Left circuit traces + nodes */}
      <g clipPath="url(#tm-lc)">
        <g stroke="#22D3EE" strokeWidth="0.85" strokeOpacity="0.85" strokeLinecap="round">
          <line x1="8"  y1="21" x2="30" y2="21" />
          <line x1="5"  y1="34" x2="30" y2="34" />
          <line x1="8"  y1="47" x2="30" y2="47" />
          <line x1="14" y1="21" x2="14" y2="47" />
          <line x1="22" y1="21" x2="22" y2="34" />
          <line x1="22" y1="34" x2="30" y2="21" />
        </g>
        <g filter="url(#tm-ng)">
          <circle cx="8"  cy="21" r="1.4" fill="#00EEFF" />
          <circle cx="14" cy="21" r="2.0" fill="#00D4FF" />
          <circle cx="22" cy="21" r="1.6" fill="#4FC3F7" />
          <circle cx="30" cy="21" r="1.1" fill="#00EEFF" />
          <circle cx="5"  cy="34" r="1.4" fill="#00EEFF" />
          <circle cx="14" cy="34" r="2.0" fill="#00D4FF" />
          <circle cx="22" cy="34" r="1.6" fill="#4FC3F7" />
          <circle cx="30" cy="34" r="1.1" fill="#00EEFF" />
          <circle cx="8"  cy="47" r="1.4" fill="#00EEFF" />
          <circle cx="14" cy="47" r="2.0" fill="#00D4FF" />
          <circle cx="30" cy="47" r="1.1" fill="#00EEFF" />
        </g>
      </g>

      {/* ── RIGHT HEMISPHERE ── */}
      <path
        d="M 32,9 C 38,5 52,6 59,16 C 64,25 63,39 59,50 C 55,59 44,64 36,63 L 32,63 L 32,9 Z"
        fill="url(#tm-rg)"
      />
      <path
        d="M 32,9 C 38,5 52,6 59,16 C 64,25 63,39 59,50 C 55,59 44,64 36,63 L 32,63 L 32,9 Z"
        fill="url(#tm-rh)"
      />
      {/* Glowing right border */}
      <path
        d="M 32,9 C 38,5 52,6 59,16 C 64,25 63,39 59,50 C 55,59 44,64 36,63 L 32,63"
        fill="none" stroke="#A855F7" strokeWidth="1.3" strokeOpacity="0.9" strokeLinecap="round"
        filter="url(#tm-bg)"
      />

      {/* Right circuit traces + nodes */}
      <g clipPath="url(#tm-rc)">
        <g stroke="#C084FC" strokeWidth="0.85" strokeOpacity="0.85" strokeLinecap="round">
          <line x1="34" y1="21" x2="56" y2="21" />
          <line x1="34" y1="34" x2="59" y2="34" />
          <line x1="34" y1="47" x2="56" y2="47" />
          <line x1="50" y1="21" x2="50" y2="47" />
          <line x1="42" y1="21" x2="42" y2="34" />
          <line x1="42" y1="34" x2="34" y2="21" />
        </g>
        <g filter="url(#tm-ng)">
          <circle cx="34" cy="21" r="1.1" fill="#E879F9" />
          <circle cx="42" cy="21" r="1.6" fill="#C084FC" />
          <circle cx="50" cy="21" r="2.0" fill="#A855F7" />
          <circle cx="56" cy="21" r="1.4" fill="#E879F9" />
          <circle cx="34" cy="34" r="1.1" fill="#E879F9" />
          <circle cx="42" cy="34" r="1.6" fill="#C084FC" />
          <circle cx="50" cy="34" r="2.0" fill="#A855F7" />
          <circle cx="59" cy="34" r="1.4" fill="#E879F9" />
          <circle cx="34" cy="47" r="1.1" fill="#E879F9" />
          <circle cx="50" cy="47" r="2.0" fill="#A855F7" />
          <circle cx="56" cy="47" r="1.4" fill="#E879F9" />
        </g>
      </g>

      {/* ── CENTER DIVIDER (corpus callosum) ── */}
      <line
        x1="32" y1="9" x2="32" y2="63"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1.5"
        strokeDasharray="2.5 2.5"
        strokeLinecap="round"
      />

      {/* Central synapse node — corpus callosum connection point */}
      <g filter="url(#tm-ng)">
        <circle cx="32" cy="36" r="3.2" fill="#FFFFFF" fillOpacity="0.8" />
        <circle cx="32" cy="36" r="1.6" fill="#FFFFFF" />
      </g>

      {/* Top bridge highlight */}
      <ellipse cx="32" cy="9.5" rx="3.5" ry="1.8" fill="rgba(255,255,255,0.18)" />
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

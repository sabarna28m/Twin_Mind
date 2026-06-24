import type { CSSProperties } from 'react';

/* ═══════════════════════════════════════════════════════════════════════
   TwinMind Brain SVG — proper brain silhouette with dual lobe profile
   Left half:  cyan → blue   (#00D4FF → #4F7CFF)
   Right half: purple → pink (#A855F7 → #EC4899)
   Shape:      bumpy frontal + parietal lobes, organic outer curve, brainstem
   Interior:   circuit traces + glowing nodes  (no central synapse dot)
   Hover:      CSS class "brain-logo-icon" — glow amplifies on hover

   Brain outline (64×64 viewBox, centred on x=32):
     LEFT  — counterclockwise from (32,8):
       arc UP-LEFT  → frontal lobe peak ≈ (22, 1)
       sulcus dip   ≈ (13, 9)
       UP again     → parietal bump ≈ (7, 5)
       sweep down   → left outer edge → temporal base → (32,57)
       straight L   → center line back to (32,8)
     RIGHT — perfect mirror of left.
═══════════════════════════════════════════════════════════════════════ */

/* shared path data — defined outside JSX for clarity */
const LP  = 'M 32,8 C 28,2 22,0 18,4 C 15,7 13,10 11,9 C 9,8 6,4 4,9 C 1,14 1,22 3,30 C 5,38 6,44 9,48 C 12,53 17,57 22,58 C 26,59 30,59 32,57 L 32,8 Z';
const RP  = 'M 32,8 C 36,2 42,0 46,4 C 49,7 51,10 53,9 C 55,8 58,4 60,9 C 63,14 63,22 61,30 C 59,38 58,44 55,48 C 52,53 47,57 42,58 C 38,59 34,59 32,57 L 32,8 Z';
/* open-arc versions (omit closing center-line segment) for border strokes */
const LA  = 'M 32,8 C 28,2 22,0 18,4 C 15,7 13,10 11,9 C 9,8 6,4 4,9 C 1,14 1,22 3,30 C 5,38 6,44 9,48 C 12,53 17,57 22,58 C 26,59 30,59 32,57';
const RA  = 'M 32,8 C 36,2 42,0 46,4 C 49,7 51,10 53,9 C 55,8 58,4 60,9 C 63,14 63,22 61,30 C 59,38 58,44 55,48 C 52,53 47,57 42,58 C 38,59 34,59 32,57';

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
        {/* ── Hemisphere fills ── */}
        <linearGradient id="tm-lg" x1="3" y1="2" x2="30" y2="59" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#00D4FF" />
          <stop offset="100%" stopColor="#4F7CFF" />
        </linearGradient>
        <linearGradient id="tm-rg" x1="61" y1="2" x2="34" y2="59" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#A855F7" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>

        {/* ── Specular sheen overlays ── */}
        <radialGradient id="tm-lh" cx="68%" cy="18%" r="65%">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"    />
        </radialGradient>
        <radialGradient id="tm-rh" cx="32%" cy="18%" r="65%">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"    />
        </radialGradient>

        {/* ── SVG glow filters ── */}
        {/* Circuit nodes */}
        <filter id="tm-ng" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Outer border stroke */}
        <filter id="tm-bg" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.0" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* ── Clip paths — circuit traces stay inside each lobe ── */}
        <clipPath id="tm-lc"><path d={LP} /></clipPath>
        <clipPath id="tm-rc"><path d={RP} /></clipPath>
      </defs>

      {/* ══════════════════════════════════════════
          LEFT HEMISPHERE
      ══════════════════════════════════════════ */}

      {/* Solid gradient fill */}
      <path d={LP} fill="url(#tm-lg)" />
      {/* Specular sheen */}
      <path d={LP} fill="url(#tm-lh)" />
      {/* Glowing outer border (arc only, not the straight center edge) */}
      <path d={LA} fill="none"
            stroke="#00D4FF" strokeWidth="1.6" strokeOpacity="0.95" strokeLinecap="round"
            filter="url(#tm-bg)" />

      {/* Left neural-circuit network */}
      <g clipPath="url(#tm-lc)">
        {/* Trace lines */}
        <g stroke="#22D3EE" strokeWidth="0.9" strokeOpacity="0.82" strokeLinecap="round">
          {/* Three horizontal rails */}
          <line x1="9"  y1="20" x2="29" y2="20" />
          <line x1="6"  y1="32" x2="29" y2="32" />
          <line x1="9"  y1="45" x2="29" y2="45" />
          {/* Vertical spine */}
          <line x1="15" y1="20" x2="15" y2="45" />
          {/* Upper branch */}
          <line x1="23" y1="20" x2="23" y2="32" />
          {/* Diagonal — inner to mid (gives neural branching feel) */}
          <line x1="23" y1="32" x2="29" y2="20" />
          {/* Lower branch diagonal */}
          <line x1="15" y1="32" x2="9"  y2="45" />
        </g>
        {/* Glowing circular nodes at intersections + endpoints */}
        <g filter="url(#tm-ng)">
          <circle cx="9"  cy="20" r="1.4" fill="#00EEFF" />
          <circle cx="15" cy="20" r="2.2" fill="#00D4FF" />
          <circle cx="23" cy="20" r="1.7" fill="#4FC3F7" />
          <circle cx="29" cy="20" r="1.1" fill="#00EEFF" />
          <circle cx="6"  cy="32" r="1.4" fill="#00EEFF" />
          <circle cx="15" cy="32" r="2.2" fill="#00D4FF" />
          <circle cx="23" cy="32" r="1.7" fill="#4FC3F7" />
          <circle cx="29" cy="32" r="1.1" fill="#00EEFF" />
          <circle cx="9"  cy="45" r="1.5" fill="#00EEFF" />
          <circle cx="15" cy="45" r="2.2" fill="#00D4FF" />
          <circle cx="29" cy="45" r="1.1" fill="#00EEFF" />
        </g>
      </g>

      {/* ══════════════════════════════════════════
          RIGHT HEMISPHERE (exact mirror)
      ══════════════════════════════════════════ */}

      <path d={RP} fill="url(#tm-rg)" />
      <path d={RP} fill="url(#tm-rh)" />
      <path d={RA} fill="none"
            stroke="#A855F7" strokeWidth="1.6" strokeOpacity="0.95" strokeLinecap="round"
            filter="url(#tm-bg)" />

      <g clipPath="url(#tm-rc)">
        <g stroke="#C084FC" strokeWidth="0.9" strokeOpacity="0.82" strokeLinecap="round">
          <line x1="35" y1="20" x2="55" y2="20" />
          <line x1="35" y1="32" x2="58" y2="32" />
          <line x1="35" y1="45" x2="55" y2="45" />
          <line x1="49" y1="20" x2="49" y2="45" />
          <line x1="41" y1="20" x2="41" y2="32" />
          <line x1="41" y1="32" x2="35" y2="20" />
          <line x1="49" y1="32" x2="55" y2="45" />
        </g>
        <g filter="url(#tm-ng)">
          <circle cx="35" cy="20" r="1.1" fill="#E879F9" />
          <circle cx="41" cy="20" r="1.7" fill="#C084FC" />
          <circle cx="49" cy="20" r="2.2" fill="#A855F7" />
          <circle cx="55" cy="20" r="1.4" fill="#E879F9" />
          <circle cx="35" cy="32" r="1.1" fill="#E879F9" />
          <circle cx="41" cy="32" r="1.7" fill="#C084FC" />
          <circle cx="49" cy="32" r="2.2" fill="#A855F7" />
          <circle cx="58" cy="32" r="1.4" fill="#E879F9" />
          <circle cx="35" cy="45" r="1.1" fill="#E879F9" />
          <circle cx="49" cy="45" r="2.2" fill="#A855F7" />
          <circle cx="55" cy="45" r="1.5" fill="#E879F9" />
        </g>
      </g>

      {/* ══════════════════════════════════════════
          ANATOMICAL DETAILS
      ══════════════════════════════════════════ */}

      {/* Interhemispheric fissure — dashed center split */}
      <line x1="32" y1="8" x2="32" y2="57"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="1.4" strokeDasharray="3 2.5" strokeLinecap="round" />

      {/* Gyri fold hints — short arc marks on outer lobe edges */}
      {/* Left frontal lobe fold */}
      <path d="M 20,3 C 19.5,2 18.5,1.5 17.5,2.5"
            fill="none" stroke="#22D3EE" strokeWidth="0.8"
            strokeOpacity="0.6" strokeLinecap="round" />
      {/* Left parietal lobe fold */}
      <path d="M 11,8 C 10.5,7 9.5,6.5 8.5,7.5"
            fill="none" stroke="#22D3EE" strokeWidth="0.8"
            strokeOpacity="0.5" strokeLinecap="round" />
      {/* Right frontal lobe fold (mirror) */}
      <path d="M 44,3 C 44.5,2 45.5,1.5 46.5,2.5"
            fill="none" stroke="#C084FC" strokeWidth="0.8"
            strokeOpacity="0.6" strokeLinecap="round" />
      {/* Right parietal lobe fold (mirror) */}
      <path d="M 53,8 C 53.5,7 54.5,6.5 55.5,7.5"
            fill="none" stroke="#C084FC" strokeWidth="0.8"
            strokeOpacity="0.5" strokeLinecap="round" />

      {/* Brainstem — narrow rounded stem at bottom center */}
      <path d="M 29.5,57 C 29,59 29.5,62 32,63 C 34.5,62 35,59 34.5,57"
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
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

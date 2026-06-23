interface Props { size?: number }

export default function TwinRobotAvatar({ size = 140 }: Props) {
  return (
    <svg
      viewBox="0 0 140 162"
      width={size}
      height={size}
      style={{
        animation: 'hero-float 3s ease-in-out infinite',
        filter: 'drop-shadow(0 0 18px rgba(0,212,255,0.38)) drop-shadow(0 4px 12px rgba(0,0,0,0.4))',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rab" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#DCE9F8" />
          <stop offset="100%" stopColor="#B4C8E6" />
        </linearGradient>
        <radialGradient id="rae" cx="35%" cy="35%" r="70%">
          <stop offset="0%"   stopColor="#AAFFFF" />
          <stop offset="60%"  stopColor="#00D4FF" />
          <stop offset="100%" stopColor="#0077CC" />
        </radialGradient>
        <linearGradient id="rac" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(99,102,241,0.28)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0.10)" />
        </linearGradient>
        {/* Ambient glow behind robot */}
        <radialGradient id="rag" cx="50%" cy="55%" r="50%">
          <stop offset="0%"   stopColor="rgba(0,212,255,0.18)" />
          <stop offset="100%" stopColor="rgba(0,212,255,0)"    />
        </radialGradient>
      </defs>

      {/* Ambient glow ellipse */}
      <ellipse cx="70" cy="108" rx="58" ry="52" fill="url(#rag)" />

      {/* ── Antenna ─────────────────────────────────────────────────────── */}
      <line x1="70" y1="19" x2="70" y2="6"
        stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="70" cy="4" r="5.5"
        fill="#00D4FF"
        style={{ filter: 'drop-shadow(0 0 5px rgba(0,212,255,0.9))' }} />
      <circle cx="70" cy="4" r="2.5" fill="white" opacity="0.7" />

      {/* ── Head ─────────────────────────────────────────────────────────── */}
      <rect x="29" y="18" width="82" height="66" rx="24"
        fill="url(#rab)"
        stroke="rgba(99,102,241,0.45)" strokeWidth="1.5" />

      {/* Ear panels */}
      <rect x="20" y="34" width="10" height="22" rx="5"
        fill="#C8D8EE" stroke="rgba(99,102,241,0.25)" strokeWidth="1" />
      <rect x="110" y="34" width="10" height="22" rx="5"
        fill="#C8D8EE" stroke="rgba(99,102,241,0.25)" strokeWidth="1" />

      {/* ── Left eye ─────────────────────────────────────────────────────── */}
      <circle cx="52" cy="48" r="14" fill="rgba(0,212,255,0.12)" />
      <circle cx="52" cy="48" r="10"  fill="url(#rae)" />
      <circle cx="52" cy="48" r="4.5" fill="#003A6E" opacity="0.55" />
      <circle cx="49" cy="45" r="3"   fill="white"   opacity="0.8"  />

      {/* ── Right eye ────────────────────────────────────────────────────── */}
      <circle cx="88" cy="48" r="14" fill="rgba(0,212,255,0.12)" />
      <circle cx="88" cy="48" r="10"  fill="url(#rae)" />
      <circle cx="88" cy="48" r="4.5" fill="#003A6E" opacity="0.55" />
      <circle cx="85" cy="45" r="3"   fill="white"   opacity="0.8"  />

      {/* ── Smile ────────────────────────────────────────────────────────── */}
      <path d="M 54,70 Q 70,82 86,70"
        stroke="#6366F1" strokeWidth="2.5" fill="none" strokeLinecap="round" />

      {/* ── Neck ─────────────────────────────────────────────────────────── */}
      <rect x="58" y="83" width="24" height="11" rx="5"
        fill="#C0D2EA" stroke="rgba(99,102,241,0.25)" strokeWidth="1" />

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <rect x="18" y="92" width="104" height="52" rx="18"
        fill="url(#rab)"
        stroke="rgba(99,102,241,0.38)" strokeWidth="1.5" />

      {/* Chest panel */}
      <rect x="34" y="102" width="72" height="32" rx="9"
        fill="url(#rac)"
        stroke="rgba(99,102,241,0.5)" strokeWidth="1" />

      {/* LED indicators */}
      <circle cx="52" cy="118" r="5"
        fill="#00D4FF"
        style={{ filter: 'drop-shadow(0 0 5px rgba(0,212,255,0.9))' }} />
      <circle cx="70" cy="118" r="5"
        fill="#8B5CF6"
        style={{ filter: 'drop-shadow(0 0 5px rgba(139,92,246,0.8))' }} />
      <circle cx="88" cy="118" r="5"
        fill="#22C55E"
        style={{ filter: 'drop-shadow(0 0 5px rgba(34,197,94,0.7))' }} />

      {/* ── Arms ─────────────────────────────────────────────────────────── */}
      <rect x="2"   y="96" width="15" height="38" rx="7.5"
        fill="url(#rab)" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" />
      <rect x="123" y="96" width="15" height="38" rx="7.5"
        fill="url(#rab)" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" />

      {/* Arm joint accents */}
      <circle cx="9.5"  cy="96" r="4" fill="#C0D2EA" />
      <circle cx="130.5" cy="96" r="4" fill="#C0D2EA" />

      {/* ── Legs ─────────────────────────────────────────────────────────── */}
      <rect x="36" y="142" width="24" height="16" rx="7"
        fill="#C0D2EA" stroke="rgba(99,102,241,0.22)" strokeWidth="1" />
      <rect x="80" y="142" width="24" height="16" rx="7"
        fill="#C0D2EA" stroke="rgba(99,102,241,0.22)" strokeWidth="1" />

      {/* Foot base highlight */}
      <rect x="37" y="154" width="22" height="4" rx="2" fill="rgba(99,102,241,0.15)" />
      <rect x="81" y="154" width="22" height="4" rx="2" fill="rgba(99,102,241,0.15)" />
    </svg>
  );
}

export default function SplashScreen() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, #050816 0%, #0B0D2E 45%, #120827 75%, #050816 100%)',
      overflow: 'hidden',
    }}>
      {/* Ambient orb — electric blue */}
      <div style={{
        position: 'absolute',
        top: '-15%', left: '-8%',
        width: '520px', height: '520px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
        animation: 'orb-drift-1 14s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      {/* Ambient orb — neon purple */}
      <div style={{
        position: 'absolute',
        bottom: '-18%', right: '-8%',
        width: '480px', height: '480px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(168,85,247,0.13) 0%, transparent 70%)',
        animation: 'orb-drift-2 17s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      {/* Ambient orb — cyan accent */}
      <div style={{
        position: 'absolute',
        top: '38%', left: '38%',
        width: '340px', height: '340px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(34,211,238,0.07) 0%, transparent 70%)',
        animation: 'orb-drift-3 11s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Logo + tagline */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        animation: 'splash-logo-in 0.75s cubic-bezier(0.16,1,0.3,1) both',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Glow halo */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            position: 'absolute',
            inset: '-52px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,212,255,0.2) 0%, rgba(168,85,247,0.1) 55%, transparent 75%)',
            animation: 'breathe 3.5s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
          <img
            src="/assets/twinmind-logo.png"
            alt="TwinMind"
            style={{
              width: 110,
              height: 'auto',
              display: 'block',
              filter: 'drop-shadow(0 0 24px rgba(0,212,255,0.35)) drop-shadow(0 0 12px rgba(168,85,247,0.25))',
            }}
          />
        </div>

        {/* Tagline */}
        <p style={{
          margin: '1.5rem 0 0',
          fontSize: '0.72rem',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'rgba(148,163,184,0.5)',
          fontWeight: 600,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}>
          AI Learning Platform
        </p>
      </div>

      {/* Loading bar */}
      <div style={{
        position: 'absolute',
        bottom: '13%',
        width: '120px',
        height: '2px',
        borderRadius: '99px',
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: '60%',
          borderRadius: '99px',
          background: 'linear-gradient(90deg, #22D3EE, #3B82F6, #A855F7)',
          animation: 'progress-slide 1.4s ease-in-out infinite',
        }} />
      </div>
    </div>
  );
}

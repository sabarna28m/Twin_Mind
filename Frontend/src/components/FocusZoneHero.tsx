import { Link } from 'react-router-dom';

export default function FocusZoneHero() {
  return (
    <div style={fz.wrap}>
      <div style={fz.orb1} />
      <div style={fz.orb2} />
      <div style={fz.gridLines} />

      <div style={fz.content} className="mob-hero-content">

        {/* Left — text */}
        <div style={fz.left} className="mob-hero-left">
          <div style={fz.tagRow}>
            <span style={fz.pulseDot} className="live-dot" />
            <span style={fz.tag}>AI FOCUS DETECTOR · HERO FEATURE</span>
          </div>
          <h2 style={fz.title}>
            AI-Powered<br />
            <span style={fz.titleAccent}>Focus Zone</span>
          </h2>
          <p style={fz.desc}>
            Real-time webcam attention monitoring using computer vision.
            Track your live focus score and eliminate distractions during deep work.
          </p>
          <div style={fz.statsRow}>
            {[
              { val: 'Real-Time', lbl: 'Analysis'  },
              { val: 'AI Vision', lbl: 'Detection' },
              { val: 'Live Score', lbl: 'Tracking' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div>
                  <p style={fz.statVal}>{s.val}</p>
                  <p style={fz.statLbl}>{s.lbl}</p>
                </div>
                {i < 2 && <div style={fz.divider} />}
              </div>
            ))}
          </div>
          <div style={fz.btnRow}>
            <Link to="/ai-focus" style={fz.primaryBtn}>👁 Start AI Focus Session</Link>
            <Link to="/focus"    style={fz.secondaryBtn}>⏱ Classic Timer</Link>
          </div>
        </div>

        {/* Right — visual mock */}
        <div style={fz.right} className="mob-hero-right">
          <div style={fz.previewCard}>
            <div style={fz.previewHeader}>
              <span style={fz.previewDot} className="live-dot" />
              <span style={fz.previewLabel}>AI Focus Monitor</span>
              <span style={fz.previewLive}>● LIVE</span>
            </div>

            {/* Camera frame */}
            <div style={fz.camFrame}>
              <span style={{ fontSize: '2.75rem', opacity: 0.25 }}>👤</span>
              {/* Focus rings */}
              <div style={fz.ring1} />
              <div style={fz.ring2} />
              {/* Corner markers */}
              {[
                { top: '8px', left: '8px',  borderTop: '2px solid #00D4FF', borderLeft: '2px solid #00D4FF' },
                { top: '8px', right: '8px', borderTop: '2px solid #00D4FF', borderRight: '2px solid #00D4FF' },
                { bottom: '8px', left: '8px',  borderBottom: '2px solid #00D4FF', borderLeft: '2px solid #00D4FF' },
                { bottom: '8px', right: '8px', borderBottom: '2px solid #00D4FF', borderRight: '2px solid #00D4FF' },
              ].map((c, i) => (
                <div key={i} style={{ position: 'absolute', width: '12px', height: '12px', ...c }} />
              ))}
            </div>

            {/* Score */}
            <div style={fz.scoreRow}>
              <span style={fz.scoreLabel}>Focus Score</span>
              <span style={fz.scoreValue}>—</span>
            </div>

            {/* Metrics */}
            <div style={fz.metricRow}>
              {[
                { label: 'Status',  value: 'Ready'  },
                { label: 'Session', value: '00:00'  },
                { label: 'Alerts',  value: '0'      },
              ].map((m, i) => (
                <div key={i} style={fz.metricCol}>
                  <p style={fz.metricLabel}>{m.label}</p>
                  <p style={fz.metricValue}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

const fz: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative', overflow: 'hidden',
    background: 'linear-gradient(135deg, rgba(0,6,20,0.98) 0%, rgba(4,0,18,0.98) 40%, rgba(0,8,26,0.98) 100%)',
    border: '1px solid rgba(0,212,255,0.16)',
    borderRadius: '24px',
    padding: '2.25rem',
    boxShadow: '0 0 80px rgba(0,212,255,0.05), 0 8px 60px rgba(0,0,0,0.6)',
  },
  orb1: {
    position: 'absolute', width: '600px', height: '600px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 55%)',
    top: '-200px', right: '-120px', pointerEvents: 'none',
    animation: 'orb-drift-1 18s ease-in-out infinite',
  },
  orb2: {
    position: 'absolute', width: '400px', height: '400px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(124,58,237,0.09) 0%, transparent 60%)',
    bottom: '-150px', left: '28%', pointerEvents: 'none',
    animation: 'orb-drift-2 14s ease-in-out infinite',
  },
  gridLines: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage:
      'linear-gradient(rgba(0,212,255,0.022) 1px, transparent 1px),' +
      'linear-gradient(90deg, rgba(0,212,255,0.022) 1px, transparent 1px)',
    backgroundSize: '42px 42px',
  },
  content: {
    position: 'relative', zIndex: 1,
    display: 'flex', alignItems: 'center', gap: '3rem',
  },
  left:  { flex: 1 },
  right: { flexShrink: 0 },

  tagRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.9rem' },
  pulseDot: {
    display: 'inline-block',
    width: '8px', height: '8px', borderRadius: '50%',
    background: '#00D4FF',
  },
  tag: { fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.14em', color: '#00D4FF', opacity: 0.7 },

  title: {
    margin: '0 0 0.85rem',
    fontSize: '2.55rem', fontWeight: 900, lineHeight: 1.1,
    color: '#f8fafc', letterSpacing: '-0.9px',
  },
  titleAccent: {
    background: 'linear-gradient(135deg, #00D4FF 0%, #7C3AED 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  desc: {
    fontSize: '0.87rem', color: 'rgba(148,163,184,0.72)',
    lineHeight: 1.65, margin: '0 0 1.5rem', maxWidth: '440px',
  },
  statsRow: { display: 'flex', alignItems: 'center', gap: '0', marginBottom: '1.75rem' },
  statVal:  { margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#00D4FF' },
  statLbl:  { margin: 0, fontSize: '0.63rem', color: 'rgba(148,163,184,0.5)', fontWeight: 600 },
  divider:  { width: '1px', height: '30px', background: 'rgba(255,255,255,0.08)', margin: '0 1.25rem', flexShrink: 0 },

  btnRow: { display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap' as const },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.72rem 1.4rem',
    background: 'linear-gradient(135deg, #00D4FF, #7C3AED)',
    borderRadius: '12px',
    color: '#fff', fontSize: '0.88rem', fontWeight: 800,
    textDecoration: 'none', letterSpacing: '-0.2px',
    boxShadow: '0 4px 24px rgba(0,212,255,0.35)',
    transition: 'box-shadow 0.2s, transform 0.18s',
  },
  secondaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.7rem 1.2rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
    color: 'rgba(226,232,240,0.75)', fontSize: '0.85rem', fontWeight: 700,
    textDecoration: 'none', transition: 'background 0.2s',
  },

  previewCard: {
    width: '252px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(0,212,255,0.15)',
    borderRadius: '18px', padding: '1.1rem',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 0 40px rgba(0,212,255,0.07)',
  },
  previewHeader: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    marginBottom: '0.85rem',
  },
  previewDot:  { display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#00D4FF' },
  previewLabel:{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(148,163,184,0.65)', flex: 1 },
  previewLive: { fontSize: '0.6rem', fontWeight: 800, color: '#10b981', letterSpacing: '0.07em' },

  camFrame: {
    height: '124px',
    background: 'rgba(0,0,0,0.55)',
    borderRadius: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: '0.85rem',
    position: 'relative', overflow: 'hidden',
    border: '1px solid rgba(0,212,255,0.1)',
  },
  ring1: {
    position: 'absolute', width: '75px', height: '75px', borderRadius: '50%',
    border: '1.5px solid rgba(0,212,255,0.3)',
    animation: 'breathe 3s ease-in-out infinite',
  },
  ring2: {
    position: 'absolute', width: '105px', height: '105px', borderRadius: '50%',
    border: '1px solid rgba(0,212,255,0.14)',
    animation: 'breathe 3s ease-in-out infinite 0.6s',
  },

  scoreRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '0.65rem',
  },
  scoreLabel: { fontSize: '0.68rem', color: 'rgba(148,163,184,0.5)', fontWeight: 600 },
  scoreValue: { fontSize: '1.55rem', fontWeight: 900, color: '#00D4FF' },

  metricRow: {
    display: 'flex',
    borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.65rem',
  },
  metricCol:   { flex: 1, textAlign: 'center' as const },
  metricLabel: { margin: 0, fontSize: '0.57rem', color: 'rgba(148,163,184,0.45)', fontWeight: 600 },
  metricValue: { margin: 0, fontSize: '0.77rem', fontWeight: 700, color: '#e2e8f0' },
};

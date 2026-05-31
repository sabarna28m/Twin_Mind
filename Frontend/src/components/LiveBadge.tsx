const badge: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.3rem',
  padding: '0.2rem 0.6rem',
  background: 'rgba(16,185,129,0.12)',
  border: '1px solid rgba(16,185,129,0.3)',
  borderRadius: '99px',
  fontSize: '0.65rem', fontWeight: 700,
  color: '#10b981', letterSpacing: '0.04em',
};

const dot: React.CSSProperties = {
  width: '6px', height: '6px', borderRadius: '50%',
  background: '#10b981', boxShadow: '0 0 6px #10b981', flexShrink: 0,
};

export default function LiveBadge() {
  return (
    <div style={badge}>
      <span style={dot} className="live-dot" />
      Live
    </div>
  );
}

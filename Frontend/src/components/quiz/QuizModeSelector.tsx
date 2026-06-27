interface Props {
  onSelectMode: (mode: 'practice' | 'focus') => void;
}

export default function QuizModeSelector({ onSelectMode }: Props) {
  return (
    <div style={s.shell}>
      <header style={s.nav}>
        <span style={s.navTitle}>🧠 Quiz Mode</span>
      </header>

      <main style={s.main}>
        <div style={s.header}>
          <h1 style={s.title}>Choose Your Assessment Mode</h1>
          <p style={s.sub}>Select how you want to approach this quiz session</p>
        </div>

        <div style={s.grid}>

          {/* ── Practice Mode ── */}
          <button onClick={() => onSelectMode('practice')} style={s.card}>
            <div style={{ ...s.cardGlow, background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 65%)' }} />
            <div style={{ ...s.iconWrap, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              <span style={s.icon}>📚</span>
            </div>
            <h2 style={s.cardTitle}>Practice Quiz</h2>
            <p style={s.cardDesc}>
              Flexible, self-paced learning. No monitoring required.
              Pause anytime and review answers at your own speed.
            </p>
            <div style={s.features}>
              {['No camera or mic required', 'Pause & resume anytime', 'Full answer review', 'Performance history'].map(f => (
                <div key={f} style={s.feat}>
                  <span style={{ ...s.featDot, background: '#6366f1' }} />
                  <span style={s.featText}>{f}</span>
                </div>
              ))}
            </div>
            <div style={{ ...s.badge, background: 'rgba(99,102,241,0.12)', color: '#818cf8', borderColor: 'rgba(99,102,241,0.3)' }}>
              Relaxed Mode
            </div>
            <div style={{ ...s.cta, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              Start Practice Quiz →
            </div>
          </button>

          {/* ── Focus Mode ── */}
          <button onClick={() => onSelectMode('focus')} style={{ ...s.card, borderColor: 'rgba(0,212,255,0.2)' }}>
            <div style={{ ...s.cardGlow, background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 65%)' }} />
            <div style={{ ...s.iconWrap, background: 'linear-gradient(135deg,#00D4FF,#7C3AED)' }}>
              <span style={s.icon}>👁</span>
            </div>
            <h2 style={{ ...s.cardTitle, color: '#00D4FF' }}>Focus Mode Quiz</h2>
            <p style={s.cardDesc}>
              Full exam simulation with AI integrity monitoring.
              Camera and microphone required. Replaces the standalone AI Focus Zone.
            </p>
            <div style={s.features}>
              {['AI webcam focus monitoring', 'Tab switch detection', '6-warning integrity system', 'Post-exam integrity report'].map(f => (
                <div key={f} style={s.feat}>
                  <span style={{ ...s.featDot, background: '#00D4FF' }} />
                  <span style={s.featText}>{f}</span>
                </div>
              ))}
            </div>
            <div style={{ ...s.badge, background: 'rgba(0,212,255,0.1)', color: '#00D4FF', borderColor: 'rgba(0,212,255,0.28)' }}>
              Exam Simulation
            </div>
            <div style={{ ...s.cta, background: 'linear-gradient(135deg,#00D4FF,#7C3AED)' }}>
              Start Focus Mode Quiz →
            </div>
          </button>

        </div>
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100svh', display: 'flex', flexDirection: 'column', background: '#f8f9fa' },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 1.5rem', height: '56px',
    borderBottom: '1px solid var(--border)', background: '#f8f9fa',
    position: 'sticky', top: 0, zIndex: 50,
  },
  navTitle: { fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-h)' },
  main: {
    flex: 1, padding: '3rem 1.5rem',
    maxWidth: '800px', width: '100%', margin: '0 auto', boxSizing: 'border-box' as const,
  },
  header: { textAlign: 'center' as const, marginBottom: '2.5rem' },
  title: { fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-h)', margin: '0 0 0.5rem', letterSpacing: '-0.5px' },
  sub: { fontSize: '0.9rem', color: 'var(--text)', margin: 0 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' },
  card: {
    position: 'relative', overflow: 'hidden',
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: '20px', padding: '1.75rem',
    display: 'flex', flexDirection: 'column', gap: '1rem',
    cursor: 'pointer', textAlign: 'left' as const,
    fontFamily: 'inherit', transition: 'transform 0.18s, box-shadow 0.2s',
    boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
  },
  cardGlow: {
    position: 'absolute', top: '-60px', right: '-60px',
    width: '220px', height: '220px', borderRadius: '50%', pointerEvents: 'none',
  },
  iconWrap: {
    width: '52px', height: '52px', borderRadius: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.35)', flexShrink: 0,
  },
  icon: { fontSize: '1.5rem' },
  cardTitle: { margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-h)', position: 'relative' as const, zIndex: 1 },
  cardDesc: { margin: 0, fontSize: '0.83rem', color: 'var(--text)', lineHeight: 1.6, position: 'relative' as const, zIndex: 1 },
  features: { display: 'flex', flexDirection: 'column' as const, gap: '0.4rem', position: 'relative' as const, zIndex: 1 },
  feat: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  featDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  featText: { fontSize: '0.78rem', color: 'var(--text-h)' },
  badge: {
    display: 'inline-flex', alignSelf: 'flex-start',
    padding: '0.22rem 0.75rem', borderRadius: '99px',
    fontSize: '0.7rem', fontWeight: 700, border: '1px solid',
    position: 'relative' as const, zIndex: 1,
  },
  cta: {
    padding: '0.75rem', borderRadius: '12px', color: '#fff',
    fontSize: '0.88rem', fontWeight: 700, textAlign: 'center' as const,
    position: 'relative' as const, zIndex: 1,
    letterSpacing: '-0.1px',
  },
};

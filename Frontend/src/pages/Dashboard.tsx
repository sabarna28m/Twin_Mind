import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

const stats = [
  { label: 'Sessions',      value: '0',  icon: '▶', grad: 'linear-gradient(135deg,#6366f1,#818cf8)' },
  { label: 'Hours Studied', value: '0h', icon: '⏱', grad: 'linear-gradient(135deg,#8b5cf6,#a78bfa)' },
  { label: 'Topics',        value: '0',  icon: '🧠', grad: 'linear-gradient(135deg,#10b981,#34d399)' },
  { label: 'Day Streak',    value: '0',  icon: '🔥', grad: 'linear-gradient(135deg,#f59e0b,#fbbf24)' },
];

const quickActions = [
  { label: 'New Session',      desc: 'Start an AI-guided study session',          icon: '▶', grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)', to: '/sessions' },
  { label: 'Upload Material',  desc: 'Add notes, PDFs or slides',                 icon: '↑', grad: 'linear-gradient(135deg,#3b82f6,#06b6d4)', to: '/materials' },
  { label: 'View Progress',    desc: 'See your learning analytics',               icon: '◎', grad: 'linear-gradient(135deg,#10b981,#34d399)', to: '/progress' },
  { label: 'Predict Score',    desc: 'ML-powered exam score prediction',          icon: '🎯', grad: 'linear-gradient(135deg,#8b5cf6,#d946ef)', to: '/predict' },
  { label: 'What-If Simulator',desc: 'Explore how habit changes affect your score',icon: '⚡', grad: 'linear-gradient(135deg,#f59e0b,#ef4444)', to: '/simulate' },
  { label: 'AI Mentor',        desc: 'Get personalised advice from your mentor',  icon: '💬', grad: 'linear-gradient(135deg,#ec4899,#8b5cf6)', to: '/mentor' },
  { label: 'Digital Twin',     desc: 'View your living academic model',           icon: '◈', grad: 'linear-gradient(135deg,#06b6d4,#6366f1)', to: '/twin' },
];

const navItems = [
  { label: 'Sessions',  to: '/sessions'  },
  { label: 'Notes',     to: '/notes'     },
  { label: 'Materials', to: '/materials' },
  { label: 'Check-in',  to: '/checkin'   },
  { label: 'Simulate',  to: '/simulate'  },
  { label: 'Mentor',    to: '/mentor'    },
  { label: 'Twin',      to: '/twin'      },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.full_name?.split(' ')[0] ?? '';

  return (
    <div style={s.shell}>
      {/* ── Navbar ── */}
      <header style={s.nav}>
        <div style={s.navLeft}>
          <span style={s.logoIcon}>◈</span>
          <span style={s.navLogo}>TwinMind</span>
        </div>
        <nav style={s.navCenter}>
          {navItems.map(n => (
            <Link key={n.to} to={n.to} className="nav-link">{n.label}</Link>
          ))}
        </nav>
        <div style={s.navRight}>
          <ThemeToggle />
          <Link to="/profile" style={s.navUser}>{user?.full_name}</Link>
          <button className="sign-out-btn" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main style={s.main}>
        {/* ── Hero ── */}
        <section style={s.hero} className="animate-slide-up">
          <p style={s.greetingLabel}>{greeting}</p>
          <h1 style={s.heroTitle}>{firstName} <span style={s.wave}>👋</span></h1>
          <p style={s.heroSub}>Here's your learning overview for today.</p>
        </section>

        {/* ── Stats ── */}
        <section style={s.statsGrid}>
          {stats.map((stat, i) => (
            <div key={stat.label} style={{ ...s.statCard, animationDelay: `${i * 80}ms` }} className="animate-slide-up">
              <div style={{ ...s.statIconWrap, background: stat.grad }}>
                <span style={s.statIcon}>{stat.icon}</span>
              </div>
              <div>
                <p style={s.statValue}>{stat.value}</p>
                <p style={s.statLabel}>{stat.label}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ── Two-col ── */}
        <div style={s.cols}>
          {/* Recent sessions */}
          <section style={s.panel}>
            <h2 style={s.panelTitle}>Recent Sessions</h2>
            <div style={s.empty}>
              <div style={s.emptyOrb} />
              <p style={s.emptyIcon}>📖</p>
              <p style={s.emptyText}>No sessions yet</p>
              <p style={s.emptySub}>Start your first session to see it here.</p>
              <Link to="/sessions" style={s.emptyBtn}>Start a session →</Link>
            </div>
          </section>

          {/* Quick actions */}
          <section style={s.panel}>
            <h2 style={s.panelTitle}>Quick Actions</h2>
            <div style={s.actionList}>
              {quickActions.map(a => (
                <Link key={a.label} to={a.to} className="action-card">
                  <div style={{ ...s.actionIconBadge, background: a.grad }}>
                    <span style={s.actionIconInner}>{a.icon}</span>
                  </div>
                  <div>
                    <p style={s.actionLabel}>{a.label}</p>
                    <p style={s.actionDesc}>{a.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100svh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(180deg, #080d1a 0%, #0a0f20 100%)',
  },

  /* Navbar */
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.75rem',
    height: '60px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(8,13,26,0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '0.45rem' },
  logoIcon: { fontSize: '1.1rem', color: '#6366f1' },
  navLogo: { fontSize: '1.05rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.3px' },
  navCenter: { display: 'flex', alignItems: 'center', gap: '0.15rem' },
  navRight: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  navUser: { fontSize: '0.8rem', color: '#94a3b8', textDecoration: 'none', fontWeight: 500 },

  /* Main */
  main: {
    flex: 1,
    padding: '2.5rem 2rem',
    maxWidth: '1000px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },

  /* Hero */
  hero: { marginBottom: '2.25rem' },
  greetingLabel: { fontSize: '0.8rem', color: '#6366f1', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '0.4rem' },
  heroTitle: { fontSize: '2rem', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.5px', marginBottom: '0.35rem' },
  wave: { display: 'inline-block', animation: 'float 3s ease-in-out infinite' },
  heroSub: { fontSize: '0.95rem', color: '#64748b' },

  /* Stats */
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
    marginBottom: '2rem',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1.25rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    backdropFilter: 'blur(10px)',
  },
  statIconWrap: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  statIcon: { fontSize: '1.1rem' },
  statValue: { fontSize: '1.6rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.1, marginBottom: '0.2rem' },
  statLabel: { fontSize: '0.72rem', color: '#64748b', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const },

  /* Two-col */
  cols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' },
  panel: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
    padding: '1.5rem',
    backdropFilter: 'blur(10px)',
  },
  panelTitle: { fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '1.25rem', letterSpacing: '-0.1px' },

  /* Empty state */
  empty: { padding: '1.5rem 1rem', textAlign: 'center', position: 'relative' as const },
  emptyOrb: {
    position: 'absolute', width: '160px', height: '160px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
    top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none',
  },
  emptyIcon: { fontSize: '2rem', marginBottom: '0.75rem', filter: 'grayscale(0.4)' },
  emptyText: { fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem', fontSize: '0.95rem' },
  emptySub: { fontSize: '0.82rem', color: '#475569', marginBottom: '1.25rem' },
  emptyBtn: {
    display: 'inline-block', padding: '0.5rem 1.1rem',
    background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)',
    borderRadius: '8px', color: '#818cf8', fontSize: '0.82rem', fontWeight: 600,
    textDecoration: 'none', transition: 'background 0.2s',
  },

  /* Action cards */
  actionList: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  actionIconBadge: {
    width: '36px', height: '36px', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  actionIconInner: { fontSize: '0.95rem' },
  actionLabel: { fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.1rem' },
  actionDesc: { fontSize: '0.75rem', color: '#64748b' },
};

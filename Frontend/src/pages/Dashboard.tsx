import { useAuth } from '../contexts/AuthContext';

const stats = [
  { label: 'Sessions', value: '0', icon: '📚' },
  { label: 'Hours Studied', value: '0h', icon: '⏱' },
  { label: 'Topics Covered', value: '0', icon: '🧠' },
  { label: 'Day Streak', value: '0', icon: '🔥' },
];

const quickActions = [
  { label: 'New Session', desc: 'Start an AI-guided study session', icon: '▶' },
  { label: 'Upload Material', desc: 'Add notes, PDFs or slides', icon: '↑' },
  { label: 'View Progress', desc: 'See your learning analytics', icon: '◎' },
];

export default function Dashboard() {
  const { user, logout } = useAuth();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={s.shell}>
      {/* Navbar */}
      <header style={s.nav}>
        <span style={s.navLogo}>TwinMind</span>
        <div style={s.navRight}>
          <span style={s.navUser}>{user?.full_name}</span>
          <button onClick={logout} style={s.signOut}>Sign out</button>
        </div>
      </header>

      {/* Main */}
      <main style={s.main}>
        {/* Greeting */}
        <section style={s.hero}>
          <h1 style={s.heroTitle}>{greeting}, {user?.full_name?.split(' ')[0]} 👋</h1>
          <p style={s.heroSub}>Here's your learning overview.</p>
        </section>

        {/* Stats */}
        <section style={s.statsGrid}>
          {stats.map(stat => (
            <div key={stat.label} style={s.statCard}>
              <span style={s.statIcon}>{stat.icon}</span>
              <p style={s.statValue}>{stat.value}</p>
              <p style={s.statLabel}>{stat.label}</p>
            </div>
          ))}
        </section>

        {/* Two-col layout */}
        <div style={s.cols}>
          {/* Recent sessions */}
          <section style={s.panel}>
            <h2 style={s.panelTitle}>Recent Sessions</h2>
            <div style={s.empty}>
              <p style={s.emptyIcon}>📖</p>
              <p style={s.emptyText}>No sessions yet.</p>
              <p style={s.emptySub}>Start your first session to see it here.</p>
            </div>
          </section>

          {/* Quick actions */}
          <section style={s.panel}>
            <h2 style={s.panelTitle}>Quick Actions</h2>
            <div style={s.actionList}>
              {quickActions.map(a => (
                <button key={a.label} style={s.actionCard}>
                  <span style={s.actionIcon}>{a.icon}</span>
                  <div style={s.actionText}>
                    <p style={s.actionLabel}>{a.label}</p>
                    <p style={s.actionDesc}>{a.desc}</p>
                  </div>
                </button>
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
    background: 'var(--bg)',
  },

  // Navbar
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 2rem',
    height: '60px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  navLogo: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: '-0.5px',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  navUser: {
    fontSize: '0.9rem',
    color: 'var(--text)',
  },
  signOut: {
    padding: '0.4rem 0.9rem',
    background: 'transparent',
    color: 'var(--accent)',
    border: '1px solid var(--accent-border)',
    borderRadius: '6px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },

  // Main
  main: {
    flex: 1,
    padding: '2rem',
    maxWidth: '960px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    textAlign: 'left',
  },

  // Hero
  hero: {
    marginBottom: '2rem',
    textAlign: 'left',
  },
  heroTitle: {
    margin: '0 0 0.25rem',
    fontSize: '1.75rem',
    color: 'var(--text-h)',
    fontWeight: 600,
  },
  heroSub: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '1rem',
  },

  // Stats
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  statCard: {
    padding: '1.25rem',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    textAlign: 'center',
    background: 'var(--bg)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  statIcon: {
    fontSize: '1.5rem',
  },
  statValue: {
    margin: '0.5rem 0 0.25rem',
    fontSize: '1.75rem',
    fontWeight: 700,
    color: 'var(--text-h)',
  },
  statLabel: {
    margin: 0,
    fontSize: '0.8rem',
    color: 'var(--text)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },

  // Two-col
  cols: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
  },
  panel: {
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.5rem',
    background: 'var(--bg)',
  },
  panelTitle: {
    margin: '0 0 1.25rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-h)',
  },

  // Empty state
  empty: {
    padding: '2rem 1rem',
    textAlign: 'center',
  },
  emptyIcon: {
    margin: '0 0 0.5rem',
    fontSize: '2rem',
  },
  emptyText: {
    margin: '0 0 0.25rem',
    color: 'var(--text-h)',
    fontWeight: 500,
    fontSize: '0.95rem',
  },
  emptySub: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '0.85rem',
  },

  // Quick actions
  actionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  actionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    padding: '0.875rem 1rem',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: '10px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  actionIcon: {
    fontSize: '1.1rem',
    color: 'var(--accent)',
    flexShrink: 0,
  },
  actionText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.1rem',
  },
  actionLabel: {
    margin: 0,
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-h)',
  },
  actionDesc: {
    margin: 0,
    fontSize: '0.78rem',
    color: 'var(--text)',
  },
};

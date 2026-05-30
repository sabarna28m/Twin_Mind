import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { user, logout } = useAuth();

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.logo}>TwinMind</h1>
        <p style={styles.subtitle}>AI-powered educational platform</p>

        {user && (
          <div style={styles.userBox}>
            <p style={styles.welcome}>Welcome, <strong>{user.full_name}</strong></p>
            <p style={styles.email}>{user.email}</p>
          </div>
        )}

        <button onClick={logout} style={styles.button}>Sign out</button>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100svh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  card: {
    textAlign: 'center',
    padding: '2.5rem 2rem',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    boxShadow: 'var(--shadow)',
    minWidth: '320px',
  },
  logo: {
    margin: '0 0 0.5rem',
    fontSize: '2rem',
    color: 'var(--accent)',
  },
  subtitle: {
    margin: '0 0 2rem',
    color: 'var(--text)',
    fontSize: '1rem',
  },
  userBox: {
    margin: '0 0 1.5rem',
    padding: '1rem',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: '8px',
  },
  welcome: {
    margin: '0 0 0.25rem',
    color: 'var(--text-h)',
    fontSize: '1rem',
  },
  email: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '0.875rem',
  },
  button: {
    padding: '0.6rem 1.5rem',
    background: 'transparent',
    color: 'var(--accent)',
    border: '1px solid var(--accent-border)',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

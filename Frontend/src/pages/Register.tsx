import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, fullName, password);
      navigate('/login');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setError(msg ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.logo}>TwinMind</h1>
        <h2 style={styles.title}>Create account</h2>

        {error && <p style={styles.error}>{error}</p>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Full name
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              style={styles.input}
              placeholder="Jane Doe"
              required
              autoFocus
            />
          </label>

          <label style={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={styles.input}
              placeholder="you@example.com"
              required
            />
          </label>

          <label style={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
              minLength={8}
              required
            />
          </label>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account? <Link to="/login" style={styles.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100svh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    background: 'var(--bg)',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    padding: '2.5rem 2rem',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    boxShadow: 'var(--shadow)',
    background: 'var(--bg)',
    textAlign: 'left',
  },
  logo: {
    margin: '0 0 1.5rem',
    fontSize: '1.5rem',
    letterSpacing: '-0.5px',
    color: 'var(--accent)',
    textAlign: 'center',
  },
  title: {
    margin: '0 0 1.5rem',
    fontSize: '1.25rem',
    color: 'var(--text-h)',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    fontSize: '0.875rem',
    color: 'var(--text)',
    fontWeight: 500,
  },
  input: {
    padding: '0.6rem 0.75rem',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '1rem',
    color: 'var(--text-h)',
    background: 'var(--bg)',
    outline: 'none',
  },
  button: {
    marginTop: '0.5rem',
    padding: '0.7rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    margin: '0 0 1rem',
    padding: '0.6rem 0.75rem',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.4)',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '0.875rem',
  },
  footer: {
    marginTop: '1.5rem',
    textAlign: 'center',
    fontSize: '0.875rem',
    color: 'var(--text)',
  },
  link: {
    color: 'var(--accent)',
    textDecoration: 'none',
    fontWeight: 500,
  },
};

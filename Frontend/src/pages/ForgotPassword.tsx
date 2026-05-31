import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';

const API = 'http://localhost:8000/api/v1';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [status, setStatus]   = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Something went wrong');
      setMessage(data.message);
      setStatus('sent');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
    }
  }

  return (
    <div style={s.page}>
      <div style={s.orb1} />
      <div style={s.orb2} />

      <div className="glass animate-slide-up" style={s.card}>
        <div style={s.logoWrap}>
          <span style={s.logoIcon}>◈</span>
          <span className="grad-text" style={s.logoText}>TwinMind</span>
        </div>
        <p style={s.tagline}>Your AI-powered academic twin</p>
        <h2 style={s.title}>Forgot Password</h2>

        {status === 'sent' ? (
          <div style={s.success}>
            <div style={s.successIcon}>✉</div>
            <p style={s.successText}>{message}</p>
            <p style={s.successSub}>Check your inbox and follow the link to reset your password.</p>
            <Link to="/login" style={s.backLink}>← Back to Sign In</Link>
          </div>
        ) : (
          <>
            <p style={s.description}>
              Enter your registered email address and we'll send you a link to reset your password.
            </p>

            {status === 'error' && <div style={s.error}>{message}</div>}

            <form onSubmit={handleSubmit} style={s.form}>
              <label style={s.label}>
                Email
                <input
                  className="dark-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </label>
              <button
                className="grad-btn"
                type="submit"
                disabled={status === 'loading'}
                style={{ marginTop: '0.5rem' }}
              >
                {status === 'loading' ? 'Sending…' : 'Send Reset Link →'}
              </button>
            </form>

            <p style={s.footer}>
              Remember it? <Link to="/login" style={s.link}>Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100svh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 70%), #080d1a',
    position: 'relative',
    overflow: 'hidden',
  },
  orb1: {
    position: 'absolute', width: '600px', height: '600px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 65%)',
    top: '-200px', left: '-200px', animation: 'orb-drift-1 12s ease-in-out infinite', pointerEvents: 'none',
  },
  orb2: {
    position: 'absolute', width: '500px', height: '500px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 65%)',
    bottom: '-150px', right: '-150px', animation: 'orb-drift-2 14s ease-in-out infinite', pointerEvents: 'none',
  },
  card: {
    position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px',
    padding: '2.75rem 2.25rem', borderRadius: '20px',
    boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
  },
  logoWrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.4rem',
  },
  logoIcon: { fontSize: '1.6rem', color: '#6366f1', lineHeight: 1 },
  logoText: { fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' },
  tagline: { textAlign: 'center', fontSize: '0.8rem', color: '#475569', marginBottom: '1.75rem' },
  title: { fontSize: '1.25rem', fontWeight: 700, color: '#f1f5f9', textAlign: 'center', marginBottom: '0.75rem' },
  description: { fontSize: '0.875rem', color: '#64748b', textAlign: 'center', marginBottom: '1.5rem', lineHeight: 1.6 },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label: {
    display: 'flex', flexDirection: 'column', gap: '0.45rem',
    fontSize: '0.75rem', fontWeight: 600, color: '#64748b',
    letterSpacing: '0.06em', textTransform: 'uppercase' as const,
  },
  error: {
    marginBottom: '1rem', padding: '0.65rem 1rem',
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '10px', color: '#f87171', fontSize: '0.875rem',
  },
  footer: { marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#475569' },
  link: { color: '#818cf8', textDecoration: 'none', fontWeight: 600 },
  success: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' },
  successIcon: { fontSize: '2.5rem', color: '#10b981' },
  successText: { fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.6 },
  successSub: { fontSize: '0.8rem', color: '#475569', lineHeight: 1.6 },
  backLink: { color: '#818cf8', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem', marginTop: '0.5rem' },
};

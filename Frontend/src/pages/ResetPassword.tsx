import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { API_URL } from '../lib/config';

const API = API_URL;

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const { t } = useLanguage();
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [status, setStatus]       = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage]     = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setStatus('error');
      setMessage(t('reset_mismatch'));
      return;
    }
    if (password.length < 8) {
      setStatus('error');
      setMessage('Password must be at least 8 characters.');
      return;
    }
    setStatus('loading');
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Something went wrong');
      setMessage(data.message);
      setStatus('done');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
    }
  }

  if (!token) {
    return (
      <div style={s.page}>
        <div className="glass" style={s.card}>
          <div style={s.logoWrap}>
            <span style={s.logoIcon}>◈</span>
            <span className="grad-text" style={s.logoText}>TwinMind</span>
          </div>
          <div style={s.error}>Invalid or missing reset token. Please request a new reset link.</div>
          <p style={{ ...s.footer, marginTop: '1rem' }}>
            <Link to="/forgot-password" style={s.link}>Request new link</Link>
          </p>
        </div>
      </div>
    );
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
        <p style={s.tagline}>{t('login_tagline')}</p>
        <h2 style={s.title}>{t('reset_title')}</h2>

        {status === 'done' ? (
          <div style={s.success}>
            <div style={s.successIcon}>✓</div>
            <p style={s.successText}>{message}</p>
            <Link to="/login" style={s.backLink}>{t('login_btn')}</Link>
          </div>
        ) : (
          <>
            {status === 'error' && <div style={s.error}>{message}</div>}

            <form onSubmit={handleSubmit} style={s.form}>
              <label style={s.label}>
                {t('reset_new_pw')}
                <input
                  className="dark-input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  autoFocus
                />
              </label>
              <label style={s.label}>
                {t('reset_confirm_pw')}
                <input
                  className="dark-input"
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  required
                />
              </label>
              <button
                className="grad-btn"
                type="submit"
                disabled={status === 'loading'}
                style={{ marginTop: '0.5rem' }}
              >
                {status === 'loading' ? t('reset_btn_loading') : t('reset_btn')}
              </button>
            </form>

            <p style={s.footer}>
              <Link to="/login" style={s.link}>{t('forgot_back')}</Link>
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

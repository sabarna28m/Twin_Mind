import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const RECAPTCHA_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MuLNMNjA';

export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!captchaToken) return;
    setError('');
    setLoading(true);
    try {
      await login(email, password, captchaToken);
      navigate('/');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? t('login_error'));
      recaptchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.orb1} />
      <div style={s.orb2} />
      <div style={s.orb3} />

      <div className="glass animate-slide-up" style={s.card}>
        <div style={s.logoWrap}>
          <span style={s.logoIcon}>◈</span>
          <span className="grad-text" style={s.logoText}>TwinMind</span>
        </div>
        <p style={s.tagline}>{t('login_tagline')}</p>
        <h2 style={s.title}>{t('login_title')}</h2>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>
            {t('login_email')}
            <input className="dark-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required autoFocus />
          </label>
          <label style={s.label}>
            {t('login_password')}
            <input className="dark-input" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required />
            <Link to="/forgot-password" style={s.forgotLink}>{t('login_forgot')}</Link>
          </label>

          <div style={s.captchaWrap}>
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={RECAPTCHA_SITE_KEY}
              theme="dark"
              onChange={token => setCaptchaToken(token)}
              onExpired={() => setCaptchaToken(null)}
            />
          </div>

          <button
            className="grad-btn"
            type="submit"
            disabled={loading || !captchaToken}
            style={{ marginTop: '0.25rem' }}
          >
            {loading ? t('login_btn_loading') : t('login_btn')}
          </button>
        </form>

        <p style={s.footer}>
          {t('login_no_account')} <Link to="/register" style={s.link}>{t('login_create')}</Link>
        </p>
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
    background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,212,255,0.12) 0%, transparent 70%), #060b18',
    position: 'relative',
    overflow: 'hidden',
  },
  orb1: {
    position: 'absolute', width: '600px', height: '600px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,212,255,0.14) 0%, transparent 65%)',
    top: '-200px', left: '-200px', animation: 'orb-drift-1 12s ease-in-out infinite', pointerEvents: 'none',
  },
  orb2: {
    position: 'absolute', width: '500px', height: '500px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)',
    bottom: '-150px', right: '-150px', animation: 'orb-drift-2 14s ease-in-out infinite', pointerEvents: 'none',
  },
  orb3: {
    position: 'absolute', width: '300px', height: '300px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 65%)',
    bottom: '15%', left: '15%', animation: 'orb-drift-3 10s ease-in-out infinite', pointerEvents: 'none',
  },
  card: {
    position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px',
    padding: '2.75rem 2.25rem', borderRadius: '20px',
    boxShadow: '0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,212,255,0.1)',
  },
  logoWrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.4rem',
  },
  logoIcon: { fontSize: '1.6rem', color: '#00D4FF', lineHeight: 1, filter: 'drop-shadow(0 0 8px rgba(0,212,255,0.6))' },
  logoText: { fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' },
  tagline: { textAlign: 'center', fontSize: '0.8rem', color: '#475569', marginBottom: '1.75rem' },
  title: { fontSize: '1.25rem', fontWeight: 700, color: '#f1f5f9', textAlign: 'center', marginBottom: '1.5rem' },
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
  captchaWrap: {
    display: 'flex',
    justifyContent: 'center',
    padding: '0.25rem 0',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  footer: { marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#475569' },
  link: { color: '#00D4FF', textDecoration: 'none', fontWeight: 600 },
  forgotLink: {
    alignSelf: 'flex-end', fontSize: '0.75rem', color: '#00D4FF',
    textDecoration: 'none', fontWeight: 500, marginTop: '2px',
  },
};

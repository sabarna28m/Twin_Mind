import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { GOOGLE_CLIENT_ID } from '../lib/config';
import CustomCaptcha from '../components/CustomCaptcha';
import PasswordInput from '../components/PasswordInput';
import PasswordStrength from '../components/PasswordStrength';

export default function Register() {
  const { register, loginWithGoogle } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [fullName, setFullName]         = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [captchaValid, setCaptchaValid] = useState(false);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!captchaValid) return;
    setError('');
    setLoading(true);
    try {
      await register(email, fullName, password);
      navigate('/login');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? t('register_error'));
      setCaptchaReset(r => r + 1);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credential: string) {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle(credential);
      navigate('/');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Google sign-up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page} className="mob-auth-page">
      <div style={s.orb1} />
      <div style={s.orb2} />
      <div style={s.orb3} />

      <div className="glass animate-slide-up mob-auth-card" style={s.card}>
        <div style={s.logoWrap}>
          <span style={s.logoIcon}>◈</span>
          <span className="grad-text" style={s.logoText}>TwinMind</span>
        </div>
        <p style={s.tagline}>{t('login_tagline')}</p>
        <h2 style={s.title}>{t('register_title')}</h2>

        {error && <div style={s.error}>{error}</div>}

        {/* Google Sign-Up */}
        {GOOGLE_CLIENT_ID && (
          <div style={s.googleWrap}>
            <GoogleLogin
              onSuccess={cr => cr.credential && handleGoogleSuccess(cr.credential)}
              onError={() => setError('Google sign-up failed. Please try again.')}
              theme="filled_black"
              size="large"
              text="signup_with"
              width={372}
              useOneTap={false}
            />
          </div>
        )}

        {/* Divider */}
        {GOOGLE_CLIENT_ID && (
          <div style={s.divider}>
            <span style={s.dividerLine} />
            <span style={s.dividerText}>or sign up with email</span>
            <span style={s.dividerLine} />
          </div>
        )}

        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>
            {t('register_fullname')}
            <input className="dark-input" type="text" value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Jane Doe" required autoFocus />
          </label>
          <label style={s.label}>
            {t('register_email')}
            <input className="dark-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required />
          </label>
          <div>
            <label style={s.label}>
              {t('register_password')}
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Min. 8 characters"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </label>
            <PasswordStrength password={password} />
          </div>

          <CustomCaptcha onValid={setCaptchaValid} resetKey={captchaReset} />

          <button
            className="grad-btn"
            type="submit"
            disabled={loading || !captchaValid}
            style={{ marginTop: '0.25rem' }}
          >
            {loading ? t('register_btn_loading') : t('register_btn')}
          </button>
        </form>

        <p style={s.footer}>
          {t('register_have_account')} <Link to="/login" style={s.link}>{t('register_signin')}</Link>
        </p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1.5rem',
    background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.14) 0%, transparent 70%), #060b18',
    position: 'relative', overflow: 'hidden',
  },
  orb1: {
    position: 'absolute', width: '600px', height: '600px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 65%)',
    top: '-220px', right: '-180px', animation: 'orb-drift-2 13s ease-in-out infinite', pointerEvents: 'none',
  },
  orb2: {
    position: 'absolute', width: '450px', height: '450px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,212,255,0.1) 0%, transparent 65%)',
    bottom: '-120px', left: '-120px', animation: 'orb-drift-1 11s ease-in-out infinite', pointerEvents: 'none',
  },
  orb3: {
    position: 'absolute', width: '280px', height: '280px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 65%)',
    top: '25%', left: '5%', animation: 'orb-drift-3 9s ease-in-out infinite', pointerEvents: 'none',
  },
  card: {
    position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px',
    padding: '2.75rem 2.25rem', borderRadius: '20px',
    boxShadow: '0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(124,58,237,0.15)',
  },
  logoWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.4rem' },
  logoIcon: { fontSize: '1.6rem', color: '#00D4FF', lineHeight: 1, filter: 'drop-shadow(0 0 8px rgba(0,212,255,0.6))' },
  logoText: { fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' },
  tagline: { textAlign: 'center', fontSize: '0.8rem', color: '#475569', marginBottom: '1.75rem' },
  title: { fontSize: '1.25rem', fontWeight: 700, color: '#f1f5f9', textAlign: 'center', marginBottom: '1.5rem' },
  googleWrap: { display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' },
  divider: {
    display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem',
  },
  dividerLine: {
    flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    fontSize: '0.72rem', color: '#334155', whiteSpace: 'nowrap' as const,
    fontWeight: 500, letterSpacing: '0.04em',
  },
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
  link: { color: '#00D4FF', textDecoration: 'none', fontWeight: 600 },
};

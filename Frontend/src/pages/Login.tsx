import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { GOOGLE_CLIENT_ID } from '../lib/config';
import CustomCaptcha from '../components/CustomCaptcha';
import PasswordInput from '../components/PasswordInput';
import './Home.css'; // SaaSable design tokens

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } }
};

export default function Login() {
  const { login, loginWithGoogle, twoFARequired, completeTwoFALogin, clearTwoFAChallenge } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // ── Credentials step ──
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [captchaValid, setCaptchaValid] = useState(false);
  const [captchaReset, setCaptchaReset] = useState(0);

  // ── 2FA step ──
  const [twoFACode, setTwoFACode]       = useState('');
  const twoFAInputRef                   = useRef<HTMLInputElement>(null);

  // ── Shared ──
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

  // Focus the 2FA input when the step becomes active
  useEffect(() => {
    if (twoFARequired) {
      setError('');
      setTwoFACode('');
      setTimeout(() => twoFAInputRef.current?.focus(), 80);
    }
  }, [twoFARequired]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!captchaValid) return;
    setError('');
    setLoading(true);
    try {
      const needs2fa = await login(email, password);
      if (!needs2fa) navigate('/dashboard');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? t('login_error'));
      setCaptchaReset(r => r + 1);
    } finally {
      setLoading(false);
    }
  }

  async function handleTwoFASubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await completeTwoFALogin(twoFACode.trim());
      navigate('/dashboard');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credential: string) {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle(credential);
      navigate('/dashboard');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ──── 2FA verification step ────────────────────────────────────────────────
  if (twoFARequired) {
    return (
      <div className="saasable-root flex items-center justify-center p-6 min-h-screen">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="w-full max-w-[380px] mx-auto flex flex-col pt-8 pb-12">
          <div className="flex flex-col items-center mb-6">
            <Link to="/" className="mb-4">
              <img src="/assets/twinmind-logo.png" alt="TwinMind" style={{ width: 80, height: 'auto', display: 'block', borderRadius: 12 }} />
            </Link>
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border-2 border-blue-100 flex items-center justify-center text-2xl mb-4">
              🔐
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight text-center mb-2">Two-Step Verification</h2>
            <p className="text-sm text-slate-500 text-center leading-relaxed">
              Enter the 6-digit code from your authenticator app,<br />or use a backup recovery code.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleTwoFASubmit} className="flex flex-col gap-5">
            <label className="flex flex-col gap-2">
              <span className="text-[0.8rem] font-bold text-slate-700">Verification Code</span>
              <input
                ref={twoFAInputRef}
                className="dark-input"
                style={{ textAlign: 'center', letterSpacing: '0.15em', fontSize: '1.05rem' }}
                type="text"
                inputMode="numeric"
                value={twoFACode}
                onChange={e => setTwoFACode(e.target.value.replace(/[^0-9A-Za-z\-]/g, ''))}
                placeholder="000000"
                maxLength={9}
                required
                autoComplete="one-time-code"
              />
            </label>

            <button
              className="saasable-btn-primary w-full justify-center py-3.5 rounded-xl font-bold text-[0.95rem] mt-2 shadow-md shadow-indigo-500/20"
              type="submit"
              disabled={loading || twoFACode.trim().length < 6}
            >
              {loading ? 'Verifying…' : 'Verify & Sign In'}
            </button>
          </form>

          <button
            onClick={() => { clearTwoFAChallenge(); setError(''); }}
            className="block mx-auto mt-6 text-sm text-slate-500 hover:text-slate-900 transition-colors font-semibold"
          >
            ← Back to login
          </button>
        </motion.div>
      </div>
    );
  }

  // ──── Normal credentials step ──────────────────────────────────────────────
  return (
    <div className="saasable-root flex items-center justify-center p-6 min-h-screen">
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="w-full max-w-[380px] mx-auto flex flex-col pt-4 pb-12">
        <div className="flex flex-col items-center mb-8">
          <Link to="/" className="mb-6">
            <TwinMindLogo size={44} variant="auth" />
          </Link>
          <h2 className="text-[1.85rem] font-bold text-slate-900 tracking-tight">{t('login_title') || 'Welcome back'}</h2>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-[0.8rem] font-bold text-slate-700">{t('login_email') || 'Email'}</span>
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
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[0.8rem] font-bold text-slate-700">{t('login_password') || 'Password'}</span>
              <Link to="/forgot-password" className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors">
                {t('login_forgot') || 'Forgot?'}
              </Link>
            </div>
            <div className="relative auth-password-override">
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <div className="mt-1">
            <CustomCaptcha onValid={setCaptchaValid} resetKey={captchaReset} />
          </div>

          <button
            className="saasable-btn-primary w-full justify-center py-3.5 rounded-xl font-bold text-[0.95rem] mt-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-500/20"
            type="submit"
            disabled={loading || !captchaValid}
          >
            {loading ? (t('login_btn_loading') || 'Signing in...') : (t('login_btn') || 'Sign in')}
          </button>
        </form>

        {/* Divider */}
        {GOOGLE_CLIENT_ID && (
          <div className="flex items-center gap-4 my-7">
            <div className="flex-1 h-px bg-slate-200"></div>
            <span className="text-xs font-semibold text-slate-400 italic">or</span>
            <div className="flex-1 h-px bg-slate-200"></div>
          </div>
        )}

        {/* Google Sign-In */}
        {GOOGLE_CLIENT_ID && (
          <div className="flex justify-center mb-8">
            <GoogleLogin
              onSuccess={cr => cr.credential && handleGoogleSuccess(cr.credential)}
              onError={() => setError('Google sign-in failed. Please try again.')}
              theme="outline"
              size="large"
              text="signin_with"
              width={380}
              useOneTap={false}
            />
          </div>
        )}

        <p className="mt-6 text-center text-[0.85rem] text-slate-500">
          {t('login_no_account') || "Don't you have an account?"} <Link to="/register" className="font-bold text-indigo-600 hover:text-indigo-700 transition-colors">{t('login_create') || 'Sign Up'}</Link>
        </p>
      </motion.div>
    </div>
  );
}

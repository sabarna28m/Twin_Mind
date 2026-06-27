import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { GOOGLE_CLIENT_ID } from '../lib/config';
import CustomCaptcha from '../components/CustomCaptcha';
import PasswordInput from '../components/PasswordInput';
import PasswordStrength from '../components/PasswordStrength';
import TwinMindLogo from '../components/TwinMindLogo';
import './Home.css'; // SaaSable design tokens

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } }
};

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
    <div className="saasable-root flex items-center justify-center p-6 min-h-screen">
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="saasable-card w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-6">
          <Link to="/" className="mb-4">
            <TwinMindLogo size={44} variant="auth" />
          </Link>
          <p className="text-sm text-slate-500 mb-2">{t('login_tagline')}</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('register_title')}</h2>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Google Sign-Up */}
        {GOOGLE_CLIENT_ID && (
          <div className="flex justify-center mb-4">
            <GoogleLogin
              onSuccess={cr => cr.credential && handleGoogleSuccess(cr.credential)}
              onError={() => setError('Google sign-up failed. Please try again.')}
              theme="outline"
              size="large"
              text="signup_with"
              width={340}
              useOneTap={false}
            />
          </div>
        )}

        {/* Divider */}
        {GOOGLE_CLIENT_ID && (
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-200"></div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">or sign up with email</span>
            <div className="flex-1 h-px bg-slate-200"></div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {t('register_fullname')}
            <input 
              className="dark-input" 
              type="text" 
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Jane Doe" 
              required 
              autoFocus 
            />
          </label>
          
          <label className="flex flex-col gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {t('register_email')}
            <input 
              className="dark-input" 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" 
              required 
            />
          </label>

          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {t('register_password')}
              <div className="relative auth-password-override">
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  placeholder="Min. 8 characters"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </div>
            </label>
            <div className="mt-1">
              <PasswordStrength password={password} />
            </div>
          </div>

          <div className="mt-2">
            <CustomCaptcha onValid={setCaptchaValid} resetKey={captchaReset} />
          </div>

          <button
            className="saasable-btn-primary w-full justify-center py-3 text-base mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            type="submit"
            disabled={loading || !captchaValid}
          >
            {loading ? t('register_btn_loading') : t('register_btn')}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-500">
          {t('register_have_account')} <Link to="/login" className="font-semibold text-[#005C97] hover:text-[#004a7a] transition-colors">{t('register_signin')}</Link>
        </p>
      </motion.div>
    </div>
  );
}

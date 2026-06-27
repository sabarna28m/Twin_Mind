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
      navigate('/dashboard');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Google sign-up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="saasable-root flex items-center justify-center p-6 min-h-screen">
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="w-full max-w-[380px] mx-auto flex flex-col pt-4 pb-12">
        <div className="flex flex-col items-center mb-8">
          <Link to="/" className="mb-6">
            <TwinMindLogo size={44} variant="auth" />
          </Link>
          <h2 className="text-[1.85rem] font-bold text-slate-900 tracking-tight">{t('register_title') || 'Create account'}</h2>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-[0.8rem] font-bold text-slate-700">{t('register_fullname') || 'Full Name'}</span>
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
          
          <label className="flex flex-col gap-2">
            <span className="text-[0.8rem] font-bold text-slate-700">{t('register_email') || 'Email'}</span>
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
            <label className="flex flex-col gap-2">
              <span className="text-[0.8rem] font-bold text-slate-700">{t('register_password') || 'Password'}</span>
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

          <div className="mt-1">
            <CustomCaptcha onValid={setCaptchaValid} resetKey={captchaReset} />
          </div>

          <button
            className="saasable-btn-primary w-full justify-center py-3.5 rounded-xl font-bold text-[0.95rem] mt-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-500/20"
            type="submit"
            disabled={loading || !captchaValid}
          >
            {loading ? (t('register_btn_loading') || 'Creating account...') : (t('register_btn') || 'Sign Up')}
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

        {/* Google Sign-Up */}
        {GOOGLE_CLIENT_ID && (
          <div className="flex justify-center mb-8">
            <GoogleLogin
              onSuccess={cr => cr.credential && handleGoogleSuccess(cr.credential)}
              onError={() => setError('Google sign-up failed. Please try again.')}
              theme="outline"
              size="large"
              text="signup_with"
              width={380}
              useOneTap={false}
            />
          </div>
        )}

        <p className="mt-6 text-center text-[0.85rem] text-slate-500">
          {t('register_have_account') || 'Already have an account?'} <Link to="/login" className="font-bold text-indigo-600 hover:text-indigo-700 transition-colors">{t('register_signin') || 'Sign in'}</Link>
        </p>
      </motion.div>
    </div>
  );
}

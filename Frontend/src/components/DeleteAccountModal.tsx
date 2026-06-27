import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import api from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

type Step = 'warning' | 'confirm';

const BULLET_ITEMS = [
  'Profile, name, and account credentials',
  'All study sessions and learning progress',
  'Notes, smart notes, and note history',
  'Uploaded materials and files',
  'Gamification progress, XP, and achievements',
  'AI chat history and mentor conversations',
  'Quiz sessions and skill tree progress',
  'Study plans and smart plan records',
  'Connected accounts and calendar sync',
  'All notifications and preferences',
];

export default function DeleteAccountModal({ isOpen, onClose, onDeleted }: Props) {
  const [step, setStep]         = useState<Step>('warning');
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const passwordRef             = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep('warning');
      setConfirmText('');
      setPassword('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (step === 'confirm') setTimeout(() => passwordRef.current?.focus(), 80);
  }, [step]);

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    if (confirmText !== 'DELETE') { setError('Please type DELETE exactly as shown.'); return; }
    setError('');
    setLoading(true);
    try {
      await api.delete('/auth/me', { data: { password } });
      onDeleted();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Deletion failed. Please check your password and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div style={modal}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
              ⚠
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.97rem', fontWeight: 700, color: '#f1f5f9' }}>Delete Account</h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(239,68,68,0.75)', marginTop: '1px', fontWeight: 600 }}>
                {step === 'warning' ? 'This action is permanent and cannot be undone' : 'Final confirmation required'}
              </p>
            </div>
          </div>
          {!loading && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(148,163,184,0.5)', cursor: 'pointer', fontSize: '1.2rem', padding: '2px', lineHeight: 1, flexShrink: 0 }}>✕</button>
          )}
        </div>

        {/* ── Step 1: Warning ── */}
        {step === 'warning' && (
          <div>
            <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '1rem 1.1rem', marginBottom: '1.25rem' }}>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'rgba(239,68,68,0.85)', fontWeight: 600, lineHeight: 1.5 }}>
                Deleting your account will permanently remove all of the following:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.32rem' }}>
                {BULLET_ITEMS.map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(239,68,68,0.6)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.78rem', color: 'rgba(203,213,225,0.8)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <p style={{ margin: '0 0 1.5rem', fontSize: '0.8rem', color: 'rgba(148,163,184,0.7)', lineHeight: 1.6 }}>
              There is no grace period. Once confirmed, your data cannot be recovered by you or TwinMind support.
            </p>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                onClick={onClose}
                style={{ flex: 1, padding: '0.68rem', background: 'rgba(255,255,255,0.07)', color: '#e2e8f0', border: '1.5px solid rgba(255,255,255,0.13)', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Keep My Account
              </button>
              <button
                onClick={() => setStep('confirm')}
                style={{ flex: 1, padding: '0.68rem', background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1.5px solid rgba(239,68,68,0.3)', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                I understand, continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Confirm ── */}
        {step === 'confirm' && (
          <form onSubmit={handleDelete}>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: 'rgba(203,213,225,0.8)', lineHeight: 1.6 }}>
              To confirm, type <strong style={{ color: '#f1f5f9', fontFamily: 'monospace', letterSpacing: '0.05em' }}>DELETE</strong> in the box below, then enter your account password.
            </p>

            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.6rem 0.9rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '9px', color: '#f87171', fontSize: '0.82rem' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <label style={labelStyle}>
                Type DELETE to confirm
                <input
                  className="dark-input"
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  style={{ fontFamily: 'monospace', letterSpacing: '0.1em', fontSize: '1rem' }}
                />
              </label>

              <label style={labelStyle}>
                Current password
                <input
                  ref={passwordRef}
                  className="dark-input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => { setStep('warning'); setError(''); setConfirmText(''); setPassword(''); }}
                disabled={loading}
                style={{ flex: '0 0 auto', padding: '0.68rem 1.1rem', background: 'rgba(255,255,255,0.07)', color: '#e2e8f0', border: '1.5px solid rgba(255,255,255,0.13)', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading || confirmText !== 'DELETE' || !password}
                style={{
                  flex: 1, padding: '0.68rem',
                  background: confirmText === 'DELETE' && password ? 'rgba(239,68,68,0.85)' : 'rgba(239,68,68,0.2)',
                  color: confirmText === 'DELETE' && password ? '#fff' : 'rgba(239,68,68,0.5)',
                  border: '1.5px solid rgba(239,68,68,0.4)',
                  borderRadius: '10px', fontSize: '0.88rem', fontWeight: 700,
                  cursor: loading || confirmText !== 'DELETE' || !password ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.18s',
                }}
              >
                {loading ? 'Deleting account…' : 'Permanently Delete Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(0,0,0,0.78)',
  backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '1rem',
};

const modal: React.CSSProperties = {
  width: '100%', maxWidth: '500px',
  background: 'rgba(8,4,22,0.98)',
  border: '1.5px solid rgba(239,68,68,0.22)',
  borderRadius: '20px',
  padding: '1.75rem',
  boxShadow: '0 24px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(239,68,68,0.06)',
  backdropFilter: 'blur(32px)',
  maxHeight: '90vh',
  overflowY: 'auto',
};

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '0.4rem',
  fontSize: '0.72rem', fontWeight: 600, color: 'rgba(148,163,184,0.7)',
  letterSpacing: '0.05em', textTransform: 'uppercase',
};

﻿import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import api from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onEnabled: (backupCodes: string[]) => void;
}

type Step = 'loading' | 'setup' | 'verify' | 'success';

interface SetupData {
  secret: string;
  qr_code: string;
  uri: string;
}

export default function TwoFactorModal({ isOpen, onClose, onEnabled }: Props) {
  const [step, setStep]             = useState<Step>('loading');
  const [setup, setSetup]           = useState<SetupData | null>(null);
  const [code, setCode]             = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [copied, setCopied]         = useState(false);
  const codeInputRef                = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when closed
      setStep('loading');
      setSetup(null);
      setCode('');
      setBackupCodes([]);
      setError('');
      setLoading(false);
      setCopied(false);
      return;
    }
    // Fetch setup data on open
    api.post<SetupData>('/auth/2fa/setup')
      .then(r => { setSetup(r.data); setStep('setup'); })
      .catch(() => { setError('Failed to generate setup code. Please try again.'); setStep('setup'); });
  }, [isOpen]);

  useEffect(() => {
    if (step === 'verify') setTimeout(() => codeInputRef.current?.focus(), 80);
  }, [step]);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<{ enabled: boolean; backup_codes: string[] }>(
        '/auth/2fa/enable', { code: code.trim() }
      );
      setBackupCodes(data.backup_codes);
      setStep('success');
      onEnabled(data.backup_codes);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Verification failed. Check your code and try again.');
    } finally {
      setLoading(false);
    }
  }

  function downloadCodes() {
    const text = backupCodes.join('\n');
    const blob = new Blob([`TwinMind Backup Recovery Codes\n${'─'.repeat(32)}\n${text}\n\nEach code can only be used once.\nStore these somewhere safe.\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'twinmind-backup-codes.txt'; a.click();
    URL.revokeObjectURL(url);
  }

  function copyAll() {
    navigator.clipboard.writeText(backupCodes.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!isOpen) return null;

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99,102,241,0.15)', border: '1.5px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}></div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9' }}>
                {step === 'success' ? 'Two-Factor Authentication Enabled' : 'Set up Two-Factor Authentication'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(148,163,184,0.7)', marginTop: '1px' }}>
                {step === 'loading' && 'Generating your unique key…'}
                {step === 'setup' && 'Step 1 of 2 — Scan with your authenticator app'}
                {step === 'verify' && 'Step 2 of 2 — Verify the code'}
                {step === 'success' && 'Save your backup codes before closing'}
              </p>
            </div>
          </div>
          {step !== 'loading' && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(148,163,184,0.6)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px', lineHeight: 1 }}></button>
          )}
        </div>

        {/* ── Step: loading ── */}
        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid rgba(99,102,241,0.15)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        )}

        {/* ── Step: setup ── */}
        {step === 'setup' && setup && (
          <div>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: 'rgba(203,213,225,0.8)', lineHeight: 1.6 }}>
              Open your authenticator app (Google Authenticator, Authy, or similar) and scan the QR code below to add TwinMind.
            </p>

            {/* QR code */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <div style={{ padding: '12px', background: '#fff', borderRadius: '12px', display: 'inline-block', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
                <img
                  src={`data:image/png;base64,${setup.qr_code}`}
                  alt="TOTP QR Code"
                  style={{ width: '180px', height: '180px', display: 'block' }}
                />
              </div>
            </div>

            {/* Manual key */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '1.5rem' }}>
              <p style={{ margin: '0 0 0.4rem', fontSize: '0.7rem', fontWeight: 700, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Can't scan? Enter this key manually</p>
              <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace', letterSpacing: '0.12em', wordBreak: 'break-all' }}>
                {setup.secret}
              </p>
            </div>

            <button
              className="grad-btn"
              onClick={() => { setError(''); setStep('verify'); }}
              style={{ width: '100%', padding: '0.7rem' }}
            >
              I've scanned it — Next →
            </button>
          </div>
        )}

        {/* ── Step: verify ── */}
        {step === 'verify' && (
          <form onSubmit={handleVerify}>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: 'rgba(203,213,225,0.8)', lineHeight: 1.6 }}>
              Enter the 6-digit code shown in your authenticator app to confirm the setup.
            </p>

            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.6rem 0.9rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '9px', color: '#f87171', fontSize: '0.82rem' }}>
                {error}
              </div>
            )}

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 600, color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.25rem' }}>
              Verification Code
              <input
                ref={codeInputRef}
                className="dark-input"
                type="text"
                inputMode="numeric"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                required
                autoComplete="one-time-code"
                style={{ letterSpacing: '0.25em', fontSize: '1.4rem', textAlign: 'center', padding: '0.75rem 1rem' }}
              />
            </label>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => { setError(''); setStep('setup'); }}
                style={{ flex: '0 0 auto', padding: '0.65rem 1.1rem', background: 'rgba(255,255,255,0.07)', color: '#e2e8f0', border: '1.5px solid rgba(255,255,255,0.14)', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ← Back
              </button>
              <button
                className="grad-btn"
                type="submit"
                disabled={loading || code.length < 6}
                style={{ flex: 1, padding: '0.65rem' }}
              >
                {loading ? 'Verifying…' : 'Enable 2FA'}
              </button>
            </div>
          </form>
        )}

        {/* ── Step: success ── */}
        {step === 'success' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem', padding: '0.65rem 0.9rem', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: '10px' }}>
              <span style={{ color: '#34d399', fontSize: '1rem' }}></span>
              <span style={{ fontSize: '0.82rem', color: '#34d399', fontWeight: 600 }}>2FA is now active on your account</span>
            </div>

            <p style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', color: 'rgba(203,213,225,0.8)', lineHeight: 1.6 }}>
              Save these <strong style={{ color: '#f1f5f9' }}>8 backup recovery codes</strong>. Each can be used once if you lose access to your authenticator app. Store them securely.
            </p>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.09)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem' }}>
                {backupCodes.map(c => (
                  <code key={c} style={{ fontSize: '0.9rem', fontFamily: 'monospace', color: '#e2e8f0', letterSpacing: '0.1em', fontWeight: 600 }}>{c}</code>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <button
                onClick={copyAll}
                style={{ flex: '1 1 auto', padding: '0.58rem 1rem', background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.07)', color: copied ? '#34d399' : '#e2e8f0', border: `1.5px solid ${copied ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.14)'}`, borderRadius: '10px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s' }}
              >
                {copied ? 'Copied!' : '⧉ Copy All'}
              </button>
              <button
                onClick={downloadCodes}
                style={{ flex: '1 1 auto', padding: '0.58rem 1rem', background: 'rgba(255,255,255,0.07)', color: '#e2e8f0', border: '1.5px solid rgba(255,255,255,0.14)', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ↓ Download .txt
              </button>
            </div>

            <button
              className="grad-btn"
              onClick={onClose}
              style={{ width: '100%', padding: '0.7rem' }}
            >
              I've saved my codes — Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(0,0,0,0.72)',
  backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '1rem',
};

const modal: React.CSSProperties = {
  width: '100%', maxWidth: '480px',
  background: 'rgba(4,8,22,0.97)',
  border: '1.5px solid rgba(99,102,241,0.22)',
  borderRadius: '20px',
  padding: '1.75rem',
  boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(99,102,241,0.07)',
  backdropFilter: 'blur(32px)',
  maxHeight: '90vh',
  overflowY: 'auto',
};

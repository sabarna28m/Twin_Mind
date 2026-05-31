import { FormEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';

const BACKEND = 'http://localhost:8000';

export default function Profile() {
  const { user, token, refreshUser } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [nameMsg, setNameMsg]   = useState<{ ok: boolean; text: string } | null>(null);
  const [nameSaving, setNameSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw]         = useState('');
  const [pwMsg, setPwMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const [pwSaving, setPwSaving]   = useState(false);

  const [avatarMsg, setAvatarMsg]       = useState<{ ok: boolean; text: string } | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setNameMsg(null);
    setNameSaving(true);
    try {
      await api.put('/auth/me', { full_name: fullName }, { headers: { Authorization: `Bearer ${token}` } });
      await refreshUser();
      setNameMsg({ ok: true, text: 'Name updated.' });
    } catch {
      setNameMsg({ ok: false, text: 'Failed to update name.' });
    } finally {
      setNameSaving(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 8) {
      setPwMsg({ ok: false, text: 'New password must be at least 8 characters.' });
      return;
    }
    setPwSaving(true);
    try {
      await api.put('/auth/me', { current_password: currentPw, new_password: newPw }, { headers: { Authorization: `Bearer ${token}` } });
      setPwMsg({ ok: true, text: 'Password changed.' });
      setCurrentPw('');
      setNewPw('');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setPwMsg({ ok: false, text: detail ?? 'Failed to change password.' });
    } finally {
      setPwSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarMsg(null);
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post('/auth/me/avatar', form, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      await refreshUser();
      setAvatarMsg({ ok: true, text: 'Profile picture updated.' });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAvatarMsg({ ok: false, text: detail ?? 'Upload failed.' });
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const initials = (user?.full_name ?? '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const avatarSrc = user?.avatar_url ? BACKEND + user.avatar_url : null;

  return (
    <div style={s.shell}>
      <header style={s.nav}>
        <Link to="/" style={s.navLogo}>TwinMind</Link>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <ThemeToggle />
          <Link to="/profile/setup" style={s.backLink}>Student Profile</Link>
          <Link to="/" style={s.backLink}>← Dashboard</Link>
        </div>
      </header>

      <main style={s.main}>
        <h1 style={s.pageTitle}>Profile</h1>

        {/* Identity card */}
        <section style={s.card}>
          {/* Clickable avatar */}
          <div
            className="avatar-wrap"
            style={s.avatarWrap}
            onClick={() => !avatarUploading && fileInputRef.current?.click()}
            title="Click to change profile picture"
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="avatar" style={s.avatarImg} />
            ) : (
              <div style={s.avatarInitials}>{initials}</div>
            )}
            <div className="avatar-overlay" style={s.avatarOverlay}>
              {avatarUploading ? '…' : '📷'}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
          </div>

          <div>
            <p style={s.identityName}>{user?.full_name}</p>
            <p style={s.identityEmail}>{user?.email}</p>
            {avatarMsg && (
              <p style={avatarMsg.ok ? { ...s.avatarFeedback, color: '#16a34a' } : { ...s.avatarFeedback, color: '#dc2626' }}>
                {avatarMsg.text}
              </p>
            )}
          </div>
        </section>

        {/* Edit name */}
        <section style={s.panel}>
          <h2 style={s.panelTitle}>Display name</h2>
          {nameMsg && <p style={nameMsg.ok ? s.msgOk : s.msgErr}>{nameMsg.text}</p>}
          <form onSubmit={saveName} style={s.form}>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              style={s.input}
              required
            />
            <button type="submit" disabled={nameSaving} style={s.btn}>
              {nameSaving ? 'Saving…' : 'Save'}
            </button>
          </form>
        </section>

        {/* Change password */}
        <section style={s.panel}>
          <h2 style={s.panelTitle}>Change password</h2>
          {pwMsg && <p style={pwMsg.ok ? s.msgOk : s.msgErr}>{pwMsg.text}</p>}
          <form onSubmit={savePassword} style={s.form}>
            <label style={s.label}>
              Current password
              <input
                type="password"
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                style={s.input}
                placeholder="••••••••"
                required
              />
            </label>
            <label style={s.label}>
              New password
              <input
                type="password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                style={s.input}
                placeholder="••••••••"
                minLength={8}
                required
              />
            </label>
            <button type="submit" disabled={pwSaving} style={s.btn}>
              {pwSaving ? 'Saving…' : 'Change password'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100svh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 2rem',
    height: '60px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  navLogo: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: '-0.5px',
    textDecoration: 'none',
  },
  backLink: {
    fontSize: '0.875rem',
    color: 'var(--accent)',
    textDecoration: 'none',
    fontWeight: 500,
  },
  main: {
    flex: 1,
    padding: '2rem',
    maxWidth: '560px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    textAlign: 'left',
  },
  pageTitle: {
    margin: '0 0 1.5rem',
    fontSize: '1.5rem',
    fontWeight: 600,
    color: 'var(--text-h)',
  },

  // Identity card
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1.25rem 1.5rem',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    marginBottom: '1.5rem',
    background: 'var(--bg)',
  },

  // Avatar
  avatarWrap: {
    position: 'relative',
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    flexShrink: 0,
    cursor: 'pointer',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    objectFit: 'cover',
    display: 'block',
    border: '2px solid var(--accent-border)',
  },
  avatarInitials: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'var(--accent-bg)',
    border: '2px solid var(--accent-border)',
    color: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    fontWeight: 700,
  },
  avatarOverlay: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    opacity: 0,
    transition: 'opacity 0.15s',
  },

  avatarFeedback: {
    margin: '0.3rem 0 0',
    fontSize: '0.8rem',
    fontWeight: 500,
  },

  identityName: {
    margin: '0 0 0.2rem',
    fontWeight: 600,
    color: 'var(--text-h)',
    fontSize: '1rem',
  },
  identityEmail: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '0.875rem',
  },

  // Panels
  panel: {
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    background: 'var(--bg)',
  },
  panelTitle: {
    margin: '0 0 1rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-h)',
  },

  // Form
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
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
    width: '100%',
    boxSizing: 'border-box',
  },
  btn: {
    alignSelf: 'flex-start',
    padding: '0.55rem 1.25rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  },

  // Feedback messages
  msgOk: {
    margin: '0 0 0.75rem',
    padding: '0.5rem 0.75rem',
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.4)',
    borderRadius: '8px',
    color: '#16a34a',
    fontSize: '0.875rem',
  },
  msgErr: {
    margin: '0 0 0.75rem',
    padding: '0.5rem 0.75rem',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.4)',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '0.875rem',
  },
};

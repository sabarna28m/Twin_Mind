import { useRef, useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';

const BACKEND = 'http://localhost:8000';

interface CalStatus { configured: boolean; connected: boolean }

export default function Profile() {
  const { user, token, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

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

  // Google Calendar state
  const [calStatus,     setCalStatus]     = useState<CalStatus | null>(null);
  const [calMsg,        setCalMsg]        = useState<{ ok: boolean; text: string } | null>(null);
  const [syncing,       setSyncing]       = useState(false);
  const [syncMsg,       setSyncMsg]       = useState<{ ok: boolean; text: string } | null>(null);
  const [remTitle,      setRemTitle]      = useState('');
  const [remDate,       setRemDate]       = useState('');
  const [remTime,       setRemTime]       = useState('');
  const [remDesc,       setRemDesc]       = useState('');
  const [addingRem,     setAddingRem]     = useState(false);
  const [remMsg,        setRemMsg]        = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.get<CalStatus>('/calendar/status').then(r => setCalStatus(r.data)).catch(() => {});
    const cal = searchParams.get('calendar');
    if (cal === 'connected') {
      setCalMsg({ ok: true, text: 'Google Calendar connected successfully!' });
      setSearchParams({}, { replace: true });
    } else if (cal === 'error') {
      setCalMsg({ ok: false, text: 'Failed to connect Google Calendar. Please try again.' });
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function connectCalendar() {
    try {
      const { data } = await api.get<{ auth_url: string }>('/calendar/auth-url');
      window.location.href = data.auth_url;
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setCalMsg({ ok: false, text: detail ?? 'Failed to get auth URL.' });
    }
  }

  async function disconnectCalendar() {
    try {
      await api.post('/calendar/disconnect');
      setCalStatus(s => s ? { ...s, connected: false } : s);
      setCalMsg({ ok: true, text: 'Disconnected from Google Calendar.' });
    } catch {
      setCalMsg({ ok: false, text: 'Failed to disconnect.' });
    }
  }

  async function syncPlan() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const { data } = await api.post<{ ok: boolean; events_created: number }>('/calendar/sync-study-plan');
      setSyncMsg({ ok: true, text: `${data.events_created} calendar events created!` });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setSyncMsg({ ok: false, text: detail ?? 'Sync failed.' });
    } finally {
      setSyncing(false);
    }
  }

  async function addReminder(e: FormEvent) {
    e.preventDefault();
    setAddingRem(true);
    setRemMsg(null);
    try {
      await api.post('/calendar/add-reminder', { title: remTitle, date: remDate, time: remTime, description: remDesc });
      setRemMsg({ ok: true, text: 'Reminder added to Google Calendar!' });
      setRemTitle(''); setRemDate(''); setRemTime(''); setRemDesc('');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setRemMsg({ ok: false, text: detail ?? 'Failed to add reminder.' });
    } finally {
      setAddingRem(false);
    }
  }

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
          <Link to="/" style={s.backLink}>{t('back_dashboard')}</Link>
        </div>
      </header>

      <main style={s.main}>
        <h1 style={s.pageTitle}>{t('profile_title')}</h1>

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
          <h2 style={s.panelTitle}>{t('profile_name')}</h2>
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
              {nameSaving ? t('profile_saving') : t('profile_save_name')}
            </button>
          </form>
        </section>

        {/* Change password */}
        <section style={s.panel}>
          <h2 style={s.panelTitle}>{t('profile_change_pw')}</h2>
          {pwMsg && <p style={pwMsg.ok ? s.msgOk : s.msgErr}>{pwMsg.text}</p>}
          <form onSubmit={savePassword} style={s.form}>
            <label style={s.label}>
              {t('profile_current_pw')}
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
              {t('profile_new_pw')}
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
              {pwSaving ? t('profile_saving') : t('profile_save_pw')}
            </button>
          </form>
        </section>

        {/* Google Calendar */}
        <section style={s.panel}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.1rem' }}>📅</span>
            <h2 style={s.panelTitle}>Google Calendar</h2>
          </div>
          {calMsg && <p style={calMsg.ok ? s.msgOk : s.msgErr}>{calMsg.text}</p>}

          {calStatus === null ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: 0 }}>Loading…</p>
          ) : !calStatus.configured ? (
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: '0 0 0.5rem' }}>
                Google Calendar integration requires Google OAuth credentials.
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text)', margin: 0, fontFamily: 'monospace', background: 'var(--bg)', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to Backend/.env
              </p>
            </div>
          ) : calStatus.connected ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <span style={s.connectedBadge}>Connected</span>
                <button onClick={disconnectCalendar} style={s.linkBtn}>Disconnect</button>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text)', margin: '0 0 0.6rem' }}>
                  Add all 30 days of your study plan as calendar events.
                </p>
                <button onClick={syncPlan} disabled={syncing} style={s.btn}>
                  {syncing ? 'Syncing…' : 'Sync Study Plan to Calendar'}
                </button>
                {syncMsg && <p style={{ ...(syncMsg.ok ? s.msgOk : s.msgErr), marginTop: '0.4rem' }}>{syncMsg.text}</p>}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-h)' }}>Add Study Reminder</h3>
                <form onSubmit={addReminder} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <input
                    type="text"
                    placeholder="Title (e.g. Study Mathematics)"
                    value={remTitle}
                    onChange={e => setRemTitle(e.target.value)}
                    style={s.input}
                    required
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="date"
                      value={remDate}
                      onChange={e => setRemDate(e.target.value)}
                      style={{ ...s.input, flex: 1 }}
                      required
                    />
                    <input
                      type="time"
                      value={remTime}
                      onChange={e => setRemTime(e.target.value)}
                      style={{ ...s.input, flex: 1 }}
                      required
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={remDesc}
                    onChange={e => setRemDesc(e.target.value)}
                    style={s.input}
                  />
                  <button type="submit" disabled={addingRem} style={s.btn}>
                    {addingRem ? 'Adding…' : 'Add Reminder'}
                  </button>
                  {remMsg && <p style={remMsg.ok ? s.msgOk : s.msgErr}>{remMsg.text}</p>}
                </form>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: '0 0 1rem' }}>
                Connect your Google Calendar to sync your 30-day study plan and set study reminders.
              </p>
              <button onClick={connectCalendar} style={s.btn}>
                Connect Google Calendar
              </button>
            </div>
          )}
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
  connectedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.25rem 0.65rem',
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.35)',
    borderRadius: '99px',
    color: '#10b981',
    fontSize: '0.78rem',
    fontWeight: 700,
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.82rem',
    fontWeight: 600,
    padding: 0,
    textDecoration: 'underline',
  },
};

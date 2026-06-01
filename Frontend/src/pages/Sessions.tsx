import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveBadge from '../components/LiveBadge';
import BackButton from '../components/BackButton';

interface Session {
  id: number;
  title: string;
  subject: string | null;
  duration_minutes: number;
  status: string;
  created_at: string | null;
}

export default function Sessions() {
  const { user, token, studentProfile } = useAuth();
  const profileSubjects = studentProfile?.subjects ?? [];
  const headers = { Authorization: `Bearer ${token}` };
  const wsConnected = useWebSocket(user?.id, token, () => {});

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get<Session[]>('/sessions', { headers }).then(r => setSessions(r.data)).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await api.post<Session>('/sessions', { title, subject: subject || null }, { headers });
      setSessions(prev => [data, ...prev]);
      setTitle('');
      setSubject('');
      setShowForm(false);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    await api.delete(`/sessions/${id}`, { headers });
    setSessions(prev => prev.filter(s => s.id !== id));
  }

  async function toggleStatus(s: Session) {
    const next = s.status === 'active' ? 'completed' : 'active';
    const { data } = await api.patch<Session>(`/sessions/${s.id}`, { status: next }, { headers });
    setSessions(prev => prev.map(x => x.id === s.id ? data : x));
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDuration(mins: number) {
    if (!mins) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <div style={s.shell}>
      <header style={s.nav}>
        <div style={s.navLeft}>
          <BackButton />
          <Link to="/" style={s.navLogo}>TwinMind</Link>
          {wsConnected && <LiveBadge />}
        </div>
      </header>

      <main style={s.main}>
        <div style={s.titleRow}>
          <h1 style={s.pageTitle}>Sessions</h1>
          <button onClick={() => setShowForm(v => !v)} style={s.newBtn}>
            {showForm ? 'Cancel' : '+ New session'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} style={s.form}>
            <input
              type="text"
              placeholder="Session title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={s.input}
              required
              autoFocus
            />
            {profileSubjects.length > 0 ? (
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                style={{ ...s.input, cursor: 'pointer' }}
              >
                <option value="">Subject (optional)</option>
                {profileSubjects.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Subject (optional)"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                style={s.input}
              />
            )}
            <button type="submit" disabled={creating} style={s.createBtn}>
              {creating ? 'Creating…' : 'Create'}
            </button>
          </form>
        )}

        {loading ? (
          <p style={s.emptyText}>Loading…</p>
        ) : sessions.length === 0 ? (
          <div style={s.empty}>
            <p style={s.emptyIcon}>📖</p>
            <p style={s.emptyTitle}>No sessions yet</p>
            <p style={s.emptyHint}>Create your first session to get started.</p>
          </div>
        ) : (
          <div style={s.list}>
            {sessions.map(session => (
              <div key={session.id} style={s.card}>
                <div style={s.cardLeft}>
                  <button
                    onClick={() => toggleStatus(session)}
                    style={session.status === 'completed' ? s.badgeDone : s.badgeActive}
                    title="Toggle status"
                  >
                    {session.status === 'completed' ? 'Completed' : 'Active'}
                  </button>
                  <div>
                    <p style={s.cardTitle}>{session.title}</p>
                    <p style={s.cardMeta}>
                      {session.subject && <span style={s.subject}>{session.subject}</span>}
                      {formatDate(session.created_at)}
                      {session.duration_minutes > 0 && ` · ${formatDuration(session.duration_minutes)}`}
                    </p>
                  </div>
                </div>
                <button onClick={() => handleDelete(session.id)} style={s.deleteBtn} title="Delete session">✕</button>
              </div>
            ))}
          </div>
        )}
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
  navLeft: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
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
    maxWidth: '720px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    textAlign: 'left',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.5rem',
  },
  pageTitle: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 600,
    color: 'var(--text-h)',
  },
  newBtn: {
    padding: '0.5rem 1rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },

  // Create form
  form: {
    display: 'flex',
    gap: '0.75rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap' as const,
    padding: '1.25rem',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    background: 'var(--bg)',
  },
  input: {
    flex: '1 1 180px',
    padding: '0.6rem 0.75rem',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '0.95rem',
    color: 'var(--text-h)',
    background: 'var(--bg)',
    outline: 'none',
  },
  createBtn: {
    padding: '0.6rem 1.25rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  },

  // Empty state
  empty: {
    textAlign: 'center',
    padding: '4rem 1rem',
  },
  emptyIcon: {
    margin: '0 0 0.75rem',
    fontSize: '2.5rem',
  },
  emptyTitle: {
    margin: '0 0 0.375rem',
    fontWeight: 600,
    color: 'var(--text-h)',
    fontSize: '1rem',
  },
  emptyHint: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '0.875rem',
  },
  emptyText: {
    color: 'var(--text)',
    fontSize: '0.9rem',
    margin: 0,
  },

  // Session list
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1.25rem',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    background: 'var(--bg)',
  },
  cardLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    minWidth: 0,
  },
  cardTitle: {
    margin: '0 0 0.2rem',
    fontWeight: 600,
    color: 'var(--text-h)',
    fontSize: '0.95rem',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardMeta: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  subject: {
    background: 'var(--accent-bg)',
    color: 'var(--accent)',
    padding: '0.1rem 0.45rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  badgeActive: {
    padding: '0.25rem 0.6rem',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid rgba(234,179,8,0.4)',
    background: 'rgba(234,179,8,0.1)',
    color: '#a16207',
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
  },
  badgeDone: {
    padding: '0.25rem 0.6rem',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid rgba(34,197,94,0.4)',
    background: 'rgba(34,197,94,0.1)',
    color: '#16a34a',
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    padding: '0.25rem 0.5rem',
    borderRadius: '6px',
    flexShrink: 0,
  },
};

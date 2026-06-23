import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Timer } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BrainIcon } from '../components/TwinMindLogo';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveBadge from '../components/LiveBadge';
import BackButton from '../components/BackButton';
import api from '../services/api';
import type { Session } from '../types/sessions';
import SessionTimer from '../components/sessions/SessionTimer';
import SessionStats from '../components/sessions/SessionStats';
import SessionAnalytics from '../components/sessions/SessionAnalytics';
import SessionFilters, { type FilterType, type SortType } from '../components/sessions/SessionFilters';
import SessionHistory from '../components/sessions/SessionHistory';

/* ── date helpers ── */
function isoDate(iso: string | null) { return iso ? iso.slice(0, 10) : ''; }
function todayKey()  { return new Date().toISOString().slice(0, 10); }
function weekAgo()   { const d = new Date(); d.setDate(d.getDate() - 7);  return d.toISOString().slice(0, 10); }
function monthAgo()  { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); }

export default function Sessions() {
  const { user, token, studentProfile } = useAuth();
  const profileSubjects = studentProfile?.subjects ?? [];
  const headers = { Authorization: `Bearer ${token}` };
  const wsConnected = useWebSocket(user?.id, token, () => {});

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [filter,        setFilter]        = useState<FilterType>('all');
  const [sort,          setSort]          = useState<SortType>('newest');
  const [search,        setSearch]        = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [showAnalytics, setShowAnalytics] = useState(false);

  /* ── subjects derived from sessions + profile ── */
  const subjects = useMemo(() => {
    const fromSessions = sessions.flatMap(s => s.subject ? [s.subject] : []);
    return Array.from(new Set([...profileSubjects, ...fromSessions]));
  }, [sessions, profileSubjects]);

  /* ── load sessions ── */
  useEffect(() => {
    api.get<Session[]>('/sessions', { headers })
      .then(r => setSessions(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* ── callbacks ── */
  function handleSessionComplete(s: Session) {
    setSessions(prev => [s, ...prev]);
  }

  async function handleToggle(s: Session) {
    const next = s.status === 'completed' ? 'active' : 'completed';
    try {
      const { data } = await api.patch<Session>(`/sessions/${s.id}`, { status: next }, { headers });
      setSessions(prev => prev.map(x => x.id === s.id ? data : x));
    } catch { /* silent */ }
  }

  async function handleDelete(id: number) {
    try {
      await api.delete(`/sessions/${id}`, { headers });
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch { /* silent */ }
  }

  /* ── filtering + sorting ── */
  const filteredSessions = useMemo(() => {
    let list = [...sessions];

    /* status / date filter */
    const today = todayKey();
    const week  = weekAgo();
    const month = monthAgo();
    if (filter === 'today')     list = list.filter(s => isoDate(s.created_at) === today);
    if (filter === 'week')      list = list.filter(s => isoDate(s.created_at) >= week);
    if (filter === 'month')     list = list.filter(s => isoDate(s.created_at) >= month);
    if (filter === 'completed') list = list.filter(s => s.status === 'completed');
    if (filter === 'active')    list = list.filter(s => s.status !== 'completed');

    /* subject filter */
    if (subjectFilter) list = list.filter(s => s.subject === subjectFilter);

    /* search */
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        (s.subject ?? '').toLowerCase().includes(q)
      );
    }

    /* sort */
    if (sort === 'newest')   list.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    if (sort === 'oldest')   list.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
    if (sort === 'longest')  list.sort((a, b) => b.duration_minutes - a.duration_minutes);
    if (sort === 'shortest') list.sort((a, b) => a.duration_minutes - b.duration_minutes);

    return list;
  }, [sessions, filter, sort, search, subjectFilter]);

  return (
    <div style={pg.shell}>

      {/* Nav */}
      <header style={pg.nav} className="nav-premium">
        <div style={pg.navLeft}>
          <BackButton />
          <BrainIcon size={24} />
          <Link to="/" style={pg.navLogo}>TwinMind</Link>
          {wsConnected && <LiveBadge />}
        </div>
        <div style={pg.navRight}>
          <div style={pg.pageTitlePill}>
            <Timer size={14} color="#00D4FF" />
            <span>Focus Sessions</span>
          </div>
        </div>
      </header>

      <main style={pg.main}>
        <div style={pg.content} className="animate-slide-up">

          {/* ── Top section: Timer + Stats ── */}
          <div style={pg.topGrid} className="sessions-top-grid">
            <SessionTimer subjects={subjects} onComplete={handleSessionComplete} />
            <div style={pg.statsCol}>
              <SessionStats sessions={sessions} />
            </div>
          </div>

          {/* ── Analytics toggle ── */}
          <div style={pg.analyticsToggleRow}>
            <button
              onClick={() => setShowAnalytics(v => !v)}
              style={pg.analyticsToggleBtn}
            >
              {showAnalytics ? '▲ Hide Analytics' : '▼ Show Analytics'}
            </button>
          </div>

          {/* ── Analytics ── */}
          {showAnalytics && sessions.length > 0 && (
            <div className="animate-fade-in">
              <SessionAnalytics sessions={sessions} />
            </div>
          )}

          {/* ── Divider ── */}
          <div style={pg.divider} />

          {/* ── Filters ── */}
          <SessionFilters
            filter={filter}           setFilter={setFilter}
            sort={sort}               setSort={setSort}
            search={search}           setSearch={setSearch}
            subjects={subjects}
            subjectFilter={subjectFilter} setSubjectFilter={setSubjectFilter}
          />

          {/* ── History ── */}
          <SessionHistory
            sessions={filteredSessions}
            loading={loading}
            onToggle={handleToggle}
            onDelete={handleDelete}
            totalCount={sessions.length}
          />

        </div>
      </main>
    </div>
  );
}

const pg: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', fontFamily: 'var(--sans)' },

  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 2rem', height: '60px',
    position: 'sticky', top: 0, zIndex: 20, flexShrink: 0,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  navRight:{ display: 'flex', alignItems: 'center', gap: '0.75rem' },
  navLogo: { fontSize: '1.18rem', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.5px', textDecoration: 'none' },
  pageTitlePill: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.3rem 0.85rem', borderRadius: '99px',
    border: '1px solid rgba(0,212,255,0.2)',
    background: 'rgba(0,212,255,0.08)',
    fontSize: '0.78rem', fontWeight: 700, color: '#00D4FF', letterSpacing: '0.02em',
  },

  main: { flex: 1, display: 'flex', justifyContent: 'center', padding: '2rem 1.25rem 4rem', boxSizing: 'border-box' },
  content: { width: '100%', maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '1.5rem' },

  topGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gap: '1.25rem',
    alignItems: 'start',
  },
  statsCol: { display: 'flex', flexDirection: 'column', gap: '1rem' },

  analyticsToggleRow: { display: 'flex', justifyContent: 'center' },
  analyticsToggleBtn: {
    padding: '0.38rem 1.1rem', borderRadius: '99px',
    border: '1px solid rgba(0,212,255,0.2)',
    background: 'rgba(0,212,255,0.06)', color: '#00D4FF',
    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background 0.18s',
  },

  divider: { height: '1px', background: 'rgba(255,255,255,0.06)' },
};

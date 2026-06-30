import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveBadge from '../components/LiveBadge';
import BackButton from '../components/BackButton';

interface Note {
  id: number;
  title: string;
  content: string;
  updated_at: string | null;
}

export default function Notes() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const headers = { Authorization: `Bearer ${token}` };
  const wsConnected = useWebSocket(user?.id, token, () => {});

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);



  useEffect(() => {
    api.get<Note[]>('/notes', { headers })
      .then(r => {
        setNotes(r.data);
        if (r.data.length > 0) selectNote(r.data[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  function selectNote(note: Note) {
    flushSave();
    setActiveId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setSaved(false);
  }

  function flushSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }

  async function createNote() {
    flushSave();
    const { data } = await api.post<Note>('/notes', { title: 'Untitled note', content: '' }, { headers });
    setNotes(prev => [data, ...prev]);
    selectNote(data);
  }

  function handleTitleChange(val: string) {
    setTitle(val);
    setSaved(false);
    scheduleSave(val, content);
  }

  function handleContentChange(val: string) {
    setContent(val);
    setSaved(false);
    scheduleSave(title, val);
  }

  function scheduleSave(t: string, c: string) {
    if (!activeId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(activeId, t, c), 800);
  }

  async function save(id: number, t: string, c: string) {
    if (!t.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.put<Note>(`/notes/${id}`, { title: t, content: c }, { headers });
      setNotes(prev => prev.map(n => n.id === id ? data : n).sort(
        (a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
      ));
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(id: number) {
    flushSave();
    await api.delete(`/notes/${id}`, { headers });
    const remaining = notes.filter(n => n.id !== id);
    setNotes(remaining);
    if (activeId === id) {
      if (remaining.length > 0) selectNote(remaining[0]);
      else { setActiveId(null); setTitle(''); setContent(''); }
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  return (
    <div style={s.shell}>
      <header style={s.nav}>
        <div style={s.navLeft}>
          <BackButton />
          <div style={{ width: 28, height: 20, overflow: 'hidden', flexShrink: 0 }}>
            <img src="/assets/twinmind-logo.png" alt="" style={{ width: 28, height: 'auto', display: 'block' }} />
          </div>
          <Link to="/" style={s.navLogo}>TwinMind</Link>
          {wsConnected && <LiveBadge />}
        </div>
      </header>

      <div style={s.body}>
        {/* Sidebar */}
        <aside style={s.sidebar}>
          <div style={s.sidebarHead}>
            <span style={s.sidebarTitle}>{t('notes_title')}</span>
            <button onClick={createNote} style={s.newBtn} title={t('notes_new')}>+</button>
          </div>

          {loading ? (
            <p style={s.sidebarEmpty}>{t('loading')}</p>
          ) : notes.length === 0 ? (
            <p style={s.sidebarEmpty}>{t('notes_empty')}</p>
          ) : (
            <ul style={s.noteList}>
              {notes.map(note => (
                <li
                  key={note.id}
                  onClick={() => selectNote(note)}
                  style={note.id === activeId ? { ...s.noteItem, ...s.noteItemActive } : s.noteItem}
                >
                  <div style={s.noteItemInner}>
                    <p style={s.noteItemTitle}>{note.title}</p>
                    <p style={s.noteItemMeta}>
                      {note.content ? note.content.slice(0, 40) + (note.content.length > 40 ? '…' : '') : 'No content'}
                    </p>
                  </div>
                  <div style={s.noteItemRight}>
                    <span style={s.noteItemDate}>{formatDate(note.updated_at)}</span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
                      style={s.deleteBtn}
                      title="Delete"
                    >✕</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Editor */}
        <div style={s.editor}>
          {activeId === null ? (
            <div style={s.editorEmpty}>
              <p style={s.editorEmptyIcon}>📝</p>
              <p style={s.editorEmptyTitle}>{t('notes_empty')}</p>
              <p style={s.editorEmptyHint}>{t('notes_empty_sub')}</p>
              <button onClick={createNote} style={s.editorNewBtn}>{t('notes_new')}</button>
            </div>
          ) : (
            <>
              <div style={s.editorTop}>
                <input
                  value={title}
                  onChange={e => handleTitleChange(e.target.value)}
                  style={s.titleInput}
                  placeholder={t('notes_untitled')}
                />
                <span style={s.saveStatus}>
                  {saving ? t('notes_saving') : saved ? t('notes_saved') : ''}
                </span>
              </div>
              <textarea
                value={content}
                onChange={e => handleContentChange(e.target.value)}
                style={s.contentArea}
                placeholder={t('notes_placeholder')}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: {
    height: '100svh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
    overflow: 'hidden',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 2rem',
    height: '60px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg)',
    flexShrink: 0,
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

  // Two-panel body
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },

  // Sidebar
  sidebar: {
    width: '260px',
    flexShrink: 0,
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1.25rem 0.75rem',
    borderBottom: '1px solid var(--border)',
  },
  sidebarTitle: {
    fontWeight: 700,
    fontSize: '0.9rem',
    color: 'var(--text-h)',
    letterSpacing: '0.3px',
    textTransform: 'uppercase' as const,
  },
  newBtn: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: '1px solid var(--accent-border)',
    background: 'var(--accent-bg)',
    color: 'var(--accent)',
    fontSize: '1.2rem',
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  sidebarEmpty: {
    padding: '1.5rem 1.25rem',
    color: 'var(--text)',
    fontSize: '0.875rem',
    margin: 0,
  },
  noteList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    overflowY: 'auto' as const,
    flex: 1,
  },
  noteItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '0.75rem 1.25rem',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border)',
    gap: '0.5rem',
  },
  noteItemActive: {
    background: 'var(--accent-bg)',
    borderLeft: '3px solid var(--accent)',
    paddingLeft: 'calc(1.25rem - 3px)',
  },
  noteItemInner: {
    flex: 1,
    minWidth: 0,
  },
  noteItemTitle: {
    margin: '0 0 0.2rem',
    fontWeight: 600,
    fontSize: '0.875rem',
    color: 'var(--text-h)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  noteItemMeta: {
    margin: 0,
    fontSize: '0.75rem',
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  noteItemRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.25rem',
    flexShrink: 0,
  },
  noteItemDate: {
    fontSize: '0.7rem',
    color: 'var(--text)',
    whiteSpace: 'nowrap' as const,
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '0.7rem',
    padding: '0.1rem 0.25rem',
    borderRadius: '4px',
    lineHeight: 1,
  },

  // Editor
  editor: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  editorEmpty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    color: 'var(--text)',
  },
  editorEmptyIcon: {
    margin: 0,
    fontSize: '2.5rem',
  },
  editorEmptyTitle: {
    margin: 0,
    fontWeight: 600,
    color: 'var(--text-h)',
    fontSize: '1rem',
  },
  editorEmptyHint: {
    margin: 0,
    fontSize: '0.875rem',
  },
  editorNewBtn: {
    marginTop: '0.5rem',
    padding: '0.5rem 1.25rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  editorTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1.25rem 2rem 0.75rem',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  titleInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text-h)',
    background: 'transparent',
    fontFamily: 'inherit',
  },
  saveStatus: {
    fontSize: '0.75rem',
    color: 'var(--text)',
    flexShrink: 0,
    minWidth: '48px',
    textAlign: 'right' as const,
  },
  contentArea: {
    flex: 1,
    border: 'none',
    outline: 'none',
    resize: 'none' as const,
    padding: '1.25rem 2rem',
    fontSize: '0.95rem',
    lineHeight: '1.7',
    color: 'var(--text-h)',
    background: 'transparent',
    fontFamily: 'inherit',
    overflowY: 'auto' as const,
  },
};

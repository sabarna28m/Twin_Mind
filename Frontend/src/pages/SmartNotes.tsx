import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import api from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SmartNote {
  id: number; user_id: number; title: string; content: string;
  subject: string; tags: string[]; is_pinned: boolean;
  version_number: number; created_at: string | null; updated_at: string | null;
}
interface HistoryNote {
  id: number; original_note_id: number; title: string; content: string;
  subject: string; tags: string[]; version_number: number;
  original_created_at: string | null; deleted_at: string | null;
}
interface NoteVersion {
  id: number; note_id: number; version_number: number;
  title: string; content: string; subject: string; saved_at: string | null;
}
interface SubjectStat {
  note_count: number; edit_count: number; word_count: number;
  pinned: number; strength: number;
}
interface Analytics {
  total_notes: number; total_deleted: number; total_versions: number;
  pinned_count: number;
  subject_stats: Record<string, SubjectStat>;
  timeline: Array<{ type: string; title: string; subject: string; date: string | null }>;
}

type MainView = 'notes' | 'history' | 'analytics' | 'timeline';
type SortBy = 'updated' | 'created' | 'title';
type SaveState = 'saved' | 'saving' | 'unsaved' | 'idle';
type AIAction = 'summarize' | 'keypoints' | 'quiz' | 'flashcards' | 'explain';

// ── Palette ───────────────────────────────────────────────────────────────────

const BG = '#f8f9fa';
const CARD    = '#ffffff';
const CARD2   = '#e2e8f0';
const BORDER  = '1px solid #e2e8f0';
const CYAN    = '#00D4FF';
const INDIGO  = '#6366f1';
const GREEN   = '#10b981';
const AMBER   = '#f59e0b';
const RED     = '#ef4444';
const PURPLE  = '#8b5cf6';
const TEXT    = '#0f172a';
const MUTED   = '#64748b';
const DIM     = '#475569';

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function fmtDate(iso: string | null, short = false): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (short) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const sc = (v: number) => v >= 75 ? GREEN : v >= 50 ? CYAN : v >= 30 ? AMBER : RED;

function Bar({ value, color, h = 4 }: { value: number; color: string; h?: number }) {
  return (
    <div style={{ background: '#e2e8f0', borderRadius: 99, height: h, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.8s ease' }} />
    </div>
  );
}

function Tag({ text, color = CYAN }: { text: string; color?: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 600, background: `${color}20`, color, border: `1px solid ${color}35` }}>
      {text}
    </span>
  );
}

// ── Markdown renderer (no external dep) ──────────────────────────────────────

function renderMarkdown(md: string): string {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^#{3}\s+(.+)$/gm, '<h3 style="color:#0052cc;margin:0.5rem 0 0.2rem;font-size:0.95rem">$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm, '<h2 style="color:#0052cc;margin:0.6rem 0 0.3rem;font-size:1.05rem">$1</h2>')
    .replace(/^#{1}\s+(.+)$/gm, '<h1 style="color:#0052cc;margin:0.7rem 0 0.3rem;font-size:1.2rem">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#0f172a">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(99,102,241,0.2);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.85em;color:#0052cc">$1</code>')
    .replace(/^\s*```[\w]*\n?([\s\S]*?)```/gm, '<pre style="background:rgba(0,0,0,0.4);border:1px solid #e2e8f0;border-radius:8px;padding:0.75rem;overflow-x:auto;font-family:monospace;font-size:0.83rem;color:#0052cc;margin:0.5rem 0">$1</pre>')
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li style="margin-bottom:3px">$1</li>')
    .replace(/^\s*\d+\.\s+(.+)$/gm, '<li style="margin-bottom:3px">$1</li>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#0052cc;text-decoration:underline">$1</a>')
    .replace(/\n\n/g, '</p><p style="margin:0 0 0.4rem">')
    .replace(/\n/g, '<br/>');

  // wrap loose li elements in ul
  html = html.replace(/(<li[^>]*>.*?<\/li>)/gs, (m) => `<ul style="padding-left:1.2rem;margin:0.3rem 0">${m}</ul>`);
  return `<p style="margin:0 0 0.4rem">${html}</p>`;
}

// ── Format toolbar ────────────────────────────────────────────────────────────

function FormatToolbar({ onInsert }: { onInsert: (before: string, after?: string, placeholder?: string) => void }) {
  const btn = (label: string, b: string, a: string, ph: string, title: string) => (
    <button key={label} title={title} onClick={() => onInsert(b, a, ph)}
      style={{ padding: '3px 8px', background: '#f8fafc', border: BORDER, borderRadius: 5, color: MUTED, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, fontFamily: 'monospace' }}>
      {label}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '6px 12px', background: '#f8fafc', borderBottom: BORDER }}>
      {btn('B', '**', '**', 'bold text', 'Bold')}
      {btn('I', '_', '_', 'italic text', 'Italic')}
      {btn('H1', '# ', '', 'Heading', 'Heading 1')}
      {btn('H2', '## ', '', 'Heading', 'Heading 2')}
      {btn('•', '\n- ', '', 'item', 'Bullet list')}
      {btn('1.', '\n1. ', '', 'item', 'Numbered list')}
      {btn('<>', '`', '`', 'code', 'Inline code')}
      {btn('```', '\n```\n', '\n```', 'code block', 'Code block')}
      {btn('🔗', '[', '](url)', 'link text', 'Hyperlink')}
    </div>
  );
}

// ── AI result panel ───────────────────────────────────────────────────────────

function AIResultPanel({ action, result, onClose }: { action: AIAction; result: string; onClose: () => void }) {
  const labels: Record<AIAction, { icon: string; label: string; color: string }> = {
    summarize:  { icon: '📋', label: 'Summary',     color: CYAN   },
    keypoints:  { icon: '🎯', label: 'Key Points',  color: GREEN  },
    quiz:       { icon: '❓', label: 'Quiz',        color: PURPLE },
    flashcards: { icon: '🃏', label: 'Flashcards',  color: AMBER  },
    explain:    { icon: '💡', label: 'Explanation', color: INDIGO },
  };
  const { icon, label, color } = labels[action];
  return (
    <div style={{ background: CARD, border: `1px solid ${color}30`, borderRadius: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.04)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: 320, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color, fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: 1 }}>{icon} {label}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
      </div>
      <div
        dangerouslySetInnerHTML={{ __html: renderMarkdown(result) }}
        style={{ overflowY: 'auto', flex: 1, fontSize: '0.82rem', lineHeight: 1.7, color: MUTED }}
      />
    </div>
  );
}

// ── Version modal ─────────────────────────────────────────────────────────────

function VersionModal({ noteId, currentVersion, onRestore, onClose }:
  { noteId: number; currentVersion: number; onRestore: (v: NoteVersion) => void; onClose: () => void }) {
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<NoteVersion | null>(null);

  useEffect(() => {
    api.get<NoteVersion[]>(`/smart-notes/${noteId}/versions`)
      .then(r => setVersions(r.data))
      .finally(() => setLoading(false));
  }, [noteId]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#f8fafc', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid #e2e8f0', borderRadius: 18, width: '100%', maxWidth: 780, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: BORDER, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: TEXT, fontSize: '0.95rem' }}>🕑 Version History</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr', overflow: 'hidden' }}>
          {/* Version list */}
          <div style={{ borderRight: BORDER, overflowY: 'auto', padding: '0.5rem 0' }}>
            {loading ? (
              <div style={{ padding: '1rem', color: MUTED, fontSize: '0.82rem' }}>Loading…</div>
            ) : versions.map(v => (
              <div key={v.id} onClick={() => setPreview(v)}
                style={{ padding: '0.65rem 1rem', cursor: 'pointer', background: preview?.id === v.id ? `${INDIGO}20` : 'transparent', borderLeft: `3px solid ${preview?.id === v.id ? INDIGO : 'transparent'}`, transition: 'all 0.1s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, color: TEXT, fontSize: '0.8rem' }}>v{v.version_number}</span>
                  {v.version_number === currentVersion && (
                    <Tag text="Current" color={GREEN} />
                  )}
                </div>
                <div style={{ color: DIM, fontSize: '0.7rem' }}>{fmtDate(v.saved_at)}</div>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div style={{ overflowY: 'auto', padding: '1rem' }}>
            {preview ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: TEXT }}>{preview.title}</div>
                    <div style={{ color: DIM, fontSize: '0.72rem', marginTop: 2 }}>v{preview.version_number} · {fmtDate(preview.saved_at)}</div>
                  </div>
                  {preview.version_number !== currentVersion && (
                    <button onClick={() => onRestore(preview)}
                      style={{ padding: '0.4rem 0.85rem', background: `linear-gradient(135deg,${INDIGO},${PURPLE})`, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem' }}>
                      Restore this version
                    </button>
                  )}
                </div>
                <div style={{ background: '#f1f5f9', border: BORDER, borderRadius: 10, padding: '0.85rem', minHeight: 200, fontSize: '0.83rem', lineHeight: 1.75, color: MUTED, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {preview.content || <span style={{ opacity: 0.4, fontStyle: 'italic' }}>Empty</span>}
                </div>
              </>
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: DIM }}>Select a version to preview</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Note card (list item) ─────────────────────────────────────────────────────

function NoteCard({ note, active, onClick, onPin, onDelete }:
  { note: SmartNote; active: boolean; onClick: () => void; onPin: () => void; onDelete: () => void }) {
  const snippet = note.content.replace(/[#*`_\[\]]/g, '').slice(0, 80);
  return (
    <div onClick={onClick} style={{
      padding: '0.8rem 1rem', cursor: 'pointer', borderBottom: BORDER,
      background: active ? `linear-gradient(135deg,${INDIGO}15,${CYAN}08)` : 'transparent',
      borderLeft: `3px solid ${active ? CYAN : 'transparent'}`,
      transition: 'all 0.1s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            {note.is_pinned && <span style={{ fontSize: '0.65rem', color: AMBER }}>📌</span>}
            <span style={{ fontWeight: 600, color: TEXT, fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title || 'Untitled'}</span>
          </div>
          {note.subject && (
            <div style={{ fontSize: '0.65rem', color: CYAN, marginBottom: 3 }}>{note.subject}</div>
          )}
          <div style={{ fontSize: '0.73rem', color: DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {snippet || <span style={{ fontStyle: 'italic' }}>Empty note</span>}
          </div>
          {note.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
              {note.tags.slice(0, 3).map(t => <Tag key={t} text={t} color={PURPLE} />)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: '0.65rem', color: DIM, whiteSpace: 'nowrap' }}>{fmtDate(note.updated_at, true)}</span>
          <div style={{ display: 'flex', gap: 3 }}>
            <button onClick={e => { e.stopPropagation(); onPin(); }}
              style={{ padding: '2px 5px', background: note.is_pinned ? `${AMBER}20` : '#f8fafc', border: `1px solid ${note.is_pinned ? AMBER + '40' : '#e2e8f0'}`, borderRadius: 4, color: note.is_pinned ? AMBER : DIM, cursor: 'pointer', fontSize: '0.65rem' }}>
              📌
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(); }}
              style={{ padding: '2px 5px', background: '#f8fafc', border: BORDER, borderRadius: 4, color: DIM, cursor: 'pointer', fontSize: '0.65rem' }}>
              🗑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Knowledge Heatmap ─────────────────────────────────────────────────────────

function KnowledgeHeatmap({ subjectStats }: { subjectStats: Record<string, SubjectStat> }) {
  const entries = Object.entries(subjectStats).sort((a, b) => b[1].strength - a[1].strength);
  if (!entries.length) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: DIM }}>No notes created yet.</div>
  );

  const strong = entries.filter(([, s]) => s.strength >= 60);
  const medium = entries.filter(([, s]) => s.strength >= 30 && s.strength < 60);
  const weak   = entries.filter(([, s]) => s.strength < 30);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* All subjects bar chart */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        {entries.map(([subj, st]) => {
          const color = sc(st.strength);
          return (
            <div key={subj}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.82rem', color: TEXT, fontWeight: 600 }}>{subj}</span>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.68rem', color: DIM }}>{st.note_count} notes · {st.word_count} words</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color }}>{st.strength}%</span>
                </div>
              </div>
              <Bar value={st.strength} color={color} h={8} />
            </div>
          );
        })}
      </div>

      {/* Category bands */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        {[
          { label: '✓ Strong Topics',          items: strong, color: GREEN  },
          { label: '⚡ Developing Topics',      items: medium, color: AMBER  },
          { label: '⚠ Needs Attention',         items: weak,   color: RED    },
        ].map(({ label, items, color }) => (
          <div key={label} style={{ background: CARD, border: `1px solid ${color}25`, borderRadius: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.04)', padding: '0.9rem' }}>
            <div style={{ color, fontWeight: 700, fontSize: '0.75rem', marginBottom: '0.6rem' }}>{label}</div>
            {items.length === 0
              ? <div style={{ color: DIM, fontSize: '0.73rem', fontStyle: 'italic' }}>None</div>
              : items.map(([subj, st]) => (
                <div key={subj} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem', color: MUTED }}>{subj}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color }}>{st.strength}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Timeline view ─────────────────────────────────────────────────────────────

function TimelineView({ events }: { events: Array<{ type: string; title: string; subject: string; date: string | null }> }) {
  const iconMap: Record<string, { icon: string; color: string; label: string }> = {
    created:  { icon: '✏️', color: GREEN,  label: 'Note Added'   },
    edited:   { icon: '🔄', color: CYAN,   label: 'Note Edited'  },
    deleted:  { icon: '🗑️', color: RED,    label: 'Note Deleted' },
    restored: { icon: '♻️', color: PURPLE, label: 'Note Restored'},
  };

  if (!events.length) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: DIM }}>No activity yet. Start creating notes!</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative', paddingLeft: '2.5rem' }}>
      {/* Vertical line */}
      <div style={{ position: 'absolute', left: '0.65rem', top: 0, bottom: 0, width: 2, background: 'linear-gradient(to bottom,rgba(99,102,241,0.6),transparent)' }} />

      {events.map((ev, i) => {
        const { icon, color, label } = iconMap[ev.type] ?? { icon: '📝', color: MUTED, label: ev.type };
        return (
          <div key={i} style={{ display: 'flex', gap: '0.85rem', paddingBottom: '1rem', position: 'relative' }}>
            {/* Dot */}
            <div style={{ position: 'absolute', left: '-1.85rem', width: 14, height: 14, borderRadius: '50%', background: color, border: `2px solid ${BG}`, boxShadow: `0 4px 12px ${color}30`, flexShrink: 0, top: 2 }} />

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.8 }}>{icon} {label}</span>
                  <div style={{ fontWeight: 600, color: TEXT, fontSize: '0.84rem', marginTop: 1 }}>{ev.title || 'Untitled'}</div>
                  {ev.subject && <div style={{ fontSize: '0.68rem', color: CYAN, marginTop: 1 }}>{ev.subject}</div>}
                </div>
                <span style={{ fontSize: '0.68rem', color: DIM, whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>{fmtDate(ev.date)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SmartNotes() {
  // View state
  const [view, setView]         = useState<MainView>('notes');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [filterSubj, setFilterSubj] = useState<string | null>(null);
  const [sortBy, setSortBy]     = useState<SortBy>('updated');
  const [search, setSearch]     = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);

  // Note data
  const [notes, setNotes]     = useState<SmartNote[]>([]);
  const [history, setHistory] = useState<HistoryNote[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  // Editor state
  const [title, setTitle]     = useState('');
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags]       = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // AI state
  const [aiLoading, setAiLoading]  = useState(false);
  const [aiAction, setAiAction]    = useState<AIAction | null>(null);
  const [aiResult, setAiResult]    = useState<string | null>(null);

  // Modals
  const [showVersions, setShowVersions] = useState(false);

  // Refs
  const saveTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef   = useRef<HTMLTextAreaElement>(null);
  const editorDirty  = useRef(false);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadNotes = useCallback(async () => {
    try {
      const params: Record<string, string> = { sort_by: sortBy };
      if (filterSubj) params.subject = filterSubj;
      if (search.trim()) params.search = search.trim();
      if (pinnedOnly) params.pinned_only = 'true';
      const r = await api.get<SmartNote[]>('/smart-notes', { params });
      setNotes(r.data);
    } catch { /* ignore */ }
  }, [sortBy, filterSubj, search, pinnedOnly]);

  useEffect(() => {
    Promise.all([
      api.get<{ subjects: string[] }>('/smart-notes/subjects').then(r => setSubjects(r.data.subjects)),
      loadNotes(),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const loadHistory = useCallback(async () => {
    const r = await api.get<HistoryNote[]>('/smart-notes/history');
    setHistory(r.data);
  }, []);

  const loadAnalytics = useCallback(async () => {
    const r = await api.get<Analytics>('/smart-notes/analytics');
    setAnalytics(r.data);
  }, []);

  useEffect(() => {
    if (view === 'history') loadHistory();
    if (view === 'analytics' || view === 'timeline') loadAnalytics();
  }, [view, loadHistory, loadAnalytics]);

  // ── Select a note ─────────────────────────────────────────────────────────

  function selectNote(note: SmartNote) {
    flushSave();
    setActiveId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setSubject(note.subject || '');
    setTags(note.tags || []);
    setSaveState('idle');
    setAiResult(null);
    setAiAction(null);
    setPreview(false);
    editorDirty.current = false;
  }

  // ── Auto-save ─────────────────────────────────────────────────────────────

  function flushSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }

  function scheduleSave(t: string, c: string, s: string, tgs: string[]) {
    if (!activeId) return;
    setSaveState('unsaved');
    flushSave();
    saveTimer.current = setTimeout(() => doSave(activeId, t, c, s, tgs), 1500);
  }

  async function doSave(id: number, t: string, c: string, s: string, tgs: string[]) {
    if (!t.trim()) return;
    setSaveState('saving');
    try {
      const r = await api.put<SmartNote>(`/smart-notes/${id}`, { title: t, content: c, subject: s, tags: tgs });
      setNotes(prev => prev.map(n => n.id === id ? r.data : n).sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime();
      }));
      setSaveState('saved');
      setLastSaved(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
      editorDirty.current = false;
    } catch {
      setSaveState('unsaved');
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async function createNote() {
    flushSave();
    const r = await api.post<SmartNote>('/smart-notes', { title: 'Untitled Note', content: '', subject: filterSubj || '', tags: [] });
    const newNote = r.data;
    setNotes(prev => [newNote, ...prev]);
    selectNote(newNote);
    // refresh subjects
    api.get<{ subjects: string[] }>('/smart-notes/subjects').then(r => setSubjects(r.data.subjects));
  }

  async function deleteNote(id: number) {
    flushSave();
    await api.delete(`/smart-notes/${id}`);
    setNotes(prev => prev.filter(n => n.id !== id));
    if (activeId === id) {
      const remaining = notes.filter(n => n.id !== id);
      if (remaining.length > 0) selectNote(remaining[0]);
      else { setActiveId(null); setTitle(''); setContent(''); setSubject(''); setTags([]); }
    }
    await loadHistory();
  }

  async function togglePin(note: SmartNote) {
    const r = await api.put<SmartNote>(`/smart-notes/${note.id}`, { is_pinned: !note.is_pinned });
    setNotes(prev => prev.map(n => n.id === note.id ? r.data : n));
  }

  async function restoreHistory(id: number) {
    const r = await api.post<SmartNote>(`/smart-notes/history/${id}/restore`);
    setHistory(prev => prev.filter(h => h.id !== id));
    setNotes(prev => [r.data, ...prev]);
    selectNote(r.data);
    setView('notes');
  }

  async function permanentDelete(id: number) {
    await api.delete(`/smart-notes/history/${id}`);
    setHistory(prev => prev.filter(h => h.id !== id));
  }

  async function restoreVersion(v: NoteVersion) {
    if (!activeId) return;
    const r = await api.post<SmartNote>(`/smart-notes/${activeId}/versions/${v.id}/restore`);
    const updated = r.data;
    setNotes(prev => prev.map(n => n.id === activeId ? updated : n));
    setTitle(updated.title);
    setContent(updated.content);
    setSubject(updated.subject);
    setTags(updated.tags);
    setShowVersions(false);
    setSaveState('saved');
    setLastSaved(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
  }

  // ── AI actions ────────────────────────────────────────────────────────────

  async function runAI(action: AIAction) {
    if (!activeId || !content.trim()) return;
    setAiLoading(true);
    setAiAction(action);
    setAiResult(null);
    try {
      const r = await api.post<{ action: string; result: string }>(`/smart-notes/${activeId}/ai`, {
        action, content, title,
      });
      setAiResult(r.data.result);
    } catch (e: any) {
      setAiResult('❌ AI request failed. Check that the AI service is configured.');
    } finally {
      setAiLoading(false);
    }
  }

  // ── Format toolbar handler ─────────────────────────────────────────────────

  function handleInsert(before: string, after = '', placeholder = '') {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end   = ta.selectionEnd ?? 0;
    const selected = ta.value.slice(start, end) || placeholder;
    const newVal = ta.value.slice(0, start) + before + selected + after + ta.value.slice(end);
    setContent(newVal);
    scheduleSave(title, newVal, subject, tags);
    setTimeout(() => {
      ta.selectionStart = start + before.length;
      ta.selectionEnd   = start + before.length + selected.length;
      ta.focus();
    }, 0);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  function exportTxt() {
    const blob = new Blob([`${title}\n${'='.repeat(title.length)}\n\n${content}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>${title}</title><style>body{font-family:sans-serif;max-width:700px;margin:2rem auto;line-height:1.7}h1{font-size:1.6rem}pre{background:#f3f4f6;padding:1rem;border-radius:8px}code{background:#e5e7eb;padding:2px 5px;border-radius:3px}</style></head><body><h1>${title}</h1><pre style="white-space:pre-wrap;font-family:inherit">${content}</pre></body></html>`);
    win.document.close();
    win.print();
  }

  // ── Tag management ────────────────────────────────────────────────────────

  function handleTagKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/,$/, '');
      if (!tags.includes(newTag)) {
        const newTags = [...tags, newTag];
        setTags(newTags);
        scheduleSave(title, content, subject, newTags);
      }
      setTagInput('');
    }
    if (e.key === 'Backspace' && !tagInput && tags.length) {
      const newTags = tags.slice(0, -1);
      setTags(newTags);
      scheduleSave(title, content, subject, newTags);
    }
  }

  function removeTag(t: string) {
    const newTags = tags.filter(x => x !== t);
    setTags(newTags);
    scheduleSave(title, content, subject, newTags);
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeNote = notes.find(n => n.id === activeId);
  const currentVersion = activeNote?.version_number ?? 1;

  const saveLabel =
    saveState === 'saving'  ? '⟳ Saving…' :
    saveState === 'saved'   ? `✓ Saved${lastSaved ? ` at ${lastSaved}` : ''}` :
    saveState === 'unsaved' ? '● Unsaved' : '';

  const saveColor =
    saveState === 'saving'  ? AMBER :
    saveState === 'saved'   ? GREEN :
    saveState === 'unsaved' ? RED : DIM;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100svh', background: BG, color: TEXT, fontFamily: '"Inter", system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        * { scrollbar-width:thin; scrollbar-color:#e2e8f0 transparent; }
        *::-webkit-scrollbar { width:4px; height:4px; }
        *::-webkit-scrollbar-thumb { background:#e2e8f0; border-radius:99px; }
        input,textarea,select { outline:none; }
        input:focus,textarea:focus,select:focus { border-color:rgba(99,102,241,0.5) !important; }
        select option { background:#0d1117; color:#0f172a; }
        .note-card:hover { background:#ffffff !important; }
        .ai-btn:hover { opacity:0.85; }
        .view-tab:hover { color:#0f172a !important; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ borderBottom: '#e2e8f0', padding: '0.85rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <BackButton />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🧠</span>
          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: TEXT }}>Smart Notes</span>
          <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 99, background: `${CYAN}15`, color: CYAN, border: `1px solid ${CYAN}30`, fontWeight: 700 }}>Knowledge Memory</span>
        </div>
        <Link to="/dashboard" style={{ marginLeft: 'auto', color: MUTED, fontSize: '0.8rem', textDecoration: 'none' }}>← Dashboard</Link>
      </div>

      {/* ── Stats bar ── */}
      {analytics && (
        <div style={{ display: 'flex', gap: '0', borderBottom: BORDER, background: '#f8fafc', overflowX: 'auto' }}>
          {[
            { icon: '📝', label: 'Total Notes',    value: analytics.total_notes,   color: CYAN   },
            { icon: '📌', label: 'Pinned',          value: analytics.pinned_count,  color: AMBER  },
            { icon: '🗑️', label: 'In History',      value: analytics.total_deleted, color: RED    },
            { icon: '🔄', label: 'Total Versions',  value: analytics.total_versions, color: PURPLE },
            { icon: '📚', label: 'Subjects',        value: Object.keys(analytics.subject_stats).length, color: GREEN },
          ].map(({ icon, label, value, color }) => (
            <div key={label} style={{ padding: '0.6rem 1.25rem', borderRight: BORDER, flexShrink: 0, textAlign: 'center' }}>
              <div style={{ fontSize: '0.58rem', color: DIM, textTransform: 'uppercase', letterSpacing: 1 }}>{icon} {label}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color, marginTop: 1 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── View tabs ── */}
      <div style={{ display: 'flex', borderBottom: BORDER, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)' }}>
        {([
          { id: 'notes',     icon: '📝', label: 'Notes'     },
          { id: 'history',   icon: '🗑️', label: 'History'   },
          { id: 'analytics', icon: '📊', label: 'Analytics' },
          { id: 'timeline',  icon: '🕑', label: 'Timeline'  },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setView(tab.id)} className="view-tab"
            style={{ padding: '0.7rem 1.25rem', background: 'none', border: 'none', borderBottom: `2px solid ${view === tab.id ? CYAN : 'transparent'}`, color: view === tab.id ? CYAN : MUTED, cursor: 'pointer', fontSize: '0.8rem', fontWeight: view === tab.id ? 700 : 400, display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'color 0.15s' }}>
            <span>{tab.icon}</span><span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Main content ── */}
      <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: '120vw', height: '60vh', background: 'radial-gradient(ellipse at center, rgba(0,82,204,0.05) 0%, rgba(248,249,250,0) 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', zIndex: 1, position: 'relative' }}>

        {/* ══════════════ NOTES VIEW ══════════════ */}
        {view === 'notes' && (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '180px 300px 1fr', overflow: 'hidden' }}>

            {/* Left: Subject sidebar */}
            <div style={{ borderRight: BORDER, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#f8fafc' }}>
              <div style={{ padding: '0.9rem 0.85rem 0.5rem', fontSize: '0.62rem', color: DIM, textTransform: 'uppercase', letterSpacing: 1 }}>Subjects</div>
              <button onClick={() => setFilterSubj(null)}
                style={{ padding: '0.5rem 0.85rem', background: !filterSubj ? `${CYAN}15` : 'transparent', border: 'none', borderLeft: `3px solid ${!filterSubj ? CYAN : 'transparent'}`, color: !filterSubj ? CYAN : MUTED, cursor: 'pointer', fontSize: '0.8rem', fontWeight: !filterSubj ? 700 : 400, textAlign: 'left' }}>
                All Notes
              </button>
              {subjects.map(s => (
                <button key={s} onClick={() => setFilterSubj(filterSubj === s ? null : s)}
                  style={{ padding: '0.45rem 0.85rem', background: filterSubj === s ? `${INDIGO}15` : 'transparent', border: 'none', borderLeft: `3px solid ${filterSubj === s ? INDIGO : 'transparent'}`, color: filterSubj === s ? CYAN : MUTED, cursor: 'pointer', fontSize: '0.78rem', fontWeight: filterSubj === s ? 700 : 400, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s}
                </button>
              ))}
              {subjects.length === 0 && (
                <div style={{ padding: '0.5rem 0.85rem', fontSize: '0.72rem', color: DIM, fontStyle: 'italic' }}>No subjects yet</div>
              )}
            </div>

            {/* Center: Note list */}
            <div style={{ borderRight: BORDER, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Toolbar */}
              <div style={{ padding: '0.6rem 0.75rem', borderBottom: BORDER, display: 'flex', flexDirection: 'column', gap: '0.45rem', background: '#f1f5f9' }}>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 Search notes…"
                    style={{ flex: 1, background: CARD, border: BORDER, borderRadius: 8, padding: '0.38rem 0.65rem', color: TEXT, fontSize: '0.78rem' }}
                  />
                  <button onClick={createNote}
                    style={{ padding: '0.38rem 0.75rem', background: `linear-gradient(135deg,${INDIGO},${PURPLE})`, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                    + New
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)} className="form-select"
                    style={{ flex: 1, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.28rem 0.5rem', color: '#0f172a', fontSize: '0.7rem' }}>
                    <option value="updated">Sort: Updated</option>
                    <option value="created">Sort: Created</option>
                    <option value="title">Sort: Title</option>
                  </select>
                  <button onClick={() => setPinnedOnly(p => !p)}
                    style={{ padding: '0.28rem 0.55rem', background: pinnedOnly ? `${AMBER}20` : 'rgba(0,0,0,0.3)', border: `1px solid ${pinnedOnly ? AMBER + '40' : '#e2e8f0'}`, borderRadius: 6, color: pinnedOnly ? AMBER : DIM, cursor: 'pointer', fontSize: '0.68rem' }}>
                    📌
                  </button>
                </div>
              </div>

              {/* Notes list */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: MUTED, fontSize: '0.85rem' }}>Loading…</div>
                ) : notes.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📝</div>
                    <div style={{ color: TEXT, fontWeight: 600, marginBottom: 4 }}>No notes yet</div>
                    <div style={{ color: MUTED, fontSize: '0.8rem', marginBottom: '1rem' }}>Create your first note to begin</div>
                    <button onClick={createNote} style={{ padding: '0.5rem 1.2rem', background: `linear-gradient(135deg,${INDIGO},${PURPLE})`, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>+ Create Note</button>
                  </div>
                ) : notes.map(note => (
                  <NoteCard key={note.id} note={note} active={note.id === activeId}
                    onClick={() => selectNote(note)}
                    onPin={() => togglePin(note)}
                    onDelete={() => deleteNote(note.id)}
                  />
                ))}
              </div>
            </div>

            {/* Right: Editor */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {activeId === null ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: DIM }}>
                  <div style={{ fontSize: '3rem' }}>📓</div>
                  <div style={{ fontWeight: 600, color: MUTED }}>Select a note or create one</div>
                  <button onClick={createNote} style={{ padding: '0.55rem 1.5rem', background: `linear-gradient(135deg,${INDIGO},${PURPLE})`, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}>+ New Note</button>
                </div>
              ) : (
                <>
                  {/* Editor top bar */}
                  <div style={{ padding: '0.65rem 1rem', borderBottom: BORDER, display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', background: '#f1f5f9', flexShrink: 0 }}>
                    {/* Subject */}
                    <select value={subject} onChange={e => { setSubject(e.target.value); scheduleSave(title, content, e.target.value, tags); }} className="form-select"
                      style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '0.28rem 0.6rem', color: '#0f172a', fontSize: '0.75rem', cursor: 'pointer' }}>
                      <option value="">No subject</option>
                      {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    {/* Tags */}
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 1, minWidth: 120, flexWrap: 'wrap', background: '#f1f5f9', border: BORDER, borderRadius: 7, padding: '0.22rem 0.6rem' }}>
                      {tags.map(t => (
                        <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 99, background: `${PURPLE}20`, color: PURPLE, fontSize: '0.68rem', border: `1px solid ${PURPLE}35` }}>
                          {t}<button onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', color: PURPLE, cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '0.7rem' }}>×</button>
                        </span>
                      ))}
                      <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleTagKey}
                        placeholder={tags.length === 0 ? '+ Add tag' : ''} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '0.72rem', minWidth: 60, flex: 1 }} />
                    </div>

                    {/* Save state */}
                    <span style={{ fontSize: '0.7rem', color: saveColor, fontWeight: 600, whiteSpace: 'nowrap' }}>{saveLabel}</span>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                      <button onClick={() => setPreview(p => !p)}
                        style={{ padding: '0.28rem 0.65rem', background: preview ? `${CYAN}20` : 'rgba(0,0,0,0.3)', border: `1px solid ${preview ? CYAN + '40' : '#e2e8f0'}`, borderRadius: 7, color: preview ? CYAN : MUTED, cursor: 'pointer', fontSize: '0.72rem' }}>
                        {preview ? '✎ Edit' : '👁 Preview'}
                      </button>
                      <button onClick={() => setShowVersions(true)}
                        style={{ padding: '0.28rem 0.65rem', background: '#f1f5f9', border: BORDER, borderRadius: 7, color: MUTED, cursor: 'pointer', fontSize: '0.72rem' }} title="Version history">
                        🕑 v{currentVersion}
                      </button>
                      <button onClick={exportTxt}
                        style={{ padding: '0.28rem 0.65rem', background: '#f1f5f9', border: BORDER, borderRadius: 7, color: MUTED, cursor: 'pointer', fontSize: '0.72rem' }}>TXT</button>
                      <button onClick={exportPdf}
                        style={{ padding: '0.28rem 0.65rem', background: '#f1f5f9', border: BORDER, borderRadius: 7, color: MUTED, cursor: 'pointer', fontSize: '0.72rem' }}>PDF</button>
                    </div>
                  </div>

                  {/* Format toolbar (only in edit mode) */}
                  {!preview && <FormatToolbar onInsert={handleInsert} />}

                  {/* Title */}
                  <div style={{ padding: '0.85rem 1.25rem 0', flexShrink: 0 }}>
                    <input
                      value={title}
                      onChange={e => { setTitle(e.target.value); scheduleSave(e.target.value, content, subject, tags); editorDirty.current = true; }}
                      placeholder="Note title…"
                      style={{ width: '100%', background: 'transparent', border: 'none', fontSize: '1.35rem', fontWeight: 800, color: TEXT, fontFamily: 'inherit' }}
                    />
                  </div>

                  {/* Content area */}
                  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {preview ? (
                      <div
                        style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.25rem 1rem', fontSize: '0.9rem', lineHeight: 1.8, color: MUTED }}
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) || '<span style="opacity:0.4;font-style:italic">Nothing to preview</span>' }}
                      />
                    ) : (
                      <textarea
                        ref={contentRef}
                        value={content}
                        onChange={e => { setContent(e.target.value); scheduleSave(title, e.target.value, subject, tags); editorDirty.current = true; }}
                        placeholder="Start writing…  Supports **bold**, _italic_, # Heading, - bullet, `code`, ```blocks```, [links](url)"
                        style={{ flex: 1, background: 'transparent', border: 'none', resize: 'none', padding: '0.75rem 1.25rem 1rem', fontSize: '0.9rem', lineHeight: 1.8, color: MUTED, fontFamily: 'inherit', overflowY: 'auto' }}
                      />
                    )}

                    {/* AI panel */}
                    <div style={{ borderTop: BORDER, padding: '0.65rem 1rem', background: '#f8fafc', flexShrink: 0 }}>
                      {/* AI buttons */}
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: aiResult ? '0.65rem' : 0 }}>
                        {([
                          { action: 'summarize' as AIAction,  icon: '📋', label: 'Summarize',   color: CYAN   },
                          { action: 'keypoints' as AIAction,  icon: '🎯', label: 'Key Points',  color: GREEN  },
                          { action: 'quiz'      as AIAction,  icon: '❓', label: 'Quiz',        color: PURPLE },
                          { action: 'flashcards' as AIAction, icon: '🃏', label: 'Flashcards',  color: AMBER  },
                          { action: 'explain'   as AIAction,  icon: '💡', label: 'Explain',     color: INDIGO },
                        ]).map(({ action, icon, label, color }) => (
                          <button key={action} onClick={() => runAI(action)} disabled={aiLoading || !content.trim()} className="ai-btn"
                            style={{ padding: '0.32rem 0.75rem', background: aiAction === action && aiResult ? `${color}20` : CARD, border: `1px solid ${aiAction === action && aiResult ? color + '40' : '#e2e8f0'}`, borderRadius: 8, color: aiLoading && aiAction === action ? MUTED : color, cursor: aiLoading || !content.trim() ? 'not-allowed' : 'pointer', fontSize: '0.73rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, opacity: !content.trim() ? 0.5 : 1, transition: 'all 0.15s' }}>
                            {aiLoading && aiAction === action
                              ? <div style={{ width: 10, height: 10, border: `2px solid ${color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                              : icon}
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* AI result */}
                      {aiResult && aiAction && (
                        <AIResultPanel action={aiAction} result={aiResult} onClose={() => { setAiResult(null); setAiAction(null); }} />
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ HISTORY VIEW ══════════════ */}
        {view === 'history' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: TEXT, marginBottom: 2 }}>🗑️ Notes History</div>
                  <div style={{ color: MUTED, fontSize: '0.82rem' }}>Deleted notes are archived here — never lost permanently unless you choose.</div>
                </div>
              </div>

              {history.length === 0 ? (
                <div style={{ padding: '4rem', textAlign: 'center', background: CARD, border: BORDER, borderRadius: 20 }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✨</div>
                  <div style={{ color: TEXT, fontWeight: 600 }}>History is empty</div>
                  <div style={{ color: MUTED, fontSize: '0.83rem', marginTop: 4 }}>Deleted notes will appear here and can be restored at any time.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1rem' }}>
                  {history.map(h => (
                    <div key={h.id} style={{ background: CARD, border: `1px solid ${RED}20`, borderRadius: 16, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: TEXT, marginBottom: 2, fontSize: '0.9rem' }}>{h.title || 'Untitled'}</div>
                        {h.subject && <div style={{ fontSize: '0.68rem', color: CYAN }}>{h.subject}</div>}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: DIM, lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                        {h.content || <span style={{ fontStyle: 'italic' }}>Empty note</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {h.tags.map(t => <Tag key={t} text={t} color={PURPLE} />)}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: DIM }}>Deleted {fmtDate(h.deleted_at)}</div>
                          <div style={{ fontSize: '0.65rem', color: DIM }}>v{h.version_number} · Created {fmtDate(h.original_created_at, true)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => restoreHistory(h.id)}
                            style={{ padding: '0.32rem 0.75rem', background: `${GREEN}18`, border: `1px solid ${GREEN}35`, borderRadius: 8, color: GREEN, cursor: 'pointer', fontWeight: 700, fontSize: '0.73rem' }}>
                            ♻ Restore
                          </button>
                          <button onClick={() => permanentDelete(h.id)}
                            style={{ padding: '0.32rem 0.75rem', background: `${RED}15`, border: `1px solid ${RED}30`, borderRadius: 8, color: RED, cursor: 'pointer', fontSize: '0.73rem' }}>
                            ✕ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ ANALYTICS VIEW ══════════════ */}
        {view === 'analytics' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: TEXT }}>📊 Knowledge Analytics</div>

              {!analytics ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: MUTED }}>Loading analytics…</div>
              ) : (
                <>
                  {/* Summary stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '0.75rem' }}>
                    {[
                      { icon: '📝', label: 'Notes',       value: analytics.total_notes,    color: CYAN   },
                      { icon: '📌', label: 'Pinned',       value: analytics.pinned_count,   color: AMBER  },
                      { icon: '🗑️', label: 'Archived',     value: analytics.total_deleted,  color: RED    },
                      { icon: '🔄', label: 'Revisions',    value: analytics.total_versions, color: PURPLE },
                      { icon: '📚', label: 'Subjects',     value: Object.keys(analytics.subject_stats).length, color: GREEN },
                    ].map(({ icon, label, value, color }) => (
                      <div key={label} style={{ background: CARD2, border: `1px solid ${color}25`, borderRadius: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.04)', padding: '0.9rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem', marginBottom: 4 }}>{icon}</div>
                        <div style={{ fontSize: '0.62rem', color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Knowledge heatmap */}
                  <div style={{ background: CARD, border: BORDER, borderRadius: 20, padding: '1.5rem' }}>
                    <div style={{ fontWeight: 700, color: TEXT, marginBottom: '1rem', fontSize: '0.95rem' }}>🧠 Knowledge Strength Heatmap</div>
                    <KnowledgeHeatmap subjectStats={analytics.subject_stats} />
                  </div>

                  {/* Recent timeline preview */}
                  {analytics.timeline.length > 0 && (
                    <div style={{ background: CARD, border: BORDER, borderRadius: 20, padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div style={{ fontWeight: 700, color: TEXT, fontSize: '0.95rem' }}>🕑 Recent Activity</div>
                        <button onClick={() => setView('timeline')} style={{ background: 'none', border: 'none', color: CYAN, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>View full timeline →</button>
                      </div>
                      <TimelineView events={analytics.timeline.slice(0, 8)} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ TIMELINE VIEW ══════════════ */}
        {view === 'timeline' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: TEXT, marginBottom: '0.5rem' }}>🕑 Memory Timeline</div>
              <div style={{ color: MUTED, fontSize: '0.82rem', marginBottom: '1.5rem' }}>Your complete learning journey — every note created, edited, and deleted.</div>

              {!analytics ? (
                <div style={{ color: MUTED, textAlign: 'center', padding: '3rem' }}>Loading timeline…</div>
              ) : (
                <TimelineView events={analytics.timeline} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Version modal ── */}
      {showVersions && activeId && (
        <VersionModal
          noteId={activeId}
          currentVersion={currentVersion}
          onRestore={restoreVersion}
          onClose={() => setShowVersions(false)}
        />
      )}
    </div>
  );
}

import { Trash2, Clock, CheckCircle, Circle } from 'lucide-react';
import type { Session } from '../../types/sessions';

interface Props {
  session: Session;
  onToggle: (s: Session) => void;
  onDelete: (id: number) => void;
  index?: number;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(mins: number) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ''}`.trim();
  return `${m}m`;
}

export default function SessionCard({ session, onToggle, onDelete, index = 0 }: Props) {
  const done = session.status === 'completed';

  return (
    <div
      style={{ ...s.card, animationDelay: `${index * 0.04}s`, borderColor: done ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.07)' }}
      className="animate-fade-in glass-panel"
    >
      {/* Left: status toggle */}
      <button
        onClick={() => onToggle(session)}
        style={s.statusBtn}
        title={done ? 'Mark as active' : 'Mark as complete'}
        aria-label="Toggle session status"
      >
        {done
          ? <CheckCircle size={20} style={{ color: '#10b981' }} />
          : <Circle size={20} style={{ color: 'rgba(148,163,184,0.4)' }} />
        }
      </button>

      {/* Middle: info */}
      <div style={s.info}>
        <p style={{ ...s.title, textDecoration: done ? 'none' : undefined, color: done ? 'rgba(226,232,240,0.75)' : 'var(--text-h)' }}>
          {session.title}
        </p>
        <div style={s.meta}>
          {session.subject && (
            <span style={s.subjectBadge}>{session.subject}</span>
          )}
          {session.duration_minutes > 0 && (
            <span style={s.metaChip}>
              <Clock size={11} style={{ flexShrink: 0 }} />
              {formatDuration(session.duration_minutes)}
            </span>
          )}
          <span style={s.metaDate}>{formatDate(session.created_at)}</span>
        </div>
      </div>

      {/* Right: status badge + delete */}
      <div style={s.actions}>
        <span style={done ? s.badgeDone : s.badgeActive}>
          {done ? 'Completed' : 'Active'}
        </span>
        <button
          onClick={() => onDelete(session.id)}
          style={s.deleteBtn}
          title="Delete session"
          aria-label="Delete session"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex', alignItems: 'center', gap: '0.85rem',
    padding: '0.95rem 1.1rem', borderRadius: '14px',
    background: 'rgba(10,16,32,0.7)',
    border: '1px solid',
    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    transition: 'border-color 0.2s, background 0.2s',
  },
  statusBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem',
    display: 'flex', alignItems: 'center', flexShrink: 0, fontFamily: 'inherit',
  },
  info: { flex: 1, minWidth: 0 },
  title: {
    margin: '0 0 0.3rem', fontSize: '0.9rem', fontWeight: 600,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  meta: { display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' },
  subjectBadge: {
    padding: '0.14rem 0.5rem', borderRadius: '6px',
    background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)',
    color: '#00D4FF', fontSize: '0.7rem', fontWeight: 700,
  },
  metaChip: {
    display: 'flex', alignItems: 'center', gap: '0.2rem',
    fontSize: '0.72rem', color: 'var(--text)', fontWeight: 500,
  },
  metaDate: { fontSize: '0.72rem', color: 'rgba(148,163,184,0.5)' },
  actions: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 },
  badgeActive: {
    padding: '0.2rem 0.6rem', borderRadius: '99px',
    border: '1px solid rgba(245,158,11,0.35)',
    background: 'rgba(245,158,11,0.1)',
    color: '#fbbf24', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap',
  },
  badgeDone: {
    padding: '0.2rem 0.6rem', borderRadius: '99px',
    border: '1px solid rgba(16,185,129,0.35)',
    background: 'rgba(16,185,129,0.1)',
    color: '#34d399', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap',
  },
  deleteBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'rgba(148,163,184,0.4)', padding: '0.25rem',
    borderRadius: '7px', display: 'flex', alignItems: 'center',
    transition: 'color 0.18s', fontFamily: 'inherit',
  },
};

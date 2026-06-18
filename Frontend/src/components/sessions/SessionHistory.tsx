import SessionCard from './SessionCard';
import type { Session } from '../../types/sessions';

interface Props {
  sessions: Session[];
  loading: boolean;
  onToggle: (s: Session) => void;
  onDelete: (id: number) => void;
  totalCount: number;
}

export default function SessionHistory({ sessions, loading, onToggle, onDelete, totalCount }: Props) {
  if (loading) {
    return (
      <div style={s.loadWrap}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ ...s.skeleton, animationDelay: `${i * 0.12}s`, animation: 'fade-in 1.2s ease infinite alternate' }} />
        ))}
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div style={s.empty}>
        <p style={s.emptyIcon}>📖</p>
        <p style={s.emptyTitle}>No sessions yet</p>
        <p style={s.emptyHint}>Start your first focus session with the timer above.</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div style={s.empty}>
        <p style={s.emptyIcon}>🔍</p>
        <p style={s.emptyTitle}>No sessions match your filters</p>
        <p style={s.emptyHint}>Try adjusting the search or filter options.</p>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.headingTitle}>Session History</span>
        <span style={s.headingCount}>{sessions.length} of {totalCount}</span>
      </div>
      <div style={s.list}>
        {sessions.map((session, i) => (
          <SessionCard
            key={session.id}
            session={session}
            onToggle={onToggle}
            onDelete={onDelete}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  loadWrap: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  skeleton: {
    height: '72px', borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
  },
  empty: { textAlign: 'center', padding: '3.5rem 1rem' },
  emptyIcon:  { margin: '0 0 0.6rem', fontSize: '2.2rem' },
  emptyTitle: { margin: '0 0 0.3rem', fontWeight: 700, color: 'var(--text-h)', fontSize: '1rem' },
  emptyHint:  { margin: 0, color: 'var(--text)', fontSize: '0.84rem' },

  wrap:   { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 0.25rem',
  },
  headingTitle: { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  headingCount: {
    fontSize: '0.68rem', fontWeight: 700, color: '#00D4FF',
    background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)',
    borderRadius: '99px', padding: '0.15rem 0.55rem',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
};

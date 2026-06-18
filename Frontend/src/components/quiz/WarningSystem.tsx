import type { IntegrityWarning } from '../../services/integrityEngine';
import { MAX_WARNINGS } from '../../services/integrityEngine';

interface Props {
  warnings: IntegrityWarning[];
  latestWarning: IntegrityWarning | null;
  onDismiss: () => void;
  terminated: boolean;
  onTerminationAcknowledge: () => void;
  quizScore: number;
  totalQuestions: number;
}

const WARNING_ICONS: Record<string, string> = {
  tab_switch:       '🔀',
  face_absent:      '👁',
  distracted:       '😵',
  suspicious_audio: '🔊',
  multiple_faces:   '👥',
};

export default function WarningSystem({ warnings, latestWarning, onDismiss, terminated, onTerminationAcknowledge, quizScore, totalQuestions }: Props) {
  const count = warnings.length;

  return (
    <>
      {/* Warning badge — always visible */}
      <div style={w.badge}>
        {Array.from({ length: MAX_WARNINGS }).map((_, i) => (
          <div
            key={i}
            style={{
              ...w.dot,
              background: i < count ? '#ef4444' : 'rgba(255,255,255,0.1)',
              boxShadow: i < count ? '0 0 6px rgba(239,68,68,0.6)' : 'none',
              transform: i === count - 1 ? 'scale(1.25)' : 'scale(1)',
            }}
          />
        ))}
        <span style={{ ...w.label, color: count >= 4 ? '#ef4444' : count >= 2 ? '#f59e0b' : 'var(--text)' }}>
          {count}/{MAX_WARNINGS} warnings
        </span>
      </div>

      {/* Latest warning toast */}
      {latestWarning && !terminated && (
        <div style={w.toast} className="animate-slide-up">
          <span style={{ fontSize: '1.1rem' }}>{WARNING_ICONS[latestWarning.type] ?? '⚠️'}</span>
          <div style={{ flex: 1 }}>
            <p style={w.toastTitle}>Warning {count} of {MAX_WARNINGS}</p>
            <p style={w.toastMsg}>{latestWarning.message}</p>
          </div>
          <button onClick={onDismiss} style={w.dismissBtn}>✕</button>
        </div>
      )}

      {/* Termination modal */}
      {terminated && (
        <div style={w.overlay}>
          <div style={w.modal}>
            <div style={w.modalIcon}>🚫</div>
            <h2 style={w.modalTitle}>Exam Session Terminated</h2>
            <p style={w.modalSub}>
              You have received {MAX_WARNINGS} integrity warnings. Your exam session has been automatically ended.
            </p>
            <div style={w.modalStats}>
              <div style={w.modalStat}>
                <span style={{ ...w.modalStatNum, color: '#ef4444' }}>{MAX_WARNINGS}</span>
                <span style={w.modalStatLbl}>Warnings</span>
              </div>
              <div style={w.modalStat}>
                <span style={{ ...w.modalStatNum, color: '#f59e0b' }}>{quizScore}</span>
                <span style={w.modalStatLbl}>Questions answered</span>
              </div>
              <div style={w.modalStat}>
                <span style={{ ...w.modalStatNum, color: '#6b7280' }}>0%</span>
                <span style={w.modalStatLbl}>Integrity score</span>
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text)', textAlign: 'center' as const, marginBottom: '1.5rem', lineHeight: 1.5 }}>
              An integrity report has been generated for this session. Your answers up to this point have been recorded.
            </p>
            <button onClick={onTerminationAcknowledge} style={w.reportBtn}>
              View Integrity Report →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const w: Record<string, React.CSSProperties> = {
  badge: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.35rem 0.75rem',
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '99px',
  },
  dot: {
    width: '8px', height: '8px', borderRadius: '50%',
    flexShrink: 0, transition: 'all 0.3s',
  },
  label: {
    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.03em',
    whiteSpace: 'nowrap' as const,
  },
  toast: {
    position: 'fixed' as const, top: '72px', right: '1rem',
    zIndex: 200, maxWidth: '340px',
    display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
    padding: '0.85rem 1rem',
    background: 'rgba(10,16,32,0.95)', backdropFilter: 'blur(20px)',
    border: '1px solid rgba(239,68,68,0.35)', borderRadius: '14px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  toastTitle: { margin: '0 0 0.2rem', fontSize: '0.78rem', fontWeight: 800, color: '#ef4444' },
  toastMsg:   { margin: 0, fontSize: '0.77rem', color: 'var(--text-h)', lineHeight: 1.45 },
  dismissBtn: {
    background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer',
    fontSize: '0.85rem', padding: '0 0.2rem', flexShrink: 0,
  },
  overlay: {
    position: 'fixed' as const, inset: 0,
    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 500, padding: '1.5rem',
  },
  modal: {
    background: 'var(--bg-surface)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '24px', padding: '2.5rem',
    maxWidth: '440px', width: '100%',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0',
    boxShadow: '0 0 60px rgba(239,68,68,0.15)',
  },
  modalIcon: { fontSize: '3rem', marginBottom: '1rem' },
  modalTitle: { margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 900, color: '#ef4444', textAlign: 'center' as const },
  modalSub: { margin: '0 0 1.5rem', fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.6, textAlign: 'center' as const },
  modalStats: { display: 'flex', gap: '1.5rem', marginBottom: '1.25rem' },
  modalStat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' },
  modalStatNum: { fontSize: '1.8rem', fontWeight: 900 },
  modalStatLbl: { fontSize: '0.65rem', color: 'var(--text)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', textAlign: 'center' as const },
  reportBtn: {
    width: '100%', padding: '0.85rem',
    background: 'linear-gradient(135deg,#ef4444,#dc2626)',
    border: 'none', borderRadius: '12px',
    color: '#fff', fontSize: '0.95rem', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  },
};

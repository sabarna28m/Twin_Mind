import type { IntegrityWarning } from '../../services/integrityEngine';
import { MAX_WARNINGS } from '../../services/integrityEngine';

interface Props {
  quizScore: number;
  totalQuestions: number;
  integrityScore: number;
  warnings: IntegrityWarning[];
  subject: string;
  difficulty: string;
  duration: number;
  timeTaken: number;
  terminated: boolean;
  onNewQuiz: () => void;
  onBack: () => void;
}

const WARNING_ICONS: Record<string, string> = {
  tab_switch:       '🔀',
  face_absent:      '👁',
  distracted:       '😵',
  suspicious_audio: '🔊',
  multiple_faces:   '👥',
};

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function fmtTs(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function FocusReport({
  quizScore, totalQuestions, integrityScore, warnings,
  subject, difficulty, duration, timeTaken,
  terminated, onNewQuiz, onBack,
}: Props) {
  const quizPct     = totalQuestions > 0 ? Math.round((quizScore / totalQuestions) * 100) : 0;
  const combinedPct = Math.round((quizPct * 0.6) + (integrityScore * 0.4));

  function getGrade(pct: number): { letter: string; label: string; color: string } {
    if (pct >= 90) return { letter: 'A', label: 'Excellent', color: '#10b981' };
    if (pct >= 75) return { letter: 'B', label: 'Good',      color: '#22c55e' };
    if (pct >= 60) return { letter: 'C', label: 'Average',   color: '#f59e0b' };
    if (pct >= 40) return { letter: 'D', label: 'Poor',      color: '#f97316' };
    return             { letter: 'F', label: 'Failed',    color: '#ef4444' };
  }

  const grade = getGrade(combinedPct);

  const warningTypes = warnings.reduce<Record<string, number>>((acc, w) => {
    acc[w.type] = (acc[w.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={r.shell}>
      <header style={r.nav}>
        <button onClick={onBack} style={r.backBtn}>← Back to Mode Select</button>
        <span style={r.navTitle}>Integrity Report</span>
        <button onClick={onNewQuiz} style={r.retakeBtn}>New Focus Quiz</button>
      </header>

      <main style={r.main}>

        {/* ── Grade card ── */}
        <div style={{ ...r.card, textAlign: 'center' as const, borderColor: `${grade.color}33` }}>
          <div style={{ ...r.gradeBig, color: grade.color }}>{grade.letter}</div>
          <p style={{ ...r.gradeLabel, color: grade.color }}>{grade.label}</p>
          <p style={r.gradeSub}>{subject} · {difficulty} · {duration} min</p>

          {terminated && (
            <div style={r.terminatedBanner}>
              ⚠️ Session terminated after {MAX_WARNINGS} integrity warnings
            </div>
          )}

          <div style={r.statsRow}>
            <div style={r.statItem}>
              <span style={{ ...r.statNum, color: '#6366f1' }}>{quizPct}%</span>
              <span style={r.statLbl}>Quiz Score</span>
            </div>
            <div style={r.statItem}>
              <span style={{ ...r.statNum, color: integrityScore >= 70 ? '#10b981' : integrityScore >= 40 ? '#f59e0b' : '#ef4444' }}>{integrityScore}%</span>
              <span style={r.statLbl}>Integrity</span>
            </div>
            <div style={r.statItem}>
              <span style={{ ...r.statNum, color: grade.color }}>{combinedPct}%</span>
              <span style={r.statLbl}>Combined</span>
            </div>
            <div style={r.statItem}>
              <span style={{ ...r.statNum, color: '#818cf8' }}>{formatTime(timeTaken)}</span>
              <span style={r.statLbl}>Time taken</span>
            </div>
          </div>

          {/* Integrity bar */}
          <div style={r.integritySection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-h)' }}>Integrity Score</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: integrityScore >= 70 ? '#10b981' : '#ef4444' }}>{integrityScore}%</span>
            </div>
            <div style={r.integrityTrack}>
              <div style={{ ...r.integrityFill, width: `${integrityScore}%`, background: integrityScore >= 70 ? 'linear-gradient(90deg,#10b981,#34d399)' : integrityScore >= 40 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#ef4444,#dc2626)' }} />
            </div>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: 'var(--text)' }}>
              {warnings.length === 0
                ? '✅ No integrity violations — clean session.'
                : `${warnings.length} of ${MAX_WARNINGS} warnings triggered.`}
            </p>
          </div>
        </div>

        {/* ── Warning breakdown ── */}
        {warnings.length > 0 && (
          <div style={r.card}>
            <h2 style={r.sectionTitle}>⚠️ Warning Breakdown</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
              {Object.entries(warningTypes).map(([type, count]) => (
                <div key={type} style={r.warnRow}>
                  <span style={{ fontSize: '1rem' }}>{WARNING_ICONS[type] ?? '⚠️'}</span>
                  <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-h)', fontWeight: 600 }}>
                    {type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <span style={r.warnCount}>{count}×</span>
                </div>
              ))}
            </div>

            <h3 style={{ ...r.sectionTitle, fontSize: '0.8rem', marginBottom: '0.6rem' }}>Warning Timeline</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {warnings.map((w, i) => (
                <div key={w.id} style={r.warnItem}>
                  <span style={r.warnNum}>{i + 1}</span>
                  <span style={{ fontSize: '0.85rem' }}>{WARNING_ICONS[w.type] ?? '⚠️'}</span>
                  <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-h)' }}>{w.message}</span>
                  <span style={r.warnTime}>{fmtTs(w.ts)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI insight ── */}
        <div style={r.insightCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🧠</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#00D4FF' }}>AI Focus Insight</span>
          </div>
          <p style={r.insightText}>
            {terminated
              ? `Your session was terminated due to repeated integrity violations. Work on maintaining consistent focus and avoiding distractions during high-stakes assessments.`
              : warnings.length === 0
                ? `Excellent session integrity! You maintained full focus throughout with no violations detected. Your commitment to exam conditions is exemplary.`
                : integrityScore >= 70
                  ? `Good integrity overall with minor lapses. ${warnings.length} warning${warnings.length > 1 ? 's were' : ' was'} triggered. Try to minimize tab switching and maintain consistent camera presence.`
                  : `Multiple integrity issues detected this session. Practice focused study with camera monitoring to improve exam habits before your next assessment.`}
          </p>
        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onNewQuiz} style={r.primaryBtn}>Try Again →</button>
          <button onClick={onBack} style={r.secondaryBtn}>Change Mode</button>
        </div>

      </main>
    </div>
  );
}

const r: Record<string, React.CSSProperties> = {
  shell:    { minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  nav:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', height: '56px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 50 },
  navTitle: { fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-h)' },
  backBtn:  { padding: '0.35rem 0.8rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-h)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  retakeBtn:{ padding: '0.42rem 0.9rem', borderRadius: '8px', background: 'linear-gradient(135deg,#00D4FF,#7C3AED)', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' },
  main:     { flex: 1, padding: '2rem 1.5rem 3rem', maxWidth: '700px', width: '100%', margin: '0 auto', boxSizing: 'border-box' as const, display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  card:     { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.04)', padding: '1.75rem' },
  gradeBig: { fontSize: '5rem', fontWeight: 900, lineHeight: 1, marginBottom: '0.2rem' },
  gradeLabel:{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 0.3rem' },
  gradeSub: { fontSize: '0.82rem', color: 'var(--text)', margin: '0 0 1.25rem' },
  terminatedBanner: {
    padding: '0.6rem 1rem', marginBottom: '1.25rem',
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '10px', fontSize: '0.8rem', color: '#fca5a5', fontWeight: 600,
  },
  statsRow: { display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1.5rem' },
  statItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' },
  statNum:  { fontSize: '1.6rem', fontWeight: 900, lineHeight: 1 },
  statLbl:  { fontSize: '0.68rem', color: 'var(--text)', fontWeight: 500 },
  integritySection: { textAlign: 'left' as const, padding: '1rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px' },
  integrityTrack: { height: '8px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' },
  integrityFill:  { height: '100%', borderRadius: '99px', transition: 'width 0.8s ease' },
  sectionTitle: { margin: '0 0 0.9rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-h)' },
  warnRow: { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.75rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px' },
  warnCount:{ padding: '0.15rem 0.5rem', borderRadius: '99px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '0.72rem', fontWeight: 800 },
  warnItem: { display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem 0.75rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px' },
  warnNum:  { width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '0.68rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  warnTime: { fontSize: '0.68rem', color: 'var(--text)', fontFamily: 'ui-monospace,monospace', flexShrink: 0 },
  insightCard: { background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)', padding: '1.25rem 1.5rem' },
  insightText:{ margin: 0, fontSize: '0.86rem', color: 'var(--text-h)', lineHeight: 1.65 },
  primaryBtn: { flex: 1, padding: '0.85rem', borderRadius: '12px', background: 'linear-gradient(135deg,#00D4FF,#7C3AED)', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' },
  secondaryBtn:{ flex: 1, padding: '0.85rem', borderRadius: '12px', background: 'var(--bg-surface)', color: 'var(--text-h)', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' },
};

import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface LearningEntry {
  id: number;
  date: string;
  study_hours: number;
  attendance_percentage: number;
  assignment_completion_rate: number;
  quiz_scores: number | null;
  exam_scores: number | null;
  sleep_duration: number;
  stress_level: number;
  notes: string;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function stressColor(level: number) {
  if (level <= 3) return '#16a34a';
  if (level <= 6) return '#d97706';
  return '#dc2626';
}

function stressLabel(level: number) {
  if (level <= 3) return 'Low';
  if (level <= 6) return 'Moderate';
  return 'High';
}

export default function CheckIn() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [entries, setEntries] = useState<LearningEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [date, setDate] = useState(today());
  const [studyHours, setStudyHours] = useState('');
  const [attendance, setAttendance] = useState('');
  const [completion, setCompletion] = useState('');
  const [quizScore, setQuizScore] = useState('');
  const [examScore, setExamScore] = useState('');
  const [sleep, setSleep] = useState('');
  const [stress, setStress] = useState(0);
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Entry that exists for the selected date
  const existingEntry = entries.find(e => e.date === date) ?? null;
  const isEditing = !!existingEntry;

  useEffect(() => {
    api.get<LearningEntry[]>('/learning-data', { headers })
      .then(r => setEntries(r.data))
      .finally(() => setLoading(false));
  }, []);

  // Pre-fill form when date changes and an entry exists
  useEffect(() => {
    if (existingEntry) {
      setStudyHours(String(existingEntry.study_hours));
      setAttendance(String(existingEntry.attendance_percentage));
      setCompletion(String(existingEntry.assignment_completion_rate));
      setQuizScore(existingEntry.quiz_scores != null ? String(existingEntry.quiz_scores) : '');
      setExamScore(existingEntry.exam_scores != null ? String(existingEntry.exam_scores) : '');
      setSleep(String(existingEntry.sleep_duration));
      setStress(existingEntry.stress_level);
      setNotes(existingEntry.notes);
    } else {
      setStudyHours(''); setAttendance(''); setCompletion('');
      setQuizScore(''); setExamScore(''); setSleep('');
      setStress(0); setNotes('');
    }
    setMsg(null);
  }, [date, entries]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stress) { setMsg({ ok: false, text: 'Please select a stress level.' }); return; }
    setSaving(true); setMsg(null);
    const payload = {
      date,
      study_hours: parseFloat(studyHours),
      attendance_percentage: parseFloat(attendance),
      assignment_completion_rate: parseFloat(completion),
      quiz_scores: quizScore !== '' ? parseFloat(quizScore) : null,
      exam_scores: examScore !== '' ? parseFloat(examScore) : null,
      sleep_duration: parseFloat(sleep),
      stress_level: stress,
      notes,
    };
    try {
      let saved: LearningEntry;
      if (isEditing) {
        const { data } = await api.put<LearningEntry>(`/learning-data/${existingEntry.id}`, payload, { headers });
        saved = data;
        setEntries(prev => prev.map(e => e.id === saved.id ? saved : e));
      } else {
        const { data } = await api.post<LearningEntry>('/learning-data', payload, { headers });
        saved = data;
        setEntries(prev => [saved, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
      }
      setMsg({ ok: true, text: isEditing ? 'Entry updated.' : 'Entry logged!' });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMsg({ ok: false, text: detail ?? 'Failed to save.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await api.delete(`/learning-data/${id}`, { headers });
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  // Sparkline data (study hours, last 14 entries reversed to chronological)
  const sparkData = [...entries].reverse().slice(-14);
  const maxStudy = Math.max(...sparkData.map(e => e.study_hours), 1);

  return (
    <div style={s.shell}>
      <header style={s.nav}>
        <Link to="/" style={s.navLogo}>TwinMind</Link>
        <Link to="/" style={s.backLink}>← Dashboard</Link>
      </header>

      <main style={s.main}>
        <h1 style={s.pageTitle}>Daily Check-in</h1>

        {/* ── Form ─────────────────────────────────────────────────── */}
        <section style={s.formCard}>
          <div style={s.formHeader}>
            <h2 style={s.formTitle}>
              {isEditing ? `Editing entry for ${date}` : "Log today's learning"}
            </h2>
            {isEditing && (
              <span style={s.editBadge}>Editing existing entry</span>
            )}
          </div>

          {msg && <p style={msg.ok ? s.msgOk : s.msgErr}>{msg.text}</p>}

          <form onSubmit={handleSubmit} style={s.form}>
            {/* Date */}
            <div style={s.row}>
              <label style={s.label}>
                Date
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={s.input} max={today()} required />
              </label>
            </div>

            {/* Row 1: Study hours + Sleep */}
            <div style={s.row2}>
              <label style={s.label}>
                Study Hours
                <input type="number" value={studyHours} onChange={e => setStudyHours(e.target.value)}
                  style={s.input} min={0} max={24} step={0.5} placeholder="e.g. 3.5" required />
              </label>
              <label style={s.label}>
                Sleep Duration (hrs)
                <input type="number" value={sleep} onChange={e => setSleep(e.target.value)}
                  style={s.input} min={0} max={24} step={0.5} placeholder="e.g. 7" required />
              </label>
            </div>

            {/* Row 2: Attendance + Assignment completion */}
            <div style={s.row2}>
              <label style={s.label}>
                Attendance (%)
                <input type="number" value={attendance} onChange={e => setAttendance(e.target.value)}
                  style={s.input} min={0} max={100} step={1} placeholder="e.g. 85" required />
              </label>
              <label style={s.label}>
                Assignment Completion (%)
                <input type="number" value={completion} onChange={e => setCompletion(e.target.value)}
                  style={s.input} min={0} max={100} step={1} placeholder="e.g. 90" required />
              </label>
            </div>

            {/* Row 3: Quiz + Exam (optional) */}
            <div style={s.row2}>
              <label style={s.label}>
                Quiz Score (%) <span style={s.optional}>optional</span>
                <input type="number" value={quizScore} onChange={e => setQuizScore(e.target.value)}
                  style={s.input} min={0} max={100} step={0.5} placeholder="—" />
              </label>
              <label style={s.label}>
                Exam Score (%) <span style={s.optional}>optional</span>
                <input type="number" value={examScore} onChange={e => setExamScore(e.target.value)}
                  style={s.input} min={0} max={100} step={0.5} placeholder="—" />
              </label>
            </div>

            {/* Stress level */}
            <div>
              <p style={s.stressLabel}>
                Stress Level
                {stress > 0 && (
                  <span style={{ ...s.stressBadge, color: stressColor(stress) }}>
                    {stress}/10 — {stressLabel(stress)}
                  </span>
                )}
              </p>
              <div style={s.stressRow}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <button
                    key={n} type="button"
                    onClick={() => setStress(n)}
                    style={{
                      ...s.stressBtn,
                      background: stress === n ? stressColor(n) : 'var(--bg)',
                      color: stress === n ? '#fff' : 'var(--text-h)',
                      borderColor: stress === n ? stressColor(n) : 'var(--border)',
                      fontWeight: stress === n ? 700 : 400,
                    }}
                  >{n}</button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <label style={s.label}>
              Notes <span style={s.optional}>optional</span>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                style={s.textarea} rows={2}
                placeholder="Anything notable about today's session…" />
            </label>

            <button type="submit" disabled={saving} style={s.submitBtn}>
              {saving ? 'Saving…' : isEditing ? 'Update entry' : 'Log entry'}
            </button>
          </form>
        </section>

        {/* ── Trend sparkline ──────────────────────────────────────── */}
        {sparkData.length > 1 && (
          <section style={s.panel}>
            <h2 style={s.panelTitle}>Study hours — last {sparkData.length} entries</h2>
            <div style={s.spark}>
              {sparkData.map((e, i) => (
                <div key={i} style={s.sparkCol}>
                  <div style={s.sparkBarWrap}>
                    <div style={{
                      ...s.sparkBar,
                      height: `${Math.round((e.study_hours / maxStudy) * 100)}%`,
                    }} title={`${e.date}: ${e.study_hours}h`} />
                  </div>
                  <span style={s.sparkLabel}>{e.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── History table ─────────────────────────────────────────── */}
        <section style={s.panel}>
          <h2 style={s.panelTitle}>History</h2>
          {loading ? (
            <p style={s.empty}>Loading…</p>
          ) : entries.length === 0 ? (
            <p style={s.empty}>No entries yet. Log your first check-in above.</p>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['Date','Study h','Sleep h','Attendance','Completion','Quiz','Exam','Stress',''].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id} style={s.tr}>
                      <td style={s.td}>
                        <button onClick={() => setDate(e.date)} style={s.dateBtn}>{e.date}</button>
                      </td>
                      <td style={s.td}>{e.study_hours}h</td>
                      <td style={s.td}>{e.sleep_duration}h</td>
                      <td style={s.td}>{e.attendance_percentage}%</td>
                      <td style={s.td}>{e.assignment_completion_rate}%</td>
                      <td style={s.td}>{e.quiz_scores != null ? `${e.quiz_scores}%` : '—'}</td>
                      <td style={s.td}>{e.exam_scores != null ? `${e.exam_scores}%` : '—'}</td>
                      <td style={s.td}>
                        <span style={{ ...s.stressTag, color: stressColor(e.stress_level), borderColor: stressColor(e.stress_level) }}>
                          {e.stress_level}
                        </span>
                      </td>
                      <td style={s.td}>
                        <button onClick={() => handleDelete(e.id)} style={s.deleteBtn} title="Delete">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 2rem', height: '60px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10,
  },
  navLogo: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px', textDecoration: 'none' },
  backLink: { fontSize: '0.875rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 },
  main: {
    flex: 1, padding: '2rem', maxWidth: '860px', width: '100%',
    margin: '0 auto', boxSizing: 'border-box', textAlign: 'left',
  },
  pageTitle: { margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-h)' },

  // Form card
  formCard: {
    border: '1px solid var(--border)', borderRadius: '12px',
    padding: '1.5rem', marginBottom: '1.5rem', background: 'var(--bg)',
  },
  formHeader: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' as const },
  formTitle: { margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-h)' },
  editBadge: {
    fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem',
    background: 'var(--accent-bg)', color: 'var(--accent)',
    border: '1px solid var(--accent-border)', borderRadius: '99px',
  },

  // Form
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  row: { display: 'flex', gap: '1rem' },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)' },
  optional: { fontWeight: 400, color: 'var(--text)', fontSize: '0.75rem' },
  input: {
    padding: '0.55rem 0.75rem', border: '1px solid var(--border)', borderRadius: '8px',
    fontSize: '0.95rem', color: 'var(--text-h)', background: 'var(--bg)', outline: 'none',
  },
  textarea: {
    padding: '0.55rem 0.75rem', border: '1px solid var(--border)', borderRadius: '8px',
    fontSize: '0.875rem', color: 'var(--text-h)', background: 'var(--bg)',
    outline: 'none', resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: '1.5',
  },

  // Stress selector
  stressLabel: { margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.75rem' },
  stressBadge: { fontSize: '0.8rem', fontWeight: 600 },
  stressRow: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' as const },
  stressBtn: {
    width: '36px', height: '36px', borderRadius: '8px', border: '1px solid var(--border)',
    cursor: 'pointer', fontSize: '0.875rem', transition: 'all 0.1s', fontFamily: 'inherit',
  },

  // Feedback
  msgOk: {
    margin: '0 0 0.75rem', padding: '0.5rem 0.75rem',
    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.4)',
    borderRadius: '8px', color: '#16a34a', fontSize: '0.875rem',
  },
  msgErr: {
    margin: '0 0 0.75rem', padding: '0.5rem 0.75rem',
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)',
    borderRadius: '8px', color: '#dc2626', fontSize: '0.875rem',
  },
  submitBtn: {
    alignSelf: 'flex-start', padding: '0.6rem 1.5rem',
    background: 'var(--accent)', color: '#fff', border: 'none',
    borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
  },

  // Sparkline
  panel: { border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', background: 'var(--bg)' },
  panelTitle: { margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-h)' },
  spark: { display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px', paddingTop: '8px' },
  sparkCol: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' },
  sparkBarWrap: { flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' },
  sparkBar: { width: '100%', borderRadius: '3px 3px 0 0', background: 'var(--accent)', minHeight: '3px', opacity: 0.85 },
  sparkLabel: { fontSize: '0.55rem', color: 'var(--text)', marginTop: '3px', transform: 'rotate(-45deg)', transformOrigin: 'top center', display: 'block', paddingTop: '3px' },

  // History table
  empty: { color: 'var(--text)', fontSize: '0.875rem', margin: 0 },
  tableWrap: { overflowX: 'auto' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.85rem' },
  th: { padding: '0.5rem 0.75rem', textAlign: 'left' as const, fontWeight: 600, color: 'var(--text)', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' as const },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '0.6rem 0.75rem', color: 'var(--text-h)', whiteSpace: 'nowrap' as const },
  dateBtn: { background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', padding: 0, fontFamily: 'inherit' },
  stressTag: { display: 'inline-block', padding: '0.15rem 0.45rem', borderRadius: '5px', border: '1px solid', fontSize: '0.78rem', fontWeight: 700 },
  deleteBtn: { background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem 0.4rem', borderRadius: '4px' },
};

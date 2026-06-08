import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/BackButton';
import api from '../services/api';

// ── Types ──────────────────────────────────────────────────────────────

interface Topic      { name: string; score: number; risk: string }
interface ScorePoint { date: string; score: number; source: string }
interface SubjectSummary {
  subject: string; avg_score: number; latest_score: number;
  previous_score: number | null; improvement: number | null;
  study_hours: number; confidence: number;
  last_activity: string | null; days_since_activity: number | null;
  trend: string; risk_level: string;
  topics: Topic[]; score_history: ScorePoint[];
  recommended_daily_minutes: number;
}
interface PriorityItem { rank: number; subject: string; avg_score: number; risk_level: string; priority_label: string }
interface ActionPlanDay { day: number; title: string; task: string }
interface Analysis {
  subjects: SubjectSummary[];
  weakest: SubjectSummary | null; strongest: SubjectSummary | null;
  most_improved: SubjectSummary | null; neglected: SubjectSummary | null;
  focus_today: SubjectSummary | null;
  recommendations: Record<string, string[]>;
  action_plans: Record<string, ActionPlanDay[]>;
  notifications: string[];
  priority_ranking: PriorityItem[];
}
interface FormState {
  subject: string; date: string; score: number; study_hours: number;
  confidence: number; source: string; notes: string;
}

/** Shape of a saved record returned by GET/POST/PUT /subject-performance/records */
interface SubjectRecord {
  id: number;
  subject: string;
  date: string;
  score: number;
  study_hours: number;
  confidence: number;
  source: string;
  topics: Topic[];
  notes: string;
  created_at: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────

// Icons for well-known subjects — custom subjects fall back to 📚
const SUBJECT_ICONS: Record<string,string> = {
  'Mathematics':'∑','Physics':'⚛','Chemistry':'⚗',
  'Biology':'🧬','English':'📖','Computer Science':'💻',
  'Machine Learning':'🤖','Computer Networks':'🌐','DBMS':'🗄',
  'Operating Systems':'⚙','Data Structures':'🌲','Algorithms':'🔍',
  'Software Engineering':'🛠','Chemistry Lab':'🧪','Economics':'📈',
};

// ── Helpers ────────────────────────────────────────────────────────────

function scoreColor(s: number) { return s >= 75 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444' }
function scoreBg(s: number)    { return s >= 75 ? 'rgba(16,185,129,0.12)' : s >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)' }
function scoreBorder(s: number){ return s >= 75 ? 'rgba(16,185,129,0.3)'  : s >= 50 ? 'rgba(245,158,11,0.3)'  : 'rgba(239,68,68,0.3)' }
function riskLabel(s: number)  { return s >= 75 ? 'Strong' : s >= 50 ? 'Average' : 'Weak' }
function riskEmoji(s: number)  { return s >= 75 ? '🟢' : s >= 50 ? '🟡' : '🔴' }
function trendIcon(t: string)  { return t === 'improving' ? '↑' : t === 'declining' ? '↓' : '→' }
function trendColor(t: string) { return t === 'improving' ? '#10b981' : t === 'declining' ? '#ef4444' : '#94a3b8' }
function confLabel(c: number)  { return ['','Very Low','Low','Medium','High','Very High'][Math.round(c)] ?? 'Medium' }
function today()               { return new Date().toISOString().slice(0,10) }
function fmtDate(d: string)    { return new Date(d+'T00:00').toLocaleDateString('en',{month:'short',day:'numeric'}) }

const priorityColor = (label: string) => ({
  'Critical Attention Required': '#ef4444',
  'Needs Improvement': '#f59e0b',
  'Good': '#06b6d4',
  'Strong': '#10b981',
  'No Data': '#6366f1',
}[label] ?? '#6366f1');

// ── Sub-components ─────────────────────────────────────────────────────

function HeatmapCell({ s, onClick }: { s: SubjectSummary; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const hasData = s.score_history.length > 0;
  const c = hasData ? scoreColor(s.avg_score) : '#6366f1';
  const bg = hasData ? scoreBg(s.avg_score) : 'rgba(99,102,241,0.08)';
  const bdr = hasData ? scoreBorder(s.avg_score) : 'rgba(99,102,241,0.2)';
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...hm.cell,
        background: hov ? (hasData ? scoreBg(s.avg_score) : 'rgba(99,102,241,0.14)') : bg,
        border: `1px solid ${hov ? c : bdr}`,
        transform: hov ? 'translateY(-3px) scale(1.03)' : 'none',
        boxShadow: hov ? `0 8px 28px ${c}30` : '0 2px 8px rgba(0,0,0,0.15)',
        cursor: 'pointer',
      }}
    >
      <div style={{ ...hm.cellIcon, color: c }}>{SUBJECT_ICONS[s.subject] ?? '📚'}</div>
      <p style={hm.cellName}>{s.subject}</p>
      {hasData ? (
        <>
          <p style={{ ...hm.cellScore, color: c }}>{s.avg_score.toFixed(0)}%</p>
          <div style={{ ...hm.cellBadge, background: `${c}22`, color: c, border: `1px solid ${c}44` }}>
            {riskEmoji(s.avg_score)} {riskLabel(s.avg_score)}
          </div>
          <p style={{ ...hm.cellTrend, color: trendColor(s.trend) }}>
            {trendIcon(s.trend)} {s.trend}
          </p>
        </>
      ) : (
        <p style={{ ...hm.cellScore, color: '#6366f1', fontSize: '0.85rem' }}>No data</p>
      )}
    </div>
  );
}

function DetectionCard({ icon, label, subject, score, detail, color }: {
  icon: string; label: string; subject?: string; score?: number; detail: string; color: string;
}) {
  return (
    <div style={{ ...dc.card, borderColor: `${color}30`, background: `${color}08` }}>
      <div style={{ ...dc.iconBox, background: `${color}22`, color }}>{icon}</div>
      <p style={{ ...dc.label, color: `${color}cc` }}>{label}</p>
      {subject && <p style={{ ...dc.subject, color }}>{subject}</p>}
      {score !== undefined && <p style={{ ...dc.score, color }}>{score.toFixed(0)}%</p>}
      <p style={dc.detail}>{detail}</p>
    </div>
  );
}

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: ScorePoint & { dateLabel: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const { score, source } = payload[0].payload;
  const c = scoreColor(score);
  return (
    <div style={{ background: 'rgba(15,23,42,0.96)', border: `1px solid ${c}40`, borderRadius: '10px', padding: '0.65rem 0.9rem' }}>
      <p style={{ margin: '0 0 0.2rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)' }}>{label}</p>
      <p style={{ margin: '0 0 0.15rem', fontSize: '1rem', fontWeight: 800, color: c }}>{score.toFixed(1)}%</p>
      <p style={{ margin: 0, fontSize: '0.7rem', color: c }}>{riskEmoji(score)} {riskLabel(score)}</p>
      <p style={{ margin: '0.1rem 0 0', fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', textTransform: 'capitalize' }}>{source}</p>
    </div>
  );
}

function SubjectModal({ s, recs, plan, onClose }: {
  s: SubjectSummary; recs: string[]; plan: ActionPlanDay[]; onClose: () => void;
}) {
  const c = scoreColor(s.avg_score);
  const trendData = s.score_history.slice(-10).map(p => ({ ...p, dateLabel: fmtDate(p.date) }));
  return (
    <div style={md.overlay} onClick={onClose}>
      <div style={md.panel} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ ...md.header, borderBottomColor: `${c}30`, background: `linear-gradient(135deg, ${c}12, transparent)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.75rem' }}>{SUBJECT_ICONS[s.subject] ?? '📚'}</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-h)' }}>{s.subject}</h2>
              <span style={{ ...md.badge, background: `${c}22`, color: c, border: `1px solid ${c}44` }}>
                {riskEmoji(s.avg_score)} {riskLabel(s.avg_score)}
              </span>
            </div>
          </div>
          <button style={md.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={md.body}>
          {/* Stats grid */}
          <div style={md.statsGrid}>
            {[
              { label: 'Current Score',  value: `${s.latest_score.toFixed(0)}%`,  color: c },
              { label: 'Previous Score', value: s.previous_score != null ? `${s.previous_score.toFixed(0)}%` : '—', color: 'var(--text-h)' },
              { label: 'Improvement',    value: s.improvement != null ? `${s.improvement > 0 ? '+' : ''}${s.improvement.toFixed(0)}%` : '—', color: s.improvement != null ? (s.improvement >= 0 ? '#10b981' : '#ef4444') : 'var(--text)' },
              { label: 'Study Hours',    value: `${s.study_hours.toFixed(1)}h`, color: '#06b6d4' },
              { label: 'Confidence',     value: confLabel(s.confidence), color: '#8b5cf6' },
              { label: 'Daily Rec.',     value: `${s.recommended_daily_minutes} min`, color: '#f59e0b' },
            ].map(stat => (
              <div key={stat.label} style={md.statBox}>
                <p style={md.statLabel}>{stat.label}</p>
                <p style={{ ...md.statValue, color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Mini trend */}
          {trendData.length > 1 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <p style={md.sectionTitle}>Score History</p>
              <ResponsiveContainer width="100%" height={110}>
                <LineChart data={trendData} margin={{ top: 5, right: 10, bottom: 0, left: -25 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                  <XAxis dataKey="dateLabel" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0,100]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <Line type="monotone" dataKey="score" stroke={c} strokeWidth={2}
                    dot={{ fill: c, r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Topics */}
          {s.topics.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <p style={md.sectionTitle}>Topic Breakdown</p>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.45rem' }}>
                {s.topics.map(t => (
                  <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={{ fontSize: '0.72rem', width: '130px', flexShrink: 0, color: 'var(--text-h)', fontWeight: 500 }}>{t.name}</span>
                    <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${t.score}%`, background: scoreColor(t.score), borderRadius: '99px', transition: 'width 0.7s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: scoreColor(t.score), width: '38px', textAlign: 'right' as const }}>
                      {t.score > 0 ? `${t.score.toFixed(0)}%` : '—'}
                    </span>
                    <span style={{ fontSize: '0.75rem' }}>{riskEmoji(t.score)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recs.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <p style={md.sectionTitle}>AI Recommendations</p>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.45rem' }}>
                {recs.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', padding: '0.55rem 0.75rem', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: '9px' }}>
                    <span style={{ color: '#818cf8', flexShrink: 0, fontSize: '0.8rem' }}>→</span>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.55 }}>{r}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Plan */}
          {plan.length > 0 && (
            <div>
              <p style={md.sectionTitle}>7-Day Recovery Plan</p>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
                {plan.map(d => (
                  <div key={d.day} style={{ display: 'flex', gap: '0.75rem', padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '9px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `${c}22`, border: `1px solid ${c}44`, color: c, fontWeight: 800, fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>D{d.day}</div>
                    <div>
                      <p style={{ margin: '0 0 0.12rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-h)' }}>{d.title}</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text)' }}>{d.task}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Record Modal (Add + Edit) ──────────────────────────────────────────

function RecordModal({
  onClose,
  onSaved,
  profileSubjects,
  editRecord,       // pre-filled when editing an existing record
}: {
  onClose: () => void;
  onSaved: (saved: SubjectRecord) => void;
  profileSubjects: string[];
  editRecord?: SubjectRecord;
}) {
  const isEdit = Boolean(editRecord);

  const makeDefault = (): FormState => ({
    subject:     editRecord?.subject     ?? profileSubjects[0] ?? '',
    date:        editRecord?.date        ?? today(),
    score:       editRecord?.score       ?? 70,
    study_hours: editRecord?.study_hours ?? 1.5,
    confidence:  editRecord?.confidence  ?? 3,
    source:      editRecord?.source      ?? 'manual',
    notes:       editRecord?.notes       ?? '',
  });

  const [form, setForm]     = useState<FormState>(makeDefault);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');
  const [saved, setSaved]   = useState(false);   // success flash state

  // Dynamic topics — pre-fill from existing record when editing
  const [customTopics, setCustomTopics] = useState<{ name: string; score: number }[]>(
    () => (editRecord?.topics ?? []).map(t => ({ name: t.name, score: t.score }))
  );
  const [topicInput, setTopicInput] = useState('');

  function addTopic() {
    const name = topicInput.trim();
    if (!name || customTopics.some(t => t.name === name)) return;
    setCustomTopics(prev => [...prev, { name, score: 70 }]);
    setTopicInput('');
  }

  function removeTopic(name: string) {
    setCustomTopics(prev => prev.filter(t => t.name !== name));
  }

  function setTopicScore(name: string, score: number) {
    setCustomTopics(prev => prev.map(t => t.name === name ? { ...t, score } : t));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject) { setErr('Please select a subject.'); return; }
    setSaving(true); setErr('');
    try {
      const payload = {
        subject: form.subject, date: form.date, score: form.score,
        study_hours: form.study_hours, confidence: form.confidence,
        source: form.source, notes: form.notes,
        topics: customTopics.map(t => ({ name: t.name, score: t.score })),
      };

      const res = isEdit
        ? await api.put<SubjectRecord>(`/subject-performance/record/${editRecord!.id}`, payload)
        : await api.post<SubjectRecord>('/subject-performance/record', payload);

      setSaved(true);
      onSaved(res.data);
      // Close after brief success flash
      setTimeout(onClose, 1200);
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to save. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div style={md.overlay} onClick={onClose}>
      <div style={{ ...md.panel, maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div style={{ ...md.header, borderBottomColor: 'rgba(99,102,241,0.25)' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-h)' }}>
            {isEdit ? '✏️ Edit Record' : '+ Add Performance Record'}
          </h2>
          <button style={md.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ ...md.body, paddingBottom: '1.5rem' }}>

          {/* Success flash */}
          {saved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', marginBottom: '1rem', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', color: '#34d399', fontSize: '0.875rem', fontWeight: 600 }}>
              <span style={{ fontSize: '1.1rem' }}>✓</span>
              Record {isEdit ? 'updated' : 'saved'} successfully!
            </div>
          )}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.9rem' }}>

            {/* Subject — pulled from profile */}
            <div style={af.row}>
              <label style={af.label}>Subject</label>
              {profileSubjects.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#f59e0b', padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px' }}>
                  No subjects found.{' '}
                  <Link to="/profile/setup" style={{ color: '#f59e0b', fontWeight: 700 }}>Add subjects in your profile →</Link>
                </p>
              ) : (
                <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} style={af.input} required>
                  {profileSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>

            <div style={af.row2}>
              <div style={{ flex: 1 }}>
                <label style={af.label}>Date</label>
                <input type="date" value={form.date} max={today()} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={af.input} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={af.label}>Source</label>
                <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} style={af.input}>
                  {['manual','quiz','exam','assignment','mock_test'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                </select>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label style={af.label}>Overall Score</label>
                <span style={{ fontWeight: 800, color: scoreColor(form.score), fontSize: '0.9rem' }}>{form.score}%</span>
              </div>
              <input type="range" min={0} max={100} value={form.score} onChange={e => setForm(f => ({ ...f, score: +e.target.value }))} style={{ width: '100%', accentColor: scoreColor(form.score) }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text)', opacity: 0.4, marginTop: '0.2rem' }}>
                <span>0</span><span>50 (avg)</span><span>75 (good)</span><span>100</span>
              </div>
            </div>

            <div style={af.row2}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <label style={af.label}>Study Hours</label>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#06b6d4' }}>{form.study_hours.toFixed(1)}h</span>
                </div>
                <input type="range" min={0} max={12} step={0.5} value={form.study_hours} onChange={e => setForm(f => ({ ...f, study_hours: +e.target.value }))} style={{ width: '100%', accentColor: '#06b6d4' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={af.label}>Confidence</label>
                <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.35rem' }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => setForm(f => ({ ...f, confidence: n }))}
                      style={{ flex: 1, height: '32px', borderRadius: '6px', border: `1px solid ${form.confidence === n ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`, background: form.confidence === n ? 'rgba(139,92,246,0.25)' : 'transparent', color: form.confidence === n ? '#a78bfa' : 'var(--text)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                    >{n}</button>
                  ))}
                </div>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.65rem', color: '#8b5cf6', textAlign: 'center' as const }}>{confLabel(form.confidence)}</p>
              </div>
            </div>

            {/* Dynamic topic scores */}
            <div>
              <label style={{ ...af.label, marginBottom: '0.45rem', display: 'block' }}>
                Topic / Chapter Scores <span style={{ color: 'var(--text)', fontWeight: 400, textTransform: 'none' as const, fontSize: '0.72rem' }}>(optional)</span>
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text" value={topicInput}
                  onChange={e => setTopicInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }}
                  placeholder="e.g. Chapter 3, Matrices, SQL Joins…"
                  style={{ ...af.input, flex: 1, margin: 0 }}
                />
                <button type="button" onClick={addTopic} disabled={!topicInput.trim()}
                  style={{ padding: '0 0.85rem', background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '8px', color: '#818cf8', fontSize: '0.8rem', fontWeight: 700, cursor: topicInput.trim() ? 'pointer' : 'not-allowed', opacity: topicInput.trim() ? 1 : 0.5, whiteSpace: 'nowrap' as const, fontFamily: 'inherit' }}
                >+ Add</button>
              </div>
              {customTopics.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
                  {customTopics.map(t => (
                    <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.35rem 0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-h)', width: '120px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }} title={t.name}>{t.name}</span>
                      <input type="range" min={0} max={100} value={t.score} onChange={e => setTopicScore(t.name, +e.target.value)} style={{ flex: 1, accentColor: scoreColor(t.score) }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: scoreColor(t.score), width: '32px', textAlign: 'right' as const }}>{t.score}</span>
                      <button type="button" onClick={() => removeTopic(t.name)} aria-label={`Remove ${t.name}`}
                        style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.85rem', padding: '0 0.1rem', lineHeight: 1, flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#334155' }}>Type a topic/chapter name and click + Add to score it.</p>
              )}
            </div>

            <div>
              <label style={af.label}>Notes (optional)</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any context about this session…"
                style={{ ...af.input, resize: 'vertical' as const, minHeight: '56px' }} />
            </div>

            {err && <p style={{ margin: 0, padding: '0.55rem 0.8rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#fca5a5', fontSize: '0.8rem' }}>{err}</p>}

            <button type="submit" disabled={saving || saved || profileSubjects.length === 0}
              style={{ padding: '0.75rem', background: saved ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: saved ? '1px solid rgba(16,185,129,0.4)' : 'none', borderRadius: '12px', color: saved ? '#34d399' : '#fff', fontSize: '0.9rem', fontWeight: 800, cursor: (saving || saved || profileSubjects.length === 0) ? 'not-allowed' : 'pointer', opacity: profileSubjects.length === 0 ? 0.5 : 1, fontFamily: 'inherit' }}
            >
              {saved ? '✓ Saved!' : saving ? 'Saving…' : isEdit ? '✓ Update Record' : '+ Save Record'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function SubjectAnalysis() {
  const { user, studentProfile } = useAuth();
  const profileSubjects = studentProfile?.subjects ?? [];
  const [analysis, setAnalysis]         = useState<Analysis | null>(null);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState<SubjectSummary | null>(null);
  const [trendSubject, setTrendSubject] = useState<string>('');
  const [showAdd, setShowAdd]           = useState(false);
  const [editRecord, setEditRecord]     = useState<SubjectRecord | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [records, setRecords]           = useState<SubjectRecord[]>([]);
  const [deletingId, setDeletingId]     = useState<number | null>(null);

  const load = async () => {
    try {
      const res = await api.get('/subject-performance/analysis');
      setAnalysis(res.data);
      setNotifications(res.data.notifications ?? []);
      if (!trendSubject && res.data.subjects?.length) {
        const withData = res.data.subjects.filter((s: SubjectSummary) => s.score_history.length > 0);
        if (withData.length) setTrendSubject(withData[0].subject);
        else setTrendSubject(res.data.subjects[0].subject);
      }
    } finally { setLoading(false); }
  };

  const loadRecords = async () => {
    try {
      const res = await api.get<SubjectRecord[]>('/subject-performance/records');
      setRecords(res.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { if (user) { load(); loadRecords(); } }, [user]);

  async function deleteRecord(id: number) {
    if (!confirm('Delete this record? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await api.delete(`/subject-performance/record/${id}`);
      setRecords(prev => prev.filter(r => r.id !== id));
      // Refresh analysis so heatmap/charts update
      load();
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  }

  const trendData = analysis?.subjects
    .find(s => s.subject === trendSubject)
    ?.score_history
    .map(p => ({ ...p, dateLabel: fmtDate(p.date) })) ?? [];

  const selectedRecs  = selected ? (analysis?.recommendations[selected.subject] ?? []) : [];
  const selectedPlan  = selected ? ((analysis?.action_plans[selected.subject] ?? []) as ActionPlanDay[]) : [];

  const weakSubjects  = analysis?.subjects.filter(s => s.score_history.length && s.risk_level === 'weak')    ?? [];
  const withData      = analysis?.subjects.filter(s => s.score_history.length > 0) ?? [];

  return (
    <div style={p.page}>
      <div style={p.orb1} /><div style={p.orb2} />

      {/* Top bar */}
      <div style={p.topBar}>
        <BackButton />
        <div style={p.topCenter}>
          <span style={{ fontSize: '1.2rem' }}>📊</span>
          <h1 style={p.pageTitle}>Subject Analysis</h1>
        </div>
        <button style={p.addBtn} onClick={() => setShowAdd(true)}>+ Add Record</button>
      </div>

      <div style={p.content}>

        {/* Notifications */}
        {notifications.map((n, i) => (
          <div key={i} style={p.notifBar} className="animate-slide-up">
            <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-h)' }}>{n}</span>
            <button style={p.notifX} onClick={() => setNotifications(ns => ns.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem 1rem' }}>
            <div style={{ width: '40px', height: '40px', margin: '0 auto 1rem', border: '3px solid rgba(99,102,241,0.2)', borderTop: '3px solid #818cf8', borderRadius: '50%' }} className="spin" />
            <p style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Analysing your performance data…</p>
          </div>
        ) : !analysis || withData.length === 0 ? (
          // Empty state
          <div style={p.emptyWrap}>
            <div style={p.emptyCard}>
              <p style={{ fontSize: '3.5rem', margin: '0 0 1rem' }}>📊</p>
              <h2 style={{ margin: '0 0 0.6rem', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-h)' }}>No performance data yet</h2>
              <p style={{ margin: '0 0 1.75rem', fontSize: '0.87rem', color: 'var(--text)', lineHeight: 1.65, maxWidth: '380px' }}>
                Add your first subject record to unlock your personal performance heatmap, AI weakness detection, topic analysis, and recovery plans.
              </p>
              <button style={p.addBigBtn} onClick={() => setShowAdd(true)}>+ Add First Record</button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Focus Subject ── */}
            {analysis.focus_today && (
              <section style={{ ...p.card, background: `linear-gradient(135deg, ${scoreColor(analysis.focus_today.avg_score)}14, rgba(15,23,42,0.8))`, border: `1px solid ${scoreColor(analysis.focus_today.avg_score)}30` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: `${scoreColor(analysis.focus_today.avg_score)}22`, border: `1px solid ${scoreColor(analysis.focus_today.avg_score)}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                      {SUBJECT_ICONS[analysis.focus_today.subject] ?? '📚'}
                    </div>
                    <div>
                      <p style={{ margin: '0 0 0.2rem', fontSize: '0.72rem', fontWeight: 700, color: scoreColor(analysis.focus_today.avg_score), letterSpacing: '0.08em' }}>🎯 FOCUS SUBJECT TODAY</p>
                      <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-h)' }}>{analysis.focus_today.subject}</h2>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.5 }}>
                        {analysis.focus_today.avg_score < 50
                          ? `Lowest performance score (${analysis.focus_today.avg_score.toFixed(0)}%) and needs immediate attention.`
                          : `Needs improvement — current score ${analysis.focus_today.avg_score.toFixed(0)}%, aim for 75%+.`}
                        {analysis.focus_today.days_since_activity && analysis.focus_today.days_since_activity >= 3
                          ? ` No revision in ${analysis.focus_today.days_since_activity} days.` : ''}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ textAlign: 'center' as const }}>
                      <p style={{ margin: 0, fontSize: '2rem', fontWeight: 900, color: scoreColor(analysis.focus_today.avg_score) }}>{analysis.focus_today.avg_score.toFixed(0)}</p>
                      <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text)', opacity: 0.6 }}>% score</p>
                    </div>
                    <button style={{ ...p.detailBtn, borderColor: `${scoreColor(analysis.focus_today.avg_score)}50`, color: scoreColor(analysis.focus_today.avg_score) }} onClick={() => setSelected(analysis.focus_today!)}>
                      View Details →
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem', flexWrap: 'wrap' as const }}>
                  <span style={{ ...p.statChip, color: '#f59e0b' }}>⏱ {analysis.focus_today.recommended_daily_minutes} min/day recommended</span>
                  <span style={{ ...p.statChip, color: trendColor(analysis.focus_today.trend) }}>{trendIcon(analysis.focus_today.trend)} {analysis.focus_today.trend}</span>
                  {analysis.focus_today.days_since_activity != null && (
                    <span style={{ ...p.statChip, color: '#ef4444' }}>📅 {analysis.focus_today.days_since_activity}d ago</span>
                  )}
                </div>
              </section>
            )}

            {/* ── AI Detection cards ── */}
            <div style={p.detectionGrid} className="subj-det-grid">
              <DetectionCard icon="🔴" label="Weakest Subject"   color="#ef4444"
                subject={analysis.weakest?.subject}   score={analysis.weakest?.avg_score}
                detail={analysis.weakest ? `${analysis.weakest.study_hours.toFixed(1)}h studied` : 'No data'} />
              <DetectionCard icon="🟢" label="Strongest Subject" color="#10b981"
                subject={analysis.strongest?.subject} score={analysis.strongest?.avg_score}
                detail={analysis.strongest ? `Trend: ${analysis.strongest.trend}` : 'No data'} />
              <DetectionCard icon="📈" label="Most Improved"     color="#06b6d4"
                subject={analysis.most_improved?.subject}
                detail={analysis.most_improved?.improvement != null ? `+${analysis.most_improved.improvement.toFixed(0)}% since last record` : 'No improvement data yet'} />
              <DetectionCard icon="⏰" label="Neglected Subject" color="#f59e0b"
                subject={analysis.neglected?.subject}
                detail={analysis.neglected?.days_since_activity != null ? `${analysis.neglected.days_since_activity} days without activity` : 'All subjects active'} />
            </div>

            {/* ── Priority Ranking ── */}
            <section style={p.card}>
              <h2 style={p.cardTitle}>📋 Priority Ranking</h2>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.45rem', marginTop: '0.85rem' }}>
                {analysis.priority_ranking.map(item => {
                  const c = priorityColor(item.priority_label);
                  const barW = item.avg_score > 0 ? item.avg_score : 5;
                  return (
                    <div key={item.subject} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px' }}>
                      <span style={{ fontWeight: 900, color: c, width: '22px', textAlign: 'center' as const, fontSize: '0.8rem' }}>#{item.rank}</span>
                      <span style={{ fontSize: '1rem' }}>{SUBJECT_ICONS[item.subject] ?? '📚'}</span>
                      <span style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-h)' }}>{item.subject}</span>
                      <div style={{ width: '120px', height: '5px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${barW}%`, background: scoreColor(item.avg_score), borderRadius: '99px', transition: 'width 0.7s ease' }} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: scoreColor(item.avg_score), width: '36px', textAlign: 'right' as const }}>
                        {item.avg_score > 0 ? `${item.avg_score.toFixed(0)}%` : '—'}
                      </span>
                      <span style={{ padding: '0.18rem 0.55rem', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 700, background: `${c}18`, color: c, border: `1px solid ${c}30`, whiteSpace: 'nowrap' as const }}>
                        {item.priority_label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ── Subject Heatmap ── */}
            <section style={p.card}>
              <div style={p.cardHead}>
                <h2 style={p.cardTitle}>🗺 Subject Heatmap</h2>
                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' as const }}>
                  {[['#10b981','Strong >75%'],['#f59e0b','Average 50–75%'],['#ef4444','Weak <50%']].map(([c,l]) => (
                    <span key={l} style={{ fontSize: '0.65rem', fontWeight: 600, color: c, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, display: 'inline-block' }} />{l}
                    </span>
                  ))}
                </div>
              </div>
              <div style={p.heatGrid} className="subj-heatmap">
                {analysis.subjects.map(s => (
                  <HeatmapCell key={s.subject} s={s} onClick={() => setSelected(s)} />
                ))}
              </div>
            </section>

            {/* ── Trend Chart ── */}
            <section style={p.card}>
              <div style={p.cardHead}>
                <h2 style={p.cardTitle}>📈 Performance Trend</h2>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' as const }}>
                  {withData.map(s => (
                    <button key={s.subject}
                      onClick={() => setTrendSubject(s.subject)}
                      style={{ ...p.trendTab, background: trendSubject === s.subject ? scoreColor(s.avg_score) + '22' : 'transparent', color: trendSubject === s.subject ? scoreColor(s.avg_score) : 'var(--text)', border: `1px solid ${trendSubject === s.subject ? scoreColor(s.avg_score) + '55' : 'rgba(255,255,255,0.1)'}` }}>
                      {s.subject.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
              {trendData.length > 1 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData} margin={{ top: 10, right: 16, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                    <XAxis dataKey="dateLabel" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0,100]} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.07)' }} />
                    <ReferenceLine y={75} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1} strokeOpacity={0.5} label={{ value: 'Strong', fill: '#10b981', fontSize: 9, position: 'right' }} />
                    <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} strokeOpacity={0.5} label={{ value: 'Avg', fill: '#f59e0b', fontSize: 9, position: 'right' }} />
                    <Line type="monotone" dataKey="score"
                      stroke={scoreColor(analysis.subjects.find(s => s.subject === trendSubject)?.avg_score ?? 60)}
                      strokeWidth={2.5} dot={{ r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text)', fontSize: '0.87rem' }}>
                  {trendData.length === 1 ? 'Add more records to see the trend chart.' : `No data for ${trendSubject}. Select another subject or add a record.`}
                </p>
              )}
            </section>

            {/* ── AI Recommendations ── */}
            {weakSubjects.length > 0 && (
              <section style={p.card}>
                <h2 style={p.cardTitle}>💡 AI Recommendations</h2>
                <div style={p.recGrid} className="subj-rec-grid">
                  {withData.map(s => {
                    const recs = analysis.recommendations[s.subject] ?? [];
                    if (!recs.length) return null;
                    const c = scoreColor(s.avg_score);
                    return (
                      <div key={s.subject} style={{ background: `${c}08`, border: `1px solid ${c}25`, borderRadius: '14px', padding: '1.1rem', display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.1rem' }}>
                          <span style={{ fontSize: '1.1rem' }}>{SUBJECT_ICONS[s.subject] ?? '📚'}</span>
                          <span style={{ fontWeight: 800, fontSize: '0.87rem', color: 'var(--text-h)' }}>{s.subject}</span>
                          <span style={{ marginLeft: 'auto', fontWeight: 800, color: c, fontSize: '0.85rem' }}>{s.avg_score.toFixed(0)}%</span>
                        </div>
                        {recs.map((r, i) => (
                          <div key={i} style={{ display: 'flex', gap: '0.45rem' }}>
                            <span style={{ color: c, flexShrink: 0, fontSize: '0.78rem', marginTop: '1px' }}>→</span>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.6 }}>{r}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Action Plans ── */}
            {Object.keys(analysis.action_plans).length > 0 && (
              <section style={p.card}>
                <h2 style={p.cardTitle}>🗓 AI Recovery Plans</h2>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.65rem', marginTop: '0.85rem' }}>
                  {Object.entries(analysis.action_plans).map(([subj, plan]) => {
                    const s = analysis.subjects.find(x => x.subject === subj);
                    const c = s ? scoreColor(s.avg_score) : '#6366f1';
                    const open = expandedPlan === subj;
                    return (
                      <div key={subj} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${c}25`, borderRadius: '14px', overflow: 'hidden' }}>
                        <button onClick={() => setExpandedPlan(open ? null : subj)} style={{ width: '100%', padding: '0.85rem 1.1rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <span style={{ fontSize: '1.1rem' }}>{SUBJECT_ICONS[subj] ?? '📚'}</span>
                            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-h)' }}>{subj} — 7-Day Recovery Plan</span>
                          </div>
                          <span style={{ color: c, fontWeight: 700, fontSize: '0.8rem' }}>{open ? '▲ Hide' : '▼ Show'}</span>
                        </button>
                        {open && (
                          <div style={{ padding: '0 1.1rem 1.1rem', display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
                            {(plan as ActionPlanDay[]).map(d => (
                              <div key={d.day} style={{ display: 'flex', gap: '0.75rem', padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '9px' }}>
                                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: `${c}22`, border: `1px solid ${c}40`, color: c, fontWeight: 800, fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>D{d.day}</div>
                                <div>
                                  <p style={{ margin: '0 0 0.1rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-h)' }}>{d.title}</p>
                                  <p style={{ margin: 0, fontSize: '0.77rem', color: 'var(--text)' }}>{d.task}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {/* ── Records List ── always shown when there are records */}
        {records.length > 0 && (
          <section style={p.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap' as const, gap: '0.5rem' }}>
              <h2 style={{ ...p.cardTitle, margin: 0 }}>📝 All Records ({records.length})</h2>
              <button style={p.addBtn} onClick={() => setShowAdd(true)}>+ Add Record</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' }}>
              {records.map(rec => (
                <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', flexWrap: 'wrap' as const }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>{SUBJECT_ICONS[rec.subject] ?? '📚'}</span>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-h)', minWidth: '100px' }}>{rec.subject}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text)' }}>{rec.date}</span>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: scoreColor(rec.score), minWidth: '44px' }}>{rec.score.toFixed(0)}%</span>
                  <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', color: 'var(--text)', textTransform: 'capitalize' as const }}>{rec.source.replace('_', ' ')}</span>
                  {rec.study_hours > 0 && (
                    <span style={{ fontSize: '0.72rem', color: '#06b6d4' }}>⏱ {rec.study_hours.toFixed(1)}h</span>
                  )}
                  {rec.topics.length > 0 && (
                    <span style={{ fontSize: '0.72rem', color: '#8b5cf6' }}>🏷 {rec.topics.length} topic{rec.topics.length !== 1 ? 's' : ''}</span>
                  )}
                  {rec.notes && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, opacity: 0.6 }} title={rec.notes}>"{rec.notes}"</span>
                  )}
                  <div style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto', flexShrink: 0 }}>
                    <button
                      onClick={() => setEditRecord(rec)}
                      style={{ padding: '0.25rem 0.65rem', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '7px', color: '#818cf8', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                    >✏️ Edit</button>
                    <button
                      onClick={() => deleteRecord(rec.id)}
                      disabled={deletingId === rec.id}
                      style={{ padding: '0.25rem 0.65rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '7px', color: '#f87171', fontSize: '0.72rem', fontWeight: 700, cursor: deletingId === rec.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: deletingId === rec.id ? 0.5 : 1 }}
                    >{deletingId === rec.id ? '…' : '🗑 Delete'}</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

      {/* Modals */}
      {selected && (
        <SubjectModal s={selected} recs={selectedRecs} plan={selectedPlan} onClose={() => setSelected(null)} />
      )}
      {(showAdd || editRecord) && (
        <RecordModal
          profileSubjects={profileSubjects}
          editRecord={editRecord ?? undefined}
          onClose={() => { setShowAdd(false); setEditRecord(null); }}
          onSaved={(saved) => {
            if (editRecord) {
              // Update the record in-place in the list
              setRecords(prev => prev.map(r => r.id === saved.id ? saved : r));
            } else {
              // Prepend the new record to the top of the list
              setRecords(prev => [saved, ...prev]);
            }
            setLoading(true);
            load();
          }}
        />
      )}
    </div>
  );
}

// ── Style objects ──────────────────────────────────────────────────────

const p: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-h)', fontFamily: 'inherit', position: 'relative', overflow: 'hidden' },
  orb1: { position: 'fixed', top: '-8%', right: '-5%', width: '450px', height: '450px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.07) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 },
  orb2: { position: 'fixed', bottom: '5%', left: '-10%', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(16,185,129,0.05) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 },
  topBar: { position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.75rem', background: 'rgba(6,11,24,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  topCenter: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  pageTitle: { margin: 0, fontSize: '1.05rem', fontWeight: 800, background: 'linear-gradient(135deg,#6366f1,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  addBtn: { padding: '0.38rem 0.9rem', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  content: { position: 'relative', zIndex: 1, maxWidth: '1100px', margin: '0 auto', padding: '1.5rem 1.5rem 4rem', display: 'flex', flexDirection: 'column' as const, gap: '1.25rem' },
  notifBar: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem', background: 'rgba(99,102,241,0.09)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '10px' },
  notifX: { background: 'none', border: 'none', color: 'var(--text)', opacity: 0.4, cursor: 'pointer', fontSize: '0.85rem', padding: '0.1rem', flexShrink: 0 },
  emptyWrap: { display: 'flex', justifyContent: 'center', padding: '4rem 1rem' },
  emptyCard: { textAlign: 'center' as const, maxWidth: '440px' },
  addBigBtn: { padding: '0.75rem 2rem', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '0.95rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(99,102,241,0.35)' },
  card: { background: 'var(--glass-bg,rgba(255,255,255,0.04))', backdropFilter: 'blur(24px)', border: '1px solid var(--glass-border,rgba(255,255,255,0.08))', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  cardHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' as const },
  cardTitle: { margin: '0 0 0.85rem', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-h)' },
  detectionGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.85rem' },
  heatGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '0.85rem', marginTop: '0.85rem' },
  trendTab: { padding: '0.28rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' },
  recGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '0.85rem', marginTop: '0.85rem' },
  detailBtn: { padding: '0.35rem 0.85rem', background: 'transparent', border: '1px solid', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  statChip: { padding: '0.2rem 0.6rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 600 },
};

const hm: Record<string, React.CSSProperties> = {
  cell: { borderRadius: '16px', padding: '1.1rem 1rem', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '0.35rem', textAlign: 'center' as const, transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)' },
  cellIcon: { fontSize: '1.5rem', lineHeight: 1, marginBottom: '0.1rem' },
  cellName: { margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-h)' },
  cellScore: { margin: 0, fontSize: '1.5rem', fontWeight: 900, lineHeight: 1 },
  cellBadge: { padding: '0.15rem 0.5rem', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 700 },
  cellTrend: { margin: 0, fontSize: '0.65rem', fontWeight: 600, textTransform: 'capitalize' as const },
};

const dc: Record<string, React.CSSProperties> = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid', borderRadius: '16px', padding: '1.1rem', display: 'flex', flexDirection: 'column' as const, gap: '0.35rem', alignItems: 'center', textAlign: 'center' as const },
  iconBox: { width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem', marginBottom: '0.15rem', flexShrink: 0 },
  label: { margin: 0, fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const },
  subject: { margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-h)' },
  score: { margin: 0, fontSize: '1.3rem', fontWeight: 900, lineHeight: 1 },
  detail: { margin: 0, fontSize: '0.72rem', color: 'var(--text)', opacity: 0.7, lineHeight: 1.4 },
};

const md: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  panel: { background: 'var(--bg-elevated,#0f1a2e)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '22px', width: '100%', maxWidth: '640px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid', flexShrink: 0 },
  badge: { display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '99px', fontSize: '0.68rem', fontWeight: 700, marginTop: '0.25rem' },
  closeBtn: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.9rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  body: { flex: 1, overflowY: 'auto' as const, padding: '1.4rem 1.5rem' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.6rem', marginBottom: '1.25rem' },
  statBox: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '0.6rem 0.75rem', textAlign: 'center' as const },
  statLabel: { margin: '0 0 0.2rem', fontSize: '0.65rem', color: 'var(--text)', opacity: 0.65 },
  statValue: { margin: 0, fontSize: '0.95rem', fontWeight: 800 },
  sectionTitle: { margin: '0 0 0.65rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', opacity: 0.7 },
};

const af: Record<string, React.CSSProperties> = {
  row:  { display: 'flex', flexDirection: 'column' as const, gap: '0.3rem' },
  row2: { display: 'flex', gap: '0.75rem' },
  label: { fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-h)' },
  input: { padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', color: 'var(--text-h)', fontSize: '0.85rem', fontFamily: 'inherit', width: '100%', outline: 'none' },
};

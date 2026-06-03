import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import BadgeNotification, { type Badge } from '../components/BadgeNotification';
import BackButton from '../components/BackButton';
import LevelUpCelebration from '../components/LevelUpCelebration';
import { levelStorageKey, STREAK_MILESTONES, type GamificationProgress } from '../utils/gamification';

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

const SURVEY_QUESTIONS: Array<{ q: string; opts: string[] }> = [
  { q: 'How overwhelmed did you feel by your responsibilities today?', opts: ['Not at all', 'Slightly', 'Moderately', 'Very much', 'Extremely'] },
  { q: 'How often did you feel worried, anxious, or unable to stop thinking about problems today?', opts: ['Not at all', 'Slightly', 'Moderately', 'Very much', 'Extremely'] },
  { q: 'How difficult was it for you to concentrate on tasks today?', opts: ['Not at all', 'Slightly', 'Moderately', 'Very much', 'Extremely'] },
  { q: 'How mentally exhausted did you feel by the end of the day?', opts: ['Not at all', 'Slightly', 'Moderately', 'Very much', 'Extremely'] },
  { q: 'How irritable, frustrated, or emotionally sensitive were you today?', opts: ['Not at all', 'Slightly', 'Moderately', 'Very much', 'Extremely'] },
  { q: 'How much physical tension did you experience today (headaches, muscle tightness, stomach discomfort, rapid heartbeat)?', opts: ['Not at all', 'Slightly', 'Moderately', 'Very much', 'Extremely'] },
  { q: 'How much did stress interfere with your productivity or daily activities today?', opts: ['Not at all', 'Slightly', 'Moderately', 'Very much', 'Extremely'] },
  { q: 'How often did you feel that you had little control over what was happening today?', opts: ['Not at all', 'Slightly', 'Moderately', 'Very much', 'Extremely'] },
  { q: 'How well were you able to relax when you had free time today?', opts: ['Extremely well', 'Very well', 'Moderately well', 'Slightly', 'Not at all'] },
  { q: 'Compared to a typical day, how stressed did you feel overall today?', opts: ['Not at all', 'Slightly', 'Moderately', 'Very much', 'Extremely'] },
];

function surveyScoreToStress(raw: number): number {
  if (raw <= 14) return 1;
  if (raw <= 19) return 2;
  if (raw <= 24) return 3;
  if (raw <= 29) return 4;
  if (raw <= 34) return 5;
  if (raw <= 39) return 6;
  if (raw <= 42) return 7;
  if (raw <= 44) return 8;
  if (raw <= 47) return 9;
  return 10;
}

function surveyCategory(raw: number): { label: string; color: string; desc: string } {
  if (raw <= 19) return { label: 'Very Low Stress', color: '#16a34a', desc: 'Excellent! You managed stress very well today.' };
  if (raw <= 29) return { label: 'Low Stress', color: '#65a30d', desc: "You're handling things well. Keep it up." };
  if (raw <= 39) return { label: 'Moderate Stress', color: '#d97706', desc: 'Some stress is present. Consider short breaks and relaxation exercises.' };
  if (raw <= 44) return { label: 'High Stress', color: '#ea580c', desc: "You're under significant stress. Prioritise rest and self-care today." };
  return { label: 'Very High Stress', color: '#dc2626', desc: "You're highly stressed. Please reach out for support and be kind to yourself." };
}

function today() { return new Date().toISOString().slice(0, 10); }
function stressColor(level: number) {
  if (level <= 3) return '#16a34a';
  if (level <= 6) return '#d97706';
  return '#dc2626';
}
function stressLabel(level: number, tFn: (k: string) => string) {
  if (level <= 3) return tFn('checkin_low');
  if (level <= 6) return tFn('checkin_moderate');
  return tFn('checkin_high');
}

export default function CheckIn() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const headers = { Authorization: `Bearer ${token}` };

  const [entries,    setEntries]    = useState<LearningEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Form state
  const [date,       setDate]       = useState(today());
  const [studyHours, setStudyHours] = useState('');
  const [attendance, setAttendance] = useState('');
  const [completion, setCompletion] = useState('');
  const [quizScore,  setQuizScore]  = useState('');
  const [examScore,  setExamScore]  = useState('');
  const [sleep,      setSleep]      = useState('');
  const [stress,     setStress]     = useState(0);
  const [notes,      setNotes]      = useState('');

  const [saving,        setSaving]        = useState(false);
  const [msg,           setMsg]           = useState<{ ok: boolean; text: string } | null>(null);
  const [newBadges,     setNewBadges]     = useState<Badge[]>([]);
  const [levelUpData,   setLevelUpData]   = useState<GamificationProgress | null>(null);
  const [streakMilestone, setStreakMilestone] = useState<number | null>(null);

  // Survey state
  const [showSurvey,    setShowSurvey]    = useState(false);
  const [surveyAnswers, setSurveyAnswers] = useState<number[]>(Array(10).fill(0));
  const [currentQ,      setCurrentQ]      = useState(0);
  const [surveyDone,    setSurveyDone]    = useState(false);

  const existingEntry = entries.find(e => e.date === date) ?? null;
  const isEditing = !!existingEntry;

  const refreshEntries = useCallback(() => {
    api.get<LearningEntry[]>('/learning-data').then(r => setEntries(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get<LearningEntry[]>('/learning-data', { headers })
      .then(r => setEntries(r.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.id || !token) return;
    let dead = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      if (dead) return;
      const ws = new WebSocket(`ws://localhost:8000/ws/${user.id}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onopen  = () => setWsConnected(true);
      ws.onmessage = (event) => {
        try {
          const m = JSON.parse(event.data) as { type: string };
          if (m.type === 'checkin_update') refreshEntries();
        } catch { /* ignore */ }
      };
      ws.onclose = () => { setWsConnected(false); if (!dead) reconnectTimer = setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => {
      dead = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close(); wsRef.current = null;
    };
  }, [user?.id, token, refreshEntries]);

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

  function openSurvey() {
    setSurveyAnswers(Array(10).fill(0));
    setCurrentQ(0);
    setSurveyDone(false);
    setShowSurvey(true);
  }

  function handleSurveyAnswer(value: number) {
    const updated = [...surveyAnswers];
    updated[currentQ] = value;
    setSurveyAnswers(updated);
    if (currentQ < 9) {
      setTimeout(() => setCurrentQ(q => q + 1), 150);
    } else {
      setTimeout(() => setSurveyDone(true), 150);
    }
  }

  function applySurveyScore() {
    const raw = surveyAnswers.reduce((sum, a) => sum + a, 0);
    setStress(surveyScoreToStress(raw));
    setShowSurvey(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stress) { setMsg({ ok: false, text: 'Please complete the stress survey.' }); return; }
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
      try {
        const { data } = await api.post<{ new_badges: Badge[] }>('/achievements/check', {}, { headers });
        if (data.new_badges?.length > 0) setNewBadges(data.new_badges);
      } catch { /* non-critical */ }
      // Check for level-up or streak milestone
      try {
        const storKey = levelStorageKey(user?.id ?? '');
        const prevLv = Number(localStorage.getItem(storKey) || '1');
        const { data: prog } = await api.get<GamificationProgress>('/gamification/progress');
        localStorage.setItem(storKey, String(prog.level));
        if (prog.level > prevLv) {
          setLevelUpData(prog);
        } else if (STREAK_MILESTONES.includes(prog.streak_days)) {
          setStreakMilestone(prog.streak_days);
        }
      } catch { /* non-critical */ }
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

  const sparkData = [...entries].reverse().slice(-14);
  const maxStudy  = Math.max(...sparkData.map(e => e.study_hours), 1);

  const rawScore    = surveyAnswers.reduce((sum, a) => sum + a, 0);
  const cat         = surveyDone ? surveyCategory(rawScore) : null;
  const mappedStress = surveyDone ? surveyScoreToStress(rawScore) : 0;

  return (
    <div style={s.shell}>
      {newBadges.length > 0 && <BadgeNotification badges={newBadges} onDone={() => setNewBadges([])} />}
      {levelUpData && <LevelUpCelebration type="level_up" level={levelUpData.level} levelName={levelUpData.level_name} xp={levelUpData.xp} onClose={() => setLevelUpData(null)} />}
      {streakMilestone && <LevelUpCelebration type="streak" streak={streakMilestone} onClose={() => setStreakMilestone(null)} />}

      <header style={s.nav}>
        <div style={s.navLeft}>
          <BackButton />
          <Link to="/" style={s.navLogo}>TwinMind</Link>
          {wsConnected && (
            <div style={s.liveBadge}>
              <span style={s.liveDot} className="live-dot" />
              Live
            </div>
          )}
        </div>
      </header>

      <main style={s.main}>
        <h1 style={s.pageTitle}>{t('checkin_title')}</h1>

        <section style={s.formCard}>
          <div style={s.formHeader}>
            <h2 style={s.formTitle}>{isEditing ? `Editing entry for ${date}` : "Log today's learning"}</h2>
            {isEditing && <span style={s.editBadge}>Editing existing entry</span>}
          </div>

          {msg && <p style={msg.ok ? s.msgOk : s.msgErr}>{msg.text}</p>}

          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.row}>
              <label style={s.label}>
                {t('checkin_date')}
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={s.input} max={today()} required />
              </label>
            </div>

            <div style={s.row2} className="mob-form-row">
              <label style={s.label}>
                {t('checkin_study_hours')}
                <input type="number" value={studyHours} onChange={e => setStudyHours(e.target.value)}
                  style={s.input} min={0} max={24} step={0.5} placeholder="e.g. 3.5" required />
              </label>
              <label style={s.label}>
                {t('checkin_sleep')}
                <input type="number" value={sleep} onChange={e => setSleep(e.target.value)}
                  style={s.input} min={0} max={24} step={0.5} placeholder="e.g. 7" required />
              </label>
            </div>

            <div style={s.row2} className="mob-form-row">
              <label style={s.label}>
                {t('checkin_attendance')}
                <input type="number" value={attendance} onChange={e => setAttendance(e.target.value)}
                  style={s.input} min={0} max={100} step={1} placeholder="e.g. 85" required />
              </label>
              <label style={s.label}>
                {t('checkin_completion')}
                <input type="number" value={completion} onChange={e => setCompletion(e.target.value)}
                  style={s.input} min={0} max={100} step={1} placeholder="e.g. 90" required />
              </label>
            </div>

            <div style={s.row2} className="mob-form-row">
              <label style={s.label}>
                {t('checkin_quiz_score')}
                <input type="number" value={quizScore} onChange={e => setQuizScore(e.target.value)}
                  style={s.input} min={0} max={100} step={0.5} placeholder="—" />
              </label>
              <label style={s.label}>
                {t('checkin_exam_score')}
                <input type="number" value={examScore} onChange={e => setExamScore(e.target.value)}
                  style={s.input} min={0} max={100} step={0.5} placeholder="—" />
              </label>
            </div>

            {/* Stress — survey trigger */}
            <div>
              <p style={s.stressLabel}>{t('checkin_stress')}</p>
              {stress > 0 ? (
                <div style={s.surveyDoneRow}>
                  <span style={{ ...s.surveyDoneBadge, color: stressColor(stress), borderColor: stressColor(stress) }}>
                    {stress}/10 — {stressLabel(stress, t)}
                  </span>
                  <button type="button" onClick={openSurvey} style={s.retakeSurveyBtn}>Retake Survey</button>
                </div>
              ) : (
                <button type="button" onClick={openSurvey} style={s.takeSurveyBtn}>
                  Take Daily Stress Survey (10 questions)
                </button>
              )}
            </div>

            <label style={s.label}>
              {t('checkin_notes')}
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                style={s.textarea} rows={2} placeholder={t('checkin_notes_ph')} />
            </label>

            <button type="submit" disabled={saving} style={s.submitBtn}>
              {saving ? t('checkin_submitting') : isEditing ? t('checkin_update') : t('checkin_submit')}
            </button>
          </form>
        </section>

        {sparkData.length > 1 && (
          <section style={s.panel}>
            <h2 style={s.panelTitle}>Study hours — last {sparkData.length} entries</h2>
            <div style={s.spark}>
              {sparkData.map((e, i) => (
                <div key={i} style={s.sparkCol}>
                  <div style={s.sparkBarWrap}>
                    <div style={{ ...s.sparkBar, height: `${Math.round((e.study_hours / maxStudy) * 100)}%` }}
                      title={`${e.date}: ${e.study_hours}h`} />
                  </div>
                  <span style={s.sparkLabel}>{e.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

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
                      <td style={s.td}><button onClick={() => setDate(e.date)} style={s.dateBtn}>{e.date}</button></td>
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

      {/* ── Daily Stress Survey Modal ──────────────────────────── */}
      {showSurvey && (
        <div style={s.overlay} onClick={() => setShowSurvey(false)}>
          <div style={s.surveyModal} onClick={e => e.stopPropagation()}>

            {!surveyDone ? (
              <>
                <div style={s.surveyHeader}>
                  <div>
                    <p style={s.surveyTitle}>Daily Stress Level Survey</p>
                    <p style={s.surveySub}>10 questions · ~1 minute</p>
                  </div>
                  <button onClick={() => setShowSurvey(false)} style={s.surveyClose}>✕</button>
                </div>

                <div style={s.progressWrap}>
                  <div style={s.progressTrack}>
                    <div style={{ ...s.progressFill, width: `${((currentQ + 1) / 10) * 100}%` }} />
                  </div>
                  <span style={s.progressLabel}>Q {currentQ + 1} / 10</span>
                </div>

                <div style={s.questionWrap}>
                  <p style={s.questionNum}>Question {currentQ + 1}</p>
                  <p style={s.questionText}>{SURVEY_QUESTIONS[currentQ].q}</p>
                  <div style={s.optionsWrap}>
                    {SURVEY_QUESTIONS[currentQ].opts.map((opt, i) => {
                      const val = i + 1;
                      const selected = surveyAnswers[currentQ] === val;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSurveyAnswer(val)}
                          style={{ ...s.optionCard, ...(selected ? s.optionSelected : {}) }}
                        >
                          <span style={{
                            ...s.optionNum,
                            background: selected ? 'var(--accent)' : 'transparent',
                            color: selected ? '#fff' : 'var(--text)',
                            borderColor: selected ? 'var(--accent)' : 'var(--border)',
                          }}>{val}</span>
                          <span style={{ ...s.optionLabel, color: selected ? 'var(--accent)' : 'var(--text-h)', fontWeight: selected ? 600 : 500 }}>
                            {opt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={s.surveyNav}>
                  <button
                    type="button"
                    onClick={() => { setCurrentQ(q => Math.max(0, q - 1)); setSurveyDone(false); }}
                    disabled={currentQ === 0}
                    style={{ ...s.navBtn, opacity: currentQ === 0 ? 0.3 : 1, cursor: currentQ === 0 ? 'default' : 'pointer' }}
                  >← Previous</button>

                  <span style={s.navDots}>
                    {Array.from({ length: 10 }, (_, i) => (
                      <span key={i} style={{
                        ...s.navDot,
                        background: surveyAnswers[i] > 0 ? 'var(--accent)' : (i === currentQ ? 'var(--text)' : 'var(--border)'),
                      }} />
                    ))}
                  </span>

                  {surveyAnswers[currentQ] > 0 && currentQ < 9 && (
                    <button type="button" onClick={() => setCurrentQ(q => q + 1)} style={s.navBtnNext}>Next →</button>
                  )}
                  {surveyAnswers[currentQ] > 0 && currentQ === 9 && (
                    <button type="button" onClick={() => setSurveyDone(true)} style={s.navBtnNext}>See Results →</button>
                  )}
                  {surveyAnswers[currentQ] === 0 && (
                    <span style={{ ...s.navBtn, visibility: 'hidden' }}>Next →</span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={s.surveyHeader}>
                  <p style={s.surveyTitle}>Survey Complete</p>
                  <button onClick={() => setShowSurvey(false)} style={s.surveyClose}>✕</button>
                </div>

                <div style={s.resultsWrap}>
                  <div style={s.scoreCircle}>
                    <span style={s.scoreNum}>{rawScore}</span>
                    <span style={s.scoreOf}>/ 50</span>
                  </div>

                  <div style={{ ...s.catBadge, background: cat!.color + '1a', borderColor: cat!.color + '55', color: cat!.color }}>
                    {cat!.label}
                  </div>

                  <p style={s.catDesc}>{cat!.desc}</p>

                  <div style={s.mappedWrap}>
                    <span style={s.mappedLabel}>Maps to stress level:</span>
                    <div style={s.mappedDots}>
                      {Array.from({ length: 10 }, (_, i) => (
                        <span key={i} style={{ ...s.mappedDot, background: i < mappedStress ? cat!.color : 'var(--border)' }} />
                      ))}
                      <span style={{ ...s.mappedVal, color: cat!.color }}>{mappedStress}/10</span>
                    </div>
                  </div>

                  <p style={s.rangesNote}>
                    10–19 Very Low · 20–29 Low · 30–39 Moderate · 40–44 High · 45–50 Very High
                  </p>
                </div>

                <div style={s.resultsFooter}>
                  <button type="button"
                    onClick={() => { setSurveyAnswers(Array(10).fill(0)); setCurrentQ(0); setSurveyDone(false); }}
                    style={s.retakeBtn}>
                    Retake Survey
                  </button>
                  <button type="button" onClick={applySurveyScore} style={s.applyBtn}>
                    Apply Score ({mappedStress}/10)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', height: '60px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10 },
  navLeft: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  navLogo: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px', textDecoration: 'none' },
  liveBadge: { display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 700, color: '#10b981', letterSpacing: '0.04em' },
  liveDot: { width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', flexShrink: 0 },
  main: { flex: 1, padding: '2rem', maxWidth: '860px', width: '100%', margin: '0 auto', boxSizing: 'border-box', textAlign: 'left' },
  pageTitle: { margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-h)' },

  formCard: { border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', background: 'var(--bg)' },
  formHeader: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' as const },
  formTitle: { margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-h)' },
  editBadge: { fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)', borderRadius: '99px' },

  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  row: { display: 'flex', gap: '1rem' },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)' },
  input: { padding: '0.55rem 0.75rem', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.95rem', color: 'var(--text-h)', background: 'var(--bg)', outline: 'none' },
  textarea: { padding: '0.55rem 0.75rem', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.875rem', color: 'var(--text-h)', background: 'var(--bg)', outline: 'none', resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: '1.5' },

  stressLabel: { margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)' },
  takeSurveyBtn: { padding: '0.7rem 1.25rem', background: 'var(--accent-bg)', border: '2px dashed var(--accent-border)', borderRadius: '10px', color: 'var(--accent)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'center' as const },
  surveyDoneRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' as const },
  surveyDoneBadge: { padding: '0.35rem 0.9rem', borderRadius: '8px', border: '1px solid', fontSize: '0.875rem', fontWeight: 700 },
  retakeSurveyBtn: { padding: '0.35rem 0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' },

  msgOk: { margin: '0 0 0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '8px', color: '#16a34a', fontSize: '0.875rem' },
  msgErr: { margin: '0 0 0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', color: '#dc2626', fontSize: '0.875rem' },
  submitBtn: { alignSelf: 'flex-start', padding: '0.6rem 1.5rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' },

  panel: { border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', background: 'var(--bg)' },
  panelTitle: { margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-h)' },
  spark: { display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px', paddingTop: '8px' },
  sparkCol: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' },
  sparkBarWrap: { flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' },
  sparkBar: { width: '100%', borderRadius: '3px 3px 0 0', background: 'var(--accent)', minHeight: '3px', opacity: 0.85 },
  sparkLabel: { fontSize: '0.55rem', color: 'var(--text)', marginTop: '3px', transform: 'rotate(-45deg)', transformOrigin: 'top center', display: 'block', paddingTop: '3px' },

  empty: { color: 'var(--text)', fontSize: '0.875rem', margin: 0 },
  tableWrap: { overflowX: 'auto' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.85rem' },
  th: { padding: '0.5rem 0.75rem', textAlign: 'left' as const, fontWeight: 600, color: 'var(--text)', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' as const },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '0.6rem 0.75rem', color: 'var(--text-h)', whiteSpace: 'nowrap' as const },
  dateBtn: { background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', padding: 0, fontFamily: 'inherit' },
  stressTag: { display: 'inline-block', padding: '0.15rem 0.45rem', borderRadius: '5px', border: '1px solid', fontSize: '0.78rem', fontWeight: 700 },
  deleteBtn: { background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem 0.4rem', borderRadius: '4px' },

  // Survey modal
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' },
  surveyModal: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' },
  surveyHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '1.25rem 1.5rem 0.875rem', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  surveyTitle: { margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-h)' },
  surveySub: { margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--text)' },
  surveyClose: { background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '1rem', cursor: 'pointer', padding: '0.2rem 0.4rem', borderRadius: '6px', lineHeight: 1, flexShrink: 0 },

  progressWrap: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.5rem', flexShrink: 0 },
  progressTrack: { flex: 1, height: '5px', borderRadius: '99px', background: 'var(--border)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: '99px', background: 'var(--accent)', transition: 'width 0.3s ease' },
  progressLabel: { fontSize: '0.72rem', color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap' as const },

  questionWrap: { padding: '0.25rem 1.5rem 0.75rem', overflowY: 'auto' as const, flex: 1 },
  questionNum: { margin: '0 0 0.25rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  questionText: { margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-h)', lineHeight: '1.5' },
  optionsWrap: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  optionCard: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.875rem', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s', textAlign: 'left' as const, width: '100%' },
  optionSelected: { border: '1px solid var(--accent)', background: 'var(--accent-bg)' },
  optionNum: { width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0, border: '1px solid', transition: 'all 0.1s' },
  optionLabel: { fontSize: '0.875rem', transition: 'all 0.1s' },

  surveyNav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.5rem 1.1rem', borderTop: '1px solid var(--border)', gap: '0.5rem', flexShrink: 0 },
  navBtn: { padding: '0.42rem 0.85rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-h)', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  navBtnNext: { padding: '0.42rem 1rem', background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  navDots: { display: 'flex', alignItems: 'center', gap: '5px', flex: 1, justifyContent: 'center' },
  navDot: { width: '7px', height: '7px', borderRadius: '50%', transition: 'background 0.2s', flexShrink: 0 },

  // Results
  resultsWrap: { padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center' as const, overflowY: 'auto' as const, flex: 1 },
  scoreCircle: { width: '88px', height: '88px', borderRadius: '50%', border: '3px solid var(--accent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-h)', lineHeight: 1 },
  scoreOf: { fontSize: '0.72rem', color: 'var(--text)', marginTop: '0.1rem' },
  catBadge: { padding: '0.4rem 1.1rem', borderRadius: '99px', border: '1px solid', fontSize: '0.875rem', fontWeight: 700 },
  catDesc: { margin: 0, fontSize: '0.875rem', color: 'var(--text)', lineHeight: '1.55', maxWidth: '340px' },
  mappedWrap: { width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' },
  mappedLabel: { fontSize: '0.75rem', color: 'var(--text)', fontWeight: 500 },
  mappedDots: { display: 'flex', alignItems: 'center', gap: '5px' },
  mappedDot: { width: '14px', height: '14px', borderRadius: '50%', transition: 'background 0.2s' },
  mappedVal: { fontSize: '0.82rem', fontWeight: 700, marginLeft: '0.4rem' },
  rangesNote: { margin: 0, fontSize: '0.68rem', color: 'var(--text)', opacity: 0.6 },
  resultsFooter: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', padding: '0.75rem 1.5rem 1.1rem', borderTop: '1px solid var(--border)', flexShrink: 0 },
  retakeBtn: { padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-h)', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  applyBtn: { padding: '0.5rem 1.25rem', background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};

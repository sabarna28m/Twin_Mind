import { useCallback, useEffect, useRef, useState, KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveBadge from '../components/LiveBadge';
import PlanContent from '../components/PlanContent';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api/v1';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

interface LatestEntry {
  study_hours: number;
  attendance_percentage: number;
  assignment_completion_rate: number;
  quiz_scores: number | null;
  stress_level: number;
  sleep_duration: number;
  date: string;
}

interface Profile {
  course: string;
  semester: string;
  institution: string;
}

const RISK_COLOR = { low: '#16a34a', medium: '#d97706', high: '#dc2626' };
const RISK_BG    = { low: 'rgba(34,197,94,0.1)', medium: 'rgba(217,119,6,0.1)', high: 'rgba(239,68,68,0.1)' };

function uid() {
  return Math.random().toString(36).slice(2);
}

function getSmartStarters(entry: LatestEntry | null, prediction: {score: number; risk: string} | null): string[] {
  if (!entry) {
    return [
      'How can I improve my exam score?',
      'Help me build a study schedule.',
      'How do I manage stress before exams?',
      'Why is attendance important?',
      'What study techniques work best?',
    ];
  }

  const starters: string[] = [];

  if (entry.stress_level >= 7)
    starters.push(`My stress is at ${entry.stress_level}/10 — how do I manage it?`);
  if (entry.attendance_percentage < 75)
    starters.push(`My attendance is ${entry.attendance_percentage}% — how do I catch up?`);
  if (entry.assignment_completion_rate < 70)
    starters.push(`I've only completed ${entry.assignment_completion_rate}% of assignments — help me catch up.`);
  if (entry.sleep_duration < 6)
    starters.push(`I'm only getting ${entry.sleep_duration}h of sleep — what should I do?`);
  if (entry.study_hours < 2)
    starters.push(`I'm studying only ${entry.study_hours}h/day — how do I study more?`);
  if (prediction?.risk === 'high')
    starters.push("I'm at high exam risk — what's my action plan?");
  else if (prediction?.risk === 'medium')
    starters.push('How do I move from medium to low exam risk?');

  const defaults = [
    'How can I improve my exam score?',
    'Help me build a study schedule.',
    'What are the best memorization techniques?',
    'How do I stay motivated during the semester?',
    'Give me tips for effective revision.',
  ];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of [...starters, ...defaults]) {
    if (!seen.has(s)) { seen.add(s); result.push(s); }
    if (result.length === 5) break;
  }
  return result;
}

function WelcomeBubble() {
  return (
    <div style={mc.bubbleWrap}>
      <div style={mc.avatar}>TM</div>
      <div style={{ ...mc.bubble, ...mc.bubbleAssistant }}>
        <p style={{ margin: 0 }}>
          Hi! I'm your <strong>TwinMind AI Mentor</strong>. I have access to your academic profile, recent
          check-ins, and predicted exam score — so my advice is tailored specifically to you.
        </p>
        <p style={{ margin: '0.5rem 0 0' }}>Ask me anything about your studies, habits, or exam preparation.</p>
      </div>
    </div>
  );
}

export default function Mentor() {
  const { token, user } = useAuth();

  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [input,          setInput]          = useState('');
  const [streaming,      setStreaming]       = useState(false);
  const [profile,        setProfile]        = useState<Profile | null>(null);
  const [entry,          setEntry]          = useState<LatestEntry | null>(null);
  const [prediction,     setPrediction]     = useState<{score: number; risk: string} | null>(null);

  // Study plan state
  const [showPlan,       setShowPlan]       = useState(false);
  const [planText,       setPlanText]       = useState('');
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [planSaved,      setPlanSaved]      = useState(false);
  const [savingPlan,     setSavingPlan]     = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const planBottomRef = useRef<HTMLDivElement>(null);

  const refreshSidebar = useCallback(() => {
    const h = { Authorization: `Bearer ${token}` };
    api.get<LatestEntry[]>('/learning-data?limit=1', { headers: h })
      .then(r => {
        if (r.data.length > 0) {
          const e = r.data[0];
          setEntry(e);
          api.post('/predict', {
            study_hours: e.study_hours,
            attendance_percentage: e.attendance_percentage,
            assignment_completion_rate: e.assignment_completion_rate,
            quiz_scores: e.quiz_scores,
            stress_level: e.stress_level,
            sleep_duration: e.sleep_duration,
          }, { headers: h })
            .then(pr => setPrediction({ score: pr.data.predicted_score, risk: pr.data.risk_level }))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [token]);

  const wsConnected = useWebSocket(user?.id, token, refreshSidebar);

  // Load sidebar data + conversation history on mount
  useEffect(() => {
    const h = { Authorization: `Bearer ${token}` };
    api.get<Profile>('/student-profile', { headers: h })
      .then(r => setProfile(r.data))
      .catch(() => {});
    refreshSidebar();

    // Load last 10 messages from DB
    api.get<Array<{role: string; content: string}>>('/mentor/history', { headers: h })
      .then(r => {
        if (r.data.length > 0) {
          setMessages(r.data.map(m => ({
            id: uid(),
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })));
        }
      })
      .catch(() => {});

    // Load saved plan if any
    api.get<{ plan_text: string }>('/mentor/study-plan/saved', { headers: h })
      .then(r => { setPlanText(r.data.plan_text); setPlanSaved(true); })
      .catch(() => {});
  }, [refreshSidebar, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (showPlan) planBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [planText, showPlan]);

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    const userMsg: ChatMessage = { id: uid(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    const assistantId = uid();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', streaming: true }]);
    setStreaming(true);

    try {
      const response = await fetch(`${API_BASE}/mentor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: text, history }),
      });

      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;
          try {
            const obj = JSON.parse(payload);
            if (obj.error) throw new Error(obj.error);
            if (obj.delta) {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content + obj.delta } : m
              ));
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: 'Sorry, something went wrong. Please try again.' } : m
      ));
    } finally {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, streaming: false } : m
      ));
      setStreaming(false);
    }
  }

  async function savePlan() {
    if (!planText || savingPlan) return;
    setSavingPlan(true);
    try {
      await api.post('/mentor/study-plan/save', { plan_text: planText });
      setPlanSaved(true);
    } catch { /* ignore */ }
    finally { setSavingPlan(false); }
  }

  async function generateStudyPlan() {
    if (generatingPlan) return;
    setPlanText('');
    setPlanSaved(false);
    setShowPlan(true);
    setGeneratingPlan(true);

    try {
      const response = await fetch(`${API_BASE}/mentor/study-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;
          try {
            const obj = JSON.parse(payload);
            if (obj.error) throw new Error(obj.error);
            if (obj.delta) setPlanText(prev => prev + obj.delta);
          } catch (innerErr) {
            if (innerErr instanceof Error && innerErr.message !== 'SyntaxError') throw innerErr;
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      const display = msg.startsWith('HTTP 404')
        ? 'Endpoint not found (HTTP 404). The backend server needs to be restarted to load the new study-plan endpoint.\n\nRun: docker-compose restart backend\nor restart your uvicorn process.'
        : `Failed to generate study plan: ${msg}\n\nPlease try again.`;
      setPlanText(display);
    } finally {
      setGeneratingPlan(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  const riskLevel = prediction?.risk as keyof typeof RISK_COLOR | undefined;
  const starters = getSmartStarters(entry, prediction);

  return (
    <div style={mc.shell}>
      {/* Navbar */}
      <header style={mc.nav}>
        <div style={mc.navLeft}>
          <Link to="/" style={mc.navLogo}>TwinMind</Link>
          {wsConnected && <LiveBadge />}
        </div>
        <nav style={mc.navRight}>
          <Link to="/predict" style={mc.navLink}>Predict</Link>
          <Link to="/simulate" style={mc.navLink}>Simulate</Link>
          <Link to="/" style={mc.backLink}>← Dashboard</Link>
        </nav>
      </header>

      <div style={mc.body}>
        {/* ── Sidebar ──────────────────────────────────────── */}
        <aside style={mc.sidebar}>
          <div style={mc.sideSection}>
            <p style={mc.sideTitle}>Your Context</p>
            <p style={mc.sideName}>{user?.full_name}</p>
            {profile && (
              <>
                <div style={mc.sideItem}>
                  <span style={mc.sideLabel}>Course</span>
                  <span style={mc.sideVal}>{profile.course}</span>
                </div>
                <div style={mc.sideItem}>
                  <span style={mc.sideLabel}>Semester</span>
                  <span style={mc.sideVal}>{profile.semester}</span>
                </div>
              </>
            )}
            {!profile && (
              <p style={mc.sideEmpty}>
                <Link to="/profile/setup" style={{ color: 'var(--accent)' }}>Set up your profile</Link> to personalise advice.
              </p>
            )}
          </div>

          {entry && (
            <div style={mc.sideSection}>
              <p style={mc.sideTitle}>Latest Check-in</p>
              <p style={mc.sideSub}>{entry.date}</p>
              {([
                ['Study', `${entry.study_hours}h`],
                ['Attendance', `${entry.attendance_percentage}%`],
                ['Completion', `${entry.assignment_completion_rate}%`],
                ['Sleep', `${entry.sleep_duration}h`],
                ['Stress', `${entry.stress_level}/10`],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={mc.sideItem}>
                  <span style={mc.sideLabel}>{k}</span>
                  <span style={mc.sideVal}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {prediction && riskLevel && (
            <div style={mc.sideSection}>
              <p style={mc.sideTitle}>Predicted Score</p>
              <p style={{ ...mc.predScore, color: RISK_COLOR[riskLevel] }}>{prediction.score}</p>
              <div style={{ ...mc.riskBadge, background: RISK_BG[riskLevel], color: RISK_COLOR[riskLevel] }}>
                {riskLevel.toUpperCase()} RISK
              </div>
            </div>
          )}

          {!entry && (
            <div style={mc.sideSection}>
              <p style={mc.sideEmpty}>
                <Link to="/checkin" style={{ color: 'var(--accent)' }}>Log a check-in</Link> to get personalised advice.
              </p>
            </div>
          )}

          {/* Study Plan button */}
          <div style={mc.sideSection}>
            <p style={mc.sideTitle}>Study Plan</p>
            <button
              onClick={generateStudyPlan}
              disabled={generatingPlan}
              style={{
                ...mc.planBtn,
                opacity: generatingPlan ? 0.6 : 1,
                cursor: generatingPlan ? 'not-allowed' : 'pointer',
              }}
            >
              {generatingPlan ? 'Generating…' : 'Generate 30-Day Plan'}
            </button>
            {planText && !showPlan && (
              <button onClick={() => setShowPlan(true)} style={mc.viewPlanBtn}>
                View Plan
              </button>
            )}
          </div>

          {/* Smart contextual starters */}
          <div style={mc.sideSection}>
            <p style={mc.sideTitle}>Try asking…</p>
            <div style={mc.starterList}>
              {starters.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  disabled={streaming}
                  style={mc.starterBtn}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Chat panel ───────────────────────────────────── */}
        <div style={mc.chatPanel}>
          <div style={mc.messageList}>
            <WelcomeBubble />

            {messages.map(msg => (
              <div key={msg.id} style={msg.role === 'user' ? mc.bubbleWrapUser : mc.bubbleWrap}>
                {msg.role === 'assistant' && <div style={mc.avatar}>TM</div>}
                <div style={{ ...mc.bubble, ...(msg.role === 'user' ? mc.bubbleUser : mc.bubbleAssistant) }}>
                  {msg.content
                    ? msg.content.split('\n').map((line, i) => (
                        <span key={i}>{line}{i < msg.content.split('\n').length - 1 ? <br /> : null}</span>
                      ))
                    : <span style={mc.cursor}>▍</span>
                  }
                  {msg.streaming && msg.content && <span style={mc.cursor}>▍</span>}
                </div>
              </div>
            ))}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={mc.inputArea}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your mentor… (Enter to send, Shift+Enter for new line)"
              rows={2}
              disabled={streaming}
              style={mc.textarea}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              style={{
                ...mc.sendBtn,
                opacity: (!input.trim() || streaming) ? 0.5 : 1,
                cursor: (!input.trim() || streaming) ? 'not-allowed' : 'pointer',
              }}
            >
              {streaming ? '…' : '→'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Study Plan Modal ──────────────────────────────── */}
      {showPlan && (
        <div style={mc.modalOverlay} onClick={() => setShowPlan(false)}>
          <div style={mc.modalBox} onClick={e => e.stopPropagation()}>
            <div style={mc.modalHeader}>
              <div>
                <p style={mc.modalTitle}>30-Day Study Plan</p>
                <p style={mc.modalSub}>Personalized for {user?.full_name}</p>
              </div>
              <button onClick={() => setShowPlan(false)} style={mc.closeBtn}>✕</button>
            </div>

            <div style={mc.modalBody}>
              {planText
                ? <>
                    <PlanContent text={planText} />
                    {generatingPlan && <span style={mc.cursor}>▍</span>}
                  </>
                : generatingPlan
                  ? <div style={mc.planLoading}>
                      <span style={mc.cursor}>▍</span> Generating your personalized plan…
                    </div>
                  : <div style={mc.planIdle}>
                      Click <strong>Generate 30-Day Plan</strong> in the sidebar to create your plan.
                    </div>
              }
              <div ref={planBottomRef} />
            </div>

            <div style={mc.modalFooter}>
              <button
                onClick={generateStudyPlan}
                disabled={generatingPlan}
                style={{ ...mc.regenBtn, opacity: generatingPlan ? 0.5 : 1, cursor: generatingPlan ? 'not-allowed' : 'pointer' }}
              >
                {generatingPlan ? 'Generating…' : 'Regenerate Plan'}
              </button>
              {planText && !generatingPlan && (
                <button
                  onClick={savePlan}
                  disabled={savingPlan || planSaved}
                  style={{
                    ...mc.saveBtn,
                    opacity: (savingPlan || planSaved) ? 0.7 : 1,
                    cursor: (savingPlan || planSaved) ? 'default' : 'pointer',
                  }}
                >
                  {savingPlan ? 'Saving…' : planSaved ? 'Saved ✓' : 'Save Plan'}
                </button>
              )}
              <button onClick={() => setShowPlan(false)} style={mc.modalCloseBtn}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const mc: Record<string, React.CSSProperties> = {
  shell:   { minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 2rem', height: '60px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10,
  },
  navLeft:  { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  navLogo:  { fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px', textDecoration: 'none' },
  navRight: { display: 'flex', alignItems: 'center', gap: '1.25rem' },
  navLink:  { fontSize: '0.875rem', color: 'var(--text)', textDecoration: 'none', fontWeight: 500 },
  backLink: { fontSize: '0.875rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 },

  body: {
    flex: 1, display: 'grid',
    gridTemplateColumns: '240px 1fr',
    overflow: 'hidden',
    height: 'calc(100svh - 60px)',
  },

  // Sidebar
  sidebar: {
    borderRight: '1px solid var(--border)',
    overflowY: 'auto' as const,
    padding: '1rem',
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
  },
  sideSection: {
    borderBottom: '1px solid var(--border)',
    paddingBottom: '0.875rem',
    marginBottom: '0.875rem',
  },
  sideTitle:  { margin: '0 0 0.4rem', fontSize: '0.7rem', textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: 'var(--text)', fontWeight: 600 },
  sideName:   { margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-h)' },
  sideSub:    { margin: '0 0 0.4rem', fontSize: '0.75rem', color: 'var(--text)' },
  sideItem:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' },
  sideLabel:  { fontSize: '0.75rem', color: 'var(--text)' },
  sideVal:    { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-h)' },
  sideEmpty:  { margin: 0, fontSize: '0.78rem', color: 'var(--text)', lineHeight: '1.4' },
  predScore:  { margin: '0.25rem 0', fontSize: '2rem', fontWeight: 700, textAlign: 'center' as const },
  riskBadge:  { padding: '0.2rem 0.6rem', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 700, textAlign: 'center' as const, display: 'inline-block', width: '100%', boxSizing: 'border-box' as const },

  planBtn: {
    width: '100%', padding: '0.5rem 0.75rem',
    background: 'var(--accent)', color: '#fff',
    border: 'none', borderRadius: '8px',
    fontSize: '0.78rem', fontWeight: 600,
    fontFamily: 'inherit', textAlign: 'center' as const,
  },
  viewPlanBtn: {
    width: '100%', marginTop: '0.4rem', padding: '0.35rem 0.6rem',
    background: 'transparent', color: 'var(--accent)',
    border: '1px solid var(--accent)', borderRadius: '8px',
    fontSize: '0.75rem', fontWeight: 500,
    fontFamily: 'inherit', cursor: 'pointer', textAlign: 'center' as const,
  },

  starterList: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  starterBtn: {
    textAlign: 'left' as const, background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)', borderRadius: '8px',
    padding: '0.35rem 0.6rem', fontSize: '0.72rem', color: 'var(--text-h)',
    cursor: 'pointer', fontFamily: 'inherit', lineHeight: '1.4',
  },

  // Chat
  chatPanel:   { display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  messageList: { flex: 1, overflowY: 'auto' as const, padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' },

  bubbleWrap:     { display: 'flex', alignItems: 'flex-start', gap: '0.6rem' },
  bubbleWrapUser: { display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flexDirection: 'row-reverse' as const },

  avatar: {
    width: '32px', height: '32px', borderRadius: '50%',
    background: 'var(--accent)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
  },

  bubble: {
    maxWidth: '72%', padding: '0.65rem 0.9rem',
    borderRadius: '12px', fontSize: '0.875rem', lineHeight: '1.55',
    color: 'var(--text-h)',
  },
  bubbleAssistant: {
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderTopLeftRadius: '4px',
  },
  bubbleUser: {
    background: 'var(--accent)',
    color: '#fff',
    borderTopRightRadius: '4px',
  },
  cursor: { display: 'inline-block', animation: 'pulse 1s infinite', opacity: 0.7 },

  // Input
  inputArea: {
    display: 'flex', alignItems: 'flex-end', gap: '0.75rem',
    padding: '0.875rem 1.5rem', borderTop: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  textarea: {
    flex: 1, resize: 'none' as const,
    border: '1px solid var(--border)', borderRadius: '10px',
    padding: '0.55rem 0.875rem', fontSize: '0.9rem',
    fontFamily: 'inherit', color: 'var(--text-h)', background: 'var(--bg)',
    outline: 'none', lineHeight: '1.5',
  },
  sendBtn: {
    width: '40px', height: '40px', borderRadius: '10px',
    background: 'var(--accent)', color: '#fff', border: 'none',
    fontSize: '1.1rem', fontWeight: 700, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  // Study Plan Modal
  modalOverlay: {
    position: 'fixed' as const, inset: 0,
    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 50, padding: '1rem',
  },
  modalBox: {
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: '16px', width: '100%', maxWidth: '760px',
    maxHeight: '85vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
  },
  modalHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  modalTitle: { margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-h)' },
  modalSub:   { margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text)' },
  closeBtn: {
    background: 'transparent', border: 'none', color: 'var(--text)',
    fontSize: '1.1rem', cursor: 'pointer', padding: '0.2rem 0.4rem',
    borderRadius: '6px', lineHeight: 1,
  },
  modalBody: {
    flex: 1, overflowY: 'auto' as const,
    padding: '1.25rem 1.5rem',
  },
  planLoading: {
    color: 'var(--text)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
  },
  planIdle: {
    color: 'var(--text)', fontSize: '0.875rem', textAlign: 'center' as const,
    padding: '2rem 0', lineHeight: '1.6',
  },
  modalFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem',
    padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', flexShrink: 0,
  },
  regenBtn: {
    padding: '0.45rem 1rem', background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)', borderRadius: '8px',
    color: 'var(--text-h)', fontSize: '0.82rem', fontWeight: 500, fontFamily: 'inherit',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '0.45rem 1rem', background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.35)', borderRadius: '8px',
    color: '#10b981', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit',
  },
  modalCloseBtn: {
    padding: '0.45rem 1.25rem', background: 'var(--accent)',
    border: 'none', borderRadius: '8px',
    color: '#fff', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  },
};


import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BrainIcon } from '../components/TwinMindLogo';
import api from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveBadge from '../components/LiveBadge';
import PlanContent from '../components/PlanContent';
import BackButton from '../components/BackButton';

import { API_URL as API_BASE } from '../lib/config';

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

interface ChatSessionSummary {
  id: number;
  title: string;
  message_count: number;
  created_at: string;
}

interface ChatSessionDetail {
  id: number;
  title: string;
  created_at: string;
  messages: { role: string; content: string }[];
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
  const { t, lang } = useLanguage();

  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [input,          setInput]          = useState('');
  const [streaming,      setStreaming]       = useState(false);
  const [profile,        setProfile]        = useState<Profile | null>(null);
  const [entry,          setEntry]          = useState<LatestEntry | null>(null);
  const [prediction,     setPrediction]     = useState<{score: number; risk: string} | null>(null);

  const [showNewChatConfirm, setShowNewChatConfirm] = useState(false);
  const [chatSessions,       setChatSessions]       = useState<ChatSessionSummary[]>([]);
  const [viewingSession,     setViewingSession]     = useState<ChatSessionDetail | null>(null);

  // Study plan state
  const [showPlan,       setShowPlan]       = useState(false);
  const [planText,       setPlanText]       = useState('');
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [planSaved,      setPlanSaved]      = useState(false);
  const [savingPlan,     setSavingPlan]     = useState(false);

  // Multimedia input state
  const [isRecording,      setIsRecording]      = useState(false);
  const [attachedImage,    setAttachedImage]    = useState<{ name: string; description: string | null; groq_context: string | null; fallback: boolean } | null>(null);
  const [attachedFile,     setAttachedFile]     = useState<{ name: string; content: string } | null>(null);
  const [isReadingFile,    setIsReadingFile]    = useState(false);
  const [readingFileName,  setReadingFileName]  = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [analyzingImageName, setAnalyzingImageName] = useState<string | null>(null);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const planBottomRef  = useRef<HTMLDivElement>(null);
  const imageInputRef  = useRef<HTMLInputElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

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

  const loadChatSessions = useCallback(async () => {
    try {
      const { data } = await api.get<ChatSessionSummary[]>('/mentor/sessions');
      setChatSessions(data);
    } catch { /* ignore */ }
  }, []);

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

    loadChatSessions();
  }, [refreshSidebar, token, loadChatSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (showPlan) planBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [planText, showPlan]);

  async function handleNewChat() {
    if (messages.length > 0) {
      try {
        await api.post('/mentor/sessions');
      } catch { /* ignore — clear frontend regardless */ }
    }
    setMessages([]);
    setShowNewChatConfirm(false);
    loadChatSessions();
  }

  async function openSession(id: number) {
    try {
      const { data } = await api.get<ChatSessionDetail>(`/mentor/sessions/${id}`);
      setViewingSession(data);
    } catch { /* ignore */ }
  }

  // ── Multimedia handlers ─────────────────────────────
  function toggleVoice() {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e: any) => {
      const transcript: string = e.results[0][0].transcript;
      setInput(prev => prev ? `${prev} ${transcript}` : transcript);
    };
    rec.onend = () => setIsRecording(false);
    rec.onerror = () => setIsRecording(false);
    recognitionRef.current = rec;
    rec.start();
    setIsRecording(true);
  }

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsAnalyzingImage(true);
    setAnalyzingImageName(file.name);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${API_BASE}/mentor/analyze-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        alert(`Could not analyse image: ${err.detail ?? response.status}`);
        return;
      }
      const result = await response.json() as { filename: string; description: string | null; groq_context: string | null; fallback: boolean };
      setAttachedImage({ name: result.filename, description: result.description, groq_context: result.groq_context, fallback: result.fallback });
    } catch {
      alert('Failed to analyse image. Please try again.');
    } finally {
      setIsAnalyzingImage(false);
      setAnalyzingImageName(null);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsReadingFile(true);
    setReadingFileName(file.name);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${API_BASE}/mentor/upload-file`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        alert(`Could not read file: ${err.detail ?? response.status}`);
        return;
      }
      const { filename, text } = await response.json();
      setAttachedFile({ name: filename, content: text });
    } catch {
      alert('Failed to read file. Please try again.');
    } finally {
      setIsReadingFile(false);
      setReadingFileName(null);
    }
  }

  async function sendMessage(text: string) {
    const hasImage = Boolean(attachedImage);
    const hasFile  = Boolean(attachedFile);
    if (!text.trim() && !hasImage && !hasFile) return;
    if (streaming) return;

    // Build the API message (file text and image description prepended as context)
    let apiMessage = text.trim();

    if (hasFile && attachedFile) {
      const prefix = `[Attached file: ${attachedFile.name}]\n\n${attachedFile.content}\n\n---\n\n`;
      apiMessage = prefix + (apiMessage || 'Please analyse this file and summarise the key points for me.');
    }

    if (hasImage && attachedImage) {
      // Step 3 — use the pre-formatted groq_context returned by the backend,
      // or the fallback message if Gemini was unavailable.
      let imageCtx: string;
      if (attachedImage.fallback || !attachedImage.groq_context) {
        imageCtx =
          `The user uploaded an image called "${attachedImage.name}" but automated analysis ` +
          `was unavailable. Please ask them to describe what is in the image so you can help.`;
      } else {
        imageCtx = attachedImage.groq_context;
      }
      apiMessage = imageCtx + (apiMessage ? `\n\nUser question: ${apiMessage}` : '');
    }

    if (!apiMessage.trim()) apiMessage = 'Please help me with what I shared.';

    // Build display content shown in the chat bubble
    const displayParts: string[] = [];
    if (hasFile  && attachedFile)  displayParts.push(`📎 ${attachedFile.name}`);
    if (hasImage && attachedImage) displayParts.push(`🖼 ${attachedImage.name}`);
    if (text.trim()) displayParts.push(text.trim());

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    const userMsg: ChatMessage = { id: uid(), role: 'user', content: displayParts.join('\n') || apiMessage };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachedImage(null);
    setAttachedFile(null);

    const assistantId = uid();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', streaming: true }]);
    setStreaming(true);

    try {
      const response = await fetch(`${API_BASE}/mentor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: apiMessage, history, language: lang }),
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
          <BackButton />
          <BrainIcon size={24} />
          <Link to="/" style={mc.navLogo}>TwinMind</Link>
          {wsConnected && <LiveBadge />}
        </div>
        <nav style={mc.navRight}>
          <button
            onClick={() => setShowNewChatConfirm(true)}
            disabled={streaming}
            style={{ ...mc.newChatBtn, opacity: streaming ? 0.5 : 1, cursor: streaming ? 'not-allowed' : 'pointer' }}
          >
            + New Chat
          </button>
          <Link to="/predict" style={mc.navLink}>Predict</Link>
          <Link to="/simulate" style={mc.navLink}>Simulate</Link>
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
              {generatingPlan ? t('mentor_generating') : t('mentor_gen_plan')}
            </button>
            {planText && !showPlan && (
              <button onClick={() => setShowPlan(true)} style={mc.viewPlanBtn}>
                View Plan
              </button>
            )}
          </div>

          {/* Chat History */}
          {chatSessions.length > 0 && (
            <div style={mc.sideSection}>
              <p style={mc.sideTitle}>Chat History</p>
              <div style={mc.sessionList}>
                {chatSessions.map(s => (
                  <button key={s.id} onClick={() => openSession(s.id)} style={mc.sessionBtn}>
                    <p style={mc.sessionTitle}>{s.title}</p>
                    <p style={mc.sessionMeta}>
                      {new Date(s.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' · '}{s.message_count} msg{s.message_count !== 1 ? 's' : ''}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

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
            {/* Hidden file inputs */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              onChange={handleImageFile}
              style={{ display: 'none' }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {/* Attachment preview chips */}
            {(attachedImage || attachedFile || isReadingFile || isAnalyzingImage) && (
              <div style={mc.attachRow}>
                {isAnalyzingImage && analyzingImageName && (
                  <div style={{ ...mc.attachChip, opacity: 0.75 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span style={mc.chipName}>Analysing image…</span>
                  </div>
                )}
                {isReadingFile && readingFileName && (
                  <div style={{ ...mc.attachChip, opacity: 0.75 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                    </svg>
                    <span style={mc.chipName}>Reading {readingFileName}…</span>
                  </div>
                )}
                {attachedImage && (
                  <div style={{ ...mc.attachChip, ...(attachedImage.fallback ? { borderColor: 'rgba(234,179,8,0.4)', background: 'rgba(234,179,8,0.08)' } : {}) }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span style={mc.chipName}>
                      {attachedImage.name}{attachedImage.fallback ? ' ⚠️' : ' ✓'}
                    </span>
                    <button onClick={() => setAttachedImage(null)} style={mc.chipClose}>✕</button>
                  </div>
                )}
                {attachedFile && (
                  <div style={mc.attachChip}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                    </svg>
                    <span style={mc.chipName}>{attachedFile.name} ✓</span>
                    <button onClick={() => setAttachedFile(null)} style={mc.chipClose}>✕</button>
                  </div>
                )}
              </div>
            )}

            {/* Input row */}
            <div style={mc.inputRow}>
              {/* Voice input */}
              <button
                onClick={toggleVoice}
                disabled={streaming}
                title={isRecording ? 'Stop recording' : 'Voice input'}
                style={{ ...mc.mediaBtn, ...(isRecording ? mc.mediaBtnActive : {}) }}
              >
                {isRecording ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#ef4444">
                    <circle cx="12" cy="12" r="8"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                )}
              </button>

              {/* Image upload */}
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={streaming || isAnalyzingImage}
                title="Upload image (JPG, PNG)"
                style={{ ...mc.mediaBtn, opacity: (streaming || isAnalyzingImage) ? 0.5 : 1 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </button>

              {/* File attachment */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={streaming || isReadingFile}
                title="Attach PDF or text file"
                style={{ ...mc.mediaBtn, opacity: (streaming || isReadingFile) ? 0.5 : 1 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>

              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('mentor_placeholder')}
                rows={2}
                disabled={streaming}
                style={mc.textarea}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={(!input.trim() && !attachedImage && !attachedFile) || streaming || isAnalyzingImage || isReadingFile}
                style={{
                  ...mc.sendBtn,
                  opacity: ((!input.trim() && !attachedImage && !attachedFile) || streaming || isAnalyzingImage || isReadingFile) ? 0.5 : 1,
                  cursor: ((!input.trim() && !attachedImage && !attachedFile) || streaming || isAnalyzingImage || isReadingFile) ? 'not-allowed' : 'pointer',
                }}
              >
                {streaming ? '…' : '→'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Past Session Viewer ──────────────────────────── */}
      {viewingSession && (
        <div style={mc.modalOverlay} onClick={() => setViewingSession(null)}>
          <div style={mc.modalBox} onClick={e => e.stopPropagation()}>
            <div style={mc.modalHeader}>
              <div>
                <p style={mc.modalTitle}>{viewingSession.title}</p>
                <p style={mc.modalSub}>
                  {new Date(viewingSession.created_at).toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })}
                  {' · '}{viewingSession.messages.length} messages · read-only
                </p>
              </div>
              <button onClick={() => setViewingSession(null)} style={mc.closeBtn}>✕</button>
            </div>
            <div style={{ ...mc.modalBody, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {viewingSession.messages.map((m, i) => (
                <div key={i} style={m.role === 'user' ? mc.bubbleWrapUser : mc.bubbleWrap}>
                  {m.role === 'assistant' && <div style={mc.avatar}>TM</div>}
                  <div style={{ ...mc.bubble, ...(m.role === 'user' ? mc.bubbleUser : mc.bubbleAssistant) }}>
                    {m.content.split('\n').map((line, j) => (
                      <span key={j}>{line}{j < m.content.split('\n').length - 1 ? <br /> : null}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={mc.modalFooter}>
              <button onClick={() => setViewingSession(null)} style={mc.modalCloseBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Chat Confirmation ────────────────────────── */}
      {showNewChatConfirm && (
        <div style={mc.modalOverlay} onClick={() => setShowNewChatConfirm(false)}>
          <div style={mc.confirmBox} onClick={e => e.stopPropagation()}>
            <p style={mc.confirmTitle}>Start a new conversation?</p>
            <p style={mc.confirmSub}>Current chat will be cleared.</p>
            <div style={mc.confirmActions}>
              <button onClick={() => setShowNewChatConfirm(false)} style={mc.confirmCancel}>
                Cancel
              </button>
              <button onClick={handleNewChat} style={mc.confirmOk}>
                Clear &amp; Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}

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
  newChatBtn: {
    padding: '0.35rem 0.85rem', background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)', borderRadius: '8px',
    color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600,
    fontFamily: 'inherit',
  },

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

  // Chat history
  sessionList: { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  sessionBtn: {
    width: '100%', textAlign: 'left' as const,
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.5rem 0.65rem',
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },
  sessionTitle: {
    margin: '0 0 0.15rem', fontSize: '0.75rem', fontWeight: 600,
    color: 'var(--text-h)', lineHeight: 1.35,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  },
  sessionMeta: { margin: 0, fontSize: '0.65rem', color: 'var(--text)' },

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
    display: 'flex', flexDirection: 'column' as const, gap: '0.45rem',
    padding: '0.875rem 1.5rem', borderTop: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  inputRow: {
    display: 'flex', alignItems: 'flex-end', gap: '0.5rem',
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
  // Media buttons
  mediaBtn: {
    width: '36px', height: '36px', flexShrink: 0,
    background: 'transparent', border: '1px solid var(--border)',
    borderRadius: '8px', color: 'var(--text)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  mediaBtnActive: {
    borderColor: '#ef4444', color: '#ef4444',
    background: 'rgba(239,68,68,0.08)',
  },
  // Attachment chips
  attachRow: {
    display: 'flex', flexWrap: 'wrap' as const, gap: '0.35rem',
  },
  attachChip: {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
    borderRadius: '99px', padding: '0.2rem 0.5rem 0.2rem 0.45rem',
    fontSize: '0.72rem', color: 'var(--text-h)', maxWidth: '220px',
  },
  chipName: {
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    maxWidth: '160px',
  },
  chipClose: {
    background: 'transparent', border: 'none', color: 'var(--text)',
    cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '0.68rem',
    display: 'flex', alignItems: 'center',
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

  // New chat confirmation
  confirmBox: {
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: '14px', padding: '1.75rem 1.5rem',
    width: '100%', maxWidth: '360px',
    boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
    textAlign: 'center' as const,
  },
  confirmTitle: { margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text-h)' },
  confirmSub:   { margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--text)' },
  confirmActions: { display: 'flex', gap: '0.75rem', justifyContent: 'center' },
  confirmCancel: {
    padding: '0.5rem 1.1rem', background: 'var(--bg)',
    border: '1px solid var(--border)', borderRadius: '8px',
    color: 'var(--text-h)', fontSize: '0.85rem', fontWeight: 500,
    fontFamily: 'inherit', cursor: 'pointer',
  },
  confirmOk: {
    padding: '0.5rem 1.1rem', background: '#ef4444',
    border: 'none', borderRadius: '8px',
    color: '#fff', fontSize: '0.85rem', fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer',
  },
};


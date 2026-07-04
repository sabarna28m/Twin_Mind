import { useState, useRef, useEffect, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';

import { API_URL as API_BASE } from '../lib/config';

interface Msg { id: string; role: 'user' | 'assistant'; content: string; streaming?: boolean }
function uid() { return Math.random().toString(36).slice(2); }

const QUICK_CHIPS = [
  { label: 'Generate Quiz',     text: 'Create a 5-question quiz on my weakest subject.'          },
  { label: 'Study Plan',        text: 'Generate a personalized 7-day study plan for me.'          },
  { label: 'Explain Concept',   text: 'Explain the most important concept I need to understand.'  },
  { label: 'Analyze Weakness',  text: 'Analyze my weakest subject and give me an action plan.'    },
  { label: 'Boost Motivation',  text: 'Give me a motivational message and my next best action.'   },
  { label: 'Predict Exam',      text: 'Based on my data, predict how I will perform in exams.'    },
];

const WELCOME: Msg = {
  id: 'welcome',
  role: 'assistant',
  content: `Hi! I'm your **TwinMind Copilot** \n\nI have full access to your academic profile, subject performance, burnout risk, and learning patterns. Ask me anything — I'll give you personalized, data-driven guidance.\n\nTry one of the quick actions below, or just type your question.`,
};

export default function TwinMindCopilot() {
  const { token } = useAuth();
  const [open,      setOpen]      = useState(false);
  const [messages,  setMessages]  = useState<Msg[]>([WELCOME]);
  const [input,     setInput]     = useState('');
  const [streaming, setStreaming] = useState(false);
  const [pulsing,   setPulsing]   = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const abortRef   = useRef<AbortController | null>(null);

  // Pulse the FAB every 30s to attract attention
  useEffect(() => {
    if (open) return;
    const id = setInterval(() => {
      setPulsing(true);
      setTimeout(() => setPulsing(false), 2000);
    }, 30_000);
    return () => clearInterval(id);
  }, [open]);

  // Listen for the custom 'copilot:open' event dispatched by HeroPriorityCard "Ask AI" button
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('copilot:open', handler);
    return () => window.removeEventListener('copilot:open', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming || !token) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const history = messages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role, content: m.content }));

    const userMsg: Msg = { id: uid(), role: 'user', content: text.trim() };
    const aId = uid();
    setMessages(prev => [...prev, userMsg, { id: aId, role: 'assistant', content: '', streaming: true }]);
    setInput('');
    setStreaming(true);

    try {
      const res = await fetch(`${API_BASE}/mentor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text.trim(), history }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body.getReader();
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
            if (obj.delta) {
              setMessages(prev => prev.map(m =>
                m.id === aId ? { ...m, content: m.content + obj.delta } : m
              ));
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      setMessages(prev => prev.map(m =>
        m.id === aId ? { ...m, content: 'Sorry, something went wrong. Please try again.' } : m
      ));
    } finally {
      setMessages(prev => prev.map(m => m.id === aId ? { ...m, streaming: false } : m));
      setStreaming(false);
    }
  }, [messages, streaming, token]);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  function renderContent(text: string) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  }

  if (!token) return null;

  return (
    <>
      {/* ── Floating Action Button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          ...fab.btn,
          animation: pulsing && !open ? 'glow-pulse 2s ease-in-out' : 'none',
          background: open
            ? 'rgba(255, 255, 255, 0.85)'
            : 'rgba(255, 255, 255, 0.65)',
        }}
        aria-label="Open TwinMind Copilot"
      >
        <span style={fab.icon}>{open ? '' : '◈'}</span>
        <span style={fab.label}>{open ? 'Close' : 'Copilot'}</span>
        {!open && <span style={fab.badge} />}
      </button>

      {/* ── Chat Panel ── */}
      <div style={{
        ...panel.wrap,
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        transform: open ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
      }}>

        {/* Header */}
        <div style={panel.header}>
          <div style={panel.headerLeft}>
            <div style={panel.avatar}>◈</div>
            <div>
              <p style={panel.title}>TwinMind Copilot</p>
              <p style={panel.subtitle}>
                <span style={panel.dot} className="live-dot" />
                AI · Always learning
              </p>
            </div>
          </div>
          <div style={panel.headerRight}>
            <button
              onClick={() => { setMessages([WELCOME]); setInput(''); }}
              style={panel.iconBtn}
              title="Clear chat"
            >↺</button>
            <button onClick={() => setOpen(false)} style={panel.iconBtn} title="Close">✕</button>
          </div>
        </div>

        {/* Quick chips */}
        <div style={panel.chips}>
          {QUICK_CHIPS.map((c, i) => (
            <button
              key={i}
              onClick={() => sendMessage(c.text)}
              disabled={streaming}
              style={panel.chip}
              className="copilot-chip"
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div style={panel.feed}>
          {messages.map(m => (
            <div key={m.id} style={{
              ...panel.msgRow,
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              {m.role === 'assistant' && <div style={panel.botAvatar}>◈</div>}
              <div style={{
                ...panel.bubble,
                ...(m.role === 'user' ? panel.bubbleUser : panel.bubbleBot),
              }}>
                {m.streaming && m.content === '' ? (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '2px 0' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{ ...panel.typingDot, animationDelay: `${i * 0.18}s` }} className="typing-dot" />
                    ))}
                  </div>
                ) : (
                  <span
                    dangerouslySetInnerHTML={{ __html: renderContent(m.content) }}
                    style={{ wordBreak: 'break-word' as const }}
                  />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={panel.inputRow}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask anything…"
            disabled={streaming}
            style={panel.input}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            style={{
              ...panel.sendBtn,
              opacity: !input.trim() || streaming ? 0.45 : 1,
            }}
          >
            {streaming ? '…' : '↑'}
          </button>
        </div>

        <p style={panel.footer}>TwinMind AI · Powered by Groq</p>
      </div>
    </>
  );
}

/* ── Styles ── */
const fab: Record<string, React.CSSProperties> = {
  btn: {
    position: 'fixed', bottom: '24px', right: '24px', zIndex: 9998,
    display: 'flex', alignItems: 'center', gap: '0.45rem',
    padding: '0.62rem 1.1rem',
    borderRadius: '99px', border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer',
    color: '#0a0a0a', fontSize: '0.8125rem', fontWeight: 600,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace", letterSpacing: '0.06em', textTransform: 'uppercase',
    backdropFilter: 'blur(16px) saturate(180%)',
    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    transition: 'box-shadow 0.2s, transform 0.18s, background 0.3s',
  },
  icon:  { fontSize: '1rem', lineHeight: 1 },
  label: { letterSpacing: '0.06em' },
  badge: {
    position: 'absolute', top: '-3px', right: '-3px',
    width: '10px', height: '10px', borderRadius: '50%',
    background: '#0a0a0a', border: '2px solid #fff',
    boxShadow: '0 0 8px rgba(0,0,0,0.2)',
  },
};

const panel: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'fixed', bottom: '80px', right: '24px', zIndex: 9997,
    width: '390px', height: '580px',
    background: 'rgba(255, 255, 255, 0.85)',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: '20px',
    display: 'flex', flexDirection: 'column' as const,
    boxShadow: '0 24px 80px rgba(0,0,0,0.08)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    transition: 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.16,1,0.3,1)',
    overflow: 'hidden',
    fontFamily: "'Inter', sans-serif",
    color: '#0a0a0a',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1rem 1.1rem 0.75rem',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '0.65rem' },
  avatar: {
    width: '36px', height: '36px', borderRadius: '50%',
    background: '#0a0a0a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.1rem', color: '#fff', flexShrink: 0,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  title:    { margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#0a0a0a' },
  subtitle: { margin: 0, fontSize: '0.65rem', color: '#737373', display: 'flex', alignItems: 'center', gap: '0.3rem' },
  dot:      { display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#0a0a0a' },
  headerRight: { display: 'flex', gap: '0.3rem' },
  iconBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#737373', fontSize: '0.95rem', fontFamily: 'inherit',
    padding: '0.3rem 0.45rem', borderRadius: '7px',
    transition: 'background 0.2s, color 0.2s',
  },
  chips: {
    display: 'flex', gap: '0.4rem', flexWrap: 'wrap' as const,
    padding: '0.65rem 1.1rem',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
    flexShrink: 0,
  },
  chip: {
    padding: '0.3rem 0.7rem',
    background: 'rgba(0,0,0,0.03)',
    border: '1px solid rgba(0,0,0,0.06)',
    borderRadius: '99px',
    fontSize: '0.68rem', fontWeight: 600, color: '#525252',
    cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.04em',
    transition: 'background 0.18s, border-color 0.18s, color 0.18s',
  },
  feed: {
    flex: 1, overflowY: 'auto' as const,
    padding: '0.85rem 1.1rem',
    display: 'flex', flexDirection: 'column' as const, gap: '0.65rem',
  },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: '0.5rem' },
  botAvatar: {
    width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
    background: '#0a0a0a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.75rem', color: '#fff',
  },
  bubble: {
    maxWidth: '82%', padding: '0.65rem 0.85rem',
    borderRadius: '14px', fontSize: '0.8rem', lineHeight: 1.6,
  },
  bubbleUser: {
    background: '#0a0a0a',
    color: '#fff', borderBottomRightRadius: '4px',
  },
  bubbleBot: {
    background: '#f5f5f5',
    border: '1px solid rgba(0,0,0,0.04)',
    color: '#171717', borderBottomLeftRadius: '4px',
  },
  typingDot: {
    display: 'inline-block',
    width: '7px', height: '7px', borderRadius: '50%',
    background: '#0a0a0a',
  },
  inputRow: {
    display: 'flex', gap: '0.5rem', alignItems: 'center',
    padding: '0.75rem 1.1rem',
    borderTop: '1px solid rgba(0,0,0,0.06)',
    flexShrink: 0,
  },
  input: {
    flex: 1, padding: '0.6rem 0.85rem',
    background: 'rgba(255, 255, 255, 0.4)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: '12px',
    color: '#0a0a0a', fontSize: '0.82rem',
    fontFamily: 'inherit', outline: 'none',
    transition: 'border-color 0.2s, background 0.2s',
  },
  sendBtn: {
    width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
    background: '#0a0a0a',
    border: 'none', cursor: 'pointer',
    color: '#fff', fontSize: '1rem', fontWeight: 800, fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'opacity 0.2s, transform 0.18s',
    boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
  },
  footer: {
    margin: 0, padding: '0.4rem 1.1rem 0.65rem',
    fontSize: '0.6rem', color: '#a3a3a3',
    textAlign: 'center' as const, flexShrink: 0,
  },
};

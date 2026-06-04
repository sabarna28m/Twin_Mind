import { useState, useRef, useEffect, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';

import { API_URL as API_BASE } from '../lib/config';

interface Msg { id: string; role: 'user' | 'assistant'; content: string; streaming?: boolean }
function uid() { return Math.random().toString(36).slice(2); }

const QUICK_CHIPS = [
  { label: '🧠 Generate Quiz',     text: 'Create a 5-question quiz on my weakest subject.'          },
  { label: '📋 Study Plan',        text: 'Generate a personalized 7-day study plan for me.'          },
  { label: '🎯 Explain Concept',   text: 'Explain the most important concept I need to understand.'  },
  { label: '📉 Analyze Weakness',  text: 'Analyze my weakest subject and give me an action plan.'    },
  { label: '🔥 Boost Motivation',  text: 'Give me a motivational message and my next best action.'   },
  { label: '📈 Predict Exam',      text: 'Based on my data, predict how I will perform in exams.'    },
];

const WELCOME: Msg = {
  id: 'welcome',
  role: 'assistant',
  content: `Hi! I'm your **TwinMind Copilot** 🤖\n\nI have full access to your academic profile, subject performance, burnout risk, and learning patterns. Ask me anything — I'll give you personalized, data-driven guidance.\n\nTry one of the quick actions below, or just type your question.`,
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
            ? 'linear-gradient(135deg, #7C3AED, #00D4FF)'
            : 'linear-gradient(135deg, #6366f1 0%, #00D4FF 100%)',
        }}
        aria-label="Open TwinMind Copilot"
      >
        <span style={fab.icon}>{open ? '✕' : '◈'}</span>
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
    borderRadius: '99px', border: 'none', cursor: 'pointer',
    color: '#fff', fontSize: '0.85rem', fontWeight: 800,
    fontFamily: 'inherit', letterSpacing: '-0.2px',
    boxShadow: '0 4px 24px rgba(99,102,241,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
    transition: 'box-shadow 0.2s, transform 0.18s, background 0.3s',
  },
  icon:  { fontSize: '1rem', lineHeight: 1 },
  label: { letterSpacing: '-0.2px' },
  badge: {
    position: 'absolute', top: '-3px', right: '-3px',
    width: '10px', height: '10px', borderRadius: '50%',
    background: '#10b981', border: '2px solid #060b18',
    boxShadow: '0 0 8px rgba(16,185,129,0.7)',
  },
};

const panel: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'fixed', bottom: '80px', right: '24px', zIndex: 9997,
    width: '390px', height: '580px',
    background: 'rgba(6,8,20,0.97)',
    border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: '20px',
    display: 'flex', flexDirection: 'column' as const,
    boxShadow: '0 24px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(99,102,241,0.08)',
    backdropFilter: 'blur(24px)',
    transition: 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.16,1,0.3,1)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1rem 1.1rem 0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '0.65rem' },
  avatar: {
    width: '36px', height: '36px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #00D4FF)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.1rem', color: '#fff', flexShrink: 0,
    boxShadow: '0 0 16px rgba(99,102,241,0.4)',
    animation: 'breathe 3.5s ease-in-out infinite',
  },
  title:    { margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#f1f5f9' },
  subtitle: { margin: 0, fontSize: '0.65rem', color: 'rgba(148,163,184,0.6)', display: 'flex', alignItems: 'center', gap: '0.3rem' },
  dot:      { display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' },
  headerRight: { display: 'flex', gap: '0.3rem' },
  iconBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'rgba(148,163,184,0.55)', fontSize: '0.95rem', fontFamily: 'inherit',
    padding: '0.3rem 0.45rem', borderRadius: '7px',
    transition: 'background 0.2s, color 0.2s',
  },
  chips: {
    display: 'flex', gap: '0.4rem', flexWrap: 'wrap' as const,
    padding: '0.65rem 1.1rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    flexShrink: 0,
  },
  chip: {
    padding: '0.3rem 0.7rem',
    background: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.22)',
    borderRadius: '99px',
    fontSize: '0.68rem', fontWeight: 600, color: '#a5b4fc',
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const,
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
    background: 'linear-gradient(135deg, #6366f1, #00D4FF)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.75rem', color: '#fff',
  },
  bubble: {
    maxWidth: '82%', padding: '0.65rem 0.85rem',
    borderRadius: '14px', fontSize: '0.8rem', lineHeight: 1.6,
  },
  bubbleUser: {
    background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
    color: '#fff', borderBottomRightRadius: '4px',
  },
  bubbleBot: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(226,232,240,0.9)', borderBottomLeftRadius: '4px',
  },
  typingDot: {
    display: 'inline-block',
    width: '7px', height: '7px', borderRadius: '50%',
    background: '#818cf8',
  },
  inputRow: {
    display: 'flex', gap: '0.5rem', alignItems: 'center',
    padding: '0.75rem 1.1rem',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  input: {
    flex: 1, padding: '0.6rem 0.85rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#f1f5f9', fontSize: '0.82rem',
    fontFamily: 'inherit', outline: 'none',
    transition: 'border-color 0.2s',
  },
  sendBtn: {
    width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
    background: 'linear-gradient(135deg, #6366f1, #00D4FF)',
    border: 'none', cursor: 'pointer',
    color: '#fff', fontSize: '1rem', fontWeight: 800, fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'opacity 0.2s, transform 0.18s',
    boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
  },
  footer: {
    margin: 0, padding: '0.4rem 1.1rem 0.65rem',
    fontSize: '0.6rem', color: 'rgba(148,163,184,0.3)',
    textAlign: 'center' as const, flexShrink: 0,
  },
};

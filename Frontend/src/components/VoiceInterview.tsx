/**
 * VoiceInterview — Premium AI mock-interview panel.
 * Supports both Text mode and Voice mode.
 * Uses Web Speech API (SpeechRecognition + SpeechSynthesis).
 * No extra dependencies — inline styles only, consistent with the rest of the app.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InterviewMsg   { role: string; content: string }
interface InterviewChatResp {
  message: string; question_number?: number; total_questions: number;
  is_complete: boolean; scores?: Record<string, number>; feedback?: string;
  strengths: string[]; improvements: string[]; twin_updated: boolean;
}

type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused' | 'complete';

const CAREER_OPTIONS = [
  // Technology & Engineering
  'AI / ML Engineer', 'Data Scientist', 'Software Developer', 'Backend Developer',
  'DevOps Engineer', 'Cybersecurity Analyst', 'Cloud Architect', 'Data Analyst',
  'UI/UX Designer', 'Research Engineer',
  // Medical & Healthcare
  'Doctor (General Physician)', 'Surgeon', 'Medical Researcher',
  'Nurse Practitioner', 'Pharmacist', 'Public Health Specialist',
  'Clinical Research Associate', 'Healthcare Administrator',
  // Law & Legal
  'Corporate Lawyer', 'Criminal Defense Attorney', 'Legal Consultant',
  'Compliance Officer', 'Intellectual Property Attorney',
  // Management & Business
  'Product Manager', 'Business Analyst', 'Marketing Manager',
  'Human Resources Manager', 'Operations Manager', 'Entrepreneur',
  'Strategy Consultant',
  // Finance & Commerce
  'Chartered Accountant (CA)', 'Investment Banker', 'Financial Analyst',
  'Auditor', 'Tax Consultant', 'Actuary',
  // Education & Research
  'University Professor', 'Research Scientist', 'School Teacher',
  // Design & Media
  'Graphic Designer', 'Journalist', 'Content Creator',
  // Government & Public Service
  'IAS / IPS Officer', 'Government Policy Analyst', 'Defence Officer',
  // Others
  'Freelancer / Independent Consultant', 'Social Entrepreneur',
];

const LANGUAGES = [
  { code:'en-US', label:'English (US)' },
  { code:'en-GB', label:'English (UK)' },
  { code:'en-AU', label:'English (AU)' },
  { code:'en-IN', label:'English (IN)' },
];

// ── Colours (match existing app palette) ─────────────────────────────────────

const BG     = '#060b18';
const CYAN   = '#00D4FF';
const INDIGO = '#6366f1';
const GREEN  = '#10b981';
const AMBER  = '#f59e0b';
const RED    = '#ef4444';
const PURPLE = '#8b5cf6';
const TEXT   = '#f1f5f9';
const MUTED  = '#94a3b8';
const DIM    = '#475569';
const CARD   = 'rgba(255,255,255,0.04)';
const CARD_HI= 'rgba(255,255,255,0.07)';
const BORDER = '1px solid rgba(255,255,255,0.08)';

// ── Metric helpers ────────────────────────────────────────────────────────────

const FILLERS = ['um','uh','umm','uhh','like','you know','basically','actually',
                 'literally','kind of','sort of','right','well','i mean'];

function countFillers(text: string): number {
  const lower = text.toLowerCase();
  return FILLERS.reduce((n, fw) => {
    const m = lower.match(new RegExp(`\\b${fw}\\b`, 'g'));
    return n + (m?.length ?? 0);
  }, 0);
}

function computeClarity(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 5) return 0;
  const penalty = Math.min(40, (countFillers(text) / words.length) * 300);
  return Math.max(0, Math.min(100, Math.round(55 + words.length * 0.45 - penalty)));
}

function computeConfidence(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 5) return 30;
  const hedges = ['maybe','perhaps','i think','i guess','possibly','probably','kind of','sort of'];
  const hc = hedges.filter(h => text.toLowerCase().includes(h)).length;
  return Math.max(20, Math.min(100, Math.round(50 + words.length * 0.65 - hc * 7)));
}

function detectTone(text: string): { label: string; color: string } {
  const pos = ['great','excellent','passionate','love','excited','confident','achieve','success','enjoy','proud'];
  const neg = ['difficult','hard','struggle','fail','problem','issue','worried','nervous','anxious','scared'];
  const lower = text.toLowerCase();
  const pc = pos.filter(w => lower.includes(w)).length;
  const nc = neg.filter(w => lower.includes(w)).length;
  if (pc > nc + 1) return { label:'Positive', color:GREEN };
  if (nc > pc + 1) return { label:'Anxious',  color:RED   };
  return { label:'Neutral', color:AMBER };
}

function computeWPM(text: string, elapsedMs: number): number {
  if (elapsedMs < 1000) return 0;
  const wc = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((wc / (elapsedMs / 1000)) * 60);
}

// ── Waveform bars ─────────────────────────────────────────────────────────────

function Waveform({ peaks, color, label, height = 44 }:
  { peaks: number[]; color: string; label: string; height?: number }) {
  return (
    <div>
      <div style={{ fontSize:'0.62rem', color:DIM, textTransform:'uppercase', letterSpacing:'1px', marginBottom:4 }}>{label}</div>
      <div style={{ display:'flex', alignItems:'center', gap:1.5, height, overflow:'hidden' }}>
        {peaks.map((h, i) => (
          <div key={i} style={{
            flex: 1,
            height: `${Math.max(4, Math.min(100, h))}%`,
            background: h > 12
              ? `linear-gradient(to top, ${color}99, ${color})`
              : `${color}25`,
            borderRadius: 2,
            boxShadow: h > 30 ? `0 0 4px ${color}55` : 'none',
            transition: 'height 0.08s ease',
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Mic button ────────────────────────────────────────────────────────────────

function MicButton({ status, onClick, disabled }:
  { status: VoiceStatus; onClick: () => void; disabled: boolean }) {
  const isListening = status === 'listening';
  const isSpeaking  = status === 'speaking';
  const isThinking  = status === 'thinking';

  const btnColor  = isListening ? CYAN : isSpeaking ? GREEN : isThinking ? AMBER : `${INDIGO}`;
  const ringColor = btnColor;
  const size = 92;

  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      {/* Concentric pulse rings — visible when listening */}
      {isListening && (<>
        <div style={{ position:'absolute', inset:-18, borderRadius:'50%', border:`2px solid ${ringColor}`, opacity:0.5, animation:'mic-ring1 2s ease-out infinite' }} />
        <div style={{ position:'absolute', inset:-36, borderRadius:'50%', border:`1.5px solid ${ringColor}`, opacity:0.25, animation:'mic-ring2 2s ease-out 0.5s infinite' }} />
      </>)}

      {/* Button */}
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          width:size, height:size,
          borderRadius:'50%',
          background: isListening
            ? `radial-gradient(circle at 35% 35%, ${CYAN}dd, ${INDIGO})`
            : isSpeaking
            ? `radial-gradient(circle at 35% 35%, ${GREEN}cc, #065f46)`
            : isThinking
            ? `radial-gradient(circle at 35% 35%, ${AMBER}cc, #78350f)`
            : `radial-gradient(circle at 35% 35%, ${INDIGO}cc, #1e1b4b)`,
          border: `2px solid ${btnColor}66`,
          boxShadow: isListening
            ? `0 0 24px ${CYAN}55, 0 0 48px ${CYAN}22, inset 0 1px 0 rgba(255,255,255,0.2)`
            : `0 0 16px ${btnColor}33, inset 0 1px 0 rgba(255,255,255,0.1)`,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'all 0.25s ease',
          position:'relative', overflow:'hidden',
        }}>

        {/* Inner glow overlay */}
        <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:`radial-gradient(circle at 35% 35%, rgba(255,255,255,0.15), transparent 60%)`, pointerEvents:'none' }} />

        {/* Icon */}
        {isThinking ? (
          <div style={{ display:'flex', gap:4 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'#fff', animation:`thinking-dot 1.4s ease-in-out ${i*0.2}s infinite` }} />
            ))}
          </div>
        ) : (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="rgba(255,255,255,0.15)" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: VoiceStatus }) {
  const MAP: Record<VoiceStatus, { color:string; label:string; pulse:boolean }> = {
    idle:       { color:DIM,    label:'Ready',      pulse:false },
    listening:  { color:CYAN,   label:'Listening',  pulse:true  },
    thinking:   { color:AMBER,  label:'Thinking',   pulse:true  },
    speaking:   { color:GREEN,  label:'Speaking',   pulse:true  },
    paused:     { color:AMBER,  label:'Paused',     pulse:false },
    complete:   { color:PURPLE, label:'Complete',   pulse:false },
  };
  const { color, label, pulse } = MAP[status] ?? MAP.idle;
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:99, background:`${color}18`, border:`1px solid ${color}44` }}>
      {pulse && (
        <div style={{ width:7, height:7, borderRadius:'50%', background:color, boxShadow:`0 0 6px ${color}`, animation:'status-dot 1.2s ease-in-out infinite' }} />
      )}
      <span style={{ color, fontWeight:700, fontSize:'0.7rem', letterSpacing:'0.8px', textTransform:'uppercase' }}>{label}</span>
    </div>
  );
}

// ── Live metrics panel ────────────────────────────────────────────────────────

function LiveMetrics({ wpm, clarity, confidence, fillers, tone, toneColor }:
  { wpm:number; clarity:number; confidence:number; fillers:number; tone:string; toneColor:string }) {
  const sc = (v:number) => v>=75?GREEN:v>=55?CYAN:v>=35?AMBER:RED;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ fontSize:'0.62rem', color:DIM, textTransform:'uppercase', letterSpacing:1 }}>Live Analysis</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        {[
          { label:'WPM',        val:String(wpm),       color:wpm>60?GREEN:wpm>30?AMBER:DIM },
          { label:'Clarity',    val:`${clarity}%`,     color:sc(clarity)   },
          { label:'Confidence', val:`${confidence}%`,  color:sc(confidence)},
          { label:'Fillers',    val:String(fillers),   color:fillers>3?RED:fillers>1?AMBER:GREEN },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'5px 8px', border:`1px solid rgba(255,255,255,0.06)` }}>
            <div style={{ fontSize:'0.58rem', color:DIM, marginBottom:1 }}>{label}</div>
            <div style={{ fontSize:'0.88rem', fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'5px 8px', border:`1px solid rgba(255,255,255,0.06)`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:'0.58rem', color:DIM }}>TONE</span>
        <span style={{ fontSize:'0.78rem', fontWeight:700, color:toneColor }}>{tone}</span>
      </div>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg, isNew }: { msg: InterviewMsg; isNew?: boolean }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display:'flex', alignItems:'flex-end', gap:8,
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      animation: isNew ? 'fade-up 0.3s ease both' : 'none',
    }}>
      {!isUser && (
        <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#00D4FF)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', flexShrink:0 }}>🤖</div>
      )}
      <div style={{
        maxWidth:'75%',
        padding:'0.7rem 0.95rem',
        borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
        background: isUser
          ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
          : 'rgba(255,255,255,0.06)',
        backdropFilter:'blur(12px)',
        border: isUser ? 'none' : '1px solid rgba(255,255,255,0.1)',
        boxShadow: isUser ? '0 4px 20px rgba(99,102,241,0.35)' : '0 2px 12px rgba(0,0,0,0.3)',
        color:TEXT, fontSize:'0.85rem', lineHeight:1.65,
      }}>
        {!isUser && (
          <div style={{ color:CYAN, fontSize:'0.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', marginBottom:3 }}>AI Interviewer</div>
        )}
        {msg.content}
      </div>
      {isUser && (
        <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#8b5cf6,#6366f1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', flexShrink:0 }}>👤</div>
      )}
    </div>
  );
}

// ── Progress & timer bar ──────────────────────────────────────────────────────

function ProgressHeader({ role, userCount, qTotal, timer, complete, onRestart, mode, onModeToggle }:
  { role:string; userCount:number; qTotal:number; timer:number; complete:boolean;
    onRestart:()=>void; mode:'text'|'voice'; onModeToggle:()=>void }) {
  const mm = String(Math.floor(timer/60)).padStart(2,'0');
  const ss = String(timer%60).padStart(2,'0');
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ color:MUTED, fontSize:'0.8rem' }}>
          <span style={{ color:CYAN, fontWeight:600 }}>{role}</span>
          {!complete && <span style={{ color:DIM }}> · Q{Math.min(userCount+1,qTotal)}/{qTotal}</span>}
        </span>
      </div>

      {/* Mode toggle */}
      <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,0.05)', borderRadius:8, padding:'3px' }}>
        {(['text','voice'] as const).map(m => (
          <button key={m} onClick={onModeToggle} disabled={mode===m}
            style={{ padding:'4px 10px', borderRadius:6, border:'none', background:mode===m?INDIGO:'transparent', color:mode===m?'#fff':MUTED, cursor:mode===m?'default':'pointer', fontSize:'0.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>
            {m==='text'?'⌨ Text':'🎤 Voice'}
          </button>
        ))}
      </div>

      {/* Timer */}
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
        <div style={{ width:6, height:6, borderRadius:'50%', background:complete?MUTED:GREEN, animation:complete?'none':'status-dot 2s ease-in-out infinite' }} />
        <span style={{ fontFamily:'monospace', fontWeight:700, color:TEXT, fontSize:'0.82rem' }}>{mm}:{ss}</span>
      </div>

      <button onClick={onRestart}
        style={{ padding:'4px 10px', background:'rgba(255,255,255,0.05)', border:BORDER, borderRadius:7, color:MUTED, cursor:'pointer', fontSize:'0.72rem' }}>
        ↺ Restart
      </button>
    </div>
  );
}

// ── Score result card ─────────────────────────────────────────────────────────

function ScoreResults({ scores, feedback, strengths, improvements }:
  { scores:Record<string,number>|null; feedback:string; strengths:string[]; improvements:string[] }) {
  const sc = (v:number) => v>=75?GREEN:v>=55?AMBER:RED;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
      <div style={{ background:`${PURPLE}12`, border:`1px solid ${PURPLE}35`, borderRadius:16, padding:'1.1rem' }}>
        <div style={{ color:PURPLE, fontWeight:700, fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Interview Complete</div>
        <div style={{ color:MUTED, fontSize:'0.83rem', lineHeight:1.6 }}>{feedback}</div>
      </div>
      {scores && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'0.5rem' }}>
          {Object.entries(scores).map(([k,v]) => (
            <div key={k} style={{ background:CARD, border:`1px solid ${sc(v)}30`, borderRadius:12, padding:'0.6rem', textAlign:'center' }}>
              <div style={{ fontSize:'0.6rem', color:MUTED, textTransform:'capitalize', marginBottom:2 }}>{k.replace(/_/g,' ')}</div>
              <div style={{ fontSize:'1.4rem', fontWeight:900, color:sc(v) }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      {(strengths.length > 0 || improvements.length > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
          {strengths.length > 0 && (
            <div style={{ background:CARD, border:BORDER, borderRadius:12, padding:'0.9rem' }}>
              <div style={{ color:GREEN, fontWeight:700, fontSize:'0.75rem', marginBottom:5 }}>✓ Strengths</div>
              {strengths.map((s,i)=><div key={i} style={{ color:MUTED, fontSize:'0.79rem', marginBottom:3 }}>• {s}</div>)}
            </div>
          )}
          {improvements.length > 0 && (
            <div style={{ background:CARD, border:BORDER, borderRadius:12, padding:'0.9rem' }}>
              <div style={{ color:AMBER, fontWeight:700, fontSize:'0.75rem', marginBottom:5 }}>⚠ Improve</div>
              {improvements.map((imp,i)=><div key={i} style={{ color:MUTED, fontSize:'0.79rem', marginBottom:3 }}>• {imp}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Controls bar ──────────────────────────────────────────────────────────────

function ControlsBar({ muted, paused, speed, voices, selectedVoice, onMute, onPause,
  onEnd, onRestart, onSpeedChange, onVoiceChange, onReplay, canReplay, lang, onLangChange }:
  { muted:boolean; paused:boolean; speed:number;
    voices:SpeechSynthesisVoice[]; selectedVoice:SpeechSynthesisVoice|null;
    onMute:()=>void; onPause:()=>void; onEnd:()=>void; onRestart:()=>void;
    onSpeedChange:(v:number)=>void; onVoiceChange:(v:SpeechSynthesisVoice)=>void;
    onReplay:()=>void; canReplay:boolean; lang:string; onLangChange:(l:string)=>void }) {

  const [showVoices, setShowVoices] = useState(false);

  const CtrlBtn = ({ icon, label, active, color, onClick, disabled }:
    { icon:string; label:string; active?:boolean; color?:string; onClick:()=>void; disabled?:boolean }) => (
    <button onClick={onClick} disabled={disabled}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, padding:'6px 10px', borderRadius:9, border:`1px solid ${active?(color||CYAN)+'55':'rgba(255,255,255,0.08)'}`, background:active?`${color||CYAN}15`:'rgba(255,255,255,0.03)', color:disabled?DIM:active?(color||CYAN):MUTED, cursor:disabled?'not-allowed':'pointer', fontSize:'0.58rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', transition:'all 0.15s', minWidth:44, opacity:disabled?0.5:1 }}>
      <span style={{ fontSize:'1rem' }}>{icon}</span>{label}
    </button>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
      {/* Control buttons */}
      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        <CtrlBtn icon={muted?'🔇':'🔊'} label={muted?'Muted':'Mute'} active={muted} color={RED} onClick={onMute} />
        <CtrlBtn icon={paused?'▶':'⏸'} label={paused?'Resume':'Pause'} active={paused} color={AMBER} onClick={onPause} />
        <CtrlBtn icon="↩" label="Replay" onClick={onReplay} disabled={!canReplay} />
        <CtrlBtn icon="↺" label="Restart" onClick={onRestart} />
        <CtrlBtn icon="⏹" label="End" color={RED} onClick={onEnd} />
      </div>

      {/* Speed slider */}
      <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'7px 10px', border:BORDER }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
          <span style={{ fontSize:'0.62rem', color:DIM, textTransform:'uppercase', letterSpacing:1 }}>AI Speed</span>
          <span style={{ fontSize:'0.72rem', fontWeight:700, color:CYAN }}>{speed.toFixed(1)}×</span>
        </div>
        <input type="range" min={0.5} max={2.0} step={0.1} value={speed} onChange={e=>onSpeedChange(parseFloat(e.target.value))}
          style={{ width:'100%', accentColor:CYAN, cursor:'pointer' }} />
      </div>

      {/* Language selector */}
      <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'7px 10px', border:BORDER }}>
        <div style={{ fontSize:'0.62rem', color:DIM, textTransform:'uppercase', letterSpacing:1, marginBottom:5 }}>Recognition Language</div>
        <select value={lang} onChange={e=>onLangChange(e.target.value)}
          style={{ width:'100%', background:'transparent', border:'none', color:TEXT, fontSize:'0.78rem', cursor:'pointer', outline:'none' }}>
          {LANGUAGES.map(l=>(
            <option key={l.code} value={l.code} style={{ background:'#0d1117', color:TEXT }}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* AI Voice selector */}
      {voices.length > 0 && (
        <div style={{ position:'relative' }}>
          <button onClick={()=>setShowVoices(v=>!v)}
            style={{ width:'100%', background:'rgba(255,255,255,0.03)', border:BORDER, borderRadius:10, padding:'6px 10px', color:MUTED, cursor:'pointer', fontSize:'0.72rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:'0.62rem', color:DIM, textTransform:'uppercase', letterSpacing:1 }}>AI Voice</span>
            <span style={{ color:TEXT, fontSize:'0.75rem', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selectedVoice?.name.split(' ').slice(0,3).join(' ') || 'Default'} {showVoices?'▲':'▼'}</span>
          </button>
          {showVoices && (
            <div style={{ position:'absolute', bottom:'110%', left:0, right:0, background:'#0d1117', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, overflow:'hidden', zIndex:100, maxHeight:160, overflowY:'auto', boxShadow:'0 16px 40px rgba(0,0,0,0.6)' }}>
              {voices.slice(0,8).map(v=>(
                <button key={v.name} onClick={()=>{ onVoiceChange(v); setShowVoices(false); }}
                  style={{ width:'100%', padding:'8px 12px', background:selectedVoice?.name===v.name?`${INDIGO}25`:'transparent', border:'none', borderBottom:'1px solid rgba(255,255,255,0.05)', color:selectedVoice?.name===v.name?CYAN:TEXT, fontSize:'0.75rem', textAlign:'left', cursor:'pointer', display:'flex', justifyContent:'space-between' }}>
                  <span>{v.name.split(' ').slice(0,3).join(' ')}</span>
                  <span style={{ color:DIM, fontSize:'0.65rem' }}>{v.lang}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function VoiceInterview() {
  // Core interview state
  const [role,        setRole]        = useState('AI Engineer');
  const [mode,        setMode]        = useState<'text'|'voice'>('voice');
  const [started,     setStarted]     = useState(false);
  const [history,     setHistory]     = useState<InterviewMsg[]>([]);
  const [textInput,   setTextInput]   = useState('');
  const [loading,     setLoading]     = useState(false);
  const [complete,    setComplete]    = useState(false);
  const [scores,      setScores]      = useState<Record<string,number>|null>(null);
  const [feedback,    setFeedback]    = useState('');
  const [strengths,   setStrengths]   = useState<string[]>([]);
  const [improvements,setImprovements]= useState<string[]>([]);

  // Voice / status
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [liveText,    setLiveText]    = useState('');
  const [interimText, setInterimText] = useState('');
  const [isMuted,     setIsMuted]     = useState(false);
  const [isPaused,    setIsPaused]    = useState(false);
  const [speed,       setSpeed]       = useState(1.0);
  const [lang,        setLang]        = useState('en-US');
  const [voices,      setVoices]      = useState<SpeechSynthesisVoice[]>([]);
  const [selVoice,    setSelVoice]    = useState<SpeechSynthesisVoice|null>(null);

  // Waveform
  const [micPeaks, setMicPeaks] = useState<number[]>(Array(48).fill(2));
  const [aiPeaks,  setAiPeaks]  = useState<number[]>(Array(48).fill(2));

  // Live metrics
  const [wpm,        setWpm]       = useState(0);
  const [clarity,    setClarity]   = useState(0);
  const [confidence, setConfidence]= useState(0);
  const [fillers,    setFillers]   = useState(0);
  const [tone,       setTone]      = useState<{ label:string; color:string }>({ label:'Neutral', color:AMBER });
  const [timer,      setTimer]     = useState(0);
  const [speechStart,setSpeechStart]=useState(0);

  // Refs
  const bottomRef    = useRef<HTMLDivElement>(null);
  const recognRef    = useRef<any>(null);
  const audioCtxRef  = useRef<AudioContext|null>(null);
  const analyserRef  = useRef<AnalyserNode|null>(null);
  const streamRef    = useRef<MediaStream|null>(null);
  const rafRef       = useRef<number>(0);
  const aiWaveRef    = useRef<ReturnType<typeof setInterval>|null>(null);
  const silenceRef   = useRef<ReturnType<typeof setTimeout>|null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval>|null>(null);
  const liveTextRef  = useRef('');
  const lastAIMsgRef = useRef('');

  // ── Voice list ──────────────────────────────────────────────────────────
  useEffect(() => {
    function load() {
      const v = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
      setVoices(v);
      if (v.length > 0) {
        const pref = v.find(x => /Google|Microsoft/.test(x.name)) ?? v[0];
        setSelVoice(pref);
      }
    }
    load();
    speechSynthesis.onvoiceschanged = load;
    return () => { speechSynthesis.onvoiceschanged = null; };
  }, []);

  // ── Interview timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (started && !complete && !isPaused) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [started, complete, isPaused]);

  // ── Scroll to bottom ────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // ── Mic visualization (real audio) ─────────────────────────────────────
  async function startMicViz() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const N = 48;
      const step = Math.max(1, Math.floor(data.length / N));
      function tick() {
        analyser.getByteFrequencyData(data);
        setMicPeaks(Array.from({ length:N }, (_,i) => {
          const sl = data.slice(i*step, (i+1)*step);
          return (sl.reduce((a,b) => a+b,0) / sl.length / 255) * 100;
        }));
        rafRef.current = requestAnimationFrame(tick);
      }
      tick();
    } catch {
      // Simulated fallback
      let phase = 0;
      function simTick() {
        phase += 0.18;
        setMicPeaks(Array.from({ length:48 }, (_,i) => {
          const wave = Math.sin(phase + i * 0.4) * 30 + 35;
          return Math.max(4, wave + (Math.random()-0.5)*20);
        }));
        rafRef.current = requestAnimationFrame(simTick);
      }
      simTick();
    }
  }

  function stopMicViz() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(()=>{});
    analyserRef.current = null;
    setMicPeaks(Array(48).fill(2));
  }

  // ── AI waveform (simulated) ─────────────────────────────────────────────
  const aiPhaseRef = useRef(0);
  function startAiWave() {
    if (aiWaveRef.current) clearInterval(aiWaveRef.current);
    aiWaveRef.current = setInterval(() => {
      aiPhaseRef.current += 0.22;
      const ph = aiPhaseRef.current;
      setAiPeaks(Array.from({ length:48 }, (_,i) => {
        const x = i / 48;
        const w = Math.sin(ph + x * 10) * 22 + Math.sin(ph*1.5 + x*6) * 15 + 30;
        return Math.max(4, w + (Math.random()-0.5)*10);
      }));
    }, 70);
  }

  function stopAiWave() {
    if (aiWaveRef.current) clearInterval(aiWaveRef.current);
    setAiPeaks(Array(48).fill(2));
  }

  // ── Speech Recognition ──────────────────────────────────────────────────
  function startListening() {
    if (isMuted || isPaused || complete) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;
    recognRef.current = r;
    liveTextRef.current = '';
    setSpeechStart(Date.now());
    setLiveText('');
    setInterimText('');
    setVoiceStatus('listening');
    startMicViz();

    r.onresult = (e: any) => {
      if (silenceRef.current) clearTimeout(silenceRef.current);
      let fin = '', int = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t + ' ';
        else int = t;
      }
      liveTextRef.current += fin;
      setLiveText(liveTextRef.current);
      setInterimText(int);

      const full = liveTextRef.current + int;
      const elapsed = Date.now() - speechStart;
      setWpm(computeWPM(full, elapsed));
      setFillers(countFillers(full));
      setClarity(computeClarity(full));
      setConfidence(computeConfidence(full));
      setTone(detectTone(full));

      // Auto-send after 2.5 s silence
      if (fin) {
        silenceRef.current = setTimeout(() => {
          const txt = liveTextRef.current.trim();
          if (txt) voiceSubmit(txt);
        }, 2500);
      }
    };
    r.onerror = () => { stopMicViz(); setVoiceStatus('idle'); };
    r.onend   = () => {};
    try { r.start(); } catch { /* already running */ }
  }

  function stopListening() {
    recognRef.current?.stop();
    stopMicViz();
    if (silenceRef.current) clearTimeout(silenceRef.current);
  }

  // ── AI voice ────────────────────────────────────────────────────────────
  function speakAI(text: string, onDone?: () => void) {
    speechSynthesis.cancel();
    if (isMuted) { setVoiceStatus('listening'); onDone?.(); return; }
    const u = new SpeechSynthesisUtterance(text);
    if (selVoice) u.voice = selVoice;
    u.rate = speed;
    u.pitch = 1.05;
    setVoiceStatus('speaking');
    startAiWave();
    u.onend = () => { stopAiWave(); setVoiceStatus('idle'); onDone?.(); };
    u.onerror = () => { stopAiWave(); setVoiceStatus('idle'); onDone?.(); };
    speechSynthesis.speak(u);
  }

  // ── API call ─────────────────────────────────────────────────────────────
  async function fetchNextQuestion(hist: InterviewMsg[]) {
    setVoiceStatus('thinking');
    setLoading(true);
    try {
      const userCnt = hist.filter(m => m.role === 'user').length;
      const r = await api.post<InterviewChatResp>('/career/interview/chat', {
        role, history: hist, mode: userCnt >= 8 ? 'evaluate' : 'question',
      });
      lastAIMsgRef.current = r.data.message;
      setHistory(prev => [...prev, { role:'assistant', content:r.data.message }]);
      if (r.data.is_complete) {
        setComplete(true);
        stopListening();
        if (r.data.scores) setScores(r.data.scores);
        if (r.data.feedback) setFeedback(r.data.feedback);
        if (r.data.strengths) setStrengths(r.data.strengths);
        if (r.data.improvements) setImprovements(r.data.improvements);
        if (mode === 'voice') speakAI(r.data.message);
        else setVoiceStatus('complete');
      } else if (mode === 'voice') {
        speakAI(r.data.message, () => setTimeout(startListening, 500));
      } else {
        setVoiceStatus('idle');
      }
    } finally { setLoading(false); }
  }

  async function voiceSubmit(text: string) {
    stopListening();
    if (!text.trim()) return;
    const hist: InterviewMsg[] = [...history, { role:'user', content:text }];
    setHistory(hist);
    setLiveText(''); setInterimText('');
    liveTextRef.current = '';
    await fetchNextQuestion(hist);
  }

  async function textSend() {
    const txt = textInput.trim();
    if (!txt) return;
    setTextInput('');
    const hist: InterviewMsg[] = [...history, { role:'user', content:txt }];
    setHistory(hist);
    await fetchNextQuestion(hist);
  }

  // ── Start / Restart ──────────────────────────────────────────────────────
  async function startInterview() {
    setStarted(true);
    setHistory([]);
    setComplete(false);
    setScores(null);
    setFeedback('');
    setTimer(0);
    liveTextRef.current = '';
    setLiveText('');
    setLoading(true);
    try {
      const r = await api.post<InterviewChatResp>('/career/interview/chat', { role, history:[], mode:'question' });
      lastAIMsgRef.current = r.data.message;
      setHistory([{ role:'assistant', content:r.data.message }]);
      if (mode === 'voice') speakAI(r.data.message, () => setTimeout(startListening, 400));
    } finally { setLoading(false); }
  }

  function restartInterview() {
    speechSynthesis.cancel();
    stopListening();
    stopAiWave();
    stopMicViz();
    setStarted(false);
    setVoiceStatus('idle');
    setTimer(0);
    setHistory([]);
    setLiveText('');
    setInterimText('');
    setScores(null);
    setComplete(false);
  }

  // ── Controls ─────────────────────────────────────────────────────────────
  function toggleMute() {
    const m = !isMuted;
    setIsMuted(m);
    if (m) { speechSynthesis.cancel(); stopAiWave(); }
  }

  function togglePause() {
    const p = !isPaused;
    setIsPaused(p);
    if (p) {
      speechSynthesis.pause();
      stopListening();
      stopMicViz();
      setVoiceStatus('paused');
    } else {
      speechSynthesis.resume();
      if (mode === 'voice' && !complete) startListening();
      else setVoiceStatus('idle');
    }
  }

  function replayQuestion() {
    if (!lastAIMsgRef.current) return;
    stopListening();
    speechSynthesis.cancel();
    stopAiWave();
    speakAI(lastAIMsgRef.current, () => setTimeout(startListening, 400));
  }

  function handleMicClick() {
    if (voiceStatus === 'listening') {
      // Manual send
      const txt = liveTextRef.current.trim();
      if (txt) voiceSubmit(txt);
      else stopListening();
    } else if (voiceStatus === 'idle' || voiceStatus === 'paused') {
      setIsPaused(false);
      startListening();
    }
  }

  const userCount = history.filter(m => m.role === 'user').length;
  const qTotal = 8;
  const progPct = (userCount / qTotal) * 100;

  // ── Pre-start screen ──────────────────────────────────────────────────────
  if (!started) {
    return (
      <>
        <INTERVIEW_STYLES />
        <div style={{ maxWidth:520, margin:'0 auto' }}>
          {/* Hero card */}
          <div style={{ background:'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(0,212,255,0.08),rgba(139,92,246,0.1))', backdropFilter:'blur(20px)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:24, padding:'2.5rem', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
            {/* Animated mic icon */}
            <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:80, height:80, borderRadius:'50%', background:'radial-gradient(circle at 35% 35%,rgba(99,102,241,0.9),rgba(139,92,246,0.7))', border:'2px solid rgba(99,102,241,0.6)', boxShadow:'0 0 30px rgba(99,102,241,0.4)', marginBottom:'1.25rem' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="rgba(255,255,255,0.2)" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>

            <div style={{ color:TEXT, fontWeight:800, fontSize:'1.3rem', marginBottom:'0.4rem' }}>AI Mock Interview</div>
            <div style={{ color:MUTED, fontSize:'0.85rem', lineHeight:1.65, marginBottom:'1.75rem' }}>
              8 adaptive questions across Technical, Behavioral, HR, and Situational rounds.<br/>
              Evaluated on Communication, Confidence, Problem Solving, and Clarity.
            </div>

            {/* Mode toggle */}
            <div style={{ display:'flex', background:'rgba(255,255,255,0.06)', borderRadius:12, padding:4, marginBottom:'1.25rem', gap:3 }}>
              {(['voice','text'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  style={{ flex:1, padding:'0.55rem', borderRadius:9, border:'none', background:mode===m?`linear-gradient(135deg,${INDIGO},${PURPLE})`:'transparent', color:mode===m?'#fff':MUTED, cursor:'pointer', fontWeight:mode===m?700:400, fontSize:'0.85rem', transition:'all 0.2s' }}>
                  {m === 'voice' ? '🎤 Voice Mode' : '⌨️ Text Mode'}
                </button>
              ))}
            </div>

            {mode === 'voice' && (
              <div style={{ background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:10, padding:'0.65rem', marginBottom:'1.25rem', fontSize:'0.78rem', color:CYAN }}>
                AI will speak questions aloud. You respond by talking — auto-detects when you finish.
              </div>
            )}

            {/* Role selector */}
            <select value={role} onChange={e=>setRole(e.target.value)}
              style={{ width:'100%', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, padding:'0.7rem 1rem', color:TEXT, fontSize:'0.9rem', marginBottom:'1rem', backdropFilter:'blur(10px)' }}>
              {CAREER_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}
            </select>

            <button onClick={startInterview}
              style={{ width:'100%', padding:'0.85rem', background:`linear-gradient(135deg,${INDIGO},${PURPLE})`, border:'none', borderRadius:12, color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'1rem', boxShadow:`0 8px 24px rgba(99,102,241,0.4)`, letterSpacing:'0.3px' }}>
              {mode === 'voice' ? '🎤 Start Voice Interview' : '⌨️ Start Text Interview'}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Active interview ──────────────────────────────────────────────────────
  const isVoice = mode === 'voice';

  return (
    <>
      <INTERVIEW_STYLES />
      <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem', height:'82vh', minHeight:560 }}>

        {/* ── Header ── */}
        <ProgressHeader
          role={role} userCount={userCount} qTotal={qTotal}
          timer={timer} complete={complete}
          onRestart={restartInterview}
          mode={mode}
          onModeToggle={() => {
            const next = mode === 'voice' ? 'text' : 'voice';
            setMode(next);
            if (next === 'text') { stopListening(); speechSynthesis.cancel(); stopAiWave(); setVoiceStatus('idle'); }
          }}
        />

        {/* ── Progress bar ── */}
        {!complete && (
          <div style={{ height:3, background:'rgba(255,255,255,0.07)', borderRadius:99, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${progPct}%`, background:`linear-gradient(90deg,${INDIGO},${CYAN})`, borderRadius:99, transition:'width 0.5s ease', boxShadow:`0 0 8px ${CYAN}55` }} />
          </div>
        )}

        {/* ── Main layout ── */}
        <div style={{ flex:1, display:'grid', gridTemplateColumns:isVoice?'1fr 260px':'1fr', gap:'1rem', overflow:'hidden' }}>

          {/* Left: chat history */}
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem', overflow:'hidden' }}>
            {/* Messages */}
            <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:'0.7rem', paddingRight:4, paddingBottom:8 }}>
              {history.map((m, i) => (
                <Bubble key={i} msg={m} isNew={i === history.length - 1} />
              ))}

              {/* Thinking indicator */}
              {loading && (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#6366f1,#00D4FF)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.75rem' }}>🤖</div>
                  <div style={{ display:'flex', gap:5, padding:'10px 14px', background:'rgba(255,255,255,0.06)', borderRadius:'4px 18px 18px 18px', border:BORDER }}>
                    {[0,1,2].map(i=>(
                      <div key={i} style={{ width:7,height:7,borderRadius:'50%',background:INDIGO,animation:`thinking-dot 1.4s ease-in-out ${i*0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Live voice transcript */}
              {isVoice && (liveText || interimText) && !loading && (
                <div style={{ display:'flex', justifyContent:'flex-end', gap:8, alignItems:'flex-end' }}>
                  <div style={{ maxWidth:'75%', padding:'0.7rem 0.95rem', borderRadius:'18px 18px 4px 18px', background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.35)', color:TEXT, fontSize:'0.85rem', lineHeight:1.65, backdropFilter:'blur(10px)' }}>
                    <div style={{ color:INDIGO, fontSize:'0.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>● Live</div>
                    {liveText}<span style={{ color:`${MUTED}88` }}>{interimText}</span>
                  </div>
                  <div style={{ width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#8b5cf6,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.75rem',flexShrink:0 }}>👤</div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Text input */}
            {!isVoice && !complete && (
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <input
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && textSend()}
                  placeholder="Type your answer…"
                  disabled={loading}
                  style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'0.7rem 1rem', color:TEXT, fontSize:'0.88rem', backdropFilter:'blur(10px)' }}
                />
                <button onClick={textSend} disabled={loading || !textInput.trim()}
                  style={{ padding:'0.7rem 1.25rem', background:loading||!textInput.trim()?DIM:`linear-gradient(135deg,${INDIGO},${PURPLE})`, border:'none', borderRadius:12, color:'#fff', fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(99,102,241,0.3)' }}>
                  Send
                </button>
              </div>
            )}

            {/* Score results */}
            {complete && (
              <ScoreResults scores={scores} feedback={feedback} strengths={strengths} improvements={improvements} />
            )}
          </div>

          {/* Right: voice panel (voice mode only) */}
          {isVoice && (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem', overflowY:'auto' }}>
              {/* Glass card */}
              <div style={{ background:'rgba(255,255,255,0.04)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:'1.1rem', display:'flex', flexDirection:'column', gap:'1rem', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>

                {/* Status */}
                <div style={{ display:'flex', justifyContent:'center' }}>
                  <StatusBadge status={voiceStatus} />
                </div>

                {/* AI waveform */}
                <Waveform peaks={aiPeaks} color={voiceStatus==='speaking'?GREEN:DIM} label="AI Response" />

                {/* Mic button */}
                <div style={{ display:'flex', justifyContent:'center', padding:'0.5rem 0' }}>
                  <MicButton
                    status={voiceStatus}
                    onClick={handleMicClick}
                    disabled={loading || complete || isPaused}
                  />
                </div>
                <div style={{ textAlign:'center', fontSize:'0.65rem', color:DIM, marginTop:-4 }}>
                  {voiceStatus==='listening'?'Click to send · or wait 2.5s':voiceStatus==='speaking'?'AI is speaking…':'Click mic to speak'}
                </div>

                {/* User waveform */}
                <Waveform peaks={micPeaks} color={voiceStatus==='listening'?CYAN:DIM} label="Your Voice" />

                {/* Live metrics */}
                {(liveText || voiceStatus !== 'idle') && (
                  <LiveMetrics
                    wpm={wpm} clarity={clarity} confidence={confidence}
                    fillers={fillers} tone={tone.label} toneColor={tone.color}
                  />
                )}
              </div>

              {/* Controls */}
              {!complete && (
                <div style={{ background:'rgba(255,255,255,0.03)', backdropFilter:'blur(12px)', border:BORDER, borderRadius:16, padding:'0.85rem' }}>
                  <ControlsBar
                    muted={isMuted} paused={isPaused}
                    speed={speed} voices={voices} selectedVoice={selVoice}
                    onMute={toggleMute}
                    onPause={togglePause}
                    onEnd={restartInterview}
                    onRestart={restartInterview}
                    onSpeedChange={setSpeed}
                    onVoiceChange={v => { setSelVoice(v); }}
                    onReplay={replayQuestion}
                    canReplay={!!lastAIMsgRef.current && !loading}
                    lang={lang}
                    onLangChange={setLang}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── CSS animations (injected once per mount) ──────────────────────────────────

function INTERVIEW_STYLES() {
  return (
    <style>{`
      @keyframes mic-ring1 {
        0%   { transform: scale(1);   opacity: 0.65; }
        100% { transform: scale(1.8); opacity: 0;    }
      }
      @keyframes mic-ring2 {
        0%   { transform: scale(1);   opacity: 0.35; }
        100% { transform: scale(2.5); opacity: 0;    }
      }
      @keyframes status-dot {
        0%,100% { opacity:1; transform:scale(1); }
        50%     { opacity:0.5; transform:scale(0.7); }
      }
      @keyframes thinking-dot {
        0%,80%,100% { transform:translateY(0);    opacity:0.5; }
        40%         { transform:translateY(-6px); opacity:1;   }
      }
      @keyframes fade-up {
        from { opacity:0; transform:translateY(10px); }
        to   { opacity:1; transform:translateY(0);    }
      }
    `}</style>
  );
}

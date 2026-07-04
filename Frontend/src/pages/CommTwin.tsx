import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend,
} from 'recharts';
import { Star } from 'lucide-react';
import BackButton from '../components/BackButton';
import api from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────

interface CTwinPrediction { days:number; overall_score:number; fluency:number; confidence:number; vocabulary:number; level_label:string; forecast:string }
interface CommTwinData {
  overall_score:number; fluency_score:number; pronunciation_score:number;
  vocabulary_score:number; grammar_score:number; confidence_score:number;
  sessions_count:number; words_reviewed:number;
  level_label:string; weekly_growth:number; monthly_growth:number;
  predictions:Record<string,CTwinPrediction>; score_history:Array<Record<string,number|string>>;
  recent_activities:Array<Record<string,unknown>>; twin_insight:string; last_updated:string|null;
}
interface GrammarError { original:string; corrected:string; rule:string; explanation:string }
interface FillerWord { word:string; count:number }
interface SpeechResult {
  fluency_score:number; pronunciation_score:number; vocabulary_score:number;
  grammar_score:number; confidence_score:number; overall_score:number;
  corrected_text:string; grammar_errors:GrammarError[]; grammar_error_count:number;
  filler_words:FillerWord[]; filler_word_count:number; word_count:number;
  sentence_count:number; avg_sentence_length:number; fluency_feedback:string;
  advanced_words_used:string[]; vocabulary_level:string; vocabulary_feedback:string;
  confidence_level:string; confidence_feedback:string; pronunciation_tips:string[];
  strengths:string[]; weaknesses:string[]; improvement_tips:string[]; practice_suggestion:string;
  twin_updated:boolean;
}
interface ImageChallenge { challenge_id:number; image_url:string; topic:string; task:string; story_prompt:string; difficulty:string }
interface ImageEvalResult {
  description_accuracy:number; observation_score:number; communication_clarity:number;
  elements_mentioned:string[]; elements_missed:string[]; speech_analysis:SpeechResult;
  ai_reconstruction_description:string; feedback:string; twin_updated:boolean;
}
interface SpeakingTask { task_id:string; task_type:string; prompt:string; sub_prompt:string; tips:string[]; time_suggestion:string; difficulty:string }
interface VocabWord { word:string; meaning:string; synonyms:string[]; antonyms:string[]; example_sentence:string; interview_usage:string; professional_usage:string; difficulty:string }
interface DailyVocab { words:VocabWord[]; date:string; level:string; theme:string }
interface GrammarResult { original_text:string; corrected_text:string; errors:GrammarError[]; score:number; grade:string; summary:string; twin_updated:boolean }
interface CoachActivity { order:number; activity:string; duration:string; focus_area:string; description:string }
interface CoachData { level:string; daily_plan:CoachActivity[]; focus_today:string; motivational_message:string; weekly_goal:string; badge_to_earn:string }

// ── Theme ─────────────────────────────────────────────────────────────────
// Accent colours stay as hex (work in both modes as status/score colours).
// Surface/text tokens use CSS custom properties so light/dark adapt automatically.

const CYAN   = '#00D4FF';
const INDIGO = '#6366f1';
const GREEN  = '#10b981';
const AMBER  = '#f59e0b';
const RED    = '#ef4444';
const PURPLE = '#8b5cf6';
const PINK   = '#ec4899';
const TEAL   = '#14b8a6';

const TEXT   = 'var(--text-h)';
const MUTED  = 'var(--text)';
const DIM    = 'var(--text-m)';
const CARD   = 'var(--bg-elevated)';
const CARD2  = 'var(--bg-surface)';
const BORDER = '1px solid var(--border)';

const TABS = [
  { id:'twin',      label:'Twin',       icon:'' },
  { id:'image',     label:'Image',      icon:''  },
  { id:'tasks',     label:'Tasks',      icon:''  },
  { id:'grammar',   label:'Grammar',    icon:''  },
  { id:'vocab',     label:'Vocab',      icon:''  },
  { id:'analytics', label:'Analytics',  icon:'' },
  { id:'coach',     label:'AI Coach',   icon:'' },
];

// ── Voice Recorder Component ──────────────────────────────────────────────

function VoiceRecorder({
  onTranscript, placeholder = 'Press the mic button and start speaking…',
}: {
  onTranscript: (text: string) => void;
  placeholder?: string;
}) {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState('');
  const recognitionRef = useRef<unknown>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    let final = '';
    r.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + ' ';
        else interim = t;
      }
      setTranscript(final + interim);
    };
    r.onerror = (e: any) => {
      setError(e.error === 'not-allowed' ? 'Microphone permission denied. Please allow mic access.' : `Error: ${e.error}`);
      setRecording(false);
    };
    r.onend = () => setRecording(false);
    recognitionRef.current = r;
  }, []);

  function startStop() {
    const r = recognitionRef.current as any;
    if (!r) return;
    if (recording) { r.stop(); onTranscript(transcript); }
    else { setTranscript(''); setError(''); r.start(); setRecording(true); }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
      {!supported && (
        <div style={{ background:`${AMBER}0a`, border:`1px solid ${AMBER}30`, borderRadius:10, padding:'0.65rem', color:AMBER, fontSize:'0.8rem' }}>
          Your browser doesn't support Speech Recognition. Type your response below instead.
        </div>
      )}
      <div style={{ position:'relative' }}>
        <textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          placeholder={placeholder}
          rows={5}
          style={{ width:'100%', background:'var(--bg-elevated)', border:`1px solid ${recording?CYAN:'var(--border)'}`, borderRadius:12, padding:'0.85rem 3.5rem 0.85rem 1rem', color:'var(--text-h)', fontSize:'0.87rem', resize:'vertical', boxSizing:'border-box', lineHeight:1.65, transition:'border-color 0.2s' }}
        />
        {supported && (
          <button onClick={startStop}
            style={{ position:'absolute', bottom:12, right:12, width:38, height:38, borderRadius:'50%', background:recording?`${RED}22`:`${INDIGO}22`, border:`1px solid ${recording?RED:INDIGO}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 0.2s' }}>
            {recording ? (
              <div style={{ width:12, height:12, background:RED, borderRadius:2 }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INDIGO} strokeWidth="2.5">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>
        )}
      </div>
      {recording && (
        <div style={{ display:'flex', alignItems:'center', gap:8, color:RED, fontSize:'0.8rem', fontWeight:600 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:RED, animation:'pulse 1s infinite' }} />
          Recording… speak clearly. Click the red button to stop.
        </div>
      )}
      {error && <div style={{ color:RED, fontSize:'0.78rem' }}>{error}</div>}
      {transcript && !recording && (
        <div style={{ display:'flex', gap:'0.5rem' }}>
          <button onClick={() => onTranscript(transcript)} style={{ flex:1, padding:'0.6rem', background:`linear-gradient(135deg,${INDIGO},${CYAN})`, border:'none', borderRadius:9, color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'0.88rem' }}>
            Analyze Response
          </button>
          <button onClick={() => setTranscript('')} style={{ padding:'0.6rem 1rem', background:'var(--bg-surface)', border:BORDER, borderRadius:9, color:MUTED, cursor:'pointer', fontSize:'0.82rem' }}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────

function Loader({ text='Analyzing…' }:{text?:string}) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.75rem', padding:'3rem', color:MUTED }}>
      <div style={{ width:20,height:20,border:`2px solid ${INDIGO}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.7s linear infinite' }} />
      {text}
    </div>
  );
}
function ScoreRing({ score, color, size=110 }:{score:number;color:string;size?:number}) {
  const r=(size-14)/2, c=2*Math.PI*r, d=(score/100)*c;
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={9} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={9} strokeDasharray={`${d} ${c-d}`} strokeLinecap="round" style={{ transition:'stroke-dasharray 1s ease',filter:`drop-shadow(0 0 6px ${color}88)` }} />
    </svg>
  );
}
function Bar({ value, color, height=6 }:{value:number;color:string;height?:number}) {
  return <div style={{ background:'var(--border)',borderRadius:99,height,overflow:'hidden' }}><div style={{ width:`${Math.min(value,100)}%`,height:'100%',background:color,borderRadius:99,transition:'width 1s ease' }} /></div>;
}
function Tag({ text, color }:{text:string;color:string}) {
  return <span style={{ display:'inline-block',padding:'2px 9px',borderRadius:99,fontSize:'0.71rem',fontWeight:600,background:`${color}22`,color,border:`1px solid ${color}44` }}>{text}</span>;
}
function ScCard({ label, value, color, icon }:{label:string;value:number;color:string;icon:string}) {
  return (
    <div style={{ background:CARD2,border:`1px solid ${color}25`,borderRadius:14,padding:'1rem',textAlign:'center' }}>
      <div style={{ fontSize:'1.3rem',marginBottom:3 }}>{icon}</div>
      <div style={{ fontSize:'0.67rem',color:MUTED,textTransform:'uppercase',letterSpacing:1,marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:'1.7rem',fontWeight:800,color,lineHeight:1 }}>{value}</div>
      <Bar value={value} color={color} height={3} />
    </div>
  );
}
function SpeechResultCards({ r }:{r:SpeechResult}) {
  const sc = (v:number) => v>=75?GREEN:v>=55?CYAN:v>=35?AMBER:RED;
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:'1.25rem' }}>
      {/* Score row */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:'0.5rem' }}>
        {[
          {label:'Fluency',       v:r.fluency_score,       c:sc(r.fluency_score)       },
          {label:'Pronunciation', v:r.pronunciation_score, c:sc(r.pronunciation_score) },
          {label:'Vocabulary',    v:r.vocabulary_score,    c:sc(r.vocabulary_score)    },
          {label:'Grammar',       v:r.grammar_score,       c:sc(r.grammar_score)       },
          {label:'Confidence',    v:r.confidence_score,    c:sc(r.confidence_score)    },
          {label:'Overall',       v:r.overall_score,       c:sc(r.overall_score)       },
        ].map(({label,v,c}) => (
          <div key={label} style={{ background:CARD,border:`1px solid ${c}25`,borderRadius:12,padding:'0.7rem',textAlign:'center' }}>
            <div style={{ fontSize:'0.62rem',color:MUTED,marginBottom:2 }}>{label}</div>
            <div style={{ fontSize:'1.4rem',fontWeight:800,color:c }}>{v}</div>
            <Bar value={v} color={c} height={3} />
          </div>
        ))}
      </div>

      {/* Grammar correction */}
      {r.grammar_error_count > 0 && (
        <div style={{ background:CARD,border:BORDER,borderRadius:14,padding:'1.1rem' }}>
          <div style={{ color:AMBER,fontWeight:700,fontSize:'0.82rem',marginBottom:'0.65rem' }}> Grammar Corrections ({r.grammar_error_count})</div>
          {r.grammar_errors.slice(0,4).map((e,i) => (
            <div key={i} style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginBottom:8,padding:'0.5rem',background:'var(--bg-surface)',borderRadius:8 }}>
              <div style={{ background:`${RED}0a`,border:`1px solid ${RED}25`,borderRadius:6,padding:'0.4rem 0.6rem' }}>
                <div style={{ fontSize:'0.63rem',color:RED,marginBottom:2 }}>ORIGINAL</div>
                <div style={{ color:MUTED,fontSize:'0.8rem' }}>{e.original}</div>
              </div>
              <div style={{ background:`${GREEN}0a`,border:`1px solid ${GREEN}25`,borderRadius:6,padding:'0.4rem 0.6rem' }}>
                <div style={{ fontSize:'0.63rem',color:GREEN,marginBottom:2 }}>CORRECTED</div>
                <div style={{ color:TEXT,fontSize:'0.8rem' }}>{e.corrected}</div>
              </div>
              <div style={{ gridColumn:'1/-1',fontSize:'0.72rem',color:DIM,fontStyle:'italic' }}>{e.rule}: {e.explanation}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filler words */}
      {r.filler_word_count > 0 && (
        <div style={{ background:CARD,border:BORDER,borderRadius:14,padding:'1.1rem' }}>
          <div style={{ color:PURPLE,fontWeight:700,fontSize:'0.82rem',marginBottom:'0.6rem' }}> Filler Words Detected</div>
          <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
            {r.filler_words.map(f => <Tag key={f.word} text={`"${f.word}" ×${f.count}`} color={PURPLE} />)}
          </div>
          <div style={{ color:MUTED,fontSize:'0.77rem',marginTop:6 }}>{r.fluency_feedback}</div>
        </div>
      )}

      {/* Advanced vocab */}
      {r.advanced_words_used.length > 0 && (
        <div style={{ background:`${GREEN}0a`,border:`1px solid ${GREEN}25`,borderRadius:12,padding:'0.85rem',display:'flex',gap:'0.75rem',alignItems:'flex-start' }}>
          <Star size={18} style={{ color: '#10b981', flexShrink: 0 }} />
          <div>
            <div style={{ color:GREEN,fontWeight:700,fontSize:'0.78rem',marginBottom:4 }}>Advanced Vocabulary Detected</div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:5 }}>{r.advanced_words_used.map(w => <Tag key={w} text={w} color={GREEN} />)}</div>
          </div>
        </div>
      )}

      {/* Strengths / Weaknesses */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem' }}>
        <div style={{ background:CARD,border:BORDER,borderRadius:14,padding:'1rem' }}>
          <div style={{ color:GREEN,fontWeight:700,fontSize:'0.78rem',marginBottom:'0.55rem' }}> Strengths</div>
          {r.strengths.map((s,i) => <div key={i} style={{ color:MUTED,fontSize:'0.8rem',marginBottom:3 }}>• {s}</div>)}
        </div>
        <div style={{ background:CARD,border:BORDER,borderRadius:14,padding:'1rem' }}>
          <div style={{ color:AMBER,fontWeight:700,fontSize:'0.78rem',marginBottom:'0.55rem' }}> Improve</div>
          {r.weaknesses.map((w,i) => <div key={i} style={{ color:MUTED,fontSize:'0.8rem',marginBottom:3 }}>• {w}</div>)}
        </div>
      </div>

      {/* Pronunciation tips */}
      {r.pronunciation_tips.length > 0 && (
        <div style={{ background:CARD,border:BORDER,borderRadius:14,padding:'1rem' }}>
          <div style={{ color:TEAL,fontWeight:700,fontSize:'0.78rem',marginBottom:'0.55rem' }}> Pronunciation Tips</div>
          {r.pronunciation_tips.map((t,i) => <div key={i} style={{ color:MUTED,fontSize:'0.8rem',marginBottom:3 }}>→ {t}</div>)}
        </div>
      )}

      {/* Practice suggestion */}
      {r.practice_suggestion && (
        <div style={{ background:`${INDIGO}0a`,border:`1px solid ${INDIGO}30`,borderRadius:12,padding:'0.85rem',display:'flex',gap:'0.75rem' }}>
          <span style={{ fontSize:'1.1rem' }}></span>
          <div>
            <div style={{ color:INDIGO,fontWeight:700,fontSize:'0.78rem',marginBottom:3 }}>Practice Suggestion</div>
            <div style={{ color:MUTED,fontSize:'0.82rem',lineHeight:1.6 }}>{r.practice_suggestion}</div>
          </div>
        </div>
      )}

      {r.twin_updated && (
        <div style={{ background:`${GREEN}0a`,border:`1px solid ${GREEN}30`,borderRadius:10,padding:'0.65rem 1rem',display:'flex',gap:'0.65rem',alignItems:'center' }}>
          <span></span><span style={{ color:GREEN,fontSize:'0.8rem',fontWeight:600 }}>Communication Twin updated.</span>
        </div>
      )}
    </div>
  );
}

// ── Section: Twin Dashboard ───────────────────────────────────────────────

function TwinSection() {
  const [data, setData] = useState<CommTwinData|null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get<CommTwinData>('/comm/twin').then(r=>setData(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  if (loading) return <Loader text="Loading Communication Twin…" />;
  if (!data) return null;
  const sc = (v:number)=>v>=75?GREEN:v>=55?CYAN:v>=35?AMBER:RED;
  const mainC = sc(data.overall_score);
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:'1.5rem' }}>
      {/* Hero */}
      <div className="ct-hero" style={{ background:`linear-gradient(135deg,${INDIGO}18,${TEAL}10)`,border:`1px solid ${INDIGO}35`,borderRadius:24,padding:'1.75rem',display:'grid',gridTemplateColumns:'auto 1fr',gap:'1.75rem',alignItems:'center' }}>
        <div style={{ position:'relative',display:'inline-flex',alignItems:'center',justifyContent:'center' }}>
          <ScoreRing score={data.overall_score} color={mainC} size={140} />
          <div style={{ position:'absolute',textAlign:'center' }}>
            <div style={{ fontSize:'2.3rem',fontWeight:900,color:TEXT,lineHeight:1 }}>{data.overall_score}</div>
            <div style={{ fontSize:'0.6rem',color:MUTED,letterSpacing:1 }}>COMM SCORE</div>
          </div>
        </div>
        <div>
          <div style={{ display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'0.5rem' }}>
            <span style={{ fontSize:'1.5rem',fontWeight:800,color:TEXT }}>Communication Twin</span>
            <span style={{ padding:'3px 12px',borderRadius:99,background:`${mainC}22`,color:mainC,border:`1px solid ${mainC}44`,fontSize:'0.78rem',fontWeight:700 }}>{data.level_label}</span>
          </div>
          <div style={{ color:MUTED,fontSize:'0.87rem',lineHeight:1.6,marginBottom:'0.85rem' }}>{data.twin_insight}</div>
          <div style={{ display:'flex',gap:'1.5rem',marginBottom:'0.85rem' }}>
            <div style={{ textAlign:'center' }}><div style={{ fontSize:'0.7rem',color:MUTED }}>Sessions</div><div style={{ fontWeight:800,color:TEXT,fontSize:'1.1rem' }}>{data.sessions_count}</div></div>
            <div style={{ textAlign:'center' }}><div style={{ fontSize:'0.7rem',color:MUTED }}>Words Reviewed</div><div style={{ fontWeight:800,color:TEXT,fontSize:'1.1rem' }}>{data.words_reviewed}</div></div>
            <div style={{ textAlign:'center' }}><div style={{ fontSize:'0.7rem',color:MUTED }}>Weekly Growth</div><div style={{ fontWeight:800,color:GREEN,fontSize:'1.1rem' }}>+{data.weekly_growth}</div></div>
            <div style={{ textAlign:'center' }}><div style={{ fontSize:'0.7rem',color:MUTED }}>Monthly Growth</div><div style={{ fontWeight:800,color:CYAN,fontSize:'1.1rem' }}>+{data.monthly_growth}</div></div>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'0.5rem' }}>
            <ScCard label="Fluency"       value={data.fluency_score}       color={sc(data.fluency_score)}       icon="" />
            <ScCard label="Pronunciation" value={data.pronunciation_score}  color={sc(data.pronunciation_score)} icon="" />
            <ScCard label="Vocabulary"    value={data.vocabulary_score}     color={sc(data.vocabulary_score)}    icon="" />
            <ScCard label="Grammar"       value={data.grammar_score}        color={sc(data.grammar_score)}       icon=""  />
            <ScCard label="Confidence"    value={data.confidence_score}     color={sc(data.confidence_score)}    icon="" />
          </div>
        </div>
      </div>

      {/* Predictions */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1rem' }}>
        {(['30d','90d','180d'] as const).map((k,i) => {
          const p=data.predictions[k];
          if (!p) return null;
          const label = k==='30d'?'30 Days':k==='90d'?'90 Days':'180 Days';
          const color = [CYAN,INDIGO,GREEN][i];
          return (
            <div key={k} style={{ background:CARD,border:`1px solid ${color}25`,borderRadius:18,padding:'1.25rem' }}>
              <div style={{ color,fontWeight:800,marginBottom:'0.65rem' }}>{label} Ahead</div>
              <div style={{ fontSize:'2rem',fontWeight:900,color,marginBottom:'0.5rem' }}>{p.overall_score}</div>
              <Tag text={p.level_label} color={color} />
              <div style={{ color:MUTED,fontSize:'0.78rem',marginTop:'0.6rem',lineHeight:1.5 }}>{p.forecast}</div>
              <div style={{ display:'flex',flexDirection:'column',gap:4,marginTop:'0.65rem' }}>
                {[{l:'Fluency',v:p.fluency},{l:'Confidence',v:p.confidence},{l:'Vocabulary',v:p.vocabulary}].map(({l,v})=>(
                  <div key={l} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',gap:8 }}>
                    <span style={{ fontSize:'0.7rem',color:MUTED,width:70,flexShrink:0 }}>{l}</span>
                    <div style={{ flex:1 }}><Bar value={v} color={color} height={4} /></div>
                    <span style={{ fontSize:'0.7rem',fontWeight:700,color }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Score history */}
      {data.score_history.length >= 2 && (
        <div style={{ background:CARD,border:BORDER,borderRadius:18,padding:'1.5rem' }}>
          <div style={{ color:TEXT,fontWeight:700,marginBottom:'1rem' }}>Communication Twin Evolution</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data.score_history}>
              <defs>
                <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={TEAL} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={TEAL} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{fill:DIM,fontSize:10}} />
              <YAxis domain={[0,100]} tick={{fill:DIM,fontSize:10}} />
              <Tooltip contentStyle={{background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:8,color:TEXT,fontSize:12}} />
              <Area type="monotone" dataKey="overall" stroke={TEAL} strokeWidth={2} fill="url(#commGrad)" name="Overall" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent activity */}
      {data.recent_activities.length > 0 && (
        <div style={{ background:CARD,border:BORDER,borderRadius:16,padding:'1.25rem' }}>
          <div style={{ color:TEXT,fontWeight:700,marginBottom:'0.85rem' }}>Recent Activity</div>
          {data.recent_activities.slice(0,5).map((a,i) => (
            <div key={i} style={{ display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.5rem 0',borderBottom:i<4?'1px solid var(--border-subtle)':'none' }}>
              <span style={{ fontSize:'1rem' }}>{String(a.type)==='image_challenge'?'':String(a.type)==='vocabulary'?'':String(a.type)==='grammar_correction'?'':''}</span>
              <div style={{ flex:1 }}>
                <div style={{ color:TEXT,fontSize:'0.8rem',fontWeight:600,textTransform:'capitalize' }}>{String(a.type).replace('_',' ')}</div>
                <div style={{ color:DIM,fontSize:'0.73rem' }}>{String(a.snippet||'')} · {String(a.date||'')}</div>
              </div>
              <span style={{ fontWeight:700,color:Number(a.overall||0)>=70?GREEN:AMBER,fontSize:'0.85rem' }}>{Number(a.overall||0)}</span>
            </div>
          ))}
        </div>
      )}

      {data.sessions_count === 0 && (
        <div style={{ background:`${AMBER}0a`,border:`1px solid ${AMBER}30`,borderRadius:16,padding:'1.25rem',display:'flex',gap:'1rem' }}>
          <span style={{ fontSize:'1.5rem' }}></span>
          <div>
            <div style={{ color:AMBER,fontWeight:700,marginBottom:4 }}>Your Communication Twin is waiting to learn</div>
            <div style={{ color:MUTED,fontSize:'0.83rem',lineHeight:1.6 }}>Complete a speaking task, image challenge, grammar check, or vocabulary drill. Every activity evolves your twin and builds a personalized improvement profile.</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section: Image Challenge ──────────────────────────────────────────────

function ImageSection() {
  const [difficulty, setDifficulty] = useState<'Easy'|'Medium'|'Hard'>('Easy');
  const [challenge, setChallenge] = useState<ImageChallenge|null>(null);
  const [result, setResult] = useState<ImageEvalResult|null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  async function getChallenge() {
    setLoading(true); setResult(null); setImgLoaded(false);
    try { const r=await api.get<ImageChallenge>(`/comm/image-challenge?difficulty=${difficulty}`); setChallenge(r.data); }
    finally { setLoading(false); }
  }
  async function evaluate(transcript: string) {
    if (!challenge||!transcript.trim()) return;
    setAnalyzing(true); setResult(null);
    try {
      const r=await api.post<ImageEvalResult>('/comm/image-challenge/evaluate',{
        challenge_id:challenge.challenge_id,
        transcript,
        image_context:challenge.topic,
      });
      setResult(r.data);
    } finally { setAnalyzing(false); }
  }

  const diffColor = (d:string)=>d==='Easy'?GREEN:d==='Medium'?AMBER:RED;
  const sc = (v:number)=>v>=75?GREEN:v>=55?CYAN:v>=35?AMBER:RED;

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:'1.5rem' }}>
      {/* Controls */}
      <div style={{ background:CARD,border:BORDER,borderRadius:18,padding:'1.25rem',display:'flex',gap:'1rem',alignItems:'flex-end',flexWrap:'wrap' }}>
        <div>
          <div style={{ color:MUTED,fontSize:'0.73rem',marginBottom:5 }}>Difficulty</div>
          <div style={{ display:'flex',gap:6 }}>
            {(['Easy','Medium','Hard'] as const).map(d=>(
              <button key={d} onClick={()=>setDifficulty(d)}
                style={{ padding:'0.38rem 0.85rem',borderRadius:7,border:`1px solid ${difficulty===d?diffColor(d):'var(--border)'}`,background:difficulty===d?`${diffColor(d)}20`:'transparent',color:difficulty===d?diffColor(d):MUTED,cursor:'pointer',fontSize:'0.8rem',fontWeight:600 }}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <button onClick={getChallenge} disabled={loading}
          style={{ padding:'0.6rem 1.75rem',background:`linear-gradient(135deg,${TEAL},${CYAN})`,border:'none',borderRadius:10,color:'#fff',fontWeight:700,cursor:'pointer' }}>
          {loading?'Loading…':'Get Image Challenge'}
        </button>
      </div>

      {loading && <Loader />}

      {challenge && !loading && (
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem' }}>
          {/* Image + task */}
          <div style={{ display:'flex',flexDirection:'column',gap:'1rem' }}>
            <div style={{ background:CARD,border:BORDER,borderRadius:16,overflow:'hidden' }}>
              {!imgLoaded && <div style={{ height:260,display:'flex',alignItems:'center',justifyContent:'center',color:MUTED }}>Loading image…</div>}
              <img src={challenge.image_url} alt={challenge.topic} onLoad={()=>setImgLoaded(true)}
                style={{ width:'100%',display:imgLoaded?'block':'none',height:260,objectFit:'cover' }} />
              <div style={{ padding:'1rem' }}>
                <div style={{ display:'flex',gap:6,marginBottom:6 }}>
                  <Tag text={challenge.topic} color={TEAL} />
                  <Tag text={challenge.difficulty} color={diffColor(challenge.difficulty)} />
                </div>
                <div style={{ color:TEXT,fontSize:'0.88rem',lineHeight:1.6,marginBottom:6 }}>{challenge.task}</div>
                <div style={{ color:INDIGO,fontSize:'0.8rem',fontStyle:'italic' }}>Story prompt: {challenge.story_prompt}</div>
              </div>
            </div>
          </div>
          {/* Recording */}
          <div>
            <div style={{ background:CARD,border:BORDER,borderRadius:16,padding:'1.25rem' }}>
              <div style={{ color:TEXT,fontWeight:700,marginBottom:'0.5rem' }}>Your Description</div>
              <div style={{ color:MUTED,fontSize:'0.8rem',marginBottom:'0.85rem' }}>Record or type your description. Be detailed — describe objects, mood, colors, story.</div>
              <VoiceRecorder onTranscript={evaluate} placeholder="Describe what you observe in this image in detail. Use descriptive language…" />
            </div>
          </div>
        </div>
      )}

      {analyzing && <Loader text="AI is evaluating your description…" />}

      {result && (
        <div style={{ display:'flex',flexDirection:'column',gap:'1.25rem' }}>
          {/* Accuracy scores */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1rem' }}>
            {[
              {label:'Description Accuracy', v:result.description_accuracy,  color:sc(result.description_accuracy)  },
              {label:'Observation Score',     v:result.observation_score,     color:sc(result.observation_score)     },
              {label:'Communication Clarity', v:result.communication_clarity, color:sc(result.communication_clarity) },
            ].map(({label,v,color})=>(
              <div key={label} style={{ background:CARD,border:BORDER,borderRadius:14,padding:'1.1rem',textAlign:'center' }}>
                <div style={{ fontSize:'0.7rem',color:MUTED,textTransform:'uppercase',letterSpacing:1 }}>{label}</div>
                <div style={{ fontSize:'2.2rem',fontWeight:900,color,margin:'4px 0' }}>{v}%</div>
                <Bar value={v} color={color} height={4} />
              </div>
            ))}
          </div>

          {/* Elements */}
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem' }}>
            <div style={{ background:CARD,border:BORDER,borderRadius:14,padding:'1rem' }}>
              <div style={{ color:GREEN,fontWeight:700,fontSize:'0.8rem',marginBottom:'0.55rem' }}> Elements Described</div>
              <div style={{ display:'flex',flexWrap:'wrap',gap:5 }}>{result.elements_mentioned.map(e=><Tag key={e} text={e} color={GREEN}/>)}</div>
            </div>
            <div style={{ background:CARD,border:BORDER,borderRadius:14,padding:'1rem' }}>
              <div style={{ color:RED,fontWeight:700,fontSize:'0.8rem',marginBottom:'0.55rem' }}> Elements Missed</div>
              <div style={{ display:'flex',flexWrap:'wrap',gap:5 }}>{result.elements_missed.map(e=><Tag key={e} text={e} color={RED}/>)}</div>
            </div>
          </div>

          {/* AI reconstruction */}
          <div style={{ background:`${PURPLE}0a`,border:`1px solid ${PURPLE}30`,borderRadius:14,padding:'1.1rem' }}>
            <div style={{ color:PURPLE,fontWeight:700,fontSize:'0.82rem',marginBottom:6 }}> AI Interpretation of Your Description</div>
            <div style={{ color:MUTED,fontSize:'0.84rem',lineHeight:1.7,fontStyle:'italic' }}>"{result.ai_reconstruction_description}"</div>
          </div>

          <div style={{ background:`${CYAN}0a`,border:`1px solid ${CYAN}25`,borderRadius:12,padding:'0.85rem',color:MUTED,fontSize:'0.83rem' }}>{result.feedback}</div>

          {/* Full speech analysis */}
          <SpeechResultCards r={result.speech_analysis} />
        </div>
      )}
    </div>
  );
}

// ── Section: Speaking Tasks ───────────────────────────────────────────────

function TasksSection() {
  const TYPES = [{id:'concept',label:'Explain a Concept',icon:''},{id:'discussion',label:'Opinion Discussion',icon:''},{id:'intro',label:'Personal Intro',icon:''},{id:'story',label:'Tell a Story',icon:''}];
  const [taskType, setTaskType] = useState('discussion');
  const [task, setTask] = useState<SpeakingTask|null>(null);
  const [result, setResult] = useState<SpeechResult|null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  async function getTask() {
    setLoading(true); setResult(null);
    try { const r=await api.get<SpeakingTask>(`/comm/speaking-task?task_type=${taskType}`); setTask(r.data); }
    finally { setLoading(false); }
  }
  async function evaluate(transcript: string) {
    if (!task||!transcript.trim()) return;
    setAnalyzing(true); setResult(null);
    try {
      const r=await api.post<SpeechResult>('/comm/analyze',{transcript,activity_type:taskType,context:task.prompt});
      setResult(r.data);
    } finally { setAnalyzing(false); }
  }

  const diffColor=(d:string)=>d==='Easy'?GREEN:d==='Medium'?AMBER:RED;

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:'1.5rem' }}>
      {/* Type selector */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.6rem' }}>
        {TYPES.map(t=>(
          <button key={t.id} onClick={()=>setTaskType(t.id)}
            style={{ padding:'0.75rem',borderRadius:12,border:`1px solid ${taskType===t.id?INDIGO:'var(--border)'}`,background:taskType===t.id?`${INDIGO}18`:CARD,color:taskType===t.id?TEXT:MUTED,cursor:'pointer',fontSize:'0.83rem',fontWeight:taskType===t.id?700:400,display:'flex',flexDirection:'column',alignItems:'center',gap:4 }}>
            <span style={{ fontSize:'1.3rem' }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div style={{ display:'flex',gap:'1rem',alignItems:'center' }}>
        <button onClick={getTask} disabled={loading}
          style={{ padding:'0.6rem 1.75rem',background:`linear-gradient(135deg,${INDIGO},${PURPLE})`,border:'none',borderRadius:10,color:'#fff',fontWeight:700,cursor:'pointer' }}>
          {loading?'Loading…':'Get Speaking Task'}
        </button>
      </div>

      {loading && <Loader />}

      {task && (
        <div style={{ display:'flex',flexDirection:'column',gap:'1.25rem' }}>
          {/* Task card */}
          <div style={{ background:CARD,border:BORDER,borderRadius:18,padding:'1.5rem' }}>
            <div style={{ display:'flex',gap:'0.75rem',alignItems:'flex-start',marginBottom:'0.75rem' }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex',gap:8,marginBottom:6 }}>
                  <Tag text={task.task_type} color={INDIGO} />
                  <Tag text={task.difficulty} color={diffColor(task.difficulty)} />
                  <Tag text={task.time_suggestion} color={TEAL} />
                </div>
                <div style={{ color:TEXT,fontWeight:800,fontSize:'1.1rem',marginBottom:4 }}>{task.prompt}</div>
                <div style={{ color:MUTED,fontSize:'0.87rem',lineHeight:1.6 }}>{task.sub_prompt}</div>
              </div>
            </div>
            <div style={{ background:'var(--bg-surface)',borderRadius:10,padding:'0.85rem' }}>
              <div style={{ color:CYAN,fontWeight:700,fontSize:'0.75rem',marginBottom:6 }}>TIPS</div>
              {task.tips.map((tip,i)=><div key={i} style={{ color:MUTED,fontSize:'0.8rem',marginBottom:3 }}>• {tip}</div>)}
            </div>
          </div>

          {/* Voice recorder */}
          <div style={{ background:CARD,border:BORDER,borderRadius:16,padding:'1.25rem' }}>
            <div style={{ color:TEXT,fontWeight:700,marginBottom:'0.5rem' }}>Your Response</div>
            <div style={{ color:MUTED,fontSize:'0.8rem',marginBottom:'0.85rem' }}>Speak for at least {task.time_suggestion}. Be confident and clear.</div>
            <VoiceRecorder onTranscript={evaluate} placeholder={`Respond to: ${task.prompt}`} />
          </div>
        </div>
      )}

      {analyzing && <Loader text="AI is analyzing your speech…" />}
      {result && <SpeechResultCards r={result} />}
    </div>
  );
}

// ── Section: Grammar Lab ──────────────────────────────────────────────────

function GrammarSection() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<GrammarResult|null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    if (!text.trim()) return;
    setLoading(true); setResult(null);
    try { const r=await api.post<GrammarResult>('/comm/grammar/correct',{text}); setResult(r.data); }
    finally { setLoading(false); }
  }

  const gradeColor=(g:string)=>g==='A'?GREEN:g==='B'?CYAN:g==='C'?AMBER:RED;
  const sc=(v:number)=>v>=75?GREEN:v>=55?CYAN:v>=35?AMBER:RED;

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:'1.5rem' }}>
      <div style={{ background:CARD,border:BORDER,borderRadius:18,padding:'1.5rem' }}>
        <div style={{ color:TEXT,fontWeight:700,marginBottom:'0.75rem' }}>Grammar Analysis Engine</div>
        <div style={{ color:MUTED,fontSize:'0.82rem',marginBottom:'0.85rem' }}>Type or paste any text. The AI will detect all grammar errors, show corrections, and explain every rule.</div>
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={7}
          placeholder="Type a sentence, paragraph, or your answer to an interview question…"
          style={{ width:'100%',background:'var(--bg-elevated)',border:BORDER,borderRadius:12,padding:'0.85rem 1rem',color:'var(--text-h)',fontSize:'0.87rem',resize:'vertical',boxSizing:'border-box',lineHeight:1.65 }} />
        <button onClick={analyze} disabled={loading||!text.trim()}
          style={{ marginTop:'0.75rem',width:'100%',padding:'0.7rem',background:loading||!text.trim()?DIM:`linear-gradient(135deg,${AMBER},${PINK})`,border:'none',borderRadius:10,color:'#fff',fontWeight:700,cursor:'pointer' }}>
          {loading?'Analyzing…':' Analyze Grammar'}
        </button>
      </div>

      {loading && <Loader text="Checking grammar…" />}

      {result && (
        <div style={{ display:'flex',flexDirection:'column',gap:'1.25rem' }}>
          {/* Score header */}
          <div style={{ display:'grid',gridTemplateColumns:'auto 1fr auto',gap:'1.5rem',background:CARD,border:BORDER,borderRadius:16,padding:'1.25rem',alignItems:'center' }}>
            <div style={{ position:'relative',display:'inline-flex',alignItems:'center',justifyContent:'center' }}>
              <ScoreRing score={result.score} color={sc(result.score)} size={90} />
              <div style={{ position:'absolute',textAlign:'center' }}>
                <div style={{ fontSize:'1.25rem',fontWeight:900,color:TEXT }}>{result.score}</div>
              </div>
            </div>
            <div>
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:4 }}>
                <span style={{ fontSize:'1.4rem',fontWeight:800,color:gradeColor(result.grade) }}>Grade {result.grade}</span>
                <Tag text={`${result.errors.length} errors found`} color={result.errors.length===0?GREEN:result.errors.length<3?AMBER:RED} />
              </div>
              <div style={{ color:MUTED,fontSize:'0.85rem' }}>{result.summary}</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'0.7rem',color:MUTED,marginBottom:3 }}>Errors</div>
              <div style={{ fontSize:'2rem',fontWeight:900,color:result.errors.length===0?GREEN:RED }}>{result.errors.length}</div>
            </div>
          </div>

          {/* Corrected text */}
          {result.corrected_text !== result.original_text && (
            <div style={{ background:CARD,border:BORDER,borderRadius:14,padding:'1.1rem' }}>
              <div style={{ color:GREEN,fontWeight:700,fontSize:'0.82rem',marginBottom:8 }}> Corrected Version</div>
              <div style={{ background:`${GREEN}08`,border:`1px solid ${GREEN}25`,borderRadius:8,padding:'0.75rem',color:TEXT,fontSize:'0.87rem',lineHeight:1.7 }}>{result.corrected_text}</div>
            </div>
          )}

          {result.errors.length===0 ? (
            <div style={{ background:`${GREEN}0a`,border:`1px solid ${GREEN}30`,borderRadius:12,padding:'1rem',textAlign:'center',color:GREEN,fontWeight:700 }}> Perfect grammar! No errors detected.</div>
          ) : (
            <div style={{ background:CARD,border:BORDER,borderRadius:14,padding:'1.1rem' }}>
              <div style={{ color:TEXT,fontWeight:700,marginBottom:'1rem' }}>Error Breakdown</div>
              {result.errors.map((e,i)=>(
                <div key={i} style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginBottom:10,padding:'0.65rem',background:'var(--bg-surface)',borderRadius:10 }}>
                  <div style={{ background:`${RED}0a`,border:`1px solid ${RED}25`,borderRadius:7,padding:'0.5rem 0.65rem' }}>
                    <div style={{ fontSize:'0.62rem',color:RED,marginBottom:2,textTransform:'uppercase' }}>Wrong</div>
                    <div style={{ color:MUTED,fontSize:'0.82rem' }}>{e.original}</div>
                  </div>
                  <div style={{ background:`${GREEN}0a`,border:`1px solid ${GREEN}25`,borderRadius:7,padding:'0.5rem 0.65rem' }}>
                    <div style={{ fontSize:'0.62rem',color:GREEN,marginBottom:2,textTransform:'uppercase' }}>Correct</div>
                    <div style={{ color:TEXT,fontSize:'0.82rem' }}>{e.corrected}</div>
                  </div>
                  <div style={{ gridColumn:'1/-1',fontSize:'0.73rem',color:DIM }}>
                    <strong style={{ color:AMBER }}>{e.rule}</strong>: {e.explanation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section: Vocabulary ───────────────────────────────────────────────────

function VocabSection() {
  const [data, setData] = useState<DailyVocab|null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string|null>(null);
  useEffect(() => {
    api.get<DailyVocab>('/comm/vocabulary/daily').then(r=>setData(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  if (loading) return <Loader text="Generating today's vocabulary…" />;
  if (!data) return null;

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:'1.25rem' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
        <div>
          <div style={{ color:TEXT,fontWeight:800,fontSize:'1.1rem' }}>Daily Vocabulary</div>
          <div style={{ color:MUTED,fontSize:'0.8rem' }}>Theme: <span style={{ color:CYAN }}>{data.theme}</span> · Level: <span style={{ color:AMBER }}>{data.level}</span> · {data.date}</div>
        </div>
        <Tag text={`${data.words.length} words today`} color={INDIGO} />
      </div>

      {data.words.map((w,i)=>{
        const open = expanded===w.word;
        const colors=[CYAN,INDIGO,PURPLE,TEAL,PINK];
        const c=colors[i%colors.length];
        return (
          <div key={w.word} style={{ background:CARD,border:`1px solid ${c}25`,borderRadius:18,overflow:'hidden' }}>
            <div onClick={()=>setExpanded(open?null:w.word)} style={{ padding:'1.1rem 1.25rem',cursor:'pointer',display:'flex',alignItems:'center',gap:'0.75rem' }}>
              <div style={{ width:36,height:36,borderRadius:10,background:`${c}22`,border:`1px solid ${c}44`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,color:c,fontSize:'0.88rem',flexShrink:0 }}>{i+1}</div>
              <div style={{ flex:1 }}>
                <div style={{ color:TEXT,fontWeight:800,fontSize:'1.05rem' }}>{w.word}</div>
                <div style={{ color:MUTED,fontSize:'0.8rem' }}>{w.meaning}</div>
              </div>
              <div style={{ display:'flex',gap:5 }}>
                <Tag text={w.difficulty} color={c} />
              </div>
              <span style={{ color:MUTED,fontSize:'0.7rem' }}>{open?'▲':'▼'}</span>
            </div>
            {open && (
              <div style={{ padding:'1rem 1.25rem',borderTop:'1px solid var(--border-subtle)',display:'flex',flexDirection:'column',gap:'0.85rem' }}>
                {/* Synonyms / Antonyms */}
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem' }}>
                  <div style={{ background:'var(--bg-surface)',borderRadius:10,padding:'0.75rem' }}>
                    <div style={{ fontSize:'0.7rem',color:GREEN,fontWeight:700,marginBottom:5 }}>SYNONYMS</div>
                    <div style={{ display:'flex',flexWrap:'wrap',gap:4 }}>{w.synonyms.map(s=><Tag key={s} text={s} color={GREEN}/>)}</div>
                  </div>
                  <div style={{ background:'var(--bg-surface)',borderRadius:10,padding:'0.75rem' }}>
                    <div style={{ fontSize:'0.7rem',color:RED,fontWeight:700,marginBottom:5 }}>ANTONYMS</div>
                    <div style={{ display:'flex',flexWrap:'wrap',gap:4 }}>{w.antonyms.map(a=><Tag key={a} text={a} color={RED}/>)}</div>
                  </div>
                </div>
                {/* Example sentence */}
                <div style={{ background:`${c}08`,border:`1px solid ${c}25`,borderRadius:10,padding:'0.75rem' }}>
                  <div style={{ fontSize:'0.68rem',color:c,fontWeight:700,marginBottom:3 }}>EXAMPLE SENTENCE</div>
                  <div style={{ color:TEXT,fontSize:'0.87rem',fontStyle:'italic',lineHeight:1.6 }}>"{w.example_sentence}"</div>
                </div>
                {/* Usage tips */}
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem' }}>
                  <div style={{ background:'var(--bg-surface)',borderRadius:10,padding:'0.75rem' }}>
                    <div style={{ fontSize:'0.68rem',color:AMBER,fontWeight:700,marginBottom:3 }}>SPEAKING USAGE</div>
                    <div style={{ color:MUTED,fontSize:'0.8rem',lineHeight:1.55 }}>{w.interview_usage}</div>
                  </div>
                  <div style={{ background:'var(--bg-surface)',borderRadius:10,padding:'0.75rem' }}>
                    <div style={{ fontSize:'0.68rem',color:INDIGO,fontWeight:700,marginBottom:3 }}>PROFESSIONAL USAGE</div>
                    <div style={{ color:MUTED,fontSize:'0.8rem',lineHeight:1.55 }}>{w.professional_usage}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Section: Analytics ────────────────────────────────────────────────────

function AnalyticsSection() {
  const [data, setData] = useState<CommTwinData|null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    api.get<CommTwinData>('/comm/twin').then(r=>setData(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  },[]);
  if (loading) return <Loader />;
  if (!data) return null;

  const radarData = [
    {skill:'Fluency',       score:data.fluency_score,       target:100},
    {skill:'Pronunciation', score:data.pronunciation_score, target:100},
    {skill:'Vocabulary',    score:data.vocabulary_score,    target:100},
    {skill:'Grammar',       score:data.grammar_score,       target:100},
    {skill:'Confidence',    score:data.confidence_score,    target:100},
  ];
  const noHistory = data.score_history.length < 2;

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:'1.5rem' }}>
      {/* Summary stats */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.75rem' }}>
        {[
          {label:'Sessions',        v:String(data.sessions_count), c:CYAN  },
          {label:'Words Reviewed',  v:String(data.words_reviewed), c:GREEN },
          {label:'Weekly Growth',   v:`+${data.weekly_growth}`,    c:AMBER },
          {label:'Monthly Growth',  v:`+${data.monthly_growth}`,   c:INDIGO},
        ].map(({label,v,c})=>(
          <div key={label} style={{ background:CARD,border:BORDER,borderRadius:14,padding:'1rem',textAlign:'center' }}>
            <div style={{ fontSize:'0.7rem',color:MUTED,textTransform:'uppercase',letterSpacing:1 }}>{label}</div>
            <div style={{ color:c,fontWeight:800,fontSize:'1.2rem',marginTop:4 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Skill Radar */}
      <div style={{ background:CARD,border:BORDER,borderRadius:16,padding:'1.5rem' }}>
        <div style={{ color:TEXT,fontWeight:700,marginBottom:'1rem' }}>Communication Skills Radar</div>
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="skill" tick={{fill:DIM,fontSize:10}} />
            <Radar name="Target"  dataKey="target" stroke="rgba(148,163,184,0.3)" fill="rgba(148,163,184,0.04)" />
            <Radar name="Current" dataKey="score"  stroke={TEAL}         fill={`${TEAL}20`} />
            <Legend wrapperStyle={{color:MUTED,fontSize:11}} />
            <Tooltip contentStyle={{background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:8,color:TEXT,fontSize:12}} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {noHistory ? (
        <div style={{ background:`${AMBER}0a`,border:`1px solid ${AMBER}30`,borderRadius:14,padding:'2rem',textAlign:'center' }}>
          <div style={{ fontSize:'2rem',marginBottom:8 }}></div>
          <div style={{ color:AMBER,fontWeight:700,marginBottom:6 }}>No history yet</div>
          <div style={{ color:MUTED,fontSize:'0.85rem' }}>Complete speaking activities to generate your communication growth chart.</div>
        </div>
      ) : (
        <>
          <div style={{ background:CARD,border:BORDER,borderRadius:16,padding:'1.5rem' }}>
            <div style={{ color:TEXT,fontWeight:700,marginBottom:'1rem' }}>Overall Score Timeline</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.score_history}>
                <defs>
                  <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={TEAL} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={TEAL} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{fill:DIM,fontSize:10}} />
                <YAxis domain={[0,100]} tick={{fill:DIM,fontSize:10}} />
                <Tooltip contentStyle={{background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:8,color:TEXT,fontSize:12}} />
                <Area type="monotone" dataKey="overall" stroke={TEAL} strokeWidth={2} fill="url(#tealGrad)" name="Overall" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background:CARD,border:BORDER,borderRadius:16,padding:'1.5rem' }}>
            <div style={{ color:TEXT,fontWeight:700,marginBottom:'1rem' }}>Skill Breakdown Trend</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.score_history}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{fill:DIM,fontSize:10}} />
                <YAxis domain={[0,100]} tick={{fill:DIM,fontSize:10}} />
                <Tooltip contentStyle={{background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:8,color:TEXT,fontSize:12}} />
                <Legend wrapperStyle={{color:MUTED,fontSize:11}} />
                <Line type="monotone" dataKey="fluency"    stroke={CYAN}   strokeWidth={2} dot={false} name="Fluency"   />
                <Line type="monotone" dataKey="grammar"    stroke={GREEN}  strokeWidth={2} dot={false} name="Grammar"   />
                <Line type="monotone" dataKey="vocab"      stroke={AMBER}  strokeWidth={2} dot={false} name="Vocabulary"/>
                <Line type="monotone" dataKey="confidence" stroke={PURPLE} strokeWidth={2} dot={false} name="Confidence"/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ── Section: AI Coach ─────────────────────────────────────────────────────

function CoachSection() {
  const [data, setData] = useState<CoachData|null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    api.get<CoachData>('/comm/coach').then(r=>setData(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  },[]);
  if (loading) return <Loader text="Generating your personalized practice plan…" />;
  if (!data) return null;
  const FOCUS_COLORS: Record<string,string> = { Fluency:CYAN, Grammar:GREEN, Vocabulary:AMBER, Confidence:PURPLE, Pronunciation:TEAL, Interviewing:INDIGO };

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:'1.5rem' }}>
      {/* Header */}
      <div className="ct-hero" style={{ background:`linear-gradient(135deg,${TEAL}18,${CYAN}10)`,border:`1px solid ${TEAL}35`,borderRadius:20,padding:'1.5rem',display:'flex',gap:'1.25rem',alignItems:'flex-start' }}>
        <span style={{ fontSize:'2.5rem' }}></span>
        <div>
          <div style={{ color:TEAL,fontWeight:700,fontSize:'0.78rem',textTransform:'uppercase',letterSpacing:1,marginBottom:4 }}>Your Personal AI Coach</div>
          <div style={{ color:TEXT,fontSize:'1rem',fontWeight:700,marginBottom:4 }}>Level: {data.level} · Focus: {data.focus_today}</div>
          <div style={{ color:MUTED,fontSize:'0.87rem',lineHeight:1.6,marginBottom:6 }}>{data.motivational_message}</div>
          <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
            <Tag text={`Weekly Goal: ${data.weekly_goal}`} color={GREEN} />
            <Tag text={`Earn: ${data.badge_to_earn}`} color={AMBER} />
          </div>
        </div>
      </div>

      {/* Daily plan */}
      <div style={{ background:CARD,border:BORDER,borderRadius:18,padding:'1.5rem' }}>
        <div style={{ color:TEXT,fontWeight:700,marginBottom:'1.25rem' }}>Today's Practice Plan</div>
        {data.daily_plan.map((activity,i)=>{
          const c = FOCUS_COLORS[activity.focus_area] || INDIGO;
          return (
            <div key={i} style={{ display:'flex',gap:'0.85rem',marginBottom:'0.85rem' }}>
              <div style={{ display:'flex',flexDirection:'column',alignItems:'center',flexShrink:0 }}>
                <div style={{ width:34,height:34,borderRadius:'50%',background:`${c}22`,border:`1px solid ${c}55`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:c,fontSize:'0.88rem' }}>{activity.order}</div>
                {i<data.daily_plan.length-1 && <div style={{ width:2,flex:1,background:'var(--border)',minHeight:16,margin:'3px 0' }} />}
              </div>
              <div style={{ flex:1,paddingBottom:i<data.daily_plan.length-1?'0.85rem':0 }}>
                <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:3 }}>
                  <span style={{ color:TEXT,fontWeight:700,fontSize:'0.9rem' }}>{activity.activity}</span>
                  <Tag text={activity.duration} color={c} />
                  <Tag text={activity.focus_area} color={c} />
                </div>
                <div style={{ color:MUTED,fontSize:'0.81rem',lineHeight:1.55 }}>{activity.description}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Achievement badge preview */}
      <div style={{ background:`${AMBER}0a`,border:`1px solid ${AMBER}35`,borderRadius:14,padding:'1.1rem',display:'flex',gap:'0.85rem',alignItems:'center' }}>
        <span style={{ fontSize:'2rem' }}></span>
        <div>
          <div style={{ color:AMBER,fontWeight:700,marginBottom:2 }}>{data.badge_to_earn}</div>
          <div style={{ color:MUTED,fontSize:'0.82rem' }}>Complete this week's goal to earn this badge and level up your Communication Twin.</div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function CommTwin() {
  const [activeTab, setActiveTab] = useState('twin');

  const renderSection = useCallback(() => {
    switch (activeTab) {
      case 'twin':      return <TwinSection />;
      case 'image':     return <ImageSection />;
      case 'tasks':     return <TasksSection />;
      case 'grammar':   return <GrammarSection />;
      case 'vocab':     return <VocabSection />;
      case 'analytics': return <AnalyticsSection />;
      case 'coach':     return <CoachSection />;
      default:          return null;
    }
  }, [activeTab]);

  return (
    <div className="ct-page" style={{ minHeight:'100svh',background:'transparent',color:TEXT,fontFamily:'var(--sans)' }}>
      <style>{`
        @keyframes spin  { to { transform:rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1;}50%{opacity:0.3;} }
        .ct-page * { scrollbar-width:thin; scrollbar-color:rgba(255,255,255,0.1) transparent; }
        .ct-page *::-webkit-scrollbar { width:4px; height:4px; }
        .ct-page *::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:99px; }
        input,textarea,select { outline:none; }
        input:focus,textarea:focus,select:focus { border-color:rgba(99,102,241,0.5)!important; }
        select option { background:#0d1117; color:#f1f5f9; }
        html[data-color-scheme="light"] .ct-page * { scrollbar-color:#CBD5E1 transparent; }
        html[data-color-scheme="light"] .ct-page *::-webkit-scrollbar-thumb { background:#CBD5E1; }
        html[data-color-scheme="light"] select option { background:#FFFFFF; color:#111827; }
        html[data-color-scheme="light"] .ct-header { background:rgba(255,255,255,0.97)!important; border-bottom:1px solid #E5E7EB!important; }
        html[data-color-scheme="light"] .ct-tabbar { background:rgba(255,255,255,0.95)!important; border-bottom:1px solid #E5E7EB!important; }
      `}</style>

      {/* Header */}
      <div className="ct-header" style={{ borderBottom:BORDER,padding:'0.9rem 1.5rem',display:'flex',alignItems:'center',gap:'1rem',background:'rgba(6,11,24,0.92)',backdropFilter:'blur(12px)',position:'sticky',top:0,zIndex:50 }}>
        <BackButton />
        <div>
          <div style={{ display:'flex',alignItems:'center',gap:'0.5rem' }}>
            <span style={{ fontSize:'1.3rem' }}></span>
            <span style={{ fontWeight:800,fontSize:'1.15rem',color:TEXT }}>Spoken English & Communication Twin</span>
          </div>
          <div style={{ color:MUTED,fontSize:'0.72rem' }}>AI-powered communication intelligence hub</div>
        </div>
        <div style={{ marginLeft:'auto' }}>
          <Link to="/dashboard" style={{ color:MUTED,fontSize:'0.8rem',textDecoration:'none' }}>← Dashboard</Link>
        </div>
      </div>

      {/* Tab bar */}
      <div className="ct-tabbar" style={{ overflowX:'auto',borderBottom:BORDER,background:'rgba(6,11,24,0.75)',backdropFilter:'blur(8px)',position:'sticky',top:62,zIndex:40 }}>
        <div style={{ display:'flex',minWidth:'max-content',padding:'0 1.5rem' }}>
          {TABS.map(tab=>{
            const active=activeTab===tab.id;
            return (
              <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
                style={{ padding:'0.8rem 1.1rem',background:'none',border:'none',borderBottom:active?`2px solid ${TEAL}`:'2px solid transparent',color:active?TEAL:MUTED,cursor:'pointer',fontSize:'0.78rem',fontWeight:active?700:400,display:'flex',alignItems:'center',gap:'0.35rem',whiteSpace:'nowrap',transition:'color 0.15s' }}>
                <span>{tab.icon}</span><span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:1100,margin:'0 auto',padding:'2rem 1.5rem 5rem' }}>
        {renderSection()}
      </div>
    </div>
  );
}

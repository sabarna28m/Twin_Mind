import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { type GamificationProgress } from '../utils/gamification';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import HumanVsTwinDashboard from '../components/HumanVsTwinDashboard';
import DecisionSimulator from '../components/DecisionSimulator';

/* ═══════════════════════════════════════════════════════════════════════
   DPT PROFILE — persisted in localStorage
═══════════════════════════════════════════════════════════════════════ */
const STORAGE_KEY = 'twinmind_dpt_v1';

interface DPTIdentity {
  bio: string; personalGoals: string[]; careerGoals: string[]; interests: string[];
  skills: string[]; values: string[]; motivations: string[]; aspirations: string[];
}
interface DPTCognitive {
  thinkingStyle: 'analytical' | 'practical' | 'creative' | 'strategic' | 'mixed';
  decisionStyle: string; riskTolerance: 'low' | 'medium' | 'high';
  failureResponse: string; stressResponse: string;
}
interface DPTCommunication {
  tone: 'formal' | 'casual' | 'mixed'; preferredLength: 'brief' | 'detailed' | 'mixed';
  primaryMotivation: string;
}
interface DPTMemory {
  id: string; type: 'semantic' | 'preference' | 'goal' | 'experience' | 'learning';
  content: string; date: string; category: string;
}
interface DPTProfile {
  version: 1; identity: DPTIdentity; cognitive: DPTCognitive;
  communication: DPTCommunication; memories: DPTMemory[];
  interview: { answers: Record<string, string> };
  createdAt: string; updatedAt: string;
}

const BLANK_PROFILE: DPTProfile = {
  version: 1,
  identity: { bio:'', personalGoals:[], careerGoals:[], interests:[], skills:[], values:[], motivations:[], aspirations:[] },
  cognitive: { thinkingStyle:'mixed', decisionStyle:'', riskTolerance:'medium', failureResponse:'', stressResponse:'' },
  communication: { tone:'mixed', preferredLength:'mixed', primaryMotivation:'' },
  memories: [], interview: { answers:{} },
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

function loadProfile(): DPTProfile {
  try { const r = localStorage.getItem(STORAGE_KEY); if (r) return { ...BLANK_PROFILE, ...JSON.parse(r) }; } catch {}
  return { ...BLANK_PROFILE };
}
function saveProfile(p: DPTProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...p, updatedAt: new Date().toISOString() }));
}

/* ═══════════════════════════════════════════════════════════════════════
   INTERVIEW QUESTIONS (unchanged logic)
═══════════════════════════════════════════════════════════════════════ */
interface IQ {
  id: string; q: string; type: 'choice' | 'text'; options?: string[];
  placeholder?: string; memType: DPTMemory['type']; category: string;
}
const INTERVIEW: IQ[] = [
  { id:'motivation',    q:'What motivates you most in your studies?',          type:'choice', memType:'semantic',  category:'Motivation',
    options:['Academic performance & grades','Career preparation & goals','Personal growth & self-improvement','Competition & recognition','Helping others & making an impact'] },
  { id:'career_goals',  q:'What are your top career goals?',                   type:'text',   memType:'goal',      category:'Career',       placeholder:'e.g. Become a software engineer, start my own business…' },
  { id:'failure',       q:'How do you respond to academic setbacks?',          type:'choice', memType:'semantic',  category:'Resilience',
    options:['Analyse what went wrong and adjust','Take a break then come back stronger','Push harder immediately','Seek guidance from others','Feel discouraged but recover gradually'] },
  { id:'learning_style',q:'What is your preferred way to learn something new?',type:'choice', memType:'preference',category:'Learning',
    options:['Reading & detailed notes','Practice & hands-on repetition','Watching videos & visual content','Quizzes, tests & active recall','Mixed — I adapt to the material'] },
  { id:'decision_style',q:'How do you make important decisions?',              type:'choice', memType:'semantic',  category:'Decision-Making',
    options:['Analyse all options thoroughly','Trust my instincts','Research extensively','Make a pros/cons list','Seek input from trusted people'] },
  { id:'thinking_style',q:'How would you describe your thinking style?',       type:'choice', memType:'semantic',  category:'Cognition',
    options:['Analytical — I rely on data and logic','Practical — I focus on real solutions','Creative — I think outside the box','Strategic — I plan for the big picture','Mixed — it depends on the situation'] },
  { id:'strengths',     q:'What are your key strengths?',                      type:'text',   memType:'semantic',  category:'Identity',     placeholder:'e.g. Strong logical thinking, quick learner, great communicator…' },
  { id:'challenges',    q:'What is your biggest academic or personal challenge?',type:'text',  memType:'experience',category:'Growth',       placeholder:'e.g. Procrastination, managing time, staying focused…' },
  { id:'interests',     q:'What fields or careers interest you most?',         type:'text',   memType:'preference',category:'Interests',    placeholder:'e.g. AI & machine learning, medicine, entrepreneurship…' },
  { id:'stress',        q:'How do you manage stress?',                         type:'choice', memType:'semantic',  category:'Wellness',
    options:['Exercise and physical activity','Continue working to push through','Talk to friends or family','Take structured breaks','Structured planning and organisation'] },
  { id:'life_goal',     q:'What is your most important long-term life goal?',  type:'text',   memType:'goal',      category:'Life Goals',   placeholder:'e.g. Financial freedom, making a positive impact, mastering my field…' },
  { id:'values',        q:'What values matter most to you?',                   type:'choice', memType:'semantic',  category:'Values',
    options:['Excellence & achievement','Integrity & honesty','Growth & learning','Relationships & community','Creativity & innovation'] },
];

/* ═══════════════════════════════════════════════════════════════════════
   API INTERFACES
═══════════════════════════════════════════════════════════════════════ */
interface HistoryPoint {
  date: string; overall_score: number; twin_intelligence_score: number;
  knowledge_growth: number; consistency_level: number; focus_quality: number;
  study_hours: number; notes_created: number; quiz_accuracy: number | null;
  focus_sessions: number; score_delta: number | null; ai_explanation: string;
}
interface CognitiveHeatmap {
  knowledge_areas: number; memory_strength: number; focus_stability: number;
  learning_speed: number; prediction_confidence: number;
}
interface EvolutionEvent { date: string; icon: string; description: string; }
interface FutureTwin {
  overall_score: number; consistency_score: number; wellness_score: number;
  academic_score: number; risk_level: 'low'|'medium'|'high';
  predicted_exam_score: number | null; motivational_message: string; tips: string[];
}
interface TwinState {
  overall_score: number; consistency_score: number; wellness_score: number; academic_score: number;
  risk_level: 'low'|'medium'|'high'; trend: 'improving'|'declining'|'stable';
  twin_age: number; data_points: number; strengths: string[]; areas_to_improve: string[];
  twin_intelligence_score: number; confidence_level: number; prediction_reliability: number;
  behavior_understanding: string; current_state_label: string; ai_insights: string[];
  cognitive_heatmap?: CognitiveHeatmap | null;
  future_twin?: FutureTwin | null;
  future_twin_60?: FutureTwin | null;
  future_twin_90?: FutureTwin | null;
  history?: HistoryPoint[];
  evolution_timeline?: EvolutionEvent[];
  twin_maturity_level?: number;
}
interface SubjectAnalysis {
  weakest: { subject: string; avg_score: number; recommended_daily_minutes: number } | null;
  strongest: { subject: string; avg_score: number } | null;
  focus_today: { subject: string; avg_score: number } | null;
}
interface BurnoutData { burnout_score: number; risk_level: 'low'|'medium'|'high' }
interface LearningEntry { study_hours: number; quiz_accuracy?: number | null; notes_created: number; focus_sessions: number; stress_level: number; assignment_completion_rate: number }
interface StreakStatus { streak_days: number; last_checkin: string | null }

/* ═══════════════════════════════════════════════════════════════════════
   FIDELITY CALCULATION (unchanged)
═══════════════════════════════════════════════════════════════════════ */
function computeFidelity(profile: DPTProfile, twin: TwinState | null, _s: SubjectAnalysis | null, _b: BurnoutData | null, learningData: LearningEntry[]) {
  const answered       = Object.keys(profile.interview.answers).length;
  const identityFid    = Math.min(98, Math.round(answered / INTERVIEW.length * 70 + (profile.identity.bio ? 15 : 0) + (profile.identity.careerGoals.length ? 13 : 0)));
  const behaviorFid    = Math.min(95, 22 + learningData.length * 2.5);
  const cognitiveFid   = profile.interview.answers.thinking_style ? Math.min(85, 55 + answered * 2) : 15;
  const personalityFid = twin ? Math.min(92, 45 + twin.data_points * 1.8) : 20;
  const commFid        = profile.interview.answers.motivation ? Math.min(88, 40 + answered * 3.5) : 12;
  const predFid        = twin?.prediction_reliability ?? 20;
  const overall        = Math.round((identityFid + behaviorFid + cognitiveFid + personalityFid + commFid + predFid) / 6);
  return { identityFid:Math.round(identityFid), behaviorFid:Math.round(behaviorFid), cognitiveFid:Math.round(cognitiveFid), personalityFid:Math.round(personalityFid), commFid:Math.round(commFid), predFid:Math.round(predFid), overall };
}

/* ═══════════════════════════════════════════════════════════════════════
   ── PREMIUM UI PRIMITIVES ──
═══════════════════════════════════════════════════════════════════════ */

function TwinAvatar({ size = 64, glow = '#6366f1' }: { size?: number; glow?: string }) {
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      {[1,2,3].map((_,i) => (
        <div key={i} style={{
          position:'absolute', inset:`${-(i+1)*9}px`, borderRadius:'50%',
          border:`1px solid ${glow}${['35','20','0c'][i]}`,
          animation:`breathe ${1.8+i*0.6}s ease-in-out infinite`, animationDelay:`${i*0.25}s`,
        }} />
      ))}
      <div style={{
        width:'100%', height:'100%', borderRadius:'50%',
        background:`radial-gradient(circle at 35% 35%, ${glow}55, ${glow}22, transparent)`,
        border:`2px solid ${glow}60`, display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:size*0.38, color:'#fff', fontWeight:900,
        boxShadow:`0 0 ${size*0.5}px ${glow}40, 0 0 ${size}px ${glow}18`,
        animation:'breathe 2.4s ease-in-out infinite',
      }}>◈</div>
    </div>
  );
}

function SectionHead({ icon, title, desc, color='#6366f1', badge }: { icon:string; title:string; desc:string; color?:string; badge?:string }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:'1rem', marginBottom:'1.5rem' }}>
      <div style={{ width:48, height:48, borderRadius:14, background:`${color}16`, border:`1px solid ${color}32`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', flexShrink:0 }}>{icon}</div>
      <div style={{ flex:1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.2rem' }}>
          <h3 style={{ margin:0, fontSize:'1.05rem', fontWeight:800, color: '#0f172a', letterSpacing:'-0.2px' }}>{title}</h3>
          {badge && <span style={{ fontSize:'0.55rem', fontWeight:800, letterSpacing:'0.08em', color, background:`${color}18`, border:`1px solid ${color}30`, padding:'0.12rem 0.5rem', borderRadius:99 }}>{badge}</span>}
        </div>
        <p style={{ margin:0, fontSize:'0.78rem', color: '#64748b', lineHeight:1.55 }}>{desc}</p>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, color, note }: { label:string; value:number; color:string; note?:string }) {
  return (
    <div style={{ marginBottom:'0.75rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.25rem' }}>
        <span className="dpt-score-label" style={{ fontSize:'0.78rem', color:'#E5E7EB', fontWeight:600 }}>{label}</span>
        <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
          {note && <span style={{ fontSize:'0.6rem', color: '#64748b' }}>{note}</span>}
          <span style={{ fontSize:'0.82rem', fontWeight:800, color }}>{value}</span>
        </div>
      </div>
      <div style={{ height:8, background: '#e2e8f0', borderRadius:99, overflow:'hidden' }}>
        <div className="score-bar-fill" style={{ width:`${value}%`, height:'100%', background:`linear-gradient(90deg,${color}aa,${color})`, borderRadius:99, boxShadow:`0 0 8px ${color}44`, transition:'width 1s cubic-bezier(0.16,1,0.3,1)' }} />
      </div>
    </div>
  );
}

function PredCard({ icon, label, prob, conf, color, riskLevel, trend }: { icon:string; label:string; prob:number; conf:number; color:string; riskLevel?:'low'|'medium'|'high'; trend?:'up'|'down'|'stable' }) {
  const rc = riskLevel==='high'?'#ef4444':riskLevel==='medium'?'#f59e0b':'#10b981';
  const ta = trend==='up'?'↑':trend==='down'?'↓':'→';
  const tc = trend==='up'?'#10b981':trend==='down'?'#ef4444':'#475569';
  return (
    <div className="glass-card glass-hover glass-babyblue" style={{ padding:'1.1rem', background:`${color}07`, border:`1px solid ${color}1e`, borderRadius:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.6rem' }}>
        <span style={{ fontSize:'1.2rem' }}>{icon}</span>
        <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap', justifyContent:'flex-end' }}>
          {riskLevel && <span style={{ fontSize:'0.54rem', fontWeight:800, color:rc, background:`${rc}14`, border:`1px solid ${rc}28`, padding:'0.1rem 0.38rem', borderRadius:99 }}>{riskLevel.toUpperCase()}</span>}
          <span className="dpt-conf-badge" style={{ fontSize:'0.54rem', fontWeight:700, color: '#64748b', background: '#f8f9fa', border: '1px solid #e2e8f0', padding:'0.1rem 0.38rem', borderRadius:99 }}>{conf}% conf</span>
        </div>
      </div>
      <p style={{ margin:'0 0 0.45rem', fontSize:'0.68rem', color: '#475569', lineHeight:1.4 }}>{label}</p>
      <div style={{ display:'flex', alignItems:'baseline', gap:'0.25rem', marginBottom:'0.45rem' }}>
        <span style={{ fontSize:'1.6rem', fontWeight:900, color, lineHeight:1 }}>{prob}</span>
        <span style={{ fontSize:'0.62rem', color: '#64748b' }}>%</span>
        {trend && <span style={{ fontSize:'0.9rem', color:tc, marginLeft:'auto' }}>{ta}</span>}
      </div>
      <div className="dpt-bar-track" style={{ height:4, background: '#f8f9fa', borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${prob}%`, background:`linear-gradient(90deg,${color}99,${color})`, borderRadius:99, transition:'width 1.2s cubic-bezier(0.16,1,0.3,1)' }} />
      </div>
    </div>
  );
}

function Chip({ label, color='#6366f1' }: { label:string; color?:string }) {
  return <span style={{ display:'inline-block', padding:'0.22rem 0.65rem', borderRadius:99, fontSize:'0.7rem', fontWeight:600, background:`${color}15`, border:`1px solid ${color}28`, color, marginRight:'0.35rem', marginBottom:'0.35rem' }}>{label}</span>;
}

function EmptyState({ twin, profile, subjects, learningData }: { twin:TwinState|null; profile:DPTProfile; subjects:SubjectAnalysis|null; learningData:LearningEntry[] }) {
  const answered = Object.keys(profile.interview.answers).length;
  const items = [
    { label:'Complete your identity interview', done: answered >= 6 },
    { label:'Set career & learning goals', done: profile.identity.careerGoals.length > 0 },
    { label:'Log your first study session', done: learningData.length > 0 },
    { label:'Complete a quiz or assessment', done: learningData.some(d => (d.quiz_accuracy ?? 0) > 0) },
    { label:'Study consistently (5+ sessions)', done: learningData.length >= 5 },
    { label:'Activate subject performance tracking', done: !!subjects?.strongest },
  ];
  const done = items.filter(i => i.done).length;
  return (
    <div style={{ ...C, padding:'1.75rem', background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.18)' }}>
      <SectionHead icon="" title="Your Twin is Still Learning" desc={`Complete ${items.length-done} more step${items.length-done!==1?'s':''} to fully activate your Digital Persona Twin.`} color="#6366f1" />
      <div style={{ display:'flex', flexDirection:'column', gap:'0.45rem', marginBottom:'1rem' }}>
        {items.map(item => (
          <div key={item.label} className="dpt-checklist-item" style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.6rem 0.85rem', background:`rgba(255,255,255,${item.done?'0.04':'0.02'})`, border:`1px solid ${item.done?'rgba(16,185,129,0.2)':'rgba(255,255,255,0.06)'}`, borderRadius:11 }}>
            <span style={{ fontSize:'0.95rem', flexShrink:0 }}>{item.done?'':''}</span>
            <span className={item.done ? 'dpt-todo-text dpt-todo-done' : 'dpt-todo-text'} style={{ fontSize:'0.8rem', color:item.done?'#34d399':'#94a3b8', fontWeight:item.done?700:500, textDecoration:item.done?'line-through':'none', opacity:item.done?0.75:1 }}>{item.label}</span>
          </div>
        ))}
      </div>
      <div className="dpt-bar-track" style={{ height:5, background: '#f8f9fa', borderRadius:99, overflow:'hidden' }}>
        <div style={{ width:`${(done/items.length)*100}%`, height:'100%', background:'linear-gradient(90deg,#6366f1,#10b981)', borderRadius:99, transition:'width 1s ease' }} />
      </div>
      <p style={{ margin:'0.4rem 0 0', fontSize:'0.68rem', color:'#334155', textAlign:'right' }}>{done}/{items.length} complete</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HERO SECTION
═══════════════════════════════════════════════════════════════════════ */
function HeroSection({ fid, twin, user, onNavigate }: {
  fid: ReturnType<typeof computeFidelity>; twin: TwinState|null;
  user: { full_name?:string } | null; onNavigate: (t:DPTTab) => void;
}) {
  const fc   = fid.overall>=80?'#10b981':fid.overall>=50?'#f59e0b':'#6366f1';
  const circ = 2*Math.PI*46;
  const models = [
    {label:'Identity',      v:fid.identityFid,    c:'#6366f1'},
    {label:'Behavior',      v:fid.behaviorFid,    c:'#06b6d4'},
    {label:'Cognitive',     v:fid.cognitiveFid,   c:'#8b5cf6'},
    {label:'Personality',   v:fid.personalityFid, c:'#f59e0b'},
    {label:'Communication', v:fid.commFid,         c:'#ec4899'},
    {label:'Prediction',    v:fid.predFid,         c:'#10b981'},
  ];
  const now = new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});

  return (
    <div className="dpt-hero" style={{
      position:'relative', overflow:'hidden', borderRadius:24,
      background:'linear-gradient(135deg,rgba(99,102,241,0.12) 0%,rgba(6,182,212,0.06) 50%,rgba(139,92,246,0.08) 100%)',
      border:'1px solid rgba(99,102,241,0.22)', padding:'2.5rem 2.5rem 2rem', marginBottom:'1.5rem',
      boxShadow:'0 0 0 1px rgba(99,102,241,0.07), 0 24px 64px rgba(0,0,0,0.5), 0 0 80px rgba(99,102,241,0.05)',
    }}>
      <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,0.08) 0%,transparent 65%)', top:-200, right:-100, pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,rgba(6,182,212,0.06) 0%,transparent 70%)', bottom:-100, left:100, pointerEvents:'none' }} />

      <div style={{ position:'relative', display:'grid', gridTemplateColumns:'1fr auto', gap:'2rem', alignItems:'flex-start' }}>
        {/* LEFT */}
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.85rem', marginBottom:'1rem', flexWrap:'wrap' }}>
            <TwinAvatar size={52} glow="#6366f1" />
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:'0.55rem', marginBottom:'0.2rem', flexWrap:'wrap' }}>
                <span className="dpt-badge-cyan" style={{ fontSize:'0.6rem', fontWeight:800, letterSpacing:'0.1em', color:'#00D4FF', background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.25)', padding:'0.14rem 0.55rem', borderRadius:99 }}>◈ DIGITAL PERSONA TWIN</span>
                <span style={{ fontSize:'0.58rem', fontWeight:800, color:'#10b981', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.28)', padding:'0.12rem 0.5rem', borderRadius:99, display:'flex', alignItems:'center', gap:'0.3rem' }}>
                  <span style={{ width:5,height:5,borderRadius:'50%',background:'#10b981',display:'inline-block',animation:'live-pulse 2s ease-in-out infinite' }} />LIVE
                </span>
              </div>
              <h1 style={{ margin:0, fontSize:'1.65rem', fontWeight:900, color: '#0f172a', letterSpacing:'-0.5px', lineHeight:1.15 }}>Your Digital Persona Twin</h1>
              <p style={{ margin:'0.1rem 0 0', fontSize:'0.7rem', color: '#64748b' }}>{user?.full_name??'Loading…'} · Updated {now} · {twin?.data_points??0} data points</p>
            </div>
          </div>

          <p style={{ margin:'0 0 1.25rem', fontSize:'0.84rem', color: '#64748b', lineHeight:1.7, maxWidth:540 }}>
            Your AI-powered digital replica continuously learns from your behavior, goals, performance, and decisions to provide personalised predictions, insights, and simulations.
          </p>

          {twin && (
            <div style={{ display:'flex', gap:'0.6rem', marginBottom:'1.4rem', flexWrap:'wrap' }}>
              {[
                {label:'Overall',     value:`${Math.round(twin.overall_score)}/100`,  color: '#0052cc'},
                {label:'Academic',    value:`${Math.round(twin.academic_score)}/100`, color:'#06b6d4'},
                {label:'Consistency', value:`${Math.round(twin.consistency_score)}%`, color:'#10b981'},
                {label:'Twin Age',    value:`${twin.twin_age}d`,                       color:'#f59e0b'},
                {label:'Trend',       value:twin.trend.charAt(0).toUpperCase()+twin.trend.slice(1), color:twin.trend==='improving'?'#10b981':twin.trend==='stable'?'#f59e0b':'#ef4444'},
              ].map(s=>(
                <div key={s.label} className="dpt-stat-card" style={{ padding:'0.45rem 0.8rem', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius:11 }}>
                  <p style={{ margin:0, fontSize:'0.54rem', fontWeight:700, color:'#334155', letterSpacing:'0.06em', textTransform:'uppercase' }}>{s.label}</p>
                  <p style={{ margin:'0.12rem 0 0', fontSize:'0.88rem', fontWeight:800, color:s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1.4rem' }}>
            <div style={{ display:'flex', gap:3 }}>
              {[0,0.15,0.3].map(d=><div key={d} style={{ width:4,height:4,borderRadius:'50%',background:'#6366f1',animation:'particle-float 1.4s ease-in-out infinite',animationDelay:`${d}s` }} />)}
            </div>
            <span style={{ fontSize:'0.67rem', color: '#64748b' }}>
              AI Activity: {twin?(twin.trend==='improving'?'Accelerating learning…':twin.trend==='stable'?'Maintaining stable patterns…':'Adapting to changes…'):'Initialising…'}
            </span>
          </div>

          <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap' }}>
            <button onClick={()=>onNavigate('intelligence')} style={{ padding:'0.65rem 1.35rem', borderRadius:12, background: '#0052cc', border:'none', color:'#fff', fontWeight:800, fontSize:'0.82rem', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 20px rgba(99,102,241,0.35)' }}>
              ◈ Ask My Twin
            </button>
            <button onClick={()=>onNavigate('overview')} className="dpt-btn-ghost" style={{ padding:'0.65rem 1.2rem', borderRadius:12, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.28)', color:'#818cf8', fontWeight:700, fontSize:'0.82rem', cursor:'pointer', fontFamily:'inherit' }}>
               Build My Twin
            </button>
            <Link to="/twin" className="dpt-link-btn" style={{ padding:'0.65rem 1.2rem', borderRadius:12, background: '#f8f9fa', border: '1px solid #e2e8f0', color: '#475569', fontWeight:600, fontSize:'0.82rem', textDecoration:'none', display:'flex', alignItems:'center', gap:'0.35rem' }}>
               Evolution Dashboard
            </Link>
          </div>
        </div>

        {/* RIGHT — Fidelity Gauge */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem', flexShrink:0, minWidth:190 }}>
          <div style={{ position:'relative', width:120, height:120 }}>
            <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform:'rotate(-90deg)' }}>
              <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" className="dpt-svg-track" />
              <circle cx="60" cy="60" r="46" fill="none" stroke={fc} strokeWidth="10"
                strokeDasharray={`${circ*fid.overall/100} ${circ*(1-fid.overall/100)}`}
                strokeLinecap="round" style={{ filter:`drop-shadow(0 0 8px ${fc}88)`, transition:'stroke-dasharray 1.5s cubic-bezier(0.16,1,0.3,1)' }} />
            </svg>
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:'1.75rem', fontWeight:900, color:fc, lineHeight:1 }}>{fid.overall}</span>
              <span style={{ fontSize:'0.56rem', fontWeight:700, color: '#64748b', letterSpacing:'0.05em' }}>FIDELITY</span>
            </div>
          </div>
          <span style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.06em', color:fc, padding:'0.16rem 0.65rem', background:`${fc}14`, border:`1px solid ${fc}28`, borderRadius:99 }}>
            {fid.overall>=80?'HIGH FIDELITY':fid.overall>=50?'DEVELOPING':'CALIBRATING'}
          </span>
          <div style={{ width:'100%' }}>
            {models.map(m=>(
              <div key={m.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.28rem' }}>
                <span style={{ fontSize:'0.62rem', color:'#334155', fontWeight:600, minWidth:68 }}>{m.label}</span>
                <div className="dpt-bar-track" style={{ flex:1, height:3, background: '#f8f9fa', borderRadius:99, margin:'0 0.4rem', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${m.v}%`, background:m.c, borderRadius:99, transition:'width 1.2s ease' }} />
                </div>
                <span style={{ fontSize:'0.62rem', fontWeight:800, color:m.c, minWidth:26, textAlign:'right' }}>{m.v}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TAB SYSTEM
═══════════════════════════════════════════════════════════════════════ */
type DPTTab = 'overview' | 'identity' | 'persona' | 'memory' | 'graph' | 'intelligence' | 'privacy' | 'evolution' | 'comparison' | 'simulator';

const TABS: {key:DPTTab; icon:string; label:string; color:string}[] = [
  {key:'overview',     icon:'◈',  label:'Overview',       color: '#0052cc'},
  {key:'identity',     icon:'', label:'Identity',       color:'#06b6d4'},
  {key:'persona',      icon:'', label:'Persona',        color: '#0052cc'},
  {key:'memory',       icon:'', label:'Memory',         color:'#f59e0b'},
  {key:'graph',        icon:'', label:'Knowledge Graph',color:'#10b981'},
  {key:'intelligence', icon:'', label:'Intelligence',   color:'#ec4899'},
  {key:'privacy',      icon:'', label:'Privacy',        color: '#475569'},
  {key:'evolution',    icon:'', label:'Evolution',      color:'#818cf8'},
  {key:'comparison',   icon:'', label:'Comparison',     color:'#34d399'},
  {key:'simulator',    icon:'', label:'Decision Sim',   color:'#a78bfa'},
];

function TabBar({ active, setActive, sticky=false }: { active:DPTTab; setActive:(t:DPTTab)=>void; sticky?:boolean }) {
  return (
    <div style={{
      display:'flex', gap:'0.2rem', overflowX:'auto', scrollbarWidth:'none' as const,
      ...(sticky?{
        position:'fixed' as const, top:60, left:0, right:0, zIndex:45,
        padding:'0.45rem 2rem', background: 'var(--bg-elevated)', backdropFilter: 'none',
        WebkitBackdropFilter: 'none', borderBottom:'1px solid var(--border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
      }:{
        padding:'0.3rem', marginBottom:'1.5rem', background: 'var(--bg-elevated)',
        border: '1px solid var(--border)', borderRadius:18,
      }),
    }}>
      {TABS.map(t=>{
        const on = active===t.key;
        return (
          <button key={t.key} onClick={()=>setActive(t.key)} style={{
            flex:'0 0 auto', padding:'0.6rem 1.05rem', borderRadius:13,
            border:'none', fontFamily:'inherit', cursor:'pointer',
            background: on?`${t.color}1e`:'transparent',
            color: on?t.color: 'var(--text-m)',
            fontSize:'0.76rem', fontWeight:on?800:600,
            borderBottom: on?`2px solid ${t.color}`:'2px solid transparent',
            boxShadow: on?`0 0 14px ${t.color}1e`:'none',
            transition:'all 0.18s cubic-bezier(0.16,1,0.3,1)',
            whiteSpace:'nowrap' as const, display:'flex', alignItems:'center', gap:'0.35rem',
          }}>
            <span style={{ fontSize:'0.88rem' }}>{t.icon}</span>{t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   BUILD MY TWIN INTERVIEW
═══════════════════════════════════════════════════════════════════════ */
function BuildMyTwinPanel({ profile, onSave }: { profile:DPTProfile; onSave:(p:DPTProfile)=>void }) {
  const answered = Object.keys(profile.interview.answers);
  const nextQ    = INTERVIEW.find(q=>!answered.includes(q.id));
  const pct      = Math.round(answered.length/INTERVIEW.length*100);
  const [draft, setDraft] = useState('');

  if (!nextQ && answered.length>=INTERVIEW.length) {
    return (
      <div style={{ ...C, border:'1px solid rgba(16,185,129,0.2)', background:'rgba(16,185,129,0.04)' }}>
        <div style={{ display:'flex', gap:'1rem', alignItems:'center' }}>
          <span style={{ fontSize:'2.5rem' }}></span>
          <div>
            <p style={{ margin:0, fontSize:'1rem', fontWeight:800, color:'#10b981' }}>Interview Complete — Twin Calibrated</p>
            <p style={{ margin:'0.2rem 0 0', fontSize:'0.78rem', color: '#64748b' }}>Your Digital Persona Twin profile has been fully calibrated. Fidelity improves continuously as you use the platform.</p>
          </div>
        </div>
      </div>
    );
  }

  function saveAnswer(value: string) {
    if (!value.trim()||!nextQ) return;
    const u: DPTProfile = {
      ...profile,
      interview: { answers:{ ...profile.interview.answers, [nextQ.id]:value } },
      memories: [...profile.memories, { id:`${nextQ.id}_${Date.now()}`, type:nextQ.memType, content:value, date:new Date().toISOString().slice(0,10), category:nextQ.category }],
    };
    if (nextQ.id==='career_goals')   u.identity.careerGoals  = value.split(/[,\n]+/).map(s=>s.trim()).filter(Boolean);
    if (nextQ.id==='interests')      u.identity.interests    = value.split(/[,\n]+/).map(s=>s.trim()).filter(Boolean);
    if (nextQ.id==='strengths')      u.identity.skills       = value.split(/[,\n]+/).map(s=>s.trim()).filter(Boolean);
    if (nextQ.id==='challenges')     u.identity.personalGoals.push(`Overcome: ${value.trim()}`);
    if (nextQ.id==='life_goal')      u.identity.aspirations  = [value.trim()];
    if (nextQ.id==='values')         u.identity.values       = [value.trim()];
    if (nextQ.id==='motivation')     u.communication.primaryMotivation = value;
    if (nextQ.id==='stress')         u.cognitive.stressResponse  = value;
    if (nextQ.id==='failure')        u.cognitive.failureResponse = value;
    if (nextQ.id==='decision_style') u.cognitive.decisionStyle   = value;
    if (nextQ.id==='thinking_style') {
      const m: Record<string,DPTCognitive['thinkingStyle']> = {
        'Analytical — I rely on data and logic':'analytical','Practical — I focus on real solutions':'practical',
        'Creative — I think outside the box':'creative','Strategic — I plan for the big picture':'strategic',
      };
      u.cognitive.thinkingStyle = m[value]??'mixed';
    }
    onSave(u); setDraft('');
  }

  return (
    <div style={{ ...C, border:'1px solid rgba(99,102,241,0.22)' }}>
      <SectionHead icon="" title="Build My Twin" desc="Answer questions to calibrate your Digital Persona Twin. Each answer improves fidelity and personalises all predictions and simulations." color="#6366f1" badge={`${pct}%`} />
      <div style={{ marginBottom:'1.25rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.35rem' }}>
          <span style={{ fontSize:'0.7rem', color: '#64748b', fontWeight:600 }}>{answered.length}/{INTERVIEW.length} questions answered</span>
          <span style={{ fontSize:'0.7rem', fontWeight:800, color: '#0052cc' }}>{pct}% complete</span>
        </div>
        <div style={{ height:8, background: '#e2e8f0', borderRadius:99, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background: '#0052cc', borderRadius:99, transition:'width 0.5s ease', boxShadow:'0 0 8px rgba(99,102,241,0.4)' }} />
        </div>
      </div>
      {answered.length>0 && (
        <div style={{ marginBottom:'1rem', padding:'0.7rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius:11 }}>
          {answered.slice(-2).map(id=>{
            const q=INTERVIEW.find(i=>i.id===id);
            return q?(
              <div key={id} style={{ marginBottom:'0.3rem', fontSize:'0.7rem', color: '#64748b', display:'flex', gap:'0.4rem' }}>
                <span style={{ color:'#34d399', flexShrink:0 }}></span>
                <span><strong style={{ color: '#64748b' }}>{q.category}:</strong> <span style={{ color:'#818cf8' }}>{profile.interview.answers[id]?.slice(0,50)}{profile.interview.answers[id]?.length>50?'…':''}</span></span>
              </div>
            ):null;
          })}
        </div>
      )}
      {nextQ && (
        <div>
          <p style={{ margin:'0 0 1rem', fontSize:'0.95rem', fontWeight:700, color: '#0f172a', lineHeight:1.55 }}>
            <span style={{ fontSize:'0.6rem', fontWeight:800, color: '#0052cc', background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.22)', padding:'0.1rem 0.45rem', borderRadius:99, marginRight:'0.5rem' }}>Q{answered.length+1}/{INTERVIEW.length}</span>
            {nextQ.q}
          </p>
          {nextQ.type==='choice'?(
            <div style={{ display:'flex', flexDirection:'column', gap:'0.45rem' }}>
              {nextQ.options!.map(opt=>(
                <button key={opt} onClick={()=>saveAnswer(opt)} style={{ padding:'0.7rem 1rem', borderRadius:12, border:'1px solid rgba(99,102,241,0.18)', background:'rgba(99,102,241,0.05)', color: '#475569', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const, transition:'background 0.15s, border-color 0.15s' }}>
                  {opt}
                </button>
              ))}
            </div>
          ):(
            <div style={{ display:'flex', gap:'0.6rem' }}>
              <textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder={nextQ.placeholder} rows={3}
                style={{ flex:1, padding:'0.65rem 0.9rem', borderRadius:12, background: '#f8f9fa', border:'1px solid rgba(99,102,241,0.22)', color: '#0f172a', fontSize:'0.8rem', fontFamily:'inherit', outline:'none', resize:'vertical' as const }} />
              <button onClick={()=>saveAnswer(draft)} disabled={!draft.trim()} style={{ padding:'0.65rem 1.25rem', borderRadius:12, background:draft.trim()?'linear-gradient(135deg,#6366f1,#8b5cf6)':'rgba(255,255,255,0.05)', border:'none', color:'#fff', fontWeight:800, fontSize:'0.82rem', cursor:draft.trim()?'pointer':'not-allowed', fontFamily:'inherit', alignSelf:'flex-start' as const }}>
                Save →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   IDENTITY TAB
═══════════════════════════════════════════════════════════════════════ */
function IdentityTab({ profile, user }: { profile:DPTProfile; user:{full_name?:string}|null }) {
  const p=profile.identity, ia=profile.interview.answers;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
      <SectionHead icon="" title="Identity Model" desc="Your core identity profile — personal goals, career aspirations, interests, and values, built from your interview answers and platform activity." color="#06b6d4" />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
        <div style={C}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.85rem', marginBottom:'1.1rem', padding:'0.85rem', background:'rgba(6,182,212,0.07)', border:'1px solid rgba(6,182,212,0.18)', borderRadius:14 }}>
            <div style={{ width:44,height:44,borderRadius:'50%',background:'linear-gradient(135deg,#6366f1,#00D4FF)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',fontWeight:800,color:'#fff',flexShrink:0 }}>
              {user?.full_name?.split(' ').map(w=>w[0]).slice(0,2).join('')??'◈'}
            </div>
            <div>
              <p style={{ margin:0, fontSize:'1rem', fontWeight:800, color: '#0f172a' }}>{user?.full_name??'Digital Persona'}</p>
              <p style={{ margin:0, fontSize:'0.7rem', color: '#64748b' }}>Digital Persona Twin · {Object.keys(ia).length}/{INTERVIEW.length} dimensions</p>
            </div>
          </div>
          {ia.motivation && <div style={{ marginBottom:'0.8rem' }}><p style={LB}>Primary Motivation</p><p style={VL}>{ia.motivation}</p></div>}
          {ia.values     && <div style={{ marginBottom:'0.8rem' }}><p style={LB}>Core Values</p><p style={VL}>{ia.values}</p></div>}
          {ia.life_goal  && <div style={{ marginBottom:'0.8rem' }}><p style={LB}>Life Goal</p><p style={VL}>{ia.life_goal}</p></div>}
          {!ia.motivation && <p style={{ color:'#334155', fontSize:'0.78rem' }}>Complete the interview to populate your identity profile.</p>}
        </div>
        <div style={C}>
          <p style={{ margin:'0 0 0.85rem', fontSize:'0.8rem', fontWeight:800, color: '#0f172a' }}>Goals & Aspirations</p>
          {p.careerGoals.length>0 && <div style={{ marginBottom:'0.85rem' }}><p style={LB}>Career Goals</p><div>{p.careerGoals.map((g,i)=><Chip key={i} label={g} color="#06b6d4" />)}</div></div>}
          {ia.career_goals && !p.careerGoals.length && <div style={{ marginBottom:'0.85rem' }}><p style={LB}>Career Goals</p><p style={VL}>{ia.career_goals}</p></div>}
          {ia.challenges  && <div style={{ marginBottom:'0.85rem' }}><p style={LB}>Key Challenge</p><p style={VL}>{ia.challenges}</p></div>}
          {p.aspirations.length>0 && <div style={{ marginBottom:'0.85rem' }}><p style={LB}>Aspirations</p><div>{p.aspirations.map((a,i)=><Chip key={i} label={a} color="#f59e0b" />)}</div></div>}
          {(p.interests.length>0||ia.interests) && <div style={{ marginBottom:'0.85rem' }}><p style={LB}>Interests</p>{p.interests.length>0?<div>{p.interests.map((x,i)=><Chip key={i} label={x} color="#8b5cf6" />)}</div>:<p style={VL}>{ia.interests}</p>}</div>}
          {(p.skills.length>0||ia.strengths) && <div><p style={LB}>Strengths</p>{p.skills.length>0?<div>{p.skills.map((s,i)=><Chip key={i} label={s} color="#10b981" />)}</div>:<p style={VL}>{ia.strengths}</p>}</div>}
        </div>
      </div>
      {Object.keys(ia).length>0 && (
        <div style={C}>
          <p style={{ margin:'0 0 0.85rem', fontSize:'0.8rem', fontWeight:800, color: '#0f172a' }}>Interview Snapshot</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
            {INTERVIEW.filter(q=>ia[q.id]).map(q=>(
              <div key={q.id} style={{ padding:'0.6rem 0.8rem', background:'rgba(6,182,212,0.04)', border:'1px solid rgba(6,182,212,0.12)', borderRadius:11 }}>
                <p style={{ margin:'0 0 0.15rem', fontSize:'0.57rem', fontWeight:800, color:'#06b6d4', letterSpacing:'0.07em', textTransform:'uppercase' as const }}>{q.category}</p>
                <p style={{ margin:0, fontSize:'0.74rem', color: '#475569' }}>{ia[q.id]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PERSONA TAB
═══════════════════════════════════════════════════════════════════════ */
function PersonaTab({ profile, twin, burnout, learningData, streakData, progress }:
  { profile:DPTProfile; twin:TwinState|null; burnout:BurnoutData|null; learningData:LearningEntry[]; streakData:StreakStatus|null; progress:GamificationProgress|null }) {
  const ia=profile.interview.answers, streak=streakData?.streak_days??0;
  const noteSessions=learningData.filter(d=>d.notes_created>0).length, total=learningData.length;
  const THINK: Record<string,{icon:string;color:string;desc:string}> = {
    analytical:{icon:'',color: '#0052cc',desc:'You rely on data, logic, and systematic reasoning. You prefer to analyse before acting.'},
    practical: {icon:'',color:'#06b6d4',desc:'You focus on real-world solutions. Efficiency and pragmatism drive your decisions.'},
    creative:  {icon:'',color:'#f59e0b',desc:'You think innovatively, connect ideas across domains, and enjoy exploring novel solutions.'},
    strategic: {icon:'',color: '#0052cc',desc:'You see the big picture. Long-term planning and systems thinking define your approach.'},
    mixed:     {icon:'',color:'#10b981',desc:'You adapt your thinking style to context. Versatile and flexible across domains.'},
  };
  const tk=profile.cognitive.thinkingStyle, tm=THINK[tk];
  const P={
    Discipline:       twin?Math.round(twin.consistency_score):40,
    Persistence:      Math.min(100,streak*3+15),
    Curiosity:        Math.min(100,noteSessions*9+20),
    Confidence:       twin?Math.min(100,Math.round(twin.academic_score*0.85+12)):40,
    Consistency:      twin?Math.round(twin.consistency_score):40,
    Competitiveness:  progress?Math.min(100,progress.level*10):20,
    Adaptability:     twin?.trend==='improving'?82:twin?.trend==='stable'?62:42,
    'Self-Control':   burnout?Math.round(Math.max(20,100-burnout.burnout_score*0.65)):55,
    'Growth Mindset': twin?Math.min(100,Math.round(twin.twin_intelligence_score*0.9+8)):40,
  };
  const PC: Record<string,string>={Discipline:'#6366f1',Persistence:'#f97316',Curiosity:'#06b6d4',Confidence:'#10b981',Consistency:'#8b5cf6',Competitiveness:'#f59e0b',Adaptability:'#34d399','Self-Control':'#ec4899','Growth Mindset':'#a78bfa'};
  const fs=burnout?Math.round(Math.max(0,100-burnout.burnout_score)):55;
  const mot=twin?Math.min(100,Math.round(twin.consistency_score*0.7+streak*1.5+10)):40;
  const eng=total>0?Math.min(100,Math.round(total*3+fs*0.4)):25;
  const mom=twin?Math.round((twin.overall_score+twin.consistency_score)/2):40;
  const lStyle=ia.learning_style??'';
  const SM:Record<string,string>={'Reading & detailed notes':'Reading Learner','Practice & hands-on repetition':'Practice Learner','Watching videos & visual content':'Video Learner','Quizzes, tests & active recall':'Quiz Learner','Mixed — I adapt to the material':'Mixed Learner'};
  const ds=SM[lStyle]??(noteSessions>total*0.6?'Reading Learner':total>5?'Practice Learner':'Mixed Learner');
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
      <SectionHead icon="" title="Persona Model" desc="How your twin understands your personality, cognitive style, communication patterns, and emotional state." color="#8b5cf6" />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
        <div style={C}>
          <p style={{ margin:'0 0 0.85rem', fontSize:'0.8rem', fontWeight:800, color: '#0f172a' }}> Cognitive Profile</p>
          <div style={{ padding:'0.85rem 1rem', background:`${tm.color}0d`, border:`1px solid ${tm.color}25`, borderRadius:14, marginBottom:'1rem', display:'flex', gap:'0.75rem' }}>
            <span style={{ fontSize:'1.5rem' }}>{tm.icon}</span>
            <div>
              <p style={{ margin:0, fontSize:'1rem', fontWeight:800, color: '#0f172a', textTransform:'capitalize' as const }}>{tk} Thinker</p>
              <p style={{ margin:'0.15rem 0 0', fontSize:'0.72rem', color: '#475569', lineHeight:1.5 }}>{tm.desc}</p>
            </div>
          </div>
          {ia.decision_style && <div style={{ marginBottom:'0.65rem', padding:'0.6rem 0.8rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius:10 }}><p style={LB}>Decision Style</p><p style={VL}>{ia.decision_style}</p></div>}
          {ia.failure        && <div style={{ marginBottom:'0.65rem', padding:'0.6rem 0.8rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius:10 }}><p style={LB}>Setback Response</p><p style={VL}>{ia.failure}</p></div>}
          {ia.stress         && <div style={{ padding:'0.6rem 0.8rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius:10 }}><p style={LB}>Stress Response</p><p style={VL}>{ia.stress}</p></div>}
          {!ia.thinking_style && <p style={{ color:'#334155', fontSize:'0.78rem', marginTop:'0.5rem' }}>Answer the thinking style question to calibrate your cognitive model.</p>}
        </div>
        <div style={C}>
          <p style={{ margin:'0 0 0.85rem', fontSize:'0.8rem', fontWeight:800, color: '#0f172a' }}> Personality Traits (0–100)</p>
          {Object.entries(P).map(([trait,score])=><ScoreBar key={trait} label={trait} value={score} color={PC[trait]??'#6366f1'} />)}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
        <div style={C}>
          <p style={{ margin:'0 0 0.85rem', fontSize:'0.8rem', fontWeight:800, color: '#0f172a' }}> Emotional State <span style={{ fontSize:'0.6rem', color:'#334155', fontStyle:'italic' }}>(confidence estimates)</span></p>
          <ScoreBar label="Motivation Level"  value={mot} color="#f59e0b" />
          <ScoreBar label="Engagement Level"  value={eng} color="#6366f1" />
          <ScoreBar label="Focus Probability" value={fs}  color="#10b981" />
          <ScoreBar label="Momentum Score"    value={mom} color="#06b6d4" />
          {burnout && <ScoreBar label="Burnout Pressure" value={burnout.burnout_score} color={burnout.risk_level==='high'?'#ef4444':burnout.risk_level==='medium'?'#f59e0b':'#10b981'} note={burnout.risk_level.toUpperCase()} />}
        </div>
        <div style={C}>
          <p style={{ margin:'0 0 0.85rem', fontSize:'0.8rem', fontWeight:800, color: '#0f172a' }}> Communication & Learning</p>
          <div style={{ marginBottom:'1rem', padding:'0.65rem 1rem', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:13 }}>
            <p style={LB}>Detected Learning Style</p>
            <p style={{ margin:0, fontSize:'1rem', fontWeight:800, color:'#c4b5fd' }}>{ds}</p>
          </div>
          {ia.motivation && <div style={{ marginBottom:'0.75rem' }}><p style={LB}>Communication Style</p><p style={VL}>{ia.motivation.includes('Academic')?'Achievement-focused — direct, outcome-oriented.':ia.motivation.includes('Career')?'Professional — concise, results-driven.':ia.motivation.includes('Personal')?'Reflective — values introspection and growth.':'Adaptive — adjusts style to context.'}</p></div>}
          {ia.values && <div style={{ marginBottom:'0.85rem' }}><p style={LB}>Core Value</p><Chip label={ia.values} color="#f59e0b" /></div>}
          {twin?.ai_insights?.[0] && <div style={{ padding:'0.7rem', background:'rgba(129,140,248,0.07)', border:'1px solid rgba(129,140,248,0.18)', borderRadius:12 }}>
            <p style={{ margin:'0 0 0.2rem', fontSize:'0.58rem', fontWeight:700, color:'#818cf8', letterSpacing:'0.07em' }}>TWIN INSIGHT</p>
            <p style={{ margin:0, fontSize:'0.74rem', color: '#475569', lineHeight:1.55 }}>{twin.ai_insights[0]}</p>
          </div>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MEMORY TAB
═══════════════════════════════════════════════════════════════════════ */
function MemoryTab({ profile, twin, progress, streakData }:
  { profile:DPTProfile; twin:TwinState|null; progress:GamificationProgress|null; streakData:StreakStatus|null }) {
  const TC: Record<DPTMemory['type'],{icon:string;color:string;label:string}> = {
    semantic:   {icon:'',color: '#0052cc',label:'Semantic — Facts about you'},
    preference: {icon:'',color:'#f59e0b',label:'Preference — Likes & dislikes'},
    goal:       {icon:'',color:'#10b981',label:'Goal — Objectives & progress'},
    experience: {icon:'',color:'#f97316',label:'Experience — Events & milestones'},
    learning:   {icon:'',color:'#06b6d4',label:'Learning — Academic history'},
  };
  const auto: DPTMemory[] = [];
  if (twin?.data_points) auto.push({id:'a_dp',type:'learning',content:`${twin.data_points} learning sessions logged. Academic score: ${Math.round(twin.overall_score)}/100.`,date:new Date().toISOString().slice(0,10),category:'Learning History'});
  if (streakData?.streak_days) auto.push({id:'a_str',type:'experience',content:`Active ${streakData.streak_days}-day study streak. Last check-in: ${streakData.last_checkin??'today'}.`,date:new Date().toISOString().slice(0,10),category:'Streak'});
  if (twin?.strengths?.length) auto.push({id:'a_s',type:'semantic',content:`Identified strengths: ${twin.strengths.join(', ')}.`,date:new Date().toISOString().slice(0,10),category:'Strengths'});
  if (twin?.areas_to_improve?.length) auto.push({id:'a_i',type:'semantic',content:`Focus areas: ${twin.areas_to_improve.join(', ')}.`,date:new Date().toISOString().slice(0,10),category:'Development'});
  if (progress?.level) auto.push({id:'a_xp',type:'experience',content:`Reached Level ${progress.level} — ${progress.level_name}. Total XP: ${progress.xp}.`,date:new Date().toISOString().slice(0,10),category:'Achievement'});
  const all=[...auto,...profile.memories].sort((a,b)=>b.date.localeCompare(a.date));
  const byType=(Object.keys(TC) as DPTMemory['type'][]).reduce((acc,t)=>{ acc[t]=all.filter(m=>m.type===t); return acc; }, {} as Record<string,DPTMemory[]>);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
      <SectionHead icon="" title="Memory System" desc="Your twin's long-term memory — semantic facts, preferences, goals, experiences, and learning history stored across 5 memory types." color="#f59e0b" />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'0.6rem' }}>
        {(Object.entries(TC) as [DPTMemory['type'],typeof TC[DPTMemory['type']]][]).map(([type,cfg])=>(
          <div key={type} style={{ padding:'0.85rem', background:`${cfg.color}0a`, border:`1px solid ${cfg.color}1e`, borderRadius:14, textAlign:'center' as const }}>
            <div style={{ fontSize:'1.5rem', marginBottom:'0.3rem' }}>{cfg.icon}</div>
            <p style={{ margin:'0 0 0.1rem', fontSize:'0.9rem', fontWeight:900, color:cfg.color }}>{byType[type]?.length??0}</p>
            <p style={{ margin:0, fontSize:'0.6rem', color: '#64748b', textTransform:'capitalize' as const }}>{type}</p>
          </div>
        ))}
      </div>
      <div style={C}>
        <p style={{ margin:'0 0 1rem', fontSize:'0.85rem', fontWeight:800, color: '#0f172a' }}>Memory Timeline</p>
        {all.length===0?<p style={{ color:'#334155', fontSize:'0.82rem' }}>No memories yet. Complete the interview to start building your memory archive.</p>:(
          <div>
            {all.slice(0,12).map((mem,i)=>{
              const cfg=TC[mem.type];
              return (
                <div key={mem.id} style={{ display:'flex', gap:'0.75rem', paddingBottom:i<all.length-1?'0.85rem':0 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                    <div style={{ width:30,height:30,borderRadius:'50%',background:`${cfg.color}12`,border:`1px solid ${cfg.color}28`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.82rem' }}>{cfg.icon}</div>
                    {i<all.length-1 && <div style={{ width:1,flex:1,background: '#f8f9fa',marginTop:4 }} />}
                  </div>
                  <div style={{ paddingTop:4 }}>
                    <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.18rem' }}>
                      <span style={{ fontSize:'0.57rem', fontWeight:700, color:cfg.color, letterSpacing:'0.06em', textTransform:'uppercase' as const }}>{mem.category}</span>
                      <span style={{ fontSize:'0.57rem', color:'#334155' }}>{mem.date}</span>
                    </div>
                    <p style={{ margin:0, fontSize:'0.76rem', color: '#475569', lineHeight:1.55 }}>{mem.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
        {(Object.entries(TC) as [DPTMemory['type'],typeof TC[DPTMemory['type']]][]).slice(0,4).map(([type,cfg])=>(
          <div key={type} style={{ ...C, padding:'1.25rem' }}>
            <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.75rem' }}>
              <span>{cfg.icon}</span><span style={{ fontSize:'0.78rem', fontWeight:700, color:cfg.color }}>{cfg.label}</span>
            </div>
            {byType[type]?.length===0?<p style={{ fontSize:'0.7rem', color:'#334155', margin:0 }}>No {type} memories yet.</p>:byType[type].slice(0,3).map(m=><p key={m.id} style={{ margin:'0 0 0.3rem', fontSize:'0.72rem', color: '#64748b', lineHeight:1.5 }}>• {m.content}</p>)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   KNOWLEDGE GRAPH TAB
═══════════════════════════════════════════════════════════════════════ */
function KnowledgeGraphTab({ profile, twin, subjects, progress }:
  { profile:DPTProfile; twin:TwinState|null; subjects:SubjectAnalysis|null; progress:GamificationProgress|null }) {
  const W=580,H=380,CX=W/2,CY=H/2;
  type N={id:string;label:string;color:string;r:number;x:number;y:number};
  const nodes:N[]=[]; const edges:{from:string;to:string}[]=[];
  nodes.push({id:'user',label:profile.identity.careerGoals[0]?.slice(0,12)??'You',color: '#0052cc',r:24,x:CX,y:CY});
  const place=(items:string[],type:string,color:string,radius:number,rN:number)=>{
    items.forEach((item,i)=>{ const a=(i/items.length)*2*Math.PI-Math.PI/2,id=`${type}_${i}`;
      nodes.push({id,label:item.slice(0,14),color,r:rN,x:CX+radius*Math.cos(a),y:CY+radius*Math.sin(a)});
      edges.push({from:'user',to:id}); });
  };
  const goals=[...profile.identity.careerGoals.slice(0,2),...(profile.interview.answers.life_goal?[profile.interview.answers.life_goal.slice(0,12)]:[])];
  if(goals.length>0) place(goals,'goal','#10b981',100,14);
  const sN:string[]=[]; if(subjects?.strongest) sN.push(subjects.strongest.subject); if(subjects?.weakest&&subjects.weakest.subject!==subjects?.strongest?.subject) sN.push(subjects.weakest.subject);
  if(sN.length) place(sN,'subject','#06b6d4',160,13);
  const sk=profile.identity.skills.slice(0,3); if(sk.length) place(sk,'skill','#f59e0b',155,12);
  const habits:string[]=[]; if(profile.cognitive.thinkingStyle!=='mixed') habits.push(profile.cognitive.thinkingStyle+' thinker'); if(profile.interview.answers.learning_style) habits.push(profile.interview.answers.learning_style.split(' ')[0]);
  if(habits.length) place(habits,'habit','#8b5cf6',205,11);
  if(progress&&progress.level>1) place([`Level ${progress.level}`],'achievement','#f97316',205,12);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
      <SectionHead icon="" title="Knowledge Graph" desc="A dynamic graph connecting your identity, goals, subjects, skills, habits, and achievements. Updates automatically as you log data." color="#10b981" />
      <div style={C}>
        <div style={{ position:'relative', overflow:'hidden', borderRadius:14, background: '#ffffff', border: '1px solid #e2e8f0' }}>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block' }}>
            <defs><radialGradient id="uG" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#8b5cf6" /></radialGradient></defs>
            {edges.map(e=>{ const f=nodes.find(n=>n.id===e.from),t=nodes.find(n=>n.id===e.to); if(!f||!t) return null; return <line key={`${e.from}-${e.to}`} x1={f.x} y1={f.y} x2={t.x} y2={t.y} stroke="rgba(99,102,241,0.2)" strokeWidth="1.5" strokeDasharray="4 4" />; })}
            {nodes.map(n=>(<g key={n.id}><circle cx={n.x} cy={n.y} r={n.r+5} fill={`${n.color}0e`} /><circle cx={n.x} cy={n.y} r={n.r} fill={n.id==='user'?'url(#uG)':`${n.color}1e`} stroke={n.color} strokeWidth={n.id==='user'?2.5:1.5} style={{filter:n.id==='user'?`drop-shadow(0 0 6px ${n.color}88)`:undefined}} /><text x={n.x} y={n.y+(n.r+16)} textAnchor="middle" fill={n.color} fontSize={n.id==='user'?9:7} fontWeight="700">{n.label}</text>{n.id==='user'&&<text x={n.x} y={n.y+5} textAnchor="middle" fill="#fff" fontSize={12} fontWeight="900">◈</text>}</g>))}
          </svg>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'0.6rem', marginTop:'0.85rem' }}>
          {[['#6366f1','User'],['#10b981','Goals'],['#06b6d4','Subjects'],['#f59e0b','Skills'],['#8b5cf6','Habits'],['#f97316','Achievements']].map(([c,l])=>(
            <span key={l} style={{ fontSize:'0.62rem', fontWeight:700, color:c, display:'flex', alignItems:'center', gap:'0.3rem' }}>
              <span style={{ width:8,height:8,borderRadius:'50%',background:c,display:'inline-block' }} />{l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   INTELLIGENCE TAB
═══════════════════════════════════════════════════════════════════════ */
function IntelligenceTab({ profile, twin, subjects, burnout, streakData }:
  { profile:DPTProfile; twin:TwinState|null; subjects:SubjectAnalysis|null; burnout:BurnoutData|null; streakData:StreakStatus|null }) {
  const [input,setInput]=useState(''), [msgs,setMsgs]=useState<{q:string;a:string}[]>([]), [thinking,setThinking]=useState(false);
  const bottomRef=useRef<HTMLDivElement>(null);
  const ia=profile.interview.answers, streak=streakData?.streak_days??0;

  const QUICK=['What would I do if I fail an exam?','Which study plan would I choose?',`Would I enjoy a career in ${ia.interests?.split(',')[0]?.trim()??'technology'}?`,'How would I react to a tight deadline?','What happens if I skip studying today?','What motivates me to keep going?'];

  function gen(q: string): string {
    const ql=q.toLowerCase(), tk=profile.cognitive.thinkingStyle, fa=ia.failure??'reflecting and adjusting', sa=ia.stress??'structured planning';
    if((ql.includes('fail')||ql.includes('setback'))&&!ql.includes('burnout'))
      return `◈ Persona Simulation: Failure Response\n\nAs a ${tk} thinker, your instinct when facing setbacks is to "${fa}".\n\n• Predicted reaction: ${fa.includes('analyse')?'Review what went wrong systematically before acting.':fa.includes('break')?'Step back emotionally before re-engaging.':'Seek to understand the gap and fill it quickly.'}\n• Recovery projection: ${twin?.trend==='improving'?'Strong recovery within 5–7 days based on your improving trend.':'Consistent patterns show resilience.'}\n\n${ia.motivation?`Motivation anchor: "${ia.motivation}" — return here when motivation dips.`:'Complete your interview for personalised guidance.'}`;
    if(ql.includes('study plan')||ql.includes('which plan'))
      return `◈ Persona Simulation: Study Plan Preference\n\nAs a ${tk} thinker learning through "${ia.learning_style??'mixed methods'}":\n\n${tk==='analytical'?'• Structured plans with measurable milestones and data-driven schedules.':tk==='practical'?'• Action-oriented daily tasks with tangible output per session.':tk==='strategic'?'• Long-horizon plans mapped to career goals with compound value.':'• Adaptive plans combining structure with flexibility and weekly reviews.'}\n\n${ia.career_goals?`Goal alignment: "${ia.career_goals?.slice(0,60)}…"`:''}`;
    if(ql.includes('career')||ql.includes('enjoy')&&ql.includes('field'))
      return `◈ Persona Simulation: Career Fit Analysis\n\nBased on your ${tk} thinking style and interests in "${ia.interests??subjects?.strongest?.subject??'your field'}":\n\n• Best-fit roles: Careers requiring ${tk==='analytical'?'systematic problem-solving and data analysis':tk==='practical'?'hands-on execution and real-world impact':tk==='creative'?'innovation, design, and novel thinking':'strategic planning and systems oversight'}.\n• Values fit: You prioritise "${ia.values??'growth'}" — seek organisations that reflect this.\n• Confidence: ${twin?`Academic score ${Math.round(twin.academic_score)}/100 suggests ${twin.academic_score>=70?'strong preparation':'continued growth needed'} for your target field.`:'Log more data for career confidence score.'}`;
    if(ql.includes('deadline')||ql.includes('pressure'))
      return `◈ Persona Simulation: Deadline Response\n\nAs a ${tk} thinker, your deadline response:\n\n• Cognitive: ${tk==='analytical'?'Break task into prioritised components.':tk==='practical'?'Identify minimum viable work and execute immediately.':tk==='strategic'?'Zoom out to assess what matters most first.':'Adapt quickly to what the situation demands.'}\n• Stress management: "${sa}"\n• Burnout alert: ${burnout?.risk_level==='high'?'HIGH burnout — performance under pressure may be reduced.':'Manageable risk — you can handle this effectively.'}`;
    if((ql.includes('skip')||ql.includes('miss'))&&ql.includes('study'))
      return `◈ Persona Simulation: Skip Studying Today\n\n${streak>0?`Your ${streak}-day streak is at immediate risk.`:''}\n\n• Academic: ~${Math.round(2.5+(twin?100-twin.consistency_score:20)*0.08)}% score drop projected within 3 days.\n• Pattern: ${fa.includes('Push')?'You recover well with an intense comeback session.':fa.includes('analyse')?'Your analytical nature will trigger a catch-up review tomorrow.':'You will feel compelled to over-compensate the next day.'}\n\nEven 20 minutes prevents regression. Use Quick Quiz.`;
    if(ql.includes('motivat')||ql.includes('keep going'))
      return `◈ Persona Simulation: Motivation Core\n\nYour primary motivation: "${ia.motivation??'your goals'}"\n\nWhen you want to give up, you re-engage when:\n${ia.motivation?.includes('Academic')?'• You see measurable progress — even a small score improvement reignites your drive.':ia.motivation?.includes('Career')?'• You reconnect with your career vision and the gap you need to close.':'• You find meaning in how your effort connects to a larger purpose.'}\n\n${ia.life_goal?`North star: "${ia.life_goal?.slice(0,60)}"`:'Complete the interview for personalised motivational guidance.'}`;
    const insight=twin?.ai_insights?.[Math.floor(Math.random()*Math.max(1,twin.ai_insights.length))]??`Twin has analysed ${twin?.data_points??0} data points.`;
    return `◈ Digital Persona Twin Response\n\n${insight}\n\nProfile: ${tk} thinker, motivated by "${ia.motivation??'your goals'}", trending ${twin?.trend??'building'}.\n\nTry: "What would I do if I fail an exam?", "Which study plan suits me?", "How would I react to a deadline?"`;
  }

  function ask(q?: string) {
    const question=(q??input).trim(); if(!question) return;
    setInput(''); setThinking(true);
    setTimeout(()=>{ setMsgs(p=>[...p,{q:question,a:gen(question)}]); setThinking(false); setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),80); },900);
  }

  const predStr=twin?.prediction_reliability??30, streakP=Math.min(98,50+streak*2), goalP=twin?Math.min(95,Math.round(twin.consistency_score*0.9)):30;
  const burnoutP=Math.min(95,Math.round((burnout?.burnout_score??25)*0.75+5)), examP=twin?Math.round(twin.academic_score):40;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <SectionHead icon="" title="Prediction Center" desc="AI-generated future outcome predictions with confidence percentages and risk assessments, derived from your behavioral patterns and twin model." color="#ec4899" />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.85rem' }}>
        <PredCard icon="" label="Maintain streak this week"     prob={streakP}  conf={Math.min(95,50+streak*2)}   color="#f97316"  riskLevel={streakP<40?'high':streakP<65?'medium':'low'}  trend={streak>7?'up':'stable'} />
        <PredCard icon="" label="Achieve current goals"         prob={goalP}   conf={Math.round(predStr*0.85)}    color="#10b981"  riskLevel={goalP<40?'high':goalP<65?'medium':'low'}    trend={twin?.trend==='improving'?'up':twin?.trend==='declining'?'down':'stable'} />
        <PredCard icon="" label="Exam readiness"               prob={examP}   conf={Math.round(predStr*0.9)}     color="#6366f1"  riskLevel={examP<40?'high':examP<65?'medium':'low'}    trend={twin?.trend==='improving'?'up':'stable'} />
        <PredCard icon="" label="Burnout risk (7 days)"        prob={burnoutP} conf={burnout?85:35}               color={burnoutP>55?'#ef4444':'#f59e0b'} riskLevel={burnoutP>60?'high':burnoutP>35?'medium':'low'} trend={burnout?.risk_level==='high'?'up':'stable'} />
        <PredCard icon="" label="Expected quiz performance"    prob={twin?Math.min(97,Math.round(twin.academic_score*0.88+5)):50} conf={Math.round(predStr*0.8)} color="#8b5cf6" trend="stable" />
        <PredCard icon="" label="Knowledge retention"         prob={twin?Math.round(twin.cognitive_heatmap?.memory_strength??twin.academic_score*0.85):40} conf={Math.round(predStr*0.75)} color="#06b6d4" trend={twin?.trend==='improving'?'up':'stable'} />
        <PredCard icon="" label="Productivity forecast"       prob={burnout?Math.round(Math.max(0,100-burnout.burnout_score*0.7)):60} conf={burnout?80:40} color="#10b981" riskLevel={burnout?.risk_level} trend="stable" />
        <PredCard icon="" label="Goal completion likelihood"  prob={goalP}   conf={Math.round(predStr*0.8)}    color="#f59e0b"  trend={twin?.trend==='improving'?'up':'stable'} />
      </div>

      {/* Ask My Twin */}
      <div style={{ ...C, border:'1px solid rgba(99,102,241,0.22)', background:'rgba(99,102,241,0.03)' }}>
        <SectionHead icon="◈" title="Ask My Twin — Persona Simulator" desc="Ask your Digital Persona Twin what you would likely do, think, prefer, or decide. Responses are generated from your learned persona model." color="#6366f1" />
        <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem', marginBottom:'1.1rem' }}>
          {QUICK.map(q=><button key={q} onClick={()=>ask(q)} style={{ padding:'0.32rem 0.78rem', borderRadius:99, border:'1px solid rgba(99,102,241,0.22)', background:'rgba(99,102,241,0.07)', color:'#818cf8', fontSize:'0.68rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{q}</button>)}
        </div>
        {msgs.length>0 && (
          <div style={{ maxHeight:400, overflowY:'auto', display:'flex', flexDirection:'column', gap:'0.85rem', marginBottom:'1.1rem', padding:'0.25rem' }}>
            {msgs.map((m,i)=>(
              <div key={i}>
                <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'0.35rem' }}>
                  <div style={{ maxWidth:'72%', padding:'0.55rem 0.85rem', background:'rgba(99,102,241,0.18)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'14px 14px 4px 14px', fontSize:'0.78rem', color: '#475569' }}>{m.q}</div>
                </div>
                <div style={{ display:'flex', gap:'0.55rem' }}>
                  <div style={{ width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,#6366f1,#00D4FF)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.75rem',flexShrink:0,color:'#fff',fontWeight:800,boxShadow:'0 0 12px rgba(99,102,241,0.4)' }}>◈</div>
                  <div style={{ flex:1,padding:'0.75rem 0.95rem',background: '#f8f9fa',border:'1px solid rgba(255,255,255,0.09)',borderRadius:'4px 14px 14px 14px',fontSize:'0.77rem',color: '#475569',lineHeight:1.7,whiteSpace:'pre-wrap' as const }}>{m.a}</div>
                </div>
              </div>
            ))}
            {thinking && (
              <div style={{ display:'flex', gap:'0.55rem' }}>
                <div style={{ width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,#6366f1,#00D4FF)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:'#fff',fontWeight:800,animation:'breathe 1.5s ease-in-out infinite' }}>◈</div>
                <div style={{ padding:'0.75rem',background: '#f8f9fa',border: '1px solid #e2e8f0',borderRadius:'4px 14px 14px 14px',display:'flex',gap:4,alignItems:'center' }}>
                  {[0,0.2,0.4].map(d=><div key={d} style={{ width:7,height:7,borderRadius:'50%',background:'#818cf8',animation:'particle-float 1.2s ease-in-out infinite',animationDelay:`${d}s` }} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
        <div style={{ display:'flex', gap:'0.6rem' }}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&ask()}
            placeholder='Ask your Digital Twin — "What would I do if I fail an exam?"'
            style={{ flex:1, padding:'0.75rem 1.1rem', borderRadius:13, background: '#f8f9fa', border:'1px solid rgba(99,102,241,0.25)', color: '#0f172a', fontSize:'0.82rem', fontFamily:'inherit', outline:'none' }} />
          <button onClick={()=>ask()} disabled={!input.trim()||thinking} style={{ padding:'0.75rem 1.4rem', borderRadius:13, background:input.trim()?'linear-gradient(135deg,#6366f1,#8b5cf6)':'rgba(255,255,255,0.05)', border:'none', color:'#fff', fontWeight:800, fontSize:'0.82rem', cursor:input.trim()?'pointer':'not-allowed', opacity:input.trim()?1:0.5, fontFamily:'inherit', boxShadow:input.trim()?'0 4px 16px rgba(99,102,241,0.3)':'none' }}>
            Ask →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   EVOLUTION TAB COMPONENTS (ported from Twin.tsx)
═══════════════════════════════════════════════════════════════════════ */

const EVO_SCORE_GRADS = [
  'linear-gradient(90deg,#6366f1,#8b5cf6)',
  'linear-gradient(90deg,#3b82f6,#6366f1)',
  'linear-gradient(90deg,#10b981,#06b6d4)',
  'linear-gradient(90deg,#8b5cf6,#d946ef)',
];
const EVO_MSG_COLOR:  Record<string,string> = { improving:'#6ee7b7', declining:'#fca5a5', stable:'#fde68a' };
const EVO_MSG_BG:     Record<string,string> = { improving:'rgba(16,185,129,0.08)', declining:'rgba(239,68,68,0.08)', stable:'rgba(245,158,11,0.08)' };
const EVO_MSG_BORDER: Record<string,string> = { improving:'rgba(16,185,129,0.25)', declining:'rgba(239,68,68,0.25)', stable:'rgba(245,158,11,0.25)' };
const EVO_MATURITY_LABELS = ['','Infant','Developing','Maturing','Advanced','Expert'];
const EVO_MATURITY_COLORS = ['','#ef4444','#f59e0b','#06b6d4','#8b5cf6','#10b981'];

type EvoTabDays = 30 | 60 | 90;
const EVO_TAB_CFG: Record<EvoTabDays, { label:string; accent:string; examGrad:string; examBg:string; examBorder:string; tipArrow:string; activeGrad:string; activeBorder:string }> = {
  30: { label:'+30 days', accent:'#6366f1', examGrad:'linear-gradient(135deg,#6366f1,#8b5cf6)', examBg:'rgba(99,102,241,0.08)', examBorder:'rgba(99,102,241,0.2)', tipArrow:'#6366f1', activeGrad:'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(139,92,246,0.18))', activeBorder:'rgba(99,102,241,0.35)' },
  60: { label:'+60 days', accent:'#3b82f6', examGrad:'linear-gradient(135deg,#3b82f6,#6366f1)', examBg:'rgba(59,130,246,0.08)', examBorder:'rgba(59,130,246,0.2)', tipArrow:'#3b82f6', activeGrad:'linear-gradient(135deg,rgba(59,130,246,0.22),rgba(99,102,241,0.15))', activeBorder:'rgba(59,130,246,0.35)' },
  90: { label:'+90 days', accent:'#a855f7', examGrad:'linear-gradient(135deg,#a855f7,#d946ef)', examBg:'rgba(168,85,247,0.08)', examBorder:'rgba(168,85,247,0.2)', tipArrow:'#a855f7', activeGrad:'linear-gradient(135deg,rgba(168,85,247,0.22),rgba(217,70,239,0.12))', activeBorder:'rgba(168,85,247,0.35)' },
};

const EVO_LAYERS = [
  { key: 'twin_intelligence_score' as const, label: 'Twin Intelligence', color: '#818cf8', desc: 'Composite score of all learning dimensions.' },
  { key: 'knowledge_growth'        as const, label: 'Knowledge Growth',  color: '#34d399', desc: 'How much new knowledge you acquired this session.' },
  { key: 'consistency_level'       as const, label: 'Consistency',       color: '#f59e0b', desc: 'Attendance and assignment completion regularity.' },
  { key: 'focus_quality'           as const, label: 'Focus Quality',     color: '#06b6d4', desc: 'Study intensity balanced with stress levels.' },
];
type EvoLayerKey = typeof EVO_LAYERS[number]['key'];

function EvoTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; color: string; payload: HistoryPoint }[] }) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  return (
    <div style={{ background:'rgba(8,13,26,0.97)', border:'1px solid rgba(129,140,248,0.3)', borderRadius:14, padding:'0.85rem 1rem', maxWidth:280, boxShadow:'0 8px 32px rgba(0,0,0,0.6)' }}>
      <p style={{ margin:'0 0 0.55rem', fontSize:'0.78rem', fontWeight:800, color:'#818cf8' }}>{pt.date}</p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.3rem 0.75rem', marginBottom:'0.6rem' }}>
        {payload.map(l => (
          <div key={l.name}>
            <span style={{ fontSize:'0.62rem', color: '#64748b', textTransform:'uppercase' as const, letterSpacing:'0.05em' }}>{EVO_LAYERS.find(x => x.key === l.name)?.label ?? l.name}</span>
            <p style={{ margin:0, fontSize:'0.85rem', fontWeight:800, color:l.color }}>{Math.round(l.value)}</p>
          </div>
        ))}
      </div>
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:'0.5rem', marginBottom:'0.45rem' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.25rem 0.75rem', fontSize:'0.7rem' }}>
          <span style={{ color: '#64748b' }}>Study: <strong style={{ color: '#0f172a' }}>{pt.study_hours}h</strong></span>
          <span style={{ color: '#64748b' }}>Notes: <strong style={{ color: '#0f172a' }}>{pt.notes_created}</strong></span>
          {pt.quiz_accuracy !== null && <span style={{ color: '#64748b' }}>Quiz: <strong style={{ color:'#10b981' }}>{pt.quiz_accuracy?.toFixed(0)}%</strong></span>}
          <span style={{ color: '#64748b' }}>Sessions: <strong style={{ color: '#0f172a' }}>{pt.focus_sessions}</strong></span>
        </div>
      </div>
      {pt.ai_explanation && (
        <div style={{ padding:'0.45rem 0.6rem', background:'rgba(129,140,248,0.08)', borderRadius:8, border:'1px solid rgba(129,140,248,0.2)' }}>
          <p style={{ margin:'0 0 0.2rem', fontSize:'0.6rem', fontWeight:700, color:'#818cf8', letterSpacing:'0.08em' }}>AI INSIGHT</p>
          <p style={{ margin:0, fontSize:'0.7rem', color: '#475569', lineHeight:1.5 }}>{pt.ai_explanation}</p>
        </div>
      )}
    </div>
  );
}

function EvoHeatBar({ label, value, desc }: { label: string; value: number; desc: string }) {
  const color = value >= 70 ? '#10b981' : value >= 45 ? '#f59e0b' : '#ef4444';
  const band  = value >= 70 ? 'Strong' : value >= 45 ? 'Developing' : 'Needs Work';
  return (
    <div style={{ marginBottom:'0.85rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.3rem' }}>
        <div>
          <span style={{ fontSize:'0.8rem', fontWeight:700, color: '#0f172a' }}>{label}</span>
          <span style={{ marginLeft:'0.5rem', fontSize:'0.62rem', color: '#64748b' }}>{desc}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <span style={{ fontSize:'0.68rem', fontWeight:700, padding:'0.12rem 0.5rem', borderRadius:99, background:`${color}18`, color, border:`1px solid ${color}30` }}>{band}</span>
          <span style={{ fontSize:'0.88rem', fontWeight:800, color }}>{Math.round(value)}</span>
        </div>
      </div>
      <div style={{ height:10, background: '#e2e8f0', borderRadius:99, overflow:'hidden' }}>
        <div className="score-bar-fill" style={{ width:`${value}%`, height:'100%', background:color, borderRadius:99, boxShadow:`0 0 10px ${color}70` }} />
      </div>
    </div>
  );
}

function EvoFutureTwinCard({ twin }: { twin: TwinState }) {
  const [evoTab, setEvoTab] = useState<EvoTabDays>(30);
  const prevFt = useRef<FutureTwin | null>(null);
  const ftMap: Record<EvoTabDays, FutureTwin|null> = { 30: twin.future_twin??null, 60: twin.future_twin_60??null, 90: twin.future_twin_90??null };
  const ft = ftMap[evoTab] ?? prevFt.current;
  if (ft) prevFt.current = ft;
  if (!ft) return null;
  const cfg = EVO_TAB_CFG[evoTab];
  const metrics = [
    { label:'Overall',     cur:twin.overall_score,     fut:ft.overall_score,     grad:EVO_SCORE_GRADS[0] },
    { label:'Academic',    cur:twin.academic_score,    fut:ft.academic_score,    grad:EVO_SCORE_GRADS[1] },
    { label:'Wellness',    cur:twin.wellness_score,    fut:ft.wellness_score,    grad:EVO_SCORE_GRADS[2] },
    { label:'Consistency', cur:twin.consistency_score, fut:ft.consistency_score, grad:EVO_SCORE_GRADS[3] },
  ];
  return (
    <div style={{ ...C, padding:'1.25rem 1.5rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.1rem', flexWrap:'wrap' as const, gap:'0.6rem' }}>
        <h3 style={{ fontSize:'0.95rem', fontWeight:700, color: '#0f172a', margin:0 }}>Future Twin</h3>
        <div style={{ display:'flex', gap:'0.25rem', padding:'3px', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius:12 }}>
          {([30,60,90] as EvoTabDays[]).map(days => {
            const c = EVO_TAB_CFG[days]; const isA = evoTab === days;
            return <button key={days} onClick={() => setEvoTab(days)} style={{ padding:'0.3rem 0.75rem', borderRadius:9, border:isA?`1px solid ${c.activeBorder}`:'1px solid transparent', background:isA?c.activeGrad:'transparent', color:isA?c.accent:'#475569', fontSize:'0.72rem', fontWeight:700, cursor:'pointer', transition:'all 0.18s', fontFamily:'inherit' }}>{c.label}</button>;
          })}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.6rem', marginBottom:'0.9rem' }}>
        {metrics.map(m => {
          const delta = m.fut - m.cur; const dc = delta >= 2 ? '#10b981' : delta <= -2 ? '#ef4444' : '#64748b';
          return (
            <div key={m.label} style={{ padding:'0.7rem 0.85rem', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.35rem' }}>
                <span style={{ fontSize:'0.72rem', color: '#64748b', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.05em' }}>{m.label}</span>
                <span style={{ fontSize:'0.72rem', fontWeight:700, color:dc }}>{delta >= 0 ? '+' : ''}{Math.round(delta)}</span>
              </div>
              <div style={{ display:'flex', alignItems:'baseline', gap:'0.3rem', marginBottom:'0.4rem' }}>
                <span style={{ fontSize:'0.78rem', color: '#64748b' }}>{Math.round(m.cur)}</span>
                <span style={{ fontSize:'0.7rem', color:'#334155' }}>→</span>
                <span style={{ fontSize:'1.1rem', fontWeight:800, color: '#0f172a' }}>{Math.round(m.fut)}</span>
              </div>
              <div style={{ height:4, background: '#f8f9fa', borderRadius:99, overflow:'hidden' }}>
                <div className="score-bar-fill" style={{ height:'100%', width:`${m.fut}%`, background: delta >= 0 ? m.grad : 'linear-gradient(90deg,#ef4444,#f87171)', borderRadius:99 }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display:'grid', gridTemplateColumns: ft.predicted_exam_score !== null ? '140px 1fr' : '1fr', gap:'0.6rem', marginBottom: ft.tips.length > 0 ? '0.75rem' : 0 }}>
        {ft.predicted_exam_score !== null && (
          <div style={{ padding:'0.6rem 0.75rem', background:cfg.examBg, border:`1px solid ${cfg.examBorder}`, borderRadius:10, display:'flex', flexDirection:'column', justifyContent:'center' }}>
            <span style={{ fontSize:'0.68rem', color: '#64748b', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.05em', marginBottom:'0.2rem' }}>Exam Score</span>
            <div style={{ display:'flex', alignItems:'baseline', gap:'0.2rem' }}>
              <span key={evoTab} style={{ fontSize:'1.5rem', fontWeight:800, background:cfg.examGrad, WebkitBackgroundClip:'text', backgroundClip:'text', WebkitTextFillColor:'transparent' }}>{ft.predicted_exam_score}</span>
              <span style={{ fontSize:'0.75rem', color: '#64748b' }}>/100</span>
            </div>
          </div>
        )}
        <div style={{ padding:'0.6rem 0.75rem', background: EVO_MSG_BG[twin.trend] ?? 'rgba(245,158,11,0.08)', border:`1px solid ${EVO_MSG_BORDER[twin.trend] ?? 'rgba(245,158,11,0.25)'}`, borderRadius:10, display:'flex', alignItems:'center' }}>
          <p style={{ margin:0, fontSize:'0.8rem', color: EVO_MSG_COLOR[twin.trend] ?? '#fde68a', lineHeight:1.5 }}>{ft.motivational_message}</p>
        </div>
      </div>
      {ft.tips.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
          {ft.tips.map((tip, i) => (
            <div key={i} style={{ display:'flex', gap:'0.5rem', alignItems:'flex-start' }}>
              <span style={{ color:cfg.tipArrow, fontWeight:700, fontSize:'0.75rem', flexShrink:0, marginTop:'0.1rem' }}>→</span>
              <p style={{ margin:0, fontSize:'0.78rem', color: '#64748b', lineHeight:1.5 }}>{tip}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EvoEvolutionDashboard({ twin }: { twin: TwinState }) {
  const [activeLayers, setActiveLayers] = useState<Set<EvoLayerKey>>(new Set(EVO_LAYERS.map(l => l.key)));
  const toggleLayer = (key: EvoLayerKey) => {
    setActiveLayers(prev => { const next = new Set(prev); if (next.has(key)) { if (next.size > 1) next.delete(key); } else next.add(key); return next; });
  };
  const history = twin.history ?? [];
  const evolutionTimeline = twin.evolution_timeline ?? [];
  const matLevel = twin.twin_maturity_level ?? 1;
  const matColor = EVO_MATURITY_COLORS[matLevel] || '#818cf8';
  const hm = twin.cognitive_heatmap ?? null;
  const hasHistory = history.length >= 2;
  const tisDelta = history.length >= 2
    ? history[history.length - 1].twin_intelligence_score - history[history.length - 2].twin_intelligence_score
    : null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>

      {/* KPI row */}
      <div style={{ ...C, padding:'1.5rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1.25rem' }}>
          <span style={{ fontSize:'1.1rem' }}>◈</span>
          <h3 style={{ fontSize:'0.95rem', fontWeight:700, color: '#0f172a', margin:0 }}>Digital Twin Evolution Dashboard</h3>
          <span style={{ marginLeft:'auto', fontSize:'0.68rem', fontWeight:700, color: '#64748b', padding:'0.18rem 0.55rem', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius:99 }}>Real-time · {twin.data_points} data pts</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.75rem' }} className="mob-4-col">
          <div style={{ padding:'1.1rem', background:'rgba(129,140,248,0.14)', border:'1px solid rgba(129,140,248,0.35)', borderRadius:14 }}>
            <p style={{ margin:'0 0 0.3rem', fontSize:'0.62rem', fontWeight:700, color:'#a5b4fc', textTransform:'uppercase' as const, letterSpacing:'0.08em' }}>Twin Intelligence Score</p>
            <div style={{ display:'flex', alignItems:'baseline', gap:'0.4rem' }}>
              <span style={{ fontSize:'2.2rem', fontWeight:900, color: '#0f172a', lineHeight:1 }}>{Math.round(twin.twin_intelligence_score)}</span>
              <span style={{ fontSize:'0.8rem', color: '#475569' }}>/100</span>
              {tisDelta !== null && <span style={{ fontSize:'0.75rem', fontWeight:800, color:tisDelta >= 0 ? '#34d399' : '#f87171' }}>{tisDelta >= 0 ? '+' : ''}{tisDelta.toFixed(1)}</span>}
            </div>
            <p style={{ margin:'0.4rem 0 0', fontSize:'0.68rem', color: '#475569', lineHeight:1.45 }}>Composite score of how well the twin knows your learning behavior.</p>
          </div>
          <div style={{ padding:'1.1rem', background:'rgba(6,182,212,0.13)', border:'1px solid rgba(6,182,212,0.35)', borderRadius:14 }}>
            <p style={{ margin:'0 0 0.3rem', fontSize:'0.62rem', fontWeight:700, color:'#67e8f9', textTransform:'uppercase' as const, letterSpacing:'0.08em' }}>Confidence Level</p>
            <div style={{ display:'flex', alignItems:'baseline', gap:'0.4rem' }}>
              <span style={{ fontSize:'2.2rem', fontWeight:900, color: '#0f172a', lineHeight:1 }}>{Math.round(twin.confidence_level)}</span>
              <span style={{ fontSize:'0.8rem', color: '#475569' }}>%</span>
            </div>
            <div style={{ height:6, background:'rgba(255,255,255,0.12)', borderRadius:99, overflow:'hidden', marginTop:'0.5rem' }}>
              <div style={{ width:`${twin.confidence_level}%`, height:'100%', background:'linear-gradient(90deg,#22d3ee,#06b6d4)', borderRadius:99, transition:'width 1s ease' }} />
            </div>
            <p style={{ margin:'0.4rem 0 0', fontSize:'0.68rem', color: '#475569' }}>How confident the twin is in its predictions.</p>
          </div>
          <div style={{ padding:'1.1rem', background:`${matColor}18`, border:`1px solid ${matColor}50`, borderRadius:14 }}>
            <p style={{ margin:'0 0 0.3rem', fontSize:'0.62rem', fontWeight:700, color:matColor, textTransform:'uppercase' as const, letterSpacing:'0.08em' }}>Twin Maturity</p>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem' }}>
              <span style={{ fontSize:'2rem', fontWeight:900, color: '#0f172a', lineHeight:1 }}>L{matLevel}</span>
              <span style={{ fontSize:'0.85rem', fontWeight:800, color:matColor }}>{EVO_MATURITY_LABELS[matLevel]}</span>
            </div>
            <div style={{ display:'flex', gap:4 }}>
              {[1,2,3,4,5].map(l => <div key={l} style={{ flex:1, height:6, borderRadius:99, background: l <= matLevel ? matColor : 'rgba(255,255,255,0.1)' }} />)}
            </div>
            <p style={{ margin:'0.4rem 0 0', fontSize:'0.68rem', color: '#475569' }}>Grows over time. Expert at Level 5.</p>
          </div>
          <div style={{ padding:'1.1rem', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.16)', borderRadius:14 }}>
            <p style={{ margin:'0 0 0.3rem', fontSize:'0.62rem', fontWeight:700, color:'#E5E7EB', textTransform:'uppercase' as const, letterSpacing:'0.08em' }}>Current State</p>
            <p style={{ margin:'0 0 0.45rem', fontSize:'1.05rem', fontWeight:800, color: '#0f172a', lineHeight:1.25 }}>{twin.current_state_label}</p>
            <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' as const }}>
              <span style={{ fontSize:'0.65rem', padding:'0.15rem 0.5rem', borderRadius:99, background:'rgba(139,92,246,0.2)', color:'#c4b5fd', border:'1px solid rgba(139,92,246,0.4)' }}>Reliability {Math.round(twin.prediction_reliability)}%</span>
              <span style={{ fontSize:'0.65rem', padding:'0.15rem 0.5rem', borderRadius:99, background:'rgba(99,102,241,0.18)', color:'#a5b4fc', border:'1px solid rgba(99,102,241,0.35)' }}>Behavior: {twin.behavior_understanding}</span>
            </div>
            <p style={{ margin:'0.4rem 0 0', fontSize:'0.68rem', color: '#475569' }}>The twin's current academic mode assessment.</p>
          </div>
        </div>
      </div>

      {/* Multi-layer evolution graph */}
      <div style={C}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'1rem', flexWrap:'wrap' as const, gap:'0.75rem' }}>
          <div>
            <h3 style={{ fontSize:'0.95rem', fontWeight:700, color: '#0f172a', margin:'0 0 0.2rem' }}>Multi-Layer Evolution Graph</h3>
            <p style={{ margin:0, fontSize:'0.72rem', color: '#64748b' }}>Each line is a different dimension of how your twin is evolving. Hover a point to see what drove the change.</p>
          </div>
          <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' as const }}>
            {EVO_LAYERS.map(l => {
              const on = activeLayers.has(l.key);
              return <button key={l.key} onClick={() => toggleLayer(l.key)} style={{ padding:'0.25rem 0.65rem', borderRadius:99, fontSize:'0.65rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s', background: on ? `${l.color}20` : 'rgba(255,255,255,0.03)', color: on ? l.color : '#475569', border:`1px solid ${on ? l.color + '50' : 'rgba(255,255,255,0.08)'}` }}>{l.label}</button>;
            })}
          </div>
        </div>
        {!hasHistory ? (
          <div style={{ textAlign:'center' as const, padding:'3rem 1rem', color: '#64748b' }}>
            <p style={{ fontSize:'1.5rem', margin:'0 0 0.5rem' }}>◈</p>
            <p style={{ margin:0, fontSize:'0.85rem' }}>Log at least 2 check-ins to activate the evolution graph.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={history} margin={{ top:5, right:16, bottom:5, left:-20 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill:'rgba(255,255,255,0.7)', fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={d => { const p = d.split('-'); return p.length === 3 ? `${p[1]}/${p[2]}` : d; }} />
              <YAxis domain={[0,100]} tick={{ fill:'rgba(255,255,255,0.7)', fontSize:11 }} axisLine={false} tickLine={false} />
              <RechartsTooltip content={<EvoTooltip />} cursor={{ stroke:'rgba(255,255,255,0.08)' }} />
              {EVO_LAYERS.filter(l => activeLayers.has(l.key)).map(l => (
                <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={activeLayers.size === 1 ? 2.5 : 1.8} dot={{ fill:l.color, r:3, strokeWidth:0 }} activeDot={{ r:6, stroke:l.color, strokeWidth:2, fill:'#08131a' }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'0.4rem', marginTop:'0.85rem' }}>
          {EVO_LAYERS.map(l => (
            <div key={l.key} style={{ display:'flex', gap:'0.5rem', alignItems:'flex-start', opacity: activeLayers.has(l.key) ? 1 : 0.35, transition:'opacity 0.2s' }}>
              <div style={{ width:12, height:3, background:l.color, borderRadius:99, marginTop:6, flexShrink:0 }} />
              <div>
                <span style={{ fontSize:'0.72rem', fontWeight:700, color:l.color }}>{l.label}</span>
                <p style={{ margin:0, fontSize:'0.62rem', color: '#64748b', lineHeight:1.4 }}>{l.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evolution Timeline + Cognitive Heatmap */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }} className="mob-twin-row">
        <div style={C}>
          <h3 style={{ fontSize:'0.95rem', fontWeight:700, color: '#0f172a', marginBottom:'1.25rem' }}>Evolution Timeline</h3>
          {evolutionTimeline.length === 0 ? (
            <p style={{ color: '#64748b', fontSize:'0.82rem' }}>Log more check-ins to build your evolution story.</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {evolutionTimeline.map((ev, i) => (
                <div key={i} style={{ display:'flex', gap:'0.75rem', paddingBottom: i < evolutionTimeline.length - 1 ? '0.9rem' : 0 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(129,140,248,0.12)', border:'1px solid rgba(129,140,248,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.85rem', flexShrink:0 }}>{ev.icon}</div>
                    {i < evolutionTimeline.length - 1 && <div style={{ width:1, flex:1, background: '#f8f9fa', marginTop:4 }} />}
                  </div>
                  <div style={{ paddingTop:4 }}>
                    <p style={{ margin:'0 0 0.2rem', fontSize:'0.65rem', fontWeight:700, color:'#818cf8', letterSpacing:'0.06em' }}>{ev.date}</p>
                    <p style={{ margin:0, fontSize:'0.77rem', color: '#475569', lineHeight:1.5 }}>{ev.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={C}>
          <div style={{ marginBottom:'1rem' }}>
            <h3 style={{ fontSize:'0.95rem', fontWeight:700, color: '#0f172a', margin:'0 0 0.2rem' }}>Cognitive Heatmap</h3>
            <p style={{ margin:0, fontSize:'0.72rem', color: '#64748b' }}>How your brain's learning dimensions are performing.</p>
          </div>
          <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap' as const }}>
            {([['#10b981','Strong ≥70'],['#f59e0b','Developing 45–69'],['#ef4444','Needs Work <45']] as [string,string][]).map(([cl, lb]) => (
              <span key={lb} style={{ fontSize:'0.62rem', fontWeight:600, color:cl, display:'flex', alignItems:'center', gap:'0.3rem' }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:cl, display:'inline-block' }} />{lb}
              </span>
            ))}
          </div>
          {hm ? (
            <>
              <EvoHeatBar label="Knowledge Areas"       value={hm.knowledge_areas}      desc="Academic depth across subjects" />
              <EvoHeatBar label="Memory Strength"       value={hm.memory_strength}       desc="Quiz & assignment retention" />
              <EvoHeatBar label="Focus Stability"       value={hm.focus_stability}       desc="Consistency of focused sessions" />
              <EvoHeatBar label="Learning Speed"        value={hm.learning_speed}        desc="Rate of score improvement" />
              <EvoHeatBar label="Prediction Confidence" value={hm.prediction_confidence} desc="Data density for reliable forecasts" />
            </>
          ) : (
            <p style={{ color: '#64748b', fontSize:'0.82rem' }}>Log check-ins to build your cognitive profile.</p>
          )}
        </div>
      </div>

      {/* AI Insights */}
      {twin.ai_insights.length > 0 && (
        <div style={C}>
          <div style={{ marginBottom:'1rem' }}>
            <h3 style={{ fontSize:'0.95rem', fontWeight:700, color: '#0f172a', margin:'0 0 0.2rem' }}>AI Twin Insights</h3>
            <p style={{ margin:0, fontSize:'0.72rem', color: '#64748b' }}>Observations generated by your digital twin based on actual behavioral patterns.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'0.7rem' }} className="mob-twin-row">
            {twin.ai_insights.map((insight, i) => (
              <div key={i} style={{ display:'flex', gap:'0.6rem', padding:'0.9rem', background:'rgba(129,140,248,0.12)', border:'1px solid rgba(129,140,248,0.28)', borderRadius:12 }}>
                <span style={{ fontSize:'1rem', flexShrink:0, marginTop:1 }}>{i === 0 ? '' : i === 1 ? '' : i === 2 ? '' : ''}</span>
                <p style={{ margin:0, fontSize:'0.82rem', color:'#E5E7EB', lineHeight:1.6 }}>{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Explanation */}
      <div style={C}>
        <h3 style={{ fontSize:'0.95rem', fontWeight:700, color: '#0f172a', marginBottom:'1rem' }}>What These Metrics Mean</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'0.7rem' }} className="mob-twin-row">
          {[
            { label:'Twin Intelligence Score', value:`${Math.round(twin.twin_intelligence_score)}/100`, color:'#818cf8', explain:'A composite score from your study hours, quiz performance, assignment completion, and focus quality. Higher = the twin knows you better.' },
            { label:'Twin Maturity Level', value:`Level ${matLevel}/5 — ${EVO_MATURITY_LABELS[matLevel]}`, color:matColor, explain:'Grows as you log more data over longer periods. A mature twin makes more accurate predictions and generates deeper insights.' },
            { label:'Prediction Reliability', value:`${Math.round(twin.prediction_reliability)}%`, color:'#a78bfa', explain:'How confident the twin is in its future predictions. Increases with more consistent and complete check-in data.' },
            { label:'Behavior Understanding', value:twin.behavior_understanding, color:'#34d399', explain:'How deeply the twin understands your patterns. Ranges from Low (just started) to Expert (30+ data points with consistent logging).' },
          ].map(m => (
            <div key={m.label} style={{ padding:'0.85rem', background:`${m.color}08`, border:`1px solid ${m.color}20`, borderRadius:12 }}>
              <p style={{ margin:'0 0 0.15rem', fontSize:'0.62rem', fontWeight:700, color:m.color, textTransform:'uppercase' as const, letterSpacing:'0.07em' }}>{m.label}</p>
              <p style={{ margin:'0 0 0.4rem', fontSize:'0.95rem', fontWeight:800, color: '#0f172a' }}>{m.value}</p>
              <p style={{ margin:0, fontSize:'0.73rem', color: '#64748b', lineHeight:1.5 }}>{m.explain}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PRIVACY TAB
═══════════════════════════════════════════════════════════════════════ */
function PrivacyTab({ profile, onReset }: { profile:DPTProfile; onReset:()=>void }) {
  const [confirm,setConfirm]=useState(false);
  function exportProfile() {
    const blob=new Blob([JSON.stringify(profile,null,2)],{type:'application/json'}), url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download=`twinmind_dpt_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
  }
  const DS=[{name:'Study Sessions',desc:'Session duration, hours, focus data'},{name:'Quiz Performance',desc:'Scores, accuracy, attempts'},{name:'Check-In Data',desc:'Mood, stress, wellness logs'},{name:'Streak Activity',desc:'Daily consistency tracking'},{name:'Achievement Data',desc:'XP, badges, level progress'},{name:'Interview Answers',desc:'Your Build My Twin responses'}];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
      <SectionHead icon="" title="Privacy & Data Control" desc="View, manage, export, or delete all data used by your Digital Persona Twin. You remain in full control of your twin at all times." color="#94a3b8" />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
        <div style={C}>
          <p style={{ margin:'0 0 0.85rem', fontSize:'0.8rem', fontWeight:800, color: '#0f172a' }}>Data Sources</p>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {DS.map(ds=>(
              <div key={ds.name} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.6rem 0.85rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius:11 }}>
                <div style={{ width:8,height:8,borderRadius:'50%',background:'#10b981',boxShadow:'0 0 6px rgba(16,185,129,0.5)',flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontSize:'0.78rem', fontWeight:700, color: '#0f172a' }}>{ds.name}</p>
                  <p style={{ margin:0, fontSize:'0.64rem', color: '#64748b' }}>{ds.desc}</p>
                </div>
                <span style={{ fontSize:'0.57rem', fontWeight:800, color:'#10b981' }}>ACTIVE</span>
              </div>
            ))}
          </div>
        </div>
        <div style={C}>
          <p style={{ margin:'0 0 0.85rem', fontSize:'0.8rem', fontWeight:800, color: '#0f172a' }}>Profile Management</p>
          <div style={{ padding:'0.85rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius:12, marginBottom:'0.75rem' }}>
            <p style={{ margin:'0 0 0.2rem', fontSize:'0.78rem', fontWeight:700, color: '#0f172a' }}>Profile Summary</p>
            <p style={{ margin:0, fontSize:'0.7rem', color: '#64748b', lineHeight:1.6 }}>Created: {profile.createdAt.slice(0,10)}<br/>Last updated: {profile.updatedAt.slice(0,10)}<br/>Interview: {Object.keys(profile.interview.answers).length}/{INTERVIEW.length} answered<br/>Memories: {profile.memories.length} stored</p>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
            <button onClick={exportProfile} style={{ padding:'0.65rem 1rem', borderRadius:11, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.22)', color:'#818cf8', fontWeight:700, fontSize:'0.8rem', cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const }}> Export DPT Profile (JSON)</button>
            <a href="/twin" style={{ padding:'0.65rem 1rem', borderRadius:11, background:'rgba(129,140,248,0.1)', border:'1px solid rgba(129,140,248,0.25)', color:'#a5b4fc', fontWeight:700, fontSize:'0.8rem', textDecoration:'none', display:'block' }}> Evolution Dashboard →</a>
            {!confirm?(
              <button onClick={()=>setConfirm(true)} style={{ padding:'0.65rem 1rem', borderRadius:11, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', fontWeight:700, fontSize:'0.8rem', cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const }}> Reset DPT Profile</button>
            ):(
              <div style={{ padding:'0.85rem', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.28)', borderRadius:12 }}>
                <p style={{ margin:'0 0 0.6rem', fontSize:'0.78rem', color:'#f87171', fontWeight:700 }}>Are you sure? This cannot be undone.</p>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  <button onClick={()=>{onReset();setConfirm(false);}} style={{ flex:1,padding:'0.5rem',borderRadius:9,background:'#ef4444',border:'none',color:'#fff',fontWeight:800,fontSize:'0.78rem',cursor:'pointer',fontFamily:'inherit' }}>Yes, Reset</button>
                  <button onClick={()=>setConfirm(false)} style={{ flex:1,padding:'0.5rem',borderRadius:9,background: '#f8f9fa',border: '1px solid #e2e8f0',color: '#475569',fontWeight:700,fontSize:'0.78rem',cursor:'pointer',fontFamily:'inherit' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════ */
export default function DigitalPersonaTwin() {
  const { user, token } = useAuth();
  const [activeTab, setTab] = useState<DPTTab>('evolution');
  const [sticky, setSticky] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile]   = useState<DPTProfile>(loadProfile);
  const [twin, setTwin]         = useState<TwinState | null>(null);
  const [subjects, setSubjects] = useState<SubjectAnalysis | null>(null);
  const [burnout, setBurnout]   = useState<BurnoutData | null>(null);
  const [learning, setLearning] = useState<LearningEntry[]>([]);
  const [streak, setStreak]     = useState<StreakStatus | null>(null);
  const [progress, setProgress] = useState<GamificationProgress | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/twin',{headers:{Authorization:`Bearer ${token}`}}).then(r=>setTwin(r.data)).catch(()=>{}),
      api.get('/subject-performance/analysis').then(r=>setSubjects(r.data)).catch(()=>{}),
      api.get('/burnout/latest').then(r=>setBurnout(r.data)).catch(()=>{}),
      api.get('/learning-data?limit=30').then(r=>setLearning(Array.isArray(r.data)?r.data:[])).catch(()=>{}),
      api.get('/streak-protection/status').then(r=>setStreak(r.data)).catch(()=>{}),
      api.get<GamificationProgress>('/gamification/progress').then(r=>setProgress(r.data)).catch(()=>{}),
    ]).finally(()=>setLoading(false));
  }, [token]);

  useEffect(() => {
    const h = () => setSticky(window.scrollY > (heroRef.current?.offsetHeight??380) + 100);
    window.addEventListener('scroll', h, {passive:true});
    return () => window.removeEventListener('scroll', h);
  }, []);

  const saveAndPersist = useCallback((p: DPTProfile) => { setProfile(p); saveProfile(p); }, []);
  function resetProfile() { const f={...BLANK_PROFILE,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}; setProfile(f); saveProfile(f); }

  const fid      = computeFidelity(profile, twin, subjects, burnout, learning);
  const answered = Object.keys(profile.interview.answers).length;
  const lowData  = !twin || twin.data_points < 3;

  return (
    <div style={{ minHeight:'100svh', display:'flex', flexDirection:'column', position:'relative' }}>
      <div style={{ position:'fixed', width:900, height:900, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,0.015) 0%,transparent 70%)', top:-300, right:-250, pointerEvents:'none', zIndex:0 }} />

      {sticky && <TabBar active={activeTab} setActive={setTab} sticky />}


      <main style={{ flex:1, padding:'2rem 2rem 6rem', maxWidth:1080, width:'100%', margin:'0 auto', boxSizing:'border-box', position:'relative', zIndex:1 }}>
        {loading?(
          <div style={{ textAlign:'center', padding:'5rem', color: '#64748b' }}>
            <TwinAvatar size={80} glow="#6366f1" />
            <p style={{ marginTop:'1.5rem', fontSize:'0.9rem' }}>Initialising your Digital Persona Twin…</p>
          </div>
        ):(
          <>
            <div ref={heroRef}>
              <HeroSection fid={fid} twin={twin} user={user} onNavigate={setTab} />
            </div>

            <TabBar active={activeTab} setActive={setTab} />
            {sticky && <div style={{ height:56 }} />}

            {answered < 6 && (
              <div onClick={()=>setTab('overview')} style={{ cursor:'pointer', marginBottom:'1.25rem', padding:'0.85rem 1.2rem', background:'rgba(99,102,241,0.07)', border:'1px solid rgba(99,102,241,0.22)', borderRadius:14, display:'flex', alignItems:'center', gap:'0.75rem' }}>
                <span style={{ fontSize:'1.1rem' }}></span>
                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontSize:'0.82rem', fontWeight:700, color:'#818cf8' }}>Your twin is calibrating — complete the Build My Twin interview</p>
                  <p style={{ margin:'0.1rem 0 0', fontSize:'0.7rem', color: '#64748b' }}>{answered}/{INTERVIEW.length} questions answered · {Math.round(answered/INTERVIEW.length*100)}% complete</p>
                </div>
                <span style={{ fontSize:'0.78rem', color: '#0052cc', fontWeight:700 }}>Start →</span>
              </div>
            )}

            <div style={{ animation:'slide-up 0.3s ease' }}>
              {activeTab==='overview' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
                  {lowData && <EmptyState twin={twin} profile={profile} subjects={subjects} learningData={learning} />}
                  <BuildMyTwinPanel profile={profile} onSave={saveAndPersist} />
                  {twin?.ai_insights?.length && (
                    <div style={C}>
                      <SectionHead icon="" title="Latest AI Insights" desc="Real-time insights generated from your twin's analysis of your activity and performance." color="#f59e0b" />
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.7rem' }}>
                        {twin.ai_insights.slice(0,4).map((ins,i)=>(
                          <div key={i} style={{ padding:'0.8rem 0.95rem', background:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.12)', borderRadius:13, display:'flex', gap:'0.55rem' }}>
                            <span style={{ flexShrink:0, fontSize:'1rem' }}>{['','','',''][i]}</span>
                            <p style={{ margin:0, fontSize:'0.77rem', color: '#475569', lineHeight:1.6 }}>{ins}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {twin && (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.75rem' }}>
                      {[
                        {label:'Overall Score', value:`${Math.round(twin.overall_score)}/100`, color: '#0052cc'},
                        {label:'Academic',       value:`${Math.round(twin.academic_score)}/100`, color:'#06b6d4'},
                        {label:'Consistency',    value:`${Math.round(twin.consistency_score)}%`, color:'#10b981'},
                        {label:'Data Points',    value:`${twin.data_points}`, color:'#f59e0b'},
                      ].map(s=>(
                        <div key={s.label} className="glass-card glass-hover glass-mint" style={{ ...C, textAlign:'center', padding:'1.1rem' }}>
                          <p style={{ margin:'0 0 0.25rem', fontSize:'0.6rem', fontWeight:700, color: '#64748b', letterSpacing:'0.07em', textTransform:'uppercase' as const }}>{s.label}</p>
                          <p style={{ margin:0, fontSize:'1.3rem', fontWeight:900, color:s.color }}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab==='identity'     && <IdentityTab profile={profile} user={user} />}
              {activeTab==='persona'      && <PersonaTab profile={profile} twin={twin} burnout={burnout} learningData={learning} streakData={streak} progress={progress} />}
              {activeTab==='memory'       && <MemoryTab profile={profile} twin={twin} progress={progress} streakData={streak} />}
              {activeTab==='graph'        && <KnowledgeGraphTab profile={profile} twin={twin} subjects={subjects} progress={progress} />}
              {activeTab==='intelligence' && <IntelligenceTab profile={profile} twin={twin} subjects={subjects} burnout={burnout} streakData={streak} />}
              {activeTab==='privacy'      && <PrivacyTab profile={profile} onReset={resetProfile} />}
              {activeTab==='evolution'    && (twin ? (
                <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
                  <EvoEvolutionDashboard twin={twin} />
                  <EvoFutureTwinCard twin={twin} />
                </div>
              ) : (
                <div style={{ padding:'3rem', textAlign:'center' as const, color: '#64748b' }}>No twin data yet — log check-ins to activate Evolution.</div>
              ))}
              {activeTab==='comparison'   && <HumanVsTwinDashboard />}
              {activeTab==='simulator'    && <DecisionSimulator twin={twin} subjects={subjects} progress={progress} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SHARED STYLE TOKENS
═══════════════════════════════════════════════════════════════════════ */
const C: React.CSSProperties = {
  background:'rgba(8,12,30,0.82)', border:'1px solid rgba(255,255,255,0.14)',
  borderRadius:20, padding:'1.6rem', backdropFilter:'blur(10px)',
  boxShadow:'0 4px 24px rgba(0,0,0,0.6)',
};
const LB: React.CSSProperties = { margin:'0 0 0.2rem', fontSize:'0.6rem', fontWeight:700, color:'#6B7280', letterSpacing:'0.07em', textTransform:'uppercase' as const };
const VL: React.CSSProperties = { margin:0, fontSize:'0.8rem', color: '#475569', lineHeight:1.55 };

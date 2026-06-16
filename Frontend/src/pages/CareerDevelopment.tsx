import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, AreaChart, Area, Legend,
} from 'recharts';
import BackButton from '../components/BackButton';
import VoiceInterview from '../components/VoiceInterview';
import api from '../services/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface CareerOverview {
  score: number; grade: string;
  strengths: string[]; areas_to_improve: string[];
  component_scores: Record<string, number>;
  twin_prediction: string; job_readiness_probability: number;
}
interface ResumeSectionData { name: string; score: number; feedback: string; suggestions: string[] }
interface BulletImprovement { section: string; original: string; improved: string; reason: string }
interface ResumeResult {
  score: number; ats_score: number; formatting_score: number;
  content_score: number; keyword_score: number; industry_relevance: string;
  strengths: string[]; weaknesses: string[]; grammar_issues: string[];
  formatting_issues: string[]; suggestions: string[];
  missing_keywords: string[]; sections: ResumeSectionData[];
  bullet_improvements: BulletImprovement[]; twin_updated: boolean;
}
interface LinkedInResult {
  score: number; visibility_score: number; personal_brand_score: number; recruiter_score: number;
  section_scores: Record<string, number>; optimized_headline: string; optimized_summary: string;
  suggestions: string[]; missing_skills: string[]; missing_certifications: string[];
  networking_suggestions: string[]; keyword_recommendations: string[]; twin_updated: boolean;
}
interface InterviewMsg { role: string; content: string }
interface InterviewChatResp {
  message: string; question_number?: number; total_questions: number;
  is_complete: boolean; scores?: Record<string, number>; feedback?: string;
  strengths: string[]; improvements: string[]; twin_updated: boolean;
}
interface SkillGap {
  target_career: string; current_skills: string[]; missing_skills: string[];
  missing_certifications: string[]; missing_projects: string[];
  learning_plan: Array<{ step: number; title: string; description: string; resources: string[]; duration: string }>;
  compatibility_score: number; learning_priority: string;
}
interface Recommendation { role: string; compatibility: number; reasoning: string; required_skills: string[]; key_matches: string[] }
interface CareerRecs { recommendations: Recommendation[]; top_match: string; twin_insight: string }
interface JobMatch {
  role: string; match_percent: number; skill_gap_percent: number;
  resume_readiness: number; interview_readiness: number; reasoning: string;
  key_skills_matched: string[]; missing_skills: string[];
  recommended_certifications: string[]; portfolio_projects: string[];
}
interface JobMatches { matches: JobMatch[]; top_role: string }
interface RoadmapStepData {
  step: number; title: string; description: string;
  duration: string; resources: string[]; skills: string[]; status: string;
}
interface Roadmap {
  current_position: string; target_career: string;
  steps: RoadmapStepData[]; estimated_time: string;
  twin_success_probability: number;
  monthly_milestones: Array<{ month: number; goal: string; deliverable: string }>;
}
interface CodingChallenge {
  title: string; problem: string;
  examples: Array<{ input: string; output: string; explanation?: string }>;
  hints: string[]; difficulty: string; topic: string;
  constraints: string[]; expected_approach: string;
}
interface CodingEval {
  score: number; is_correct: boolean; feedback: string;
  time_complexity: string; space_complexity: string;
  approach_quality: string; improvements: string[]; twin_updated: boolean;
}
interface TwinPrediction { months: number; career_twin_score: number; employability_score: number; interview_readiness: number; industry_readiness: number }
interface CareerTwinData {
  career_twin_score: number; employability_score: number;
  interview_readiness: number; industry_readiness: number;
  resume_score: number; linkedin_score: number;
  interview_score: number; coding_score: number;
  skills: string[]; certifications: string[];
  last_updated: string | null;
  predictions: Record<string, TwinPrediction>;
  score_history: Array<Record<string, number | string>>;
  twin_insight: string; current_state_label: string;
}
interface Analytics {
  career_twin_trend: Array<Record<string, number | string>>;
  score_breakdown_trend: Array<Record<string, number | string>>;
  skill_radar: Array<{ skill: string; current: number; target: number }>;
  total_analyses: number; top_improvement: string; consistency_score: number;
}

// ── Theme ─────────────────────────────────────────────────────────────────────

const BG     = '#060b18';
const CARD   = 'rgba(255,255,255,0.04)';
const CARD2  = 'rgba(255,255,255,0.06)';
const BORDER = '1px solid rgba(255,255,255,0.08)';
const CYAN   = '#00D4FF';
const INDIGO = '#6366f1';
const GREEN  = '#10b981';
const AMBER  = '#f59e0b';
const RED    = '#ef4444';
const PURPLE = '#8b5cf6';
const PINK   = '#ec4899';
const TEXT   = '#f1f5f9';
const MUTED  = '#94a3b8';
const DIM    = '#475569';

const TABS = [
  { id: 'twin',            label: 'Career Twin',    icon: '🤖' },
  { id: 'overview',        label: 'Readiness',      icon: '🎯' },
  { id: 'resume',          label: 'Resume',         icon: '📄' },
  { id: 'linkedin',        label: 'LinkedIn',       icon: '💼' },
  { id: 'interview',       label: 'Interview',      icon: '🎤' },
  { id: 'coding',          label: 'Coding',         icon: '💻' },
  { id: 'skillgap',        label: 'Skill Gap',      icon: '📊' },
  { id: 'recommendations', label: 'Careers',        icon: '🌟' },
  { id: 'jobmatch',        label: 'Job Match',      icon: '🔍' },
  { id: 'roadmap',         label: 'Roadmap',        icon: '🗺️' },
  { id: 'analytics',       label: 'Analytics',      icon: '📈' },
  { id: 'resources',       label: 'Resources',      icon: '📚' },
];

const CAREER_OPTIONS = ['AI Engineer','Data Scientist','ML Engineer','Software Developer','Research Engineer','Data Analyst','Backend Developer','DevOps Engineer'];

const RESOURCES = [
  { name:'LinkedIn',    url:'https://linkedin.com',      icon:'💼', color:'#0077b5', desc:'Professional networking and job search.',       tip:'Update profile weekly; connect with 5 new people daily.' },
  { name:'LeetCode',    url:'https://leetcode.com',      icon:'⚡', color:'#f89f1b', desc:'3000+ coding interview problems.',              tip:'Solve 1 problem daily. Focus on patterns, not memorization.' },
  { name:'GitHub',      url:'https://github.com',        icon:'🐙', color:'#f0f6fc', desc:'Host projects and contribute to open source.',  tip:'Maintain green contribution graph. Pin your best 6 projects.' },
  { name:'Kaggle',      url:'https://kaggle.com',        icon:'🔬', color:'#20beff', desc:'ML competitions and real-world datasets.',      tip:'Aim for top 10% in competitions to boost your profile.' },
  { name:'HackerRank',  url:'https://hackerrank.com',    icon:'🟢', color:'#00ea64', desc:'Coding challenges and skill certifications.',   tip:'Earn 5-star certificates to show employers verified skills.' },
  { name:'Codeforces',  url:'https://codeforces.com',    icon:'🏆', color:'#1c86ee', desc:'Competitive programming contests.',             tip:'Participate in rated contests to reach Specialist+ rating.' },
  { name:'Coursera',    url:'https://coursera.org',      icon:'🎓', color:'#0056d2', desc:'University courses from top institutions.',     tip:'Complete specializations for structured learning paths.' },
  { name:'edX',         url:'https://edx.org',           icon:'📖', color:'#02262b', desc:'Professional certs from MIT, Harvard, and more.',tip:'Enroll in MicroMasters programs for deep expertise.' },
  { name:'Udemy',       url:'https://udemy.com',         icon:'🎯', color:'#a435f0', desc:'Practical skill courses at low cost.',          tip:'Buy on sale (~$15). Focus on project-based courses.' },
];

// ── Shared primitives ────────────────────────────────────────────────────────

function Loader({ text = 'Analyzing…' }: { text?: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.75rem', padding:'3rem', color:MUTED }}>
      <div style={{ width:20, height:20, border:`2px solid ${INDIGO}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      {text}
    </div>
  );
}

function ScoreRing({ score, color, size = 110 }: { score:number; color:string; size?:number }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const d = (score / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={9} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={9}
        strokeDasharray={`${d} ${c-d}`} strokeLinecap="round"
        style={{ transition:'stroke-dasharray 1s ease', filter:`drop-shadow(0 0 6px ${color}88)` }} />
    </svg>
  );
}

function Bar({ value, color, height = 6 }: { value:number; color:string; height?:number }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:99, height, overflow:'hidden' }}>
      <div style={{ width:`${Math.min(value,100)}%`, height:'100%', background:color, borderRadius:99, transition:'width 1s ease' }} />
    </div>
  );
}

function Tag({ text, color }: { text:string; color:string }) {
  return <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:99, fontSize:'0.72rem', fontWeight:600, background:`${color}22`, color, border:`1px solid ${color}44` }}>{text}</span>;
}

function ScoreCard({ label, value, color, icon }: { label:string; value:number; color:string; icon:string }) {
  return (
    <div style={{ background:CARD2, border:`1px solid ${color}30`, borderRadius:16, padding:'1.1rem', textAlign:'center' }}>
      <div style={{ fontSize:'1.4rem', marginBottom:4 }}>{icon}</div>
      <div style={{ fontSize:'0.7rem', color:MUTED, textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:'1.8rem', fontWeight:800, color, lineHeight:1 }}>{value}</div>
      <Bar value={value} color={color} height={3} />
    </div>
  );
}

function TwinBadge({ label }: { label:string }) {
  const c = label==='Highly Employable' ? GREEN : label==='Interview Ready' ? CYAN : label==='Building Profile' ? AMBER : MUTED;
  return <span style={{ padding:'4px 12px', borderRadius:99, background:`${c}22`, color:c, border:`1px solid ${c}44`, fontSize:'0.78rem', fontWeight:700 }}>{label}</span>;
}

// ── Section: Career Twin ──────────────────────────────────────────────────────

function CareerTwinSection() {
  const [data, setData] = useState<CareerTwinData|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<CareerTwinData>('/career/twin')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader text="Loading Career Twin…" />;
  if (!data) return <div style={{ padding:'2rem', color:MUTED }}>Could not load Career Twin. Check your connection.</div>;

  const mainColor = data.career_twin_score >= 75 ? GREEN : data.career_twin_score >= 50 ? CYAN : data.career_twin_score >= 25 ? AMBER : RED;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      {/* Hero */}
      <div style={{ background:`linear-gradient(135deg,${INDIGO}18,${CYAN}10,${PURPLE}08)`, border:`1px solid ${INDIGO}35`, borderRadius:24, padding:'2rem', display:'grid', gridTemplateColumns:'auto 1fr', gap:'2rem', alignItems:'center' }}>
        <div style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
          <ScoreRing score={data.career_twin_score} color={mainColor} size={140} />
          <div style={{ position:'absolute', textAlign:'center' }}>
            <div style={{ fontSize:'2.4rem', fontWeight:900, color:TEXT, lineHeight:1 }}>{data.career_twin_score}</div>
            <div style={{ fontSize:'0.65rem', color:MUTED, letterSpacing:1, textTransform:'uppercase' }}>Twin Score</div>
          </div>
        </div>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
            <span style={{ fontSize:'1.6rem', fontWeight:800, color:TEXT }}>Career Twin</span>
            <TwinBadge label={data.current_state_label} />
          </div>
          <div style={{ color:MUTED, fontSize:'0.88rem', lineHeight:1.6, marginBottom:'1rem' }}>{data.twin_insight}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.5rem' }}>
            <ScoreCard label="Resume"    value={data.resume_score}   color={CYAN}   icon="📄" />
            <ScoreCard label="LinkedIn"  value={data.linkedin_score} color="#0077b5" icon="💼" />
            <ScoreCard label="Interview" value={data.interview_score}color={PURPLE}  icon="🎤" />
            <ScoreCard label="Coding"    value={data.coding_score}   color={AMBER}   icon="💻" />
          </div>
        </div>
      </div>

      {/* Second row: Employability + Predictions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
        {/* Employability gauges */}
        <div style={{ background:CARD, border:BORDER, borderRadius:20, padding:'1.5rem' }}>
          <div style={{ color:TEXT, fontWeight:700, marginBottom:'1.2rem' }}>Readiness Scores</div>
          {[
            { label:'Employability Score',   value:data.employability_score,  color:GREEN  },
            { label:'Interview Readiness',   value:data.interview_readiness,  color:PURPLE },
            { label:'Industry Readiness',    value:data.industry_readiness,   color:AMBER  },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ marginBottom:'1rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:'0.83rem', color:MUTED }}>{label}</span>
                <span style={{ fontSize:'0.83rem', fontWeight:700, color }}>{value}%</span>
              </div>
              <Bar value={value} color={color} height={8} />
            </div>
          ))}
          {data.skills.length > 0 && (
            <div style={{ marginTop:'1rem' }}>
              <div style={{ fontSize:'0.75rem', color:MUTED, marginBottom:6, textTransform:'uppercase', letterSpacing:1 }}>Detected Skills</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {data.skills.slice(0,12).map(s => <Tag key={s} text={s} color={CYAN} />)}
              </div>
            </div>
          )}
        </div>

        {/* Predictions */}
        <div style={{ background:CARD, border:BORDER, borderRadius:20, padding:'1.5rem' }}>
          <div style={{ color:TEXT, fontWeight:700, marginBottom:'1.2rem' }}>Future State Predictions</div>
          {(['3m','6m','12m'] as const).map((key, i) => {
            const pred = data.predictions[key];
            if (!pred) return null;
            const label = key === '3m' ? '3 Months' : key === '6m' ? '6 Months' : '12 Months';
            const color = [CYAN, INDIGO, GREEN][i];
            return (
              <div key={key} style={{ background:'rgba(255,255,255,0.03)', border:BORDER, borderRadius:12, padding:'0.85rem', marginBottom:'0.75rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ color:TEXT, fontWeight:600, fontSize:'0.88rem' }}>{label}</span>
                  <span style={{ color, fontWeight:800, fontSize:'1.1rem' }}>{pred.career_twin_score}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 1rem' }}>
                  {[
                    { k:'Employability', v:pred.employability_score   },
                    { k:'Interview',     v:pred.interview_readiness   },
                    { k:'Industry',      v:pred.industry_readiness    },
                  ].map(({ k, v }) => (
                    <div key={k}>
                      <div style={{ display:'flex', justifyContent:'space-between' }}>
                        <span style={{ fontSize:'0.7rem', color:DIM }}>{k}</span>
                        <span style={{ fontSize:'0.7rem', color:MUTED }}>{v}</span>
                      </div>
                      <Bar value={v} color={color} height={3} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Score history chart */}
      {data.score_history.length >= 2 && (
        <div style={{ background:CARD, border:BORDER, borderRadius:20, padding:'1.5rem' }}>
          <div style={{ color:TEXT, fontWeight:700, marginBottom:'1rem' }}>Career Twin Evolution</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data.score_history}>
              <defs>
                <linearGradient id="empGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={GREEN}  stopOpacity={0.3} />
                  <stop offset="95%" stopColor={GREEN}  stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill:DIM, fontSize:10 }} />
              <YAxis domain={[0,100]} tick={{ fill:DIM, fontSize:10 }} />
              <Tooltip contentStyle={{ background:'#0d1117', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:TEXT, fontSize:12 }} />
              <Area type="monotone" dataKey="employability" stroke={GREEN} strokeWidth={2} fill="url(#empGrad)" name="Employability" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.score_history.length === 0 && (
        <div style={{ background:`${AMBER}0a`, border:`1px solid ${AMBER}30`, borderRadius:16, padding:'1.25rem', display:'flex', gap:'1rem', alignItems:'flex-start' }}>
          <span style={{ fontSize:'1.5rem' }}>💡</span>
          <div>
            <div style={{ color:AMBER, fontWeight:700, marginBottom:4 }}>Career Twin needs data to evolve</div>
            <div style={{ color:MUTED, fontSize:'0.85rem', lineHeight:1.6 }}>Upload your resume, complete a mock interview, or submit a coding solution. Every action updates your Career Twin and unlocks predictive insights.</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section: Career Readiness ─────────────────────────────────────────────────

function OverviewSection() {
  const [data, setData] = useState<CareerOverview|null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  useEffect(() => {
    api.get<CareerOverview>('/career/overview').then(r => setData(r.data)).catch(() => setErr('Failed to load.')).finally(() => setLoading(false));
  }, []);
  if (loading) return <Loader />;
  if (err) return <div style={{ padding:'2rem', color:RED }}>{err}</div>;
  if (!data) return null;
  const gc = data.grade==='A' ? GREEN : data.grade==='B' ? CYAN : data.grade==='C' ? AMBER : RED;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
        <div style={{ background:CARD, border:BORDER, borderRadius:20, padding:'1.75rem', display:'flex', alignItems:'center', gap:'1.75rem' }}>
          <div style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
            <ScoreRing score={data.score} color={gc} size={130} />
            <div style={{ position:'absolute', textAlign:'center' }}>
              <div style={{ fontSize:'2.2rem', fontWeight:900, color:TEXT }}>{data.score}</div>
              <div style={{ fontSize:'0.65rem', color:MUTED }}>/ 100</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize:'1.6rem', fontWeight:800, color:gc }}>Grade {data.grade}</div>
            <div style={{ color:TEXT, fontWeight:600, marginTop:4 }}>Career Readiness Score</div>
            <div style={{ color:MUTED, fontSize:'0.82rem', marginTop:8, lineHeight:1.6 }}>{data.job_readiness_probability >= 0.8 ? 'Excellent — nearly job-ready.' : data.job_readiness_probability >= 0.6 ? 'Good — keep building.' : 'Developing — focus on gaps.'}</div>
          </div>
        </div>
        <div style={{ background:CARD, border:BORDER, borderRadius:20, padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div>
            <div style={{ color:GREEN, fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>✓ Strengths</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>{data.strengths.map(s => <Tag key={s} text={s} color={GREEN} />)}</div>
          </div>
          <div>
            <div style={{ color:AMBER, fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>⚠ Improve</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>{data.areas_to_improve.map(s => <Tag key={s} text={s} color={AMBER} />)}</div>
          </div>
        </div>
      </div>
      <div style={{ background:CARD, border:BORDER, borderRadius:20, padding:'1.5rem' }}>
        <div style={{ color:TEXT, fontWeight:700, marginBottom:'1.2rem' }}>Performance Breakdown</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.9rem 2.5rem' }}>
          {Object.entries(data.component_scores).map(([k,v]) => {
            const c = v>=75?GREEN:v>=55?CYAN:v>=35?AMBER:RED;
            return (
              <div key={k}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <span style={{ fontSize:'0.8rem', color:MUTED }}>{k}</span>
                  <span style={{ fontSize:'0.8rem', fontWeight:700, color:c }}>{v.toFixed(0)}%</span>
                </div>
                <Bar value={v} color={c} />
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ background:`linear-gradient(135deg,${INDIGO}18,${CYAN}10)`, border:`1px solid ${INDIGO}40`, borderRadius:20, padding:'1.5rem', display:'flex', gap:'1rem' }}>
        <span style={{ fontSize:'1.8rem', flexShrink:0 }}>🤖</span>
        <div>
          <div style={{ color:CYAN, fontWeight:700, fontSize:'0.78rem', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>Digital Twin Prediction</div>
          <div style={{ color:TEXT, fontSize:'0.95rem', lineHeight:1.65 }}>{data.twin_prediction}</div>
        </div>
      </div>
    </div>
  );
}

// ── Section: Resume ───────────────────────────────────────────────────────────

function ResumeUploadSection() {
  const [mode, setMode] = useState<'upload'|'paste'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File|null>(null);
  const [pasteText, setPasteText] = useState('');
  const [role, setRole] = useState('');
  const [result, setResult] = useState<ResumeResult|null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState('');
  const [expandedSection, setExpandedSection] = useState<string|null>(null);
  const [activeBullet, setActiveBullet] = useState<number|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    const ok = f.name.match(/\.(pdf|docx|txt)$/i);
    if (!ok) { setErr('Only PDF, DOCX, and TXT files are supported.'); return; }
    if (f.size > 5 * 1024 * 1024) { setErr('File must be under 5 MB.'); return; }
    setFile(f); setErr('');
  }

  async function analyze() {
    setLoading(true); setErr(''); setResult(null); setProgress(0);
    try {
      let resp;
      if (mode === 'upload' && file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('target_role', role || 'Software Developer');
        resp = await api.post<ResumeResult>('/career/resume/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => setProgress(Math.round((e.loaded / (e.total||1)) * 90)),
        });
        setProgress(100);
      } else {
        if (!pasteText.trim()) { setErr('Please paste your resume text.'); return; }
        resp = await api.post<ResumeResult>('/career/resume/analyze', { resume_text: pasteText, target_role: role || 'Software Developer' });
      }
      setResult(resp.data);
    } catch (e: unknown) {
      const d = (e as {response?:{data?:{detail?:string}}})?.response?.data?.detail;
      setErr(d ?? 'Analysis failed. Please try again.');
    } finally { setLoading(false); setProgress(0); }
  }

  const scoreColor = (s:number) => s>=80?GREEN:s>=60?CYAN:s>=40?AMBER:RED;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      {/* Mode toggle */}
      <div style={{ display:'flex', gap:6 }}>
        {(['upload','paste'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{ padding:'0.45rem 1.1rem', borderRadius:8, border:`1px solid ${mode===m?CYAN:'rgba(255,255,255,0.1)'}`, background:mode===m?`${CYAN}18`:'transparent', color:mode===m?CYAN:MUTED, cursor:'pointer', fontWeight:600, fontSize:'0.82rem', textTransform:'capitalize' }}>
            {m==='upload' ? '📁 Upload File' : '📋 Paste Text'}
          </button>
        ))}
      </div>

      <div style={{ background:CARD, border:BORDER, borderRadius:20, padding:'1.5rem' }}>
        <input placeholder="Target role (e.g. AI Engineer)" value={role} onChange={e=>setRole(e.target.value)}
          style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:BORDER, borderRadius:10, padding:'0.6rem 1rem', color:TEXT, fontSize:'0.88rem', marginBottom:'1rem', boxSizing:'border-box' }} />

        {mode === 'upload' ? (
          <div
            onDragOver={e=>{e.preventDefault();setDragOver(true)}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
            onClick={()=>fileRef.current?.click()}
            style={{ border:`2px dashed ${dragOver?CYAN:'rgba(255,255,255,0.15)'}`, borderRadius:14, padding:'3rem 2rem', textAlign:'center', cursor:'pointer', background:dragOver?`${CYAN}08`:'transparent', transition:'all 0.2s' }}>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; if(f) handleFile(f); }} />
            <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>📁</div>
            {file ? (
              <div>
                <div style={{ color:GREEN, fontWeight:700, marginBottom:4 }}>✓ {file.name}</div>
                <div style={{ color:MUTED, fontSize:'0.8rem' }}>{(file.size/1024).toFixed(0)} KB — Click to change</div>
              </div>
            ) : (
              <div>
                <div style={{ color:TEXT, fontWeight:600, marginBottom:6 }}>Drag & drop your resume here</div>
                <div style={{ color:MUTED, fontSize:'0.82rem' }}>or click to browse — PDF, DOCX, TXT up to 5 MB</div>
              </div>
            )}
          </div>
        ) : (
          <textarea placeholder="Paste your full resume text here…" value={pasteText} onChange={e=>setPasteText(e.target.value)} rows={10}
            style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:BORDER, borderRadius:10, padding:'0.75rem 1rem', color:TEXT, fontSize:'0.83rem', resize:'vertical', fontFamily:'monospace', boxSizing:'border-box' }} />
        )}

        {progress > 0 && progress < 100 && (
          <div style={{ marginTop:'0.75rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:'0.75rem', color:MUTED }}>Uploading…</span>
              <span style={{ fontSize:'0.75rem', color:CYAN }}>{progress}%</span>
            </div>
            <Bar value={progress} color={CYAN} height={4} />
          </div>
        )}

        <button onClick={analyze} disabled={loading || (mode==='upload'?!file:!pasteText.trim())}
          style={{ marginTop:'1rem', width:'100%', padding:'0.75rem', background:loading?DIM:`linear-gradient(135deg,${INDIGO},${CYAN})`, border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:loading?'not-allowed':'pointer', fontSize:'0.95rem' }}>
          {loading ? 'Analyzing…' : '🔍 Analyze Resume'}
        </button>
        {err && <div style={{ color:RED, fontSize:'0.83rem', marginTop:8 }}>{err}</div>}
      </div>

      {loading && <Loader text="AI is reviewing your resume…" />}

      {result && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          {/* Score header */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'0.75rem' }}>
            {[
              { label:'Resume Score',    value:result.score,            color:scoreColor(result.score)            },
              { label:'ATS Score',       value:result.ats_score,        color:scoreColor(result.ats_score)        },
              { label:'Formatting',      value:result.formatting_score, color:scoreColor(result.formatting_score) },
              { label:'Content',         value:result.content_score,    color:scoreColor(result.content_score)    },
              { label:'Keywords',        value:result.keyword_score,    color:scoreColor(result.keyword_score)    },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background:CARD, border:BORDER, borderRadius:14, padding:'0.85rem', textAlign:'center' }}>
                <div style={{ fontSize:'0.68rem', color:MUTED, textTransform:'uppercase', letterSpacing:1 }}>{label}</div>
                <div style={{ fontSize:'1.8rem', fontWeight:800, color, margin:'4px 0' }}>{value}</div>
                <Bar value={value} color={color} height={3} />
              </div>
            ))}
          </div>

          {/* Industry relevance */}
          {result.industry_relevance && (
            <div style={{ background:`${CYAN}0a`, border:`1px solid ${CYAN}25`, borderRadius:14, padding:'1rem', display:'flex', gap:'0.75rem' }}>
              <span style={{ fontSize:'1.2rem' }}>🏭</span>
              <div><span style={{ color:CYAN, fontWeight:600, fontSize:'0.82rem' }}>Industry Relevance: </span><span style={{ color:MUTED, fontSize:'0.83rem' }}>{result.industry_relevance}</span></div>
            </div>
          )}

          {/* Strengths / Weaknesses */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div style={{ background:CARD, border:BORDER, borderRadius:14, padding:'1.1rem' }}>
              <div style={{ color:GREEN, fontWeight:700, fontSize:'0.82rem', marginBottom:'0.65rem' }}>✓ Strengths</div>
              {result.strengths.map((s,i) => <div key={i} style={{ color:MUTED, fontSize:'0.81rem', marginBottom:4 }}>• {s}</div>)}
            </div>
            <div style={{ background:CARD, border:BORDER, borderRadius:14, padding:'1.1rem' }}>
              <div style={{ color:RED, fontWeight:700, fontSize:'0.82rem', marginBottom:'0.65rem' }}>✗ Weaknesses</div>
              {result.weaknesses.map((w,i) => <div key={i} style={{ color:MUTED, fontSize:'0.81rem', marginBottom:4 }}>• {w}</div>)}
            </div>
          </div>

          {/* Grammar / Formatting issues */}
          {(result.grammar_issues.length > 0 || result.formatting_issues.length > 0) && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              {result.grammar_issues.length > 0 && (
                <div style={{ background:CARD, border:`1px solid ${AMBER}30`, borderRadius:14, padding:'1.1rem' }}>
                  <div style={{ color:AMBER, fontWeight:700, fontSize:'0.82rem', marginBottom:'0.65rem' }}>✎ Grammar Issues</div>
                  {result.grammar_issues.map((g,i) => <div key={i} style={{ color:MUTED, fontSize:'0.81rem', marginBottom:4 }}>• {g}</div>)}
                </div>
              )}
              {result.formatting_issues.length > 0 && (
                <div style={{ background:CARD, border:`1px solid ${AMBER}30`, borderRadius:14, padding:'1.1rem' }}>
                  <div style={{ color:AMBER, fontWeight:700, fontSize:'0.82rem', marginBottom:'0.65rem' }}>⊞ Formatting Issues</div>
                  {result.formatting_issues.map((f,i) => <div key={i} style={{ color:MUTED, fontSize:'0.81rem', marginBottom:4 }}>• {f}</div>)}
                </div>
              )}
            </div>
          )}

          {/* Section-by-section */}
          <div style={{ background:CARD, border:BORDER, borderRadius:16, padding:'1.25rem' }}>
            <div style={{ color:TEXT, fontWeight:700, marginBottom:'1rem' }}>Section-by-Section Analysis</div>
            {result.sections.map(sec => {
              const c = scoreColor(sec.score);
              const open = expandedSection === sec.name;
              return (
                <div key={sec.name} style={{ marginBottom:'0.6rem', border:BORDER, borderRadius:10, overflow:'hidden' }}>
                  <div onClick={() => setExpandedSection(open?null:sec.name)} style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'0.7rem 1rem', cursor:'pointer', background:'rgba(255,255,255,0.03)' }}>
                    <span style={{ color:TEXT, fontWeight:600, fontSize:'0.85rem', flex:1 }}>{sec.name}</span>
                    <Bar value={sec.score} color={c} height={5} />
                    <span style={{ fontWeight:700, color:c, fontSize:'0.85rem', width:36, textAlign:'right' }}>{sec.score}</span>
                    <span style={{ color:MUTED, fontSize:'0.7rem' }}>{open?'▲':'▼'}</span>
                  </div>
                  {open && (
                    <div style={{ padding:'0.75rem 1rem', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ color:MUTED, fontSize:'0.82rem', marginBottom:'0.5rem' }}>{sec.feedback}</div>
                      {sec.suggestions.map((s,i) => <div key={i} style={{ color:CYAN, fontSize:'0.8rem', marginBottom:3 }}>→ {s}</div>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bullet improvements */}
          {result.bullet_improvements.length > 0 && (
            <div style={{ background:CARD, border:BORDER, borderRadius:16, padding:'1.25rem' }}>
              <div style={{ color:TEXT, fontWeight:700, marginBottom:'0.25rem' }}>Bullet Point Improvements</div>
              <div style={{ color:MUTED, fontSize:'0.78rem', marginBottom:'1rem' }}>Click a card to see Before → After</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
                {result.bullet_improvements.map((b,i) => (
                  <div key={i} onClick={() => setActiveBullet(activeBullet===i?null:i)}
                    style={{ border:`1px solid ${activeBullet===i?INDIGO:'rgba(255,255,255,0.08)'}`, borderRadius:12, overflow:'hidden', cursor:'pointer' }}>
                    <div style={{ padding:'0.7rem 1rem', background:activeBullet===i?`${INDIGO}12`:'rgba(255,255,255,0.02)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:'0.72rem', color:INDIGO, fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>{b.section}</span>
                      <span style={{ fontSize:'0.72rem', color:MUTED }}>{activeBullet===i?'▲ Collapse':'▼ View Improvement'}</span>
                    </div>
                    {activeBullet === i ? (
                      <div style={{ padding:'0.85rem 1rem', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                        <div style={{ background:`${RED}0a`, border:`1px solid ${RED}25`, borderRadius:8, padding:'0.65rem 0.85rem' }}>
                          <div style={{ fontSize:'0.68rem', color:RED, fontWeight:700, marginBottom:4, textTransform:'uppercase' }}>Before</div>
                          <div style={{ color:MUTED, fontSize:'0.82rem', lineHeight:1.5 }}>{b.original}</div>
                        </div>
                        <div style={{ background:`${GREEN}0a`, border:`1px solid ${GREEN}25`, borderRadius:8, padding:'0.65rem 0.85rem' }}>
                          <div style={{ fontSize:'0.68rem', color:GREEN, fontWeight:700, marginBottom:4, textTransform:'uppercase' }}>After (Suggested)</div>
                          <div style={{ color:TEXT, fontSize:'0.83rem', lineHeight:1.5 }}>{b.improved}</div>
                        </div>
                        <div style={{ fontSize:'0.75rem', color:DIM, fontStyle:'italic' }}>Why: {b.reason}</div>
                      </div>
                    ) : (
                      <div style={{ padding:'0.6rem 1rem' }}>
                        <div style={{ color:DIM, fontSize:'0.8rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.original}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing keywords */}
          {result.missing_keywords.length > 0 && (
            <div style={{ background:CARD, border:BORDER, borderRadius:14, padding:'1.1rem' }}>
              <div style={{ color:AMBER, fontWeight:700, fontSize:'0.82rem', marginBottom:'0.65rem' }}>⚠ Missing Keywords</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {result.missing_keywords.map(k => <Tag key={k} text={k} color={AMBER} />)}
              </div>
            </div>
          )}

          {/* Suggestions */}
          <div style={{ background:CARD, border:BORDER, borderRadius:14, padding:'1.1rem' }}>
            <div style={{ color:CYAN, fontWeight:700, fontSize:'0.82rem', marginBottom:'0.65rem' }}>💡 Suggestions</div>
            {result.suggestions.map((s,i) => <div key={i} style={{ color:MUTED, fontSize:'0.82rem', marginBottom:4 }}>→ {s}</div>)}
          </div>

          {result.twin_updated && (
            <div style={{ background:`${GREEN}0a`, border:`1px solid ${GREEN}30`, borderRadius:12, padding:'0.75rem 1rem', display:'flex', gap:'0.75rem', alignItems:'center' }}>
              <span>🤖</span><span style={{ color:GREEN, fontSize:'0.83rem', fontWeight:600 }}>Career Twin updated with your resume score.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section: LinkedIn Digital Twin ───────────────────────────────────────────

// ── Types specific to LinkedIn Twin
interface LIAchievement { id:string; title:string; achievement_type:string; raw_text:string; skills_gained:string[]; technologies:string[]; difficulty_level:string; career_value:string; industry_relevance:string; impact_score:number; career_value_score:number; recruiter_appeal_score:number; why_it_matters:string; how_it_improves:string; career_paths_supported:string[]; uploaded_at:string }
interface LIImprovement  { section:string; current_version:string; suggested_version:string; reason:string }
interface LIChecklist    { key:string; label:string; completed:boolean; recommendation:string }
interface LIPrediction   { months:number; career_growth:string; recruiter_interest:number; employability_score:number; skill_growth:string; opportunities:string[] }
interface LISectionScore { name:string; score:number; feedback:string; suggestion:string }
interface LITwin {
  profile_strength:number; recruiter_visibility:number; personal_branding:number;
  industry_relevance_score:number; network_readiness:number; overall_score:number;
  sections:LISectionScore[]; suggested_headline:string; suggested_about:string;
  improvements:LIImprovement[]; checklist:LIChecklist[]; checklist_completion:number;
  suitable_roles:string[]; internship_opportunities:string[];
  missing_skills:string[]; missing_certifications:string[];
  important_projects:string[]; learning_priorities:string[];
  achievements:LIAchievement[]; achievements_count:number;
  predictions:Record<string, LIPrediction>; last_analyzed:string|null;
  twin_insight:string; twin_updated:boolean;
}

const LI_SUB_TABS = [
  { id:'input',     label:'Input',     icon:'📥' },
  { id:'profile',   label:'Twin',      icon:'👤' },
  { id:'achieve',   label:'Achieve',   icon:'🏆' },
  { id:'optimize',  label:'Optimize',  icon:'⚙️' },
  { id:'predict',   label:'Predict',   icon:'🔮' },
];

function LinkedInSection() {
  const [liTab, setLiTab] = useState<'input'|'profile'|'achieve'|'optimize'|'predict'>('input');
  const [twinData, setTwinData] = useState<LITwin|null>(null);
  const [twinLoading, setTwinLoading] = useState(true);

  // Load existing twin state on mount
  useEffect(() => {
    api.get<LITwin>('/career/linkedin/twin')
      .then(r => { setTwinData(r.data); if (r.data.last_analyzed) setLiTab('profile'); })
      .catch(() => {})
      .finally(() => setTwinLoading(false));
  }, []);

  const sc = (v:number) => v>=70?GREEN:v>=50?AMBER:RED;

  // ── Sub-tab: Input ─────────────────────────────────────────────────────────
  function InputTab() {
    const [inputMode, setInputMode] = useState<'paste'|'file'|'url'>('paste');
    const [profileText, setProfileText] = useState('');
    const [profileUrl, setProfileUrl] = useState('');
    const [role, setRole] = useState('');
    const [file, setFile] = useState<File|null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [progress, setProgress] = useState(0);
    const fileRef = useRef<HTMLInputElement>(null);

    async function analyze() {
      setLoading(true); setErr(''); setProgress(10);
      try {
        const fd = new FormData();
        if (file) fd.append('file', file);
        fd.append('profile_text', profileText);
        fd.append('profile_url', profileUrl);
        fd.append('target_role', role || 'Software Developer');
        setProgress(40);
        const r = await api.post<LITwin>('/career/linkedin/upload', fd, {
          headers:{ 'Content-Type':'multipart/form-data' },
          onUploadProgress: (e) => setProgress(40 + Math.round((e.loaded/(e.total||1))*40)),
        });
        setProgress(100);
        setTwinData(r.data);
        setLiTab('profile');
      } catch(e:unknown) {
        const d=(e as {response?:{data?:{detail?:string}}})?.response?.data?.detail;
        setErr(d ?? 'Analysis failed. Please try again.');
      } finally { setLoading(false); setProgress(0); }
    }

    const INPUT_MODES = [
      { id:'paste', label:'Paste Text',  icon:'📋' },
      { id:'file',  label:'Upload File', icon:'📁' },
      { id:'url',   label:'Profile URL', icon:'🔗' },
    ] as const;

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
        {/* Mode selector */}
        <div style={{ display:'flex', gap:6 }}>
          {INPUT_MODES.map(m => (
            <button key={m.id} onClick={() => setInputMode(m.id)}
              style={{ padding:'0.45rem 1rem', borderRadius:8, border:`1px solid ${inputMode===m.id?'#0077b5':'rgba(255,255,255,0.1)'}`, background:inputMode===m.id?'#0077b522':'transparent', color:inputMode===m.id?'#5cb8ff':MUTED, cursor:'pointer', fontWeight:600, fontSize:'0.82rem' }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        <div style={{ background:CARD, border:BORDER, borderRadius:20, padding:'1.5rem', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          <input placeholder="Target role (e.g. AI Engineer)" value={role} onChange={e=>setRole(e.target.value)}
            style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:BORDER, borderRadius:10, padding:'0.6rem 1rem', color:TEXT, fontSize:'0.88rem', boxSizing:'border-box' }} />

          {inputMode === 'paste' && (
            <textarea placeholder="Paste your full LinkedIn profile here — include Headline, About, Experience, Skills, Projects, Certifications…" value={profileText} onChange={e=>setProfileText(e.target.value)} rows={10}
              style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:BORDER, borderRadius:10, padding:'0.75rem 1rem', color:TEXT, fontSize:'0.83rem', resize:'vertical', boxSizing:'border-box' }} />
          )}

          {inputMode === 'file' && (
            <div>
              <div onClick={() => fileRef.current?.click()}
                style={{ border:`2px dashed ${file?GREEN:'rgba(255,255,255,0.15)'}`, borderRadius:14, padding:'2.5rem', textAlign:'center', cursor:'pointer', background:file?`${GREEN}06`:'transparent' }}>
                <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display:'none' }}
                  onChange={e => setFile(e.target.files?.[0] || null)} />
                <div style={{ fontSize:'2rem', marginBottom:8 }}>📁</div>
                {file ? (
                  <div><div style={{ color:GREEN, fontWeight:700 }}>✓ {file.name}</div><div style={{ color:MUTED, fontSize:'0.78rem' }}>Click to change</div></div>
                ) : (
                  <div><div style={{ color:TEXT, fontWeight:600 }}>Upload LinkedIn PDF or profile export</div><div style={{ color:MUTED, fontSize:'0.78rem' }}>PDF, DOCX, or TXT — max 5 MB</div></div>
                )}
              </div>
              <textarea placeholder="Optional: add extra context or notes…" value={profileText} onChange={e=>setProfileText(e.target.value)} rows={3}
                style={{ width:'100%', marginTop:8, background:'rgba(255,255,255,0.04)', border:BORDER, borderRadius:10, padding:'0.65rem 1rem', color:TEXT, fontSize:'0.82rem', resize:'none', boxSizing:'border-box' }} />
            </div>
          )}

          {inputMode === 'url' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
              <input placeholder="https://linkedin.com/in/yourprofile" value={profileUrl} onChange={e=>setProfileUrl(e.target.value)}
                style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:BORDER, borderRadius:10, padding:'0.6rem 1rem', color:TEXT, fontSize:'0.88rem', boxSizing:'border-box' }} />
              <div style={{ background:`${AMBER}0a`, border:`1px solid ${AMBER}25`, borderRadius:8, padding:'0.65rem 0.85rem', fontSize:'0.78rem', color:AMBER }}>
                LinkedIn requires authentication to scrape profiles. Please also paste your profile content below for analysis.
              </div>
              <textarea placeholder="Paste your profile content here as well…" value={profileText} onChange={e=>setProfileText(e.target.value)} rows={7}
                style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:BORDER, borderRadius:10, padding:'0.75rem 1rem', color:TEXT, fontSize:'0.83rem', resize:'vertical', boxSizing:'border-box' }} />
            </div>
          )}

          {progress > 0 && progress < 100 && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:'0.73rem', color:MUTED }}>Analyzing…</span>
                <span style={{ fontSize:'0.73rem', color:CYAN }}>{progress}%</span>
              </div>
              <Bar value={progress} color={CYAN} height={4} />
            </div>
          )}

          <button onClick={analyze} disabled={loading || (!profileText.trim() && !file && !profileUrl.trim())}
            style={{ padding:'0.75rem', background:loading?DIM:`linear-gradient(135deg,#0077b5,${CYAN})`, border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'0.95rem' }}>
            {loading ? 'Analyzing with AI…' : '🔍 Analyze LinkedIn Profile'}
          </button>
          {err && <div style={{ color:RED, fontSize:'0.82rem' }}>{err}</div>}
        </div>

        {twinLoading && <Loader text="Loading LinkedIn Twin…" />}
        {!twinLoading && twinData && !twinData.last_analyzed && (
          <div style={{ background:`${INDIGO}0a`, border:`1px solid ${INDIGO}30`, borderRadius:14, padding:'1.25rem', display:'flex', gap:'1rem', alignItems:'flex-start' }}>
            <span style={{ fontSize:'1.6rem' }}>💡</span>
            <div>
              <div style={{ color:INDIGO, fontWeight:700, marginBottom:4 }}>How to get the most from LinkedIn Digital Twin</div>
              <div style={{ color:MUTED, fontSize:'0.83rem', lineHeight:1.7 }}>
                1. Paste or upload your full LinkedIn profile content.<br/>
                2. Upload your certificates and achievements in the <strong style={{ color:CYAN }}>Achievements</strong> tab.<br/>
                3. Check the <strong style={{ color:CYAN }}>Optimize</strong> tab for checklist and before/after improvements.<br/>
                4. View your career growth forecasts in the <strong style={{ color:CYAN }}>Predict</strong> tab.
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Sub-tab: Twin Profile ──────────────────────────────────────────────────
  function ProfileTab() {
    if (!twinData || !twinData.last_analyzed) return (
      <div style={{ padding:'3rem', textAlign:'center', color:MUTED }}>
        <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>👤</div>
        <div style={{ fontWeight:700, color:TEXT, marginBottom:6 }}>No profile analyzed yet</div>
        <div style={{ fontSize:'0.85rem', marginBottom:'1rem' }}>Go to the Input tab to upload or paste your LinkedIn profile.</div>
        <button onClick={() => setLiTab('input')} style={{ padding:'0.55rem 1.5rem', background:INDIGO, border:'none', borderRadius:10, color:'#fff', fontWeight:600, cursor:'pointer' }}>Go to Input</button>
      </div>
    );
    const d = twinData;
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
        {/* Twin insight */}
        <div style={{ background:`linear-gradient(135deg,#0077b520,${CYAN}10)`, border:'1px solid #0077b540', borderRadius:18, padding:'1.5rem', display:'flex', gap:'1rem', alignItems:'flex-start' }}>
          <div style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <ScoreRing score={d.overall_score} color={sc(d.overall_score)} size={100} />
            <div style={{ position:'absolute', textAlign:'center' }}>
              <div style={{ fontSize:'1.5rem', fontWeight:900, color:TEXT, lineHeight:1 }}>{d.overall_score}</div>
              <div style={{ fontSize:'0.6rem', color:MUTED }}>Score</div>
            </div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ color:'#5cb8ff', fontWeight:700, fontSize:'0.78rem', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>LinkedIn Digital Twin</div>
            <div style={{ color:TEXT, fontSize:'0.93rem', lineHeight:1.6, marginBottom:'0.75rem' }}>{d.twin_insight}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'0.5rem' }}>
              {[
                { label:'Profile',   value:d.profile_strength       },
                { label:'Visibility',value:d.recruiter_visibility    },
                { label:'Branding',  value:d.personal_branding       },
                { label:'Industry',  value:d.industry_relevance_score},
                { label:'Network',   value:d.network_readiness       },
              ].map(({ label, value }) => {
                const c = sc(value);
                return (
                  <div key={label} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:'0.65rem', color:MUTED, marginBottom:3 }}>{label}</div>
                    <div style={{ fontWeight:800, fontSize:'1.1rem', color:c }}>{value}</div>
                    <Bar value={value} color={c} height={3} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section scores */}
        {d.sections.length > 0 && (
          <div style={{ background:CARD, border:BORDER, borderRadius:16, padding:'1.25rem' }}>
            <div style={{ color:TEXT, fontWeight:700, marginBottom:'1rem' }}>Section-by-Section Analysis</div>
            {d.sections.map(sec => {
              const c = sc(sec.score);
              return (
                <div key={sec.name} style={{ marginBottom:'0.85rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:'0.83rem', color:TEXT }}>{sec.name}</span>
                    <span style={{ fontSize:'0.83rem', fontWeight:700, color:c }}>{sec.score}/100</span>
                  </div>
                  <Bar value={sec.score} color={c} height={6} />
                  <div style={{ fontSize:'0.75rem', color:DIM, marginTop:3 }}>{sec.feedback}</div>
                  {sec.suggestion && <div style={{ fontSize:'0.75rem', color:CYAN, marginTop:2 }}>→ {sec.suggestion}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* Generated content */}
        {d.suggested_headline && (
          <div style={{ background:CARD, border:BORDER, borderRadius:14, padding:'1.1rem' }}>
            <div style={{ color:CYAN, fontWeight:700, fontSize:'0.83rem', marginBottom:8 }}>✨ Suggested Headline</div>
            <div style={{ background:`${CYAN}08`, border:`1px solid ${CYAN}25`, borderRadius:8, padding:'0.75rem', color:TEXT, fontSize:'0.9rem', lineHeight:1.6 }}>{d.suggested_headline}</div>
          </div>
        )}
        {d.suggested_about && (
          <div style={{ background:CARD, border:BORDER, borderRadius:14, padding:'1.1rem' }}>
            <div style={{ color:CYAN, fontWeight:700, fontSize:'0.83rem', marginBottom:8 }}>✨ Suggested About Section</div>
            <div style={{ background:`${CYAN}06`, border:`1px solid ${CYAN}20`, borderRadius:8, padding:'0.85rem', color:MUTED, fontSize:'0.86rem', lineHeight:1.75 }}>{d.suggested_about}</div>
          </div>
        )}

        {/* Career recommendations */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
          {[
            { label:'Suitable Roles',         items:d.suitable_roles,          color:GREEN  },
            { label:'Internship Opportunities',items:d.internship_opportunities, color:CYAN   },
            { label:'Missing Skills',          items:d.missing_skills,          color:RED    },
            { label:'Missing Certifications',  items:d.missing_certifications,  color:AMBER  },
            { label:'Important Projects',      items:d.important_projects,      color:PURPLE },
            { label:'Learning Priorities',     items:d.learning_priorities,     color:INDIGO },
          ].map(({ label, items, color }) => items.length > 0 && (
            <div key={label} style={{ background:CARD, border:BORDER, borderRadius:14, padding:'1rem' }}>
              <div style={{ color, fontWeight:700, fontSize:'0.78rem', textTransform:'uppercase', letterSpacing:0.8, marginBottom:'0.55rem' }}>{label}</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>{items.map(item => <Tag key={item} text={item} color={color} />)}</div>
            </div>
          ))}
        </div>

        <div style={{ color:DIM, fontSize:'0.72rem', textAlign:'right' }}>Last analyzed: {d.last_analyzed ? new Date(d.last_analyzed).toLocaleString() : '—'}</div>
      </div>
    );
  }

  // ── Sub-tab: Achievements ──────────────────────────────────────────────────
  function AchievementsTab() {
    const [uploadMode, setUploadMode] = useState<'file'|'manual'>('file');
    const [achFile, setAchFile] = useState<File|null>(null);
    const [achType, setAchType] = useState('certificate');
    const [manualTitle, setManualTitle] = useState('');
    const [manualDesc, setManualDesc] = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [expandedId, setExpandedId] = useState<string|null>(null);
    const achFileRef = useRef<HTMLInputElement>(null);

    const achievements = twinData?.achievements || [];

    async function uploadCert() {
      if (!achFile) return;
      setLoading(true); setErr('');
      try {
        const fd = new FormData();
        fd.append('file', achFile);
        fd.append('achievement_type', achType);
        const r = await api.post<{ achievement:LIAchievement; twin_updated:boolean }>('/career/linkedin/certificate', fd, { headers:{ 'Content-Type':'multipart/form-data' } });
        setTwinData(prev => prev ? { ...prev, achievements:[r.data.achievement, ...prev.achievements], achievements_count:prev.achievements_count+1 } : prev);
        setAchFile(null);
      } catch(e:unknown) {
        const d=(e as {response?:{data?:{detail?:string}}})?.response?.data?.detail;
        setErr(d ?? 'Upload failed.');
      } finally { setLoading(false); }
    }

    async function addManual() {
      if (!manualTitle.trim() || !manualDesc.trim()) return;
      setLoading(true); setErr('');
      try {
        const r = await api.post<{ achievement:LIAchievement }>('/career/linkedin/achievement', { title:manualTitle, description:manualDesc, achievement_type:achType });
        setTwinData(prev => prev ? { ...prev, achievements:[r.data.achievement, ...prev.achievements], achievements_count:prev.achievements_count+1 } : prev);
        setManualTitle(''); setManualDesc('');
      } catch(e:unknown) {
        const d=(e as {response?:{data?:{detail?:string}}})?.response?.data?.detail;
        setErr(d ?? 'Failed to add achievement.');
      } finally { setLoading(false); }
    }

    async function deleteAchievement(id: string) {
      try {
        await api.delete(`/career/linkedin/achievement/${id}`);
        setTwinData(prev => prev ? { ...prev, achievements:prev.achievements.filter(a=>a.id!==id), achievements_count:prev.achievements_count-1 } : prev);
      } catch { /* ignore */ }
    }

    const ACH_TYPES = ['certificate','internship','project','skill','hackathon','award','course','other'];
    const scoreColor = (v:number) => v>=80?GREEN:v>=60?CYAN:v>=40?AMBER:RED;

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
        {/* Upload panel */}
        <div style={{ background:CARD, border:BORDER, borderRadius:20, padding:'1.5rem' }}>
          <div style={{ color:TEXT, fontWeight:700, marginBottom:'1rem' }}>Add Achievement or Certificate</div>
          <div style={{ display:'flex', gap:6, marginBottom:'1rem' }}>
            {[{id:'file' as const, label:'Upload File'}, {id:'manual' as const, label:'Manual Entry'}].map(m => (
              <button key={m.id} onClick={() => setUploadMode(m.id)}
                style={{ padding:'0.38rem 0.9rem', borderRadius:8, border:`1px solid ${uploadMode===m.id?CYAN:'rgba(255,255,255,0.1)'}`, background:uploadMode===m.id?`${CYAN}18`:'transparent', color:uploadMode===m.id?CYAN:MUTED, cursor:'pointer', fontWeight:600, fontSize:'0.8rem' }}>
                {m.label}
              </button>
            ))}
          </div>

          <div style={{ marginBottom:'0.75rem' }}>
            <div style={{ color:MUTED, fontSize:'0.73rem', marginBottom:4 }}>Type</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {ACH_TYPES.map(t => (
                <button key={t} onClick={() => setAchType(t)}
                  style={{ padding:'0.3rem 0.75rem', borderRadius:6, border:`1px solid ${achType===t?PURPLE:'rgba(255,255,255,0.1)'}`, background:achType===t?`${PURPLE}22`:'transparent', color:achType===t?PURPLE:MUTED, cursor:'pointer', fontSize:'0.76rem', fontWeight:achType===t?700:400, textTransform:'capitalize' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {uploadMode === 'file' ? (
            <div>
              <div onClick={() => achFileRef.current?.click()}
                style={{ border:`2px dashed ${achFile?GREEN:'rgba(255,255,255,0.15)'}`, borderRadius:12, padding:'1.75rem', textAlign:'center', cursor:'pointer', marginBottom:'0.75rem' }}>
                <input ref={achFileRef} type="file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png" style={{ display:'none' }}
                  onChange={e => setAchFile(e.target.files?.[0] || null)} />
                {achFile ? (
                  <div><div style={{ color:GREEN, fontWeight:700 }}>✓ {achFile.name}</div><div style={{ color:MUTED, fontSize:'0.75rem' }}>Click to change</div></div>
                ) : (
                  <div><div style={{ fontSize:'1.5rem', marginBottom:5 }}>📜</div><div style={{ color:TEXT, fontWeight:600, fontSize:'0.88rem' }}>Upload Certificate / Document</div><div style={{ color:MUTED, fontSize:'0.75rem' }}>PDF, DOCX, TXT, JPG, PNG</div></div>
                )}
              </div>
              <button onClick={uploadCert} disabled={loading || !achFile}
                style={{ width:'100%', padding:'0.65rem', background:loading||!achFile?DIM:`linear-gradient(135deg,${PURPLE},${INDIGO})`, border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer' }}>
                {loading ? 'Analyzing…' : 'Analyze & Add Achievement'}
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
              <input placeholder="Achievement title (e.g. AWS Certified Solutions Architect)" value={manualTitle} onChange={e=>setManualTitle(e.target.value)}
                style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:BORDER, borderRadius:10, padding:'0.6rem 1rem', color:TEXT, fontSize:'0.88rem', boxSizing:'border-box' }} />
              <textarea placeholder="Describe the achievement, what you learned, technologies used, outcome…" value={manualDesc} onChange={e=>setManualDesc(e.target.value)} rows={4}
                style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:BORDER, borderRadius:10, padding:'0.65rem 1rem', color:TEXT, fontSize:'0.83rem', resize:'vertical', boxSizing:'border-box' }} />
              <button onClick={addManual} disabled={loading || !manualTitle.trim() || !manualDesc.trim()}
                style={{ padding:'0.65rem', background:loading||!manualTitle.trim()||!manualDesc.trim()?DIM:`linear-gradient(135deg,${PURPLE},${INDIGO})`, border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer' }}>
                {loading ? 'Analyzing…' : 'Add Achievement'}
              </button>
            </div>
          )}
          {err && <div style={{ color:RED, fontSize:'0.8rem', marginTop:6 }}>{err}</div>}
        </div>

        {/* Achievement cards */}
        {achievements.length === 0 ? (
          <div style={{ padding:'2rem', textAlign:'center', color:MUTED }}>
            <div style={{ fontSize:'2rem', marginBottom:8 }}>🏆</div>
            No achievements added yet. Upload certificates, internship letters, or add manually.
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            <div style={{ color:MUTED, fontSize:'0.78rem' }}>{achievements.length} achievement{achievements.length!==1?'s':''} stored in your LinkedIn Twin</div>
            {achievements.map(a => {
              const open = expandedId === a.id;
              const avgScore = Math.round((a.impact_score + a.career_value_score + a.recruiter_appeal_score) / 3);
              return (
                <div key={a.id} style={{ background:CARD, border:BORDER, borderRadius:16, overflow:'hidden' }}>
                  <div onClick={() => setExpandedId(open ? null : a.id)} style={{ padding:'1rem 1.25rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.85rem' }}>
                    <div style={{ width:42, height:42, borderRadius:10, background:`${PURPLE}22`, border:`1px solid ${PURPLE}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', flexShrink:0 }}>
                      {a.achievement_type==='certificate'?'🎓':a.achievement_type==='internship'?'💼':a.achievement_type==='project'?'🛠':a.achievement_type==='hackathon'?'⚡':a.achievement_type==='award'?'🏆':'📜'}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ color:TEXT, fontWeight:700, fontSize:'0.88rem' }}>{a.title}</div>
                      <div style={{ display:'flex', gap:6, marginTop:4, flexWrap:'wrap' }}>
                        <Tag text={a.achievement_type} color={PURPLE} />
                        <Tag text={a.difficulty_level} color={a.difficulty_level==='Advanced'?RED:a.difficulty_level==='Intermediate'?AMBER:GREEN} />
                        {a.skills_gained.slice(0,2).map(s => <Tag key={s} text={s} color={CYAN} />)}
                      </div>
                    </div>
                    <div style={{ textAlign:'center', flexShrink:0 }}>
                      <div style={{ fontSize:'1.3rem', fontWeight:800, color:scoreColor(avgScore) }}>{avgScore}</div>
                      <div style={{ fontSize:'0.65rem', color:MUTED }}>Score</div>
                    </div>
                    <span style={{ color:MUTED, fontSize:'0.7rem' }}>{open?'▲':'▼'}</span>
                  </div>

                  {open && (
                    <div style={{ padding:'1rem 1.25rem', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', gap:'0.85rem' }}>
                      {/* Scores */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.6rem' }}>
                        {[
                          { label:'Impact',         value:a.impact_score           },
                          { label:'Career Value',   value:a.career_value_score     },
                          { label:'Recruiter Appeal',value:a.recruiter_appeal_score},
                        ].map(({ label, value }) => (
                          <div key={label} style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'0.65rem', textAlign:'center' }}>
                            <div style={{ fontSize:'0.68rem', color:MUTED, marginBottom:3 }}>{label}</div>
                            <div style={{ fontWeight:800, fontSize:'1.1rem', color:scoreColor(value) }}>{value}</div>
                            <Bar value={value} color={scoreColor(value)} height={3} />
                          </div>
                        ))}
                      </div>
                      {/* Why it matters */}
                      <div style={{ background:`${GREEN}08`, border:`1px solid ${GREEN}25`, borderRadius:10, padding:'0.75rem' }}>
                        <div style={{ color:GREEN, fontWeight:700, fontSize:'0.75rem', marginBottom:4 }}>WHY IT MATTERS</div>
                        <div style={{ color:MUTED, fontSize:'0.82rem', lineHeight:1.6 }}>{a.why_it_matters}</div>
                      </div>
                      <div style={{ background:`${CYAN}08`, border:`1px solid ${CYAN}25`, borderRadius:10, padding:'0.75rem' }}>
                        <div style={{ color:CYAN, fontWeight:700, fontSize:'0.75rem', marginBottom:4 }}>HOW IT IMPROVES EMPLOYABILITY</div>
                        <div style={{ color:MUTED, fontSize:'0.82rem', lineHeight:1.6 }}>{a.how_it_improves}</div>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.6rem' }}>
                        <div>
                          <div style={{ fontSize:'0.7rem', color:MUTED, marginBottom:4 }}>Skills Gained</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>{a.skills_gained.map(s=><Tag key={s} text={s} color={GREEN}/>)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:'0.7rem', color:MUTED, marginBottom:4 }}>Technologies</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>{a.technologies.map(t=><Tag key={t} text={t} color={INDIGO}/>)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:'0.7rem', color:MUTED, marginBottom:4 }}>Career Paths</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>{a.career_paths_supported.map(p=><Tag key={p} text={p} color={PURPLE}/>)}</div>
                        </div>
                      </div>
                      <div style={{ fontSize:'0.75rem', color:MUTED, fontStyle:'italic' }}>{a.career_value}</div>
                      <div style={{ display:'flex', justifyContent:'flex-end' }}>
                        <button onClick={() => deleteAchievement(a.id)}
                          style={{ padding:'0.35rem 0.9rem', background:`${RED}15`, border:`1px solid ${RED}30`, borderRadius:7, color:RED, cursor:'pointer', fontSize:'0.75rem' }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Sub-tab: Optimize ──────────────────────────────────────────────────────
  function OptimizeTab() {
    const [activeImp, setActiveImp] = useState<number|null>(null);
    if (!twinData || !twinData.last_analyzed) return (
      <div style={{ padding:'3rem', textAlign:'center', color:MUTED }}>
        Analyze your profile first to see optimization suggestions.
        <br/><button onClick={() => setLiTab('input')} style={{ marginTop:'1rem', padding:'0.5rem 1.5rem', background:INDIGO, border:'none', borderRadius:8, color:'#fff', cursor:'pointer', fontWeight:600 }}>Go to Input</button>
      </div>
    );
    const { checklist, checklist_completion, improvements } = twinData;
    const completedN = checklist.filter(c => c.completed).length;
    const completionColor = checklist_completion>=80?GREEN:checklist_completion>=50?AMBER:RED;
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
        {/* Checklist */}
        <div style={{ background:CARD, border:BORDER, borderRadius:20, padding:'1.5rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
            <div style={{ color:TEXT, fontWeight:700 }}>Optimization Checklist</div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <span style={{ color:MUTED, fontSize:'0.8rem' }}>{completedN}/{checklist.length} completed</span>
              <span style={{ fontWeight:800, fontSize:'1.1rem', color:completionColor }}>{checklist_completion}%</span>
            </div>
          </div>
          <Bar value={checklist_completion} color={completionColor} height={8} />
          <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem', marginTop:'1rem' }}>
            {checklist.map(item => (
              <div key={item.key} style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem', padding:'0.65rem 0.85rem', background:item.completed?`${GREEN}08`:'rgba(255,255,255,0.02)', border:`1px solid ${item.completed?GREEN+'30':'rgba(255,255,255,0.06)'}`, borderRadius:10 }}>
                <span style={{ fontSize:'1rem', flexShrink:0, marginTop:1 }}>{item.completed ? '✅' : '⬜'}</span>
                <div style={{ flex:1 }}>
                  <div style={{ color:item.completed?GREEN:TEXT, fontWeight:item.completed?600:400, fontSize:'0.85rem' }}>{item.label}</div>
                  {!item.completed && <div style={{ color:DIM, fontSize:'0.75rem', marginTop:2 }}>{item.recommendation}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Before / After improvements */}
        {improvements.length > 0 && (
          <div style={{ background:CARD, border:BORDER, borderRadius:20, padding:'1.5rem' }}>
            <div style={{ color:TEXT, fontWeight:700, marginBottom:'0.5rem' }}>Before → After Improvements</div>
            <div style={{ color:MUTED, fontSize:'0.78rem', marginBottom:'1rem' }}>Click a card to expand</div>
            {improvements.map((imp, i) => {
              const open = activeImp === i;
              return (
                <div key={i} onClick={() => setActiveImp(open?null:i)}
                  style={{ border:`1px solid ${open?INDIGO:'rgba(255,255,255,0.08)'}`, borderRadius:12, marginBottom:'0.65rem', overflow:'hidden', cursor:'pointer' }}>
                  <div style={{ padding:'0.7rem 1rem', background:open?`${INDIGO}12`:'rgba(255,255,255,0.02)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ color:INDIGO, fontWeight:700, fontSize:'0.78rem', textTransform:'uppercase', letterSpacing:1 }}>{imp.section}</span>
                    <span style={{ color:MUTED, fontSize:'0.7rem' }}>{open?'▲ Collapse':'▼ See Improvement'}</span>
                  </div>
                  {open ? (
                    <div style={{ padding:'0.9rem 1rem', display:'flex', flexDirection:'column', gap:'0.65rem' }}>
                      <div style={{ background:`${RED}0a`, border:`1px solid ${RED}25`, borderRadius:8, padding:'0.65rem' }}>
                        <div style={{ fontSize:'0.68rem', color:RED, fontWeight:700, marginBottom:4, textTransform:'uppercase' }}>Current</div>
                        <div style={{ color:MUTED, fontSize:'0.82rem', lineHeight:1.55 }}>{imp.current_version}</div>
                      </div>
                      <div style={{ background:`${GREEN}0a`, border:`1px solid ${GREEN}25`, borderRadius:8, padding:'0.65rem' }}>
                        <div style={{ fontSize:'0.68rem', color:GREEN, fontWeight:700, marginBottom:4, textTransform:'uppercase' }}>Suggested</div>
                        <div style={{ color:TEXT, fontSize:'0.83rem', lineHeight:1.55 }}>{imp.suggested_version}</div>
                      </div>
                      <div style={{ fontSize:'0.74rem', color:DIM, fontStyle:'italic' }}>Why: {imp.reason}</div>
                    </div>
                  ) : (
                    <div style={{ padding:'0.5rem 1rem' }}>
                      <div style={{ color:DIM, fontSize:'0.79rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{imp.current_version}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Sub-tab: Predict ───────────────────────────────────────────────────────
  function PredictTab() {
    if (!twinData || !twinData.last_analyzed) return (
      <div style={{ padding:'3rem', textAlign:'center', color:MUTED }}>
        Analyze your profile first to unlock Digital Twin predictions.
        <br/><button onClick={() => setLiTab('input')} style={{ marginTop:'1rem', padding:'0.5rem 1.5rem', background:INDIGO, border:'none', borderRadius:8, color:'#fff', cursor:'pointer', fontWeight:600 }}>Go to Input</button>
      </div>
    );
    const periods = [
      { key:'3m', label:'3 Months',  color:CYAN   },
      { key:'6m', label:'6 Months',  color:INDIGO  },
      { key:'12m',label:'12 Months', color:GREEN  },
    ] as const;
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
        <div style={{ background:`linear-gradient(135deg,${PURPLE}15,${INDIGO}10)`, border:`1px solid ${PURPLE}35`, borderRadius:18, padding:'1.25rem', display:'flex', gap:'0.85rem' }}>
          <span style={{ fontSize:'1.8rem' }}>🔮</span>
          <div>
            <div style={{ color:PURPLE, fontWeight:700, fontSize:'0.78rem', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>Digital Twin Career Forecast</div>
            <div style={{ color:TEXT, fontSize:'0.9rem', lineHeight:1.6 }}>{twinData.twin_insight}</div>
          </div>
        </div>
        {periods.map(({ key, label, color }) => {
          const p = twinData.predictions[key];
          if (!p) return null;
          return (
            <div key={key} style={{ background:CARD, border:`1px solid ${color}30`, borderRadius:18, padding:'1.5rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                <div style={{ color:color, fontWeight:800, fontSize:'1rem' }}>{label} Ahead</div>
                <div style={{ display:'flex', gap:6 }}>
                  <Tag text={`Recruiter: ${p.recruiter_interest}%`}   color={color} />
                  <Tag text={`Employable: ${p.employability_score}%`} color={color} />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.85rem', marginBottom:'0.85rem' }}>
                <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'0.75rem' }}>
                  <div style={{ fontSize:'0.7rem', color:MUTED, marginBottom:4 }}>Career Growth</div>
                  <div style={{ color:TEXT, fontSize:'0.85rem', lineHeight:1.5 }}>{p.career_growth}</div>
                </div>
                <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'0.75rem' }}>
                  <div style={{ fontSize:'0.7rem', color:MUTED, marginBottom:4 }}>Skill Growth</div>
                  <div style={{ color:TEXT, fontSize:'0.85rem', lineHeight:1.5 }}>{p.skill_growth}</div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.65rem', marginBottom:'0.85rem' }}>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:'0.75rem', color:MUTED }}>Recruiter Interest</span>
                    <span style={{ fontSize:'0.75rem', fontWeight:700, color }}>{p.recruiter_interest}%</span>
                  </div>
                  <Bar value={p.recruiter_interest} color={color} height={6} />
                </div>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:'0.75rem', color:MUTED }}>Employability</span>
                    <span style={{ fontSize:'0.75rem', fontWeight:700, color }}>{p.employability_score}%</span>
                  </div>
                  <Bar value={p.employability_score} color={color} height={6} />
                </div>
              </div>
              {p.opportunities.length > 0 && (
                <div>
                  <div style={{ fontSize:'0.7rem', color:MUTED, marginBottom:5 }}>Upcoming Opportunities</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>{p.opportunities.map(o => <Tag key={o} text={o} color={color} />)}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
      {/* Internal sub-tab bar */}
      <div style={{ display:'flex', gap:0, background:'rgba(255,255,255,0.03)', borderRadius:12, padding:4, border:BORDER }}>
        {LI_SUB_TABS.map(t => {
          const active = liTab === t.id;
          const hasData = twinData && twinData.last_analyzed;
          const locked = (t.id !== 'input' && t.id !== 'achieve') && !hasData;
          return (
            <button key={t.id} onClick={() => !locked && setLiTab(t.id as typeof liTab)}
              style={{ flex:1, padding:'0.55rem 0.5rem', borderRadius:9, border:'none', background:active?'rgba(255,255,255,0.09)':'transparent', color:locked?DIM:active?TEXT:MUTED, cursor:locked?'not-allowed':'pointer', fontSize:'0.78rem', fontWeight:active?700:400, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.3rem', transition:'all 0.15s' }}>
              <span>{t.icon}</span><span>{t.label}</span>
              {locked && <span style={{ fontSize:'0.6rem' }}>🔒</span>}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {liTab === 'input'    && <InputTab />}
      {liTab === 'profile'  && <ProfileTab />}
      {liTab === 'achieve'  && <AchievementsTab />}
      {liTab === 'optimize' && <OptimizeTab />}
      {liTab === 'predict'  && <PredictTab />}
    </div>
  );
}

// ── Section: Interview ────────────────────────────────────────────────────────

function InterviewSection() {
  const [role, setRole] = useState('AI Engineer');
  const [started, setStarted] = useState(false);
  const [history, setHistory] = useState<InterviewMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [scores, setScores] = useState<Record<string,number>|null>(null);
  const [feedback, setFeedback] = useState('');
  const [strengths, setStrengths] = useState<string[]>([]);
  const [improvements, setImprovements] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [history]);

  async function start() {
    setStarted(true); setHistory([]); setComplete(false); setScores(null); setFeedback('');
    setLoading(true);
    try {
      const r = await api.post<InterviewChatResp>('/career/interview/chat', { role, history:[], mode:'question' });
      setHistory([{ role:'assistant', content:r.data.message }]);
    } finally { setLoading(false); }
  }

  async function send() {
    if (!input.trim()) return;
    const nh: InterviewMsg[] = [...history, { role:'user', content:input.trim() }];
    setHistory(nh); setInput(''); setLoading(true);
    try {
      const userCnt = nh.filter(m=>m.role==='user').length;
      const r = await api.post<InterviewChatResp>('/career/interview/chat', { role, history:nh, mode:userCnt>=8?'evaluate':'question' });
      setHistory(prev => [...prev, { role:'assistant', content:r.data.message }]);
      if (r.data.is_complete) {
        setComplete(true);
        if (r.data.scores) setScores(r.data.scores);
        if (r.data.feedback) setFeedback(r.data.feedback);
        if (r.data.strengths) setStrengths(r.data.strengths);
        if (r.data.improvements) setImprovements(r.data.improvements);
      }
    } finally { setLoading(false); }
  }

  if (!started) return (
    <div style={{ background:CARD, border:BORDER, borderRadius:20, padding:'2.5rem', maxWidth:500, margin:'0 auto', textAlign:'center' }}>
      <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>🎤</div>
      <div style={{ color:TEXT, fontWeight:700, fontSize:'1.2rem', marginBottom:'0.5rem' }}>AI Mock Interview</div>
      <div style={{ color:MUTED, fontSize:'0.85rem', lineHeight:1.6, marginBottom:'1.5rem' }}>
        8 questions mixing Technical, Behavioral, HR, and Situational rounds.<br/>
        Get scored on Communication, Confidence, Technical Depth, and Problem Solving.
      </div>
      <select value={role} onChange={e=>setRole(e.target.value)}
        style={{ width:'100%', background:'#0d1117', border:BORDER, borderRadius:10, padding:'0.65rem 1rem', color:TEXT, fontSize:'0.9rem', marginBottom:'1rem' }}>
        {CAREER_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
      <button onClick={start} style={{ width:'100%', padding:'0.8rem', background:`linear-gradient(135deg,${INDIGO},${PURPLE})`, border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'1rem' }}>
        Start Interview
      </button>
    </div>
  );

  const userCount = history.filter(m=>m.role==='user').length;
  const qTotal = 8;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem', height:'70vh' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
          <span style={{ color:MUTED, fontSize:'0.82rem' }}>Mock Interview — <span style={{ color:CYAN }}>{role}</span></span>
          {!complete && <span style={{ color:MUTED, fontSize:'0.78rem' }}>Q {Math.min(userCount+1,qTotal)}/{qTotal}</span>}
        </div>
        <button onClick={() => { setStarted(false); setHistory([]); }}
          style={{ padding:'0.35rem 0.85rem', background:'rgba(255,255,255,0.05)', border:BORDER, borderRadius:8, color:MUTED, cursor:'pointer', fontSize:'0.78rem' }}>
          Restart
        </button>
      </div>

      {/* Progress bar */}
      {!complete && <Bar value={(userCount/qTotal)*100} color={INDIGO} height={3} />}

      {/* Chat */}
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:'0.75rem', padding:'0.25rem' }}>
        {history.map((m,i) => (
          <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
            <div style={{ maxWidth:'80%', padding:'0.75rem 1rem',
              borderRadius:m.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px',
              background:m.role==='user'?`linear-gradient(135deg,${INDIGO},${PURPLE})`:'rgba(255,255,255,0.06)',
              border:m.role==='user'?'none':BORDER, color:TEXT, fontSize:'0.87rem', lineHeight:1.65 }}>
              {m.role==='assistant' && <div style={{ color:CYAN, fontSize:'0.7rem', fontWeight:700, marginBottom:4 }}>AI INTERVIEWER</div>}
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex', alignItems:'center', gap:8, color:MUTED, fontSize:'0.8rem' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:INDIGO, animation:'pulse 1s infinite' }} /> Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Scores on completion */}
      {complete && scores && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'0.5rem' }}>
            {Object.entries(scores).map(([k,v]) => (
              <div key={k} style={{ background:CARD, border:BORDER, borderRadius:12, padding:'0.65rem', textAlign:'center' }}>
                <div style={{ fontSize:'0.68rem', color:MUTED, textTransform:'capitalize' }}>{k.replace('_',' ')}</div>
                <div style={{ fontSize:'1.5rem', fontWeight:800, color:v>=75?GREEN:v>=55?AMBER:RED }}>{v}</div>
              </div>
            ))}
          </div>
          {(strengths.length > 0 || improvements.length > 0) && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
              <div style={{ background:CARD, border:BORDER, borderRadius:12, padding:'1rem' }}>
                <div style={{ color:GREEN, fontWeight:700, fontSize:'0.8rem', marginBottom:6 }}>✓ Strengths</div>
                {strengths.map((s,i) => <div key={i} style={{ color:MUTED, fontSize:'0.8rem' }}>• {s}</div>)}
              </div>
              <div style={{ background:CARD, border:BORDER, borderRadius:12, padding:'1rem' }}>
                <div style={{ color:AMBER, fontWeight:700, fontSize:'0.8rem', marginBottom:6 }}>⚠ Improve</div>
                {improvements.map((imp,i) => <div key={i} style={{ color:MUTED, fontSize:'0.8rem' }}>• {imp}</div>)}
              </div>
            </div>
          )}
        </div>
      )}

      {!complete && (
        <div style={{ display:'flex', gap:'0.5rem' }}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
            placeholder="Type your answer…" disabled={loading}
            style={{ flex:1, background:'rgba(255,255,255,0.05)', border:BORDER, borderRadius:10, padding:'0.65rem 1rem', color:TEXT, fontSize:'0.88rem' }} />
          <button onClick={send} disabled={loading||!input.trim()}
            style={{ padding:'0.65rem 1.25rem', background:loading||!input.trim()?DIM:INDIGO, border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer' }}>
            Send
          </button>
        </div>
      )}
    </div>
  );
}

// ── Section: Coding ────────────────────────────────────────────────────────────

function CodingSection() {
  const [difficulty, setDifficulty] = useState('medium');
  const [topic, setTopic] = useState('arrays');
  const [challenge, setChallenge] = useState<CodingChallenge|null>(null);
  const [code, setCode] = useState('');
  const [lang, setLang] = useState('python');
  const [evalResult, setEvalResult] = useState<CodingEval|null>(null);
  const [loading, setLoading] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const TOPICS = ['Arrays','Linked Lists','Trees','Graphs','Dynamic Programming','Sorting','Binary Search','Strings','SQL','System Design','Machine Learning'];

  async function getChallenge() {
    setLoading(true); setChallenge(null); setEvalResult(null); setCode('');
    try {
      const r = await api.post<CodingChallenge>('/career/coding/challenge', { difficulty, topic });
      setChallenge(r.data);
    } finally { setLoading(false); }
  }

  async function submit() {
    if (!challenge || !code.trim()) return;
    setEvalLoading(true); setEvalResult(null);
    try {
      const r = await api.post<CodingEval>('/career/coding/evaluate', { problem:challenge.problem, solution:code, language:lang });
      setEvalResult(r.data);
    } finally { setEvalLoading(false); }
  }

  const diffColor = (d:string) => d==='easy'?GREEN:d==='medium'?AMBER:RED;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div style={{ background:CARD, border:BORDER, borderRadius:20, padding:'1.25rem', display:'flex', gap:'1rem', flexWrap:'wrap', alignItems:'flex-end' }}>
        <div>
          <div style={{ color:MUTED, fontSize:'0.73rem', marginBottom:5 }}>Difficulty</div>
          <div style={{ display:'flex', gap:6 }}>
            {['easy','medium','hard'].map(d=>(
              <button key={d} onClick={()=>setDifficulty(d)}
                style={{ padding:'0.38rem 0.85rem', borderRadius:7, border:`1px solid ${difficulty===d?diffColor(d):'rgba(255,255,255,0.1)'}`, background:difficulty===d?`${diffColor(d)}20`:'transparent', color:difficulty===d?diffColor(d):MUTED, cursor:'pointer', fontSize:'0.8rem', fontWeight:600, textTransform:'capitalize' }}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ color:MUTED, fontSize:'0.73rem', marginBottom:5 }}>Topic</div>
          <select value={topic} onChange={e=>setTopic(e.target.value)}
            style={{ background:'#0d1117', border:BORDER, borderRadius:8, padding:'0.4rem 0.75rem', color:TEXT, fontSize:'0.83rem' }}>
            {TOPICS.map(t=><option key={t} value={t.toLowerCase()}>{t}</option>)}
          </select>
        </div>
        <button onClick={getChallenge} disabled={loading}
          style={{ padding:'0.6rem 1.5rem', background:`linear-gradient(135deg,${CYAN},${INDIGO})`, border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', marginTop:20 }}>
          {loading?'Loading…':'Get Challenge'}
        </button>
      </div>

      {loading && <Loader />}

      {challenge && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
          {/* Left: Problem */}
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            <div style={{ background:CARD, border:BORDER, borderRadius:16, padding:'1.25rem' }}>
              <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.75rem' }}>
                <span style={{ color:TEXT, fontWeight:700, fontSize:'0.95rem' }}>{challenge.title}</span>
                <Tag text={challenge.difficulty} color={diffColor(challenge.difficulty)} />
                <Tag text={challenge.topic} color={INDIGO} />
              </div>
              <div style={{ color:MUTED, fontSize:'0.85rem', lineHeight:1.75, whiteSpace:'pre-wrap' }}>{challenge.problem}</div>
            </div>
            {challenge.examples.length > 0 && (
              <div style={{ background:CARD, border:BORDER, borderRadius:16, padding:'1.1rem' }}>
                <div style={{ color:TEXT, fontWeight:600, marginBottom:'0.6rem', fontSize:'0.85rem' }}>Examples</div>
                {challenge.examples.map((ex,i)=>(
                  <div key={i} style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'0.6rem', marginBottom:6, fontFamily:'monospace', fontSize:'0.8rem' }}>
                    <div style={{ color:CYAN }}>Input: <span style={{ color:TEXT }}>{ex.input}</span></div>
                    <div style={{ color:GREEN }}>Output: <span style={{ color:TEXT }}>{ex.output}</span></div>
                    {ex.explanation && <div style={{ color:MUTED }}>// {ex.explanation}</div>}
                  </div>
                ))}
              </div>
            )}
            {challenge.constraints.length > 0 && (
              <div style={{ background:CARD, border:BORDER, borderRadius:12, padding:'0.9rem' }}>
                <div style={{ color:TEXT, fontWeight:600, fontSize:'0.8rem', marginBottom:4 }}>Constraints</div>
                {challenge.constraints.map((c,i)=><div key={i} style={{ color:MUTED, fontSize:'0.78rem' }}>• {c}</div>)}
              </div>
            )}
            {challenge.expected_approach && (
              <div style={{ background:`${INDIGO}0a`, border:`1px solid ${INDIGO}30`, borderRadius:12, padding:'0.9rem' }}>
                <div style={{ color:INDIGO, fontWeight:600, fontSize:'0.8rem', marginBottom:4 }}>Expected Approach</div>
                <div style={{ color:MUTED, fontSize:'0.8rem' }}>{challenge.expected_approach}</div>
              </div>
            )}
            <button onClick={()=>setShowHints(!showHints)}
              style={{ padding:'0.45rem 1rem', background:`${AMBER}12`, border:`1px solid ${AMBER}35`, borderRadius:8, color:AMBER, cursor:'pointer', fontSize:'0.8rem', width:'fit-content' }}>
              {showHints?'Hide Hints':'Show Hints 💡'}
            </button>
            {showHints && challenge.hints.map((h,i)=>(
              <div key={i} style={{ background:`${AMBER}08`, border:`1px solid ${AMBER}25`, borderRadius:8, padding:'0.6rem 0.75rem', color:AMBER, fontSize:'0.8rem' }}>Hint {i+1}: {h}</div>
            ))}
          </div>

          {/* Right: Editor */}
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            <div style={{ background:CARD, border:BORDER, borderRadius:16, padding:'1.1rem', display:'flex', flexDirection:'column', gap:'0.65rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ color:TEXT, fontWeight:600, fontSize:'0.85rem' }}>Solution Editor</span>
                <select value={lang} onChange={e=>setLang(e.target.value)}
                  style={{ background:'#0d1117', border:BORDER, borderRadius:6, padding:'0.28rem 0.5rem', color:MUTED, fontSize:'0.75rem' }}>
                  {['python','javascript','java','c++','go'].map(l=><option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <textarea value={code} onChange={e=>setCode(e.target.value)} rows={18}
                placeholder={`# Write your ${lang} solution here…`}
                style={{ width:'100%', background:'#0a0e17', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'0.75rem', color:'#e2e8f0', fontSize:'0.82rem', fontFamily:'"JetBrains Mono","Fira Code",monospace', resize:'vertical', boxSizing:'border-box', lineHeight:1.7 }} />
              <button onClick={submit} disabled={evalLoading||!code.trim()}
                style={{ padding:'0.65rem', background:evalLoading||!code.trim()?DIM:`linear-gradient(135deg,${GREEN},${CYAN})`, border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer' }}>
                {evalLoading?'Evaluating…':'Submit Solution'}
              </button>
            </div>

            {evalLoading && <Loader text="AI is reviewing your solution…" />}

            {evalResult && (
              <div style={{ background:CARD, border:`1px solid ${evalResult.is_correct?GREEN:AMBER}40`, borderRadius:16, padding:'1.25rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.85rem' }}>
                  <span style={{ fontWeight:700, color:evalResult.is_correct?GREEN:AMBER }}>
                    {evalResult.is_correct?'✓ Accepted':'◎ Needs Work'}
                  </span>
                  <span style={{ fontSize:'1.6rem', fontWeight:900, color:evalResult.score>=75?GREEN:evalResult.score>=50?AMBER:RED }}>{evalResult.score}<span style={{ fontSize:'0.9rem', color:MUTED }}>/100</span></span>
                </div>
                <div style={{ color:MUTED, fontSize:'0.83rem', lineHeight:1.6, marginBottom:'0.85rem' }}>{evalResult.feedback}</div>
                <div style={{ display:'flex', gap:'0.65rem', flexWrap:'wrap', marginBottom:'0.75rem' }}>
                  <Tag text={`⏱ ${evalResult.time_complexity}`}  color={CYAN}   />
                  <Tag text={`💾 ${evalResult.space_complexity}`} color={INDIGO} />
                  <Tag text={evalResult.approach_quality}         color={PURPLE} />
                </div>
                {evalResult.improvements.length > 0 && (
                  <>
                    <div style={{ color:AMBER, fontWeight:600, fontSize:'0.78rem', marginBottom:5 }}>Improvements:</div>
                    {evalResult.improvements.map((imp,i)=><div key={i} style={{ color:MUTED, fontSize:'0.78rem' }}>• {imp}</div>)}
                  </>
                )}
                {evalResult.twin_updated && (
                  <div style={{ marginTop:8, color:GREEN, fontSize:'0.78rem', fontWeight:600 }}>🤖 Career Twin updated</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section: Skill Gap ────────────────────────────────────────────────────────

function SkillGapSection() {
  const [target, setTarget] = useState('AI Engineer');
  const [result, setResult] = useState<SkillGap|null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true); setResult(null);
    try { const r = await api.get<SkillGap>(`/career/skill-gap?target=${encodeURIComponent(target)}`); setResult(r.data); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div style={{ background:CARD, border:BORDER, borderRadius:20, padding:'1.25rem', display:'flex', gap:'1rem', alignItems:'flex-end', flexWrap:'wrap' }}>
        <div style={{ flex:1 }}>
          <div style={{ color:MUTED, fontSize:'0.78rem', marginBottom:5 }}>Target Career</div>
          <select value={target} onChange={e=>setTarget(e.target.value)}
            style={{ width:'100%', background:'#0d1117', border:BORDER, borderRadius:10, padding:'0.65rem 1rem', color:TEXT, fontSize:'0.88rem' }}>
            {CAREER_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <button onClick={analyze} disabled={loading}
          style={{ padding:'0.65rem 1.75rem', background:`linear-gradient(135deg,${INDIGO},${PURPLE})`, border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer' }}>
          {loading?'Analyzing…':'Analyze Gap'}
        </button>
      </div>

      {loading && <Loader />}

      {result && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          <div style={{ background:CARD, border:BORDER, borderRadius:16, padding:'1.5rem', display:'flex', alignItems:'center', gap:'1.5rem' }}>
            <div style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <ScoreRing score={result.compatibility_score} color={result.compatibility_score>=70?GREEN:result.compatibility_score>=45?AMBER:RED} size={90} />
              <div style={{ position:'absolute', textAlign:'center' }}>
                <div style={{ fontSize:'1.25rem', fontWeight:900, color:TEXT }}>{result.compatibility_score}%</div>
              </div>
            </div>
            <div>
              <div style={{ color:TEXT, fontWeight:700, fontSize:'1rem' }}>Compatibility with {result.target_career}</div>
              <div style={{ color:AMBER, fontWeight:600, fontSize:'0.82rem', marginTop:4 }}>Priority: {result.learning_priority}</div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div style={{ background:CARD, border:BORDER, borderRadius:14, padding:'1.1rem' }}>
              <div style={{ color:GREEN, fontWeight:700, fontSize:'0.82rem', marginBottom:'0.65rem' }}>✓ Current Skills</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>{result.current_skills.map(s=><Tag key={s} text={s} color={GREEN}/>)}</div>
            </div>
            <div style={{ background:CARD, border:BORDER, borderRadius:14, padding:'1.1rem' }}>
              <div style={{ color:RED, fontWeight:700, fontSize:'0.82rem', marginBottom:'0.65rem' }}>⚠ Missing Skills</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>{result.missing_skills.map(s=><Tag key={s} text={s} color={RED}/>)}</div>
            </div>
            <div style={{ background:CARD, border:BORDER, borderRadius:14, padding:'1.1rem' }}>
              <div style={{ color:AMBER, fontWeight:700, fontSize:'0.82rem', marginBottom:'0.65rem' }}>🎓 Missing Certifications</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>{result.missing_certifications.map(c=><Tag key={c} text={c} color={AMBER}/>)}</div>
            </div>
            <div style={{ background:CARD, border:BORDER, borderRadius:14, padding:'1.1rem' }}>
              <div style={{ color:PURPLE, fontWeight:700, fontSize:'0.82rem', marginBottom:'0.65rem' }}>🛠 Missing Projects</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>{result.missing_projects.map(p=><Tag key={p} text={p} color={PURPLE}/>)}</div>
            </div>
          </div>

          <div style={{ background:CARD, border:BORDER, borderRadius:16, padding:'1.25rem' }}>
            <div style={{ color:TEXT, fontWeight:700, marginBottom:'1rem' }}>5-Step Learning Plan</div>
            {result.learning_plan.map((step,i)=>(
              <div key={i} style={{ display:'flex', gap:'0.85rem', padding:'0.75rem', background:'rgba(255,255,255,0.03)', borderRadius:12, border:BORDER, marginBottom:'0.6rem' }}>
                <div style={{ width:30, height:30, borderRadius:'50%', background:`${INDIGO}25`, border:`1px solid ${INDIGO}55`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:INDIGO, flexShrink:0, fontSize:'0.82rem' }}>{step.step}</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:TEXT, fontWeight:600, fontSize:'0.88rem' }}>{step.title}</div>
                  <div style={{ color:MUTED, fontSize:'0.8rem', marginTop:2, lineHeight:1.5 }}>{step.description}</div>
                  <div style={{ display:'flex', gap:5, marginTop:5, flexWrap:'wrap' }}>
                    {step.resources.map(r=><Tag key={r} text={r} color={CYAN}/>)}
                    <Tag text={step.duration} color={AMBER} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section: Recommendations ──────────────────────────────────────────────────

function RecommendationsSection() {
  const [data, setData] = useState<CareerRecs|null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get<CareerRecs>('/career/recommendations').then(r=>setData(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  if (loading) return <Loader />;
  if (!data) return <div style={{ padding:'2rem', color:MUTED }}>No data. Add subjects and check-ins first.</div>;
  const COLORS = [CYAN,INDIGO,PURPLE,GREEN,AMBER,PINK];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div style={{ background:`linear-gradient(135deg,${INDIGO}18,${PURPLE}15)`, border:`1px solid ${INDIGO}40`, borderRadius:16, padding:'1.25rem', display:'flex', gap:'1rem' }}>
        <span style={{ fontSize:'1.8rem' }}>🤖</span>
        <div>
          <div style={{ color:CYAN, fontWeight:700, fontSize:'0.78rem', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>Twin Insight</div>
          <div style={{ color:TEXT, fontSize:'0.95rem', lineHeight:1.6 }}>{data.twin_insight}</div>
          <div style={{ color:MUTED, fontSize:'0.78rem', marginTop:5 }}>Top match: <strong style={{ color:CYAN }}>{data.top_match}</strong></div>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
        {data.recommendations.map((rec,i)=>(
          <div key={rec.role} style={{ background:CARD, border:i===0?`1px solid ${CYAN}40`:BORDER, borderRadius:16, padding:'1.25rem', position:'relative', overflow:'hidden' }}>
            {i===0 && <div style={{ position:'absolute', top:0, right:0, background:`${CYAN}22`, padding:'2px 10px', borderRadius:'0 16px 0 10px', fontSize:'0.68rem', color:CYAN, fontWeight:700 }}>TOP MATCH</div>}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.65rem' }}>
              <div style={{ color:TEXT, fontWeight:700, fontSize:'0.92rem' }}>{rec.role}</div>
              <div style={{ fontSize:'1.35rem', fontWeight:800, color:COLORS[i%COLORS.length] }}>{rec.compatibility}%</div>
            </div>
            <Bar value={rec.compatibility} color={COLORS[i%COLORS.length]} />
            <div style={{ color:MUTED, fontSize:'0.78rem', marginTop:'0.55rem', lineHeight:1.5 }}>{rec.reasoning}</div>
            {rec.key_matches.length > 0 && (
              <div style={{ marginTop:'0.55rem', display:'flex', flexWrap:'wrap', gap:4 }}>
                {rec.key_matches.slice(0,3).map(m=><Tag key={m} text={m} color={GREEN}/>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Job Match ────────────────────────────────────────────────────────

function JobMatchSection() {
  const [data, setData] = useState<JobMatches|null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string|null>(null);
  useEffect(() => {
    api.get<JobMatches>('/career/job-matching').then(r=>setData(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  if (loading) return <Loader />;
  if (!data) return null;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
      {data.matches.map((m,i)=>{
        const c = m.match_percent>=80?GREEN:m.match_percent>=65?CYAN:m.match_percent>=50?AMBER:RED;
        const open = expanded===m.role;
        return (
          <div key={m.role} style={{ background:CARD, border:i===0?`1px solid ${c}40`:BORDER, borderRadius:16, overflow:'hidden' }}>
            <div onClick={()=>setExpanded(open?null:m.role)} style={{ padding:'1.1rem 1.25rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'1rem' }}>
              {i===0 && <span style={{ fontSize:'1.1rem' }}>🏆</span>}
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <span style={{ color:TEXT, fontWeight:700, fontSize:'0.92rem' }}>{m.role}</span>
                  <span style={{ fontWeight:800, color:c, fontSize:'1.1rem' }}>{m.match_percent}%</span>
                </div>
                <Bar value={m.match_percent} color={c} height={7} />
              </div>
              <span style={{ color:MUTED, fontSize:'0.7rem' }}>{open?'▲':'▼'}</span>
            </div>
            {open && (
              <div style={{ padding:'1rem 1.25rem', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', gap:'0.85rem' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.75rem' }}>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:'0.68rem', color:MUTED, marginBottom:3 }}>Skill Gap</div>
                    <div style={{ fontWeight:700, color:RED }}>{m.skill_gap_percent}%</div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:'0.68rem', color:MUTED, marginBottom:3 }}>Resume Ready</div>
                    <div style={{ fontWeight:700, color:CYAN }}>{m.resume_readiness}%</div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:'0.68rem', color:MUTED, marginBottom:3 }}>Interview Ready</div>
                    <div style={{ fontWeight:700, color:PURPLE }}>{m.interview_readiness}%</div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                  {m.key_skills_matched.length > 0 && (
                    <div>
                      <div style={{ fontSize:'0.72rem', color:MUTED, marginBottom:4 }}>Matched skills</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>{m.key_skills_matched.map(s=><Tag key={s} text={s} color={GREEN}/>)}</div>
                    </div>
                  )}
                  {m.missing_skills.length > 0 && (
                    <div>
                      <div style={{ fontSize:'0.72rem', color:MUTED, marginBottom:4 }}>Missing skills</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>{m.missing_skills.map(s=><Tag key={s} text={s} color={RED}/>)}</div>
                    </div>
                  )}
                </div>
                {m.recommended_certifications.length > 0 && (
                  <div>
                    <div style={{ fontSize:'0.72rem', color:MUTED, marginBottom:4 }}>Recommended certifications</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>{m.recommended_certifications.map(c=><Tag key={c} text={c} color={AMBER}/>)}</div>
                  </div>
                )}
                {m.portfolio_projects.length > 0 && (
                  <div>
                    <div style={{ fontSize:'0.72rem', color:MUTED, marginBottom:4 }}>Portfolio projects to build</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>{m.portfolio_projects.map(p=><Tag key={p} text={p} color={PURPLE}/>)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Section: Roadmap ──────────────────────────────────────────────────────────

function RoadmapSection() {
  const [target, setTarget] = useState('AI Engineer');
  const [data, setData] = useState<Roadmap|null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true); setData(null);
    try { const r = await api.get<Roadmap>(`/career/roadmap?target=${encodeURIComponent(target)}`); setData(r.data); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div style={{ background:CARD, border:BORDER, borderRadius:20, padding:'1.25rem', display:'flex', gap:'1rem', alignItems:'flex-end', flexWrap:'wrap' }}>
        <div style={{ flex:1 }}>
          <div style={{ color:MUTED, fontSize:'0.78rem', marginBottom:5 }}>Target Career</div>
          <select value={target} onChange={e=>setTarget(e.target.value)}
            style={{ width:'100%', background:'#0d1117', border:BORDER, borderRadius:10, padding:'0.65rem 1rem', color:TEXT, fontSize:'0.88rem' }}>
            {CAREER_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <button onClick={load} disabled={loading}
          style={{ padding:'0.65rem 1.75rem', background:`linear-gradient(135deg,${PURPLE},${INDIGO})`, border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer' }}>
          {loading?'Generating…':'Generate Roadmap'}
        </button>
      </div>
      {loading && <Loader />}
      {data && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.75rem' }}>
            {[
              { label:'Current Position', value:data.current_position, color:MUTED  },
              { label:'Target Career',    value:data.target_career,    color:CYAN   },
              { label:'Estimated Time',   value:data.estimated_time,   color:AMBER  },
            ].map(({ label, value, color })=>(
              <div key={label} style={{ background:CARD, border:BORDER, borderRadius:14, padding:'1rem', textAlign:'center' }}>
                <div style={{ fontSize:'0.7rem', color:MUTED, textTransform:'uppercase', letterSpacing:1 }}>{label}</div>
                <div style={{ color, fontWeight:700, fontSize:'0.92rem', marginTop:4 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ background:CARD, border:BORDER, borderRadius:16, padding:'1.5rem' }}>
            <div style={{ color:TEXT, fontWeight:700, marginBottom:'1.25rem' }}>Your Personalized Roadmap</div>
            {data.steps.map((step,i)=>{
              const isCurrent = step.status==='current';
              const isLast = i===data.steps.length-1;
              return (
                <div key={i} style={{ display:'flex', gap:'0.85rem' }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                    <div style={{ width:34, height:34, borderRadius:'50%',
                      background:isCurrent?`linear-gradient(135deg,${CYAN},${INDIGO})`:'rgba(255,255,255,0.05)',
                      border:`2px solid ${isCurrent?CYAN:'rgba(255,255,255,0.1)'}`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontWeight:700, color:isCurrent?'#fff':MUTED, fontSize:'0.82rem' }}>
                      {isCurrent?'▶':step.step}
                    </div>
                    {!isLast && <div style={{ width:2, flex:1, background:'rgba(255,255,255,0.06)', minHeight:20, margin:'4px 0' }} />}
                  </div>
                  <div style={{ flex:1, paddingBottom:isLast?0:'1.25rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:3 }}>
                      <span style={{ color:isCurrent?TEXT:MUTED, fontWeight:isCurrent?700:400, fontSize:'0.9rem' }}>{step.title}</span>
                      <Tag text={step.duration} color={isCurrent?CYAN:DIM} />
                      {isCurrent && <Tag text="CURRENT" color={GREEN} />}
                    </div>
                    <div style={{ color:DIM, fontSize:'0.8rem', lineHeight:1.55, marginBottom:5 }}>{step.description}</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {step.resources.map(r=><Tag key={r} text={r} color={INDIGO}/>)}
                      {step.skills?.map(s=><Tag key={s} text={s} color={PURPLE}/>)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Monthly milestones */}
          {data.monthly_milestones.length > 0 && (
            <div style={{ background:CARD, border:BORDER, borderRadius:16, padding:'1.25rem' }}>
              <div style={{ color:TEXT, fontWeight:700, marginBottom:'1rem' }}>Monthly Milestones</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.75rem' }}>
                {data.monthly_milestones.map((m,i)=>{
                  const colors=[CYAN,INDIGO,PURPLE,GREEN];
                  return (
                    <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${colors[i%4]}30`, borderRadius:12, padding:'0.85rem' }}>
                      <div style={{ color:colors[i%4], fontWeight:700, fontSize:'0.78rem', marginBottom:4 }}>Month {m.month}</div>
                      <div style={{ color:TEXT, fontSize:'0.8rem', fontWeight:600, marginBottom:3 }}>{m.goal}</div>
                      <div style={{ color:MUTED, fontSize:'0.75rem' }}>📌 {m.deliverable}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ background:`linear-gradient(135deg,${GREEN}10,${CYAN}06)`, border:`1px solid ${GREEN}35`, borderRadius:14, padding:'1.1rem', display:'flex', gap:'0.85rem', alignItems:'center' }}>
            <span style={{ fontSize:'1.8rem' }}>🤖</span>
            <div>
              <div style={{ color:GREEN, fontWeight:700, fontSize:'0.78rem', textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>Twin Success Probability</div>
              <div style={{ color:TEXT, fontSize:'0.9rem' }}>Your Digital Twin estimates a <strong style={{ color:GREEN }}>{Math.round(data.twin_success_probability*100)}%</strong> probability of successfully transitioning to <strong style={{ color:CYAN }}>{data.target_career}</strong>.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section: Analytics ────────────────────────────────────────────────────────

function AnalyticsSection() {
  const [data, setData] = useState<Analytics|null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get<Analytics>('/career/analytics').then(r=>setData(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  if (loading) return <Loader />;
  if (!data) return null;

  const noHistory = data.career_twin_trend.length < 2;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.75rem' }}>
        {[
          { label:'Total Analyses',  value:String(data.total_analyses),    color:CYAN   },
          { label:'Consistency',     value:`${data.consistency_score}%`,   color:GREEN  },
          { label:'Top Improvement', value:data.top_improvement,           color:AMBER  },
        ].map(({ label, value, color })=>(
          <div key={label} style={{ background:CARD, border:BORDER, borderRadius:14, padding:'1rem', textAlign:'center' }}>
            <div style={{ fontSize:'0.7rem', color:MUTED, textTransform:'uppercase', letterSpacing:1 }}>{label}</div>
            <div style={{ color, fontWeight:700, fontSize:'0.92rem', marginTop:4 }}>{value}</div>
          </div>
        ))}
      </div>

      {noHistory ? (
        <div style={{ background:`${AMBER}0a`, border:`1px solid ${AMBER}30`, borderRadius:16, padding:'2rem', textAlign:'center' }}>
          <div style={{ fontSize:'2rem', marginBottom:'0.75rem' }}>📊</div>
          <div style={{ color:AMBER, fontWeight:700, marginBottom:6 }}>No history yet</div>
          <div style={{ color:MUTED, fontSize:'0.85rem' }}>Upload a resume, complete an interview, or submit coding solutions to generate analytics charts.</div>
        </div>
      ) : (
        <>
          {/* Career Twin trend */}
          <div style={{ background:CARD, border:BORDER, borderRadius:16, padding:'1.5rem' }}>
            <div style={{ color:TEXT, fontWeight:700, marginBottom:'1rem' }}>Career Twin Evolution</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.career_twin_trend}>
                <defs>
                  <linearGradient id="ctGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={CYAN} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CYAN} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill:DIM, fontSize:10 }} />
                <YAxis domain={[0,100]} tick={{ fill:DIM, fontSize:10 }} />
                <Tooltip contentStyle={{ background:'#0d1117', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:TEXT, fontSize:12 }} />
                <Area type="monotone" dataKey="Career Twin" stroke={CYAN} strokeWidth={2} fill="url(#ctGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Score breakdown */}
          <div style={{ background:CARD, border:BORDER, borderRadius:16, padding:'1.5rem' }}>
            <div style={{ color:TEXT, fontWeight:700, marginBottom:'1rem' }}>Score Breakdown Trend</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.score_breakdown_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill:DIM, fontSize:10 }} />
                <YAxis domain={[0,100]} tick={{ fill:DIM, fontSize:10 }} />
                <Tooltip contentStyle={{ background:'#0d1117', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:TEXT, fontSize:12 }} />
                <Legend wrapperStyle={{ color:MUTED, fontSize:11 }} />
                <Line type="monotone" dataKey="Resume"    stroke={CYAN}   strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="LinkedIn"  stroke="#0077b5" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Interview" stroke={PURPLE}  strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Coding"    stroke={AMBER}   strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Skill radar */}
      {data.skill_radar.length > 0 && (
        <div style={{ background:CARD, border:BORDER, borderRadius:16, padding:'1.5rem' }}>
          <div style={{ color:TEXT, fontWeight:700, marginBottom:'1rem' }}>Skill Coverage Radar</div>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={data.skill_radar}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis dataKey="skill" tick={{ fill:MUTED, fontSize:10 }} />
              <Radar name="Target"  dataKey="target"  stroke={`${MUTED}60`} fill={`${MUTED}08`} />
              <Radar name="Current" dataKey="current" stroke={CYAN}        fill={`${CYAN}20`} />
              <Legend wrapperStyle={{ color:MUTED, fontSize:11 }} />
              <Tooltip contentStyle={{ background:'#0d1117', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:TEXT, fontSize:12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Section: Resources ────────────────────────────────────────────────────────

function ResourceHub() {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem' }}>
      {RESOURCES.map(res=>(
        <a key={res.name} href={res.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none' }}>
          <div style={{ background:CARD, border:BORDER, borderRadius:16, padding:'1.25rem', cursor:'pointer', transition:'transform 0.2s, border-color 0.2s', height:'100%', boxSizing:'border-box' }}
            onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.transform='translateY(-3px)';(e.currentTarget as HTMLDivElement).style.borderColor='rgba(255,255,255,0.18)';}}
            onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.transform='none';(e.currentTarget as HTMLDivElement).style.borderColor='rgba(255,255,255,0.08)';}}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.65rem', marginBottom:'0.65rem' }}>
              <span style={{ fontSize:'1.5rem' }}>{res.icon}</span>
              <span style={{ color:TEXT, fontWeight:700, fontSize:'0.92rem' }}>{res.name}</span>
            </div>
            <div style={{ color:MUTED, fontSize:'0.8rem', lineHeight:1.6, marginBottom:'0.5rem' }}>{res.desc}</div>
            <div style={{ color:DIM, fontSize:'0.73rem', fontStyle:'italic' }}>💡 {res.tip}</div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CareerDevelopment() {
  const [activeTab, setActiveTab] = useState('twin');

  const renderSection = useCallback(() => {
    switch (activeTab) {
      case 'twin':            return <CareerTwinSection />;
      case 'overview':        return <OverviewSection />;
      case 'resume':          return <ResumeUploadSection />;
      case 'linkedin':        return <LinkedInSection />;
      case 'interview':       return <VoiceInterview />;
      case 'coding':          return <CodingSection />;
      case 'skillgap':        return <SkillGapSection />;
      case 'recommendations': return <RecommendationsSection />;
      case 'jobmatch':        return <JobMatchSection />;
      case 'roadmap':         return <RoadmapSection />;
      case 'analytics':       return <AnalyticsSection />;
      case 'resources':       return <ResourceHub />;
      default:                return null;
    }
  }, [activeTab]);

  return (
    <div style={{ minHeight:'100svh', background:BG, color:TEXT, fontFamily:'system-ui,-apple-system,sans-serif' }}>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        * { scrollbar-width:thin; scrollbar-color:rgba(255,255,255,0.1) transparent; }
        *::-webkit-scrollbar { width:4px; height:4px; }
        *::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:99px; }
        input,textarea,select { outline:none; }
        input:focus,textarea:focus,select:focus { border-color:rgba(99,102,241,0.5) !important; }
        select option { background:#0d1117; color:#f1f5f9; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom:BORDER, padding:'0.9rem 1.5rem', display:'flex', alignItems:'center', gap:'1rem', background:'rgba(6,11,24,0.92)', backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:50 }}>
        <BackButton />
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <span style={{ fontSize:'1.3rem' }}>🚀</span>
            <span style={{ fontWeight:800, fontSize:'1.15rem', color:TEXT }}>Career Development Mode</span>
          </div>
          <div style={{ color:MUTED, fontSize:'0.72rem' }}>AI-powered career intelligence hub</div>
        </div>
        <div style={{ marginLeft:'auto' }}>
          <Link to="/" style={{ color:MUTED, fontSize:'0.8rem', textDecoration:'none' }}>← Dashboard</Link>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ overflowX:'auto', borderBottom:BORDER, background:'rgba(6,11,24,0.75)', backdropFilter:'blur(8px)', position:'sticky', top:62, zIndex:40 }}>
        <div style={{ display:'flex', minWidth:'max-content', padding:'0 1.5rem' }}>
          {TABS.map(tab=>{
            const active = activeTab===tab.id;
            return (
              <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
                style={{ padding:'0.8rem 1rem', background:'none', border:'none', borderBottom:active?`2px solid ${CYAN}`:'2px solid transparent', color:active?CYAN:MUTED, cursor:'pointer', fontSize:'0.78rem', fontWeight:active?700:400, display:'flex', alignItems:'center', gap:'0.35rem', whiteSpace:'nowrap', transition:'color 0.15s' }}>
                <span>{tab.icon}</span><span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'2rem 1.5rem 5rem' }}>
        {renderSection()}
      </div>
    </div>
  );
}

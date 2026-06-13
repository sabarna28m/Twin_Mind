import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import api from '../services/api';

// ── Types ───────────────────────────────────────────────────────────────

interface CareerOverview {
  score: number; grade: string;
  strengths: string[]; areas_to_improve: string[];
  component_scores: Record<string, number>;
  twin_prediction: string; job_readiness_probability: number;
}
interface ResumeSection { name: string; score: number; feedback: string }
interface ResumeResult {
  score: number; ats_score: number;
  strengths: string[]; suggestions: string[];
  missing_keywords: string[]; sections: ResumeSection[];
}
interface LinkedInResult {
  score: number; suggestions: string[];
  optimized_headline: string; optimized_summary: string;
  missing_skills: string[]; section_scores: Record<string, number>;
}
interface InterviewMsg { role: string; content: string }
interface InterviewChatResp {
  message: string; question_number?: number; total_questions: number;
  is_complete: boolean; scores?: Record<string, number>; feedback?: string;
}
interface SkillGap {
  target_career: string; current_skills: string[]; missing_skills: string[];
  learning_plan: Array<{ step: number; title: string; description: string; resources: string[]; duration: string }>;
  compatibility_score: number;
}
interface Recommendation {
  role: string; compatibility: number; reasoning: string;
  required_skills: string[]; key_matches: string[];
}
interface CareerRecs { recommendations: Recommendation[]; top_match: string; twin_insight: string }
interface JobMatch {
  role: string; match_percent: number; reasoning: string;
  key_skills_matched: string[]; missing_skills: string[];
}
interface JobMatches { matches: JobMatch[]; top_role: string }
interface RoadmapStepData {
  step: number; title: string; description: string;
  duration: string; resources: string[]; status: string;
}
interface Roadmap {
  current_position: string; target_career: string;
  steps: RoadmapStepData[]; estimated_time: string; twin_success_probability: number;
}
interface CodingChallenge {
  title: string; problem: string;
  examples: Array<{ input: string; output: string; explanation?: string }>;
  hints: string[]; difficulty: string; topic: string; constraints: string[];
}
interface CodingEval {
  score: number; is_correct: boolean; feedback: string;
  time_complexity: string; space_complexity: string; improvements: string[];
}

// ── Theme constants ─────────────────────────────────────────────────────

const BG = '#060b18';
const CARD = 'rgba(255,255,255,0.04)';
const BORDER = '1px solid rgba(255,255,255,0.08)';
const CYAN = '#00D4FF';
const INDIGO = '#6366f1';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const PURPLE = '#8b5cf6';
const TEXT = '#f1f5f9';
const MUTED = '#94a3b8';
const DIM = '#475569';

const TABS = [
  { id: 'overview',      label: 'Career Score',    icon: '🎯' },
  { id: 'resume',        label: 'Resume',           icon: '📄' },
  { id: 'linkedin',      label: 'LinkedIn',         icon: '💼' },
  { id: 'interview',     label: 'Interview',        icon: '🎤' },
  { id: 'coding',        label: 'Coding',           icon: '💻' },
  { id: 'skillgap',      label: 'Skill Gap',        icon: '📊' },
  { id: 'recommendations', label: 'Careers',        icon: '🌟' },
  { id: 'jobmatch',      label: 'Job Match',        icon: '🔍' },
  { id: 'roadmap',       label: 'Roadmap',          icon: '🗺️' },
  { id: 'resources',     label: 'Resources',        icon: '📚' },
];

const CAREER_OPTIONS = ['AI Engineer', 'Data Scientist', 'ML Engineer', 'Software Developer', 'Research Engineer', 'Data Analyst', 'Backend Developer', 'DevOps Engineer'];

const RESOURCES = [
  { name: 'LinkedIn', url: 'https://linkedin.com', icon: '💼', color: '#0077b5', desc: 'Professional networking and job search platform.', tip: 'Update your profile weekly and connect with industry professionals.' },
  { name: 'LeetCode', url: 'https://leetcode.com', icon: '⚡', color: '#f89f1b', desc: 'Coding interview preparation with 3000+ problems.', tip: 'Solve at least 1 problem daily for interview readiness.' },
  { name: 'GitHub', url: 'https://github.com', icon: '🐙', color: '#f0f6fc', desc: 'Host your projects and contribute to open source.', tip: 'Maintain a green contribution graph and pin top projects.' },
  { name: 'Kaggle', url: 'https://kaggle.com', icon: '🔬', color: '#20beff', desc: 'Data science competitions and datasets.', tip: 'Participate in competitions to build practical ML skills.' },
  { name: 'HackerRank', url: 'https://hackerrank.com', icon: '🟢', color: '#00ea64', desc: 'Coding challenges and skill certification.', tip: 'Earn certifications to validate your skills to employers.' },
  { name: 'Coursera', url: 'https://coursera.org', icon: '🎓', color: '#0056d2', desc: 'University-level courses from top institutions.', tip: 'Complete specializations for structured learning paths.' },
  { name: 'Codeforces', url: 'https://codeforces.com', icon: '🏆', color: '#1c86ee', desc: 'Competitive programming contests.', tip: 'Participate in rated contests to sharpen algorithmic thinking.' },
  { name: 'edX', url: 'https://edx.org', icon: '📖', color: '#02262b', desc: 'Online courses from MIT, Harvard, and more.', tip: 'Enroll in professional certificates for career advancement.' },
  { name: 'Udemy', url: 'https://udemy.com', icon: '🎯', color: '#a435f0', desc: 'Practical skill courses at affordable prices.', tip: 'Buy courses during sales and focus on project-based learning.' },
];

// ── Reusable components ──────────────────────────────────────────────────

function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '3rem', color: MUTED }}>
      <div style={{ width: 20, height: 20, border: `2px solid ${INDIGO}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      Analyzing...
    </div>
  );
}

function ScoreRing({ score, color, size = 100 }: { score: number; color: string; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }} />
    </svg>
  );
}

function ProgressBar({ value, color, height = 6 }: { value: number; color: string; height?: number }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 99, height, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.8s ease' }} />
    </div>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {text}
    </span>
  );
}

// ── Section: Career Readiness Score ────────────────────────────────────

function OverviewSection() {
  const [data, setData] = useState<CareerOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get<CareerOverview>('/career/overview')
      .then(r => setData(r.data))
      .catch(() => setErr('Failed to load career data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;
  if (err) return <div style={{ padding: '2rem', color: RED }}>{err}</div>;
  if (!data) return null;

  const gradeColor = data.grade === 'A' ? GREEN : data.grade === 'B' ? CYAN : data.grade === 'C' ? AMBER : RED;
  const components = Object.entries(data.component_scores);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Score hero */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div style={{ background: CARD, border: BORDER, borderRadius: 20, padding: '2rem', display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <ScoreRing score={data.score} color={gradeColor} size={130} />
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: TEXT }}>{data.score}</div>
              <div style={{ fontSize: '0.7rem', color: MUTED }}>/ 100</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: gradeColor }}>Grade {data.grade}</div>
            <div style={{ color: TEXT, fontSize: '1.1rem', fontWeight: 600, marginTop: 4 }}>Career Readiness</div>
            <div style={{ color: MUTED, fontSize: '0.85rem', marginTop: 8, lineHeight: 1.5 }}>
              {data.job_readiness_probability >= 0.8 ? 'Excellent — you\'re nearly job-ready!' :
               data.job_readiness_probability >= 0.6 ? 'Good progress — keep building skills.' :
               data.job_readiness_probability >= 0.4 ? 'Developing — focus on key gaps.' : 'Early stage — start with the roadmap below.'}
            </div>
          </div>
        </div>

        <div style={{ background: CARD, border: BORDER, borderRadius: 20, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <div style={{ color: GREEN, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>✓ Strengths</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {data.strengths.map(s => <Tag key={s} text={s} color={GREEN} />)}
            </div>
          </div>
          <div>
            <div style={{ color: AMBER, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>⚠ Areas to Improve</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {data.areas_to_improve.map(s => <Tag key={s} text={s} color={AMBER} />)}
            </div>
          </div>
        </div>
      </div>

      {/* Component breakdown */}
      <div style={{ background: CARD, border: BORDER, borderRadius: 20, padding: '1.5rem' }}>
        <div style={{ color: TEXT, fontWeight: 700, fontSize: '1rem', marginBottom: '1.2rem' }}>Performance Breakdown</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem 2rem' }}>
          {components.map(([key, val]) => {
            const c = val >= 75 ? GREEN : val >= 55 ? CYAN : val >= 35 ? AMBER : RED;
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.82rem', color: MUTED }}>{key}</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: c }}>{val.toFixed(0)}%</span>
                </div>
                <ProgressBar value={val} color={c} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Twin prediction */}
      <div style={{ background: `linear-gradient(135deg, ${INDIGO}18, ${CYAN}10)`, border: `1px solid ${INDIGO}40`, borderRadius: 20, padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <div style={{ fontSize: '2rem', flexShrink: 0 }}>🤖</div>
        <div>
          <div style={{ color: CYAN, fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Digital Twin Prediction</div>
          <div style={{ color: TEXT, fontSize: '1rem', lineHeight: 1.6 }}>{data.twin_prediction}</div>
        </div>
      </div>
    </div>
  );
}

// ── Section: Resume Analyzer ────────────────────────────────────────────

function ResumeSection() {
  const [text, setText] = useState('');
  const [role, setRole] = useState('');
  const [result, setResult] = useState<ResumeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function analyze() {
    if (!text.trim()) return;
    setLoading(true); setErr(''); setResult(null);
    try {
      const r = await api.post<ResumeResult>('/career/resume/analyze', { resume_text: text, target_role: role || undefined });
      setResult(r.data);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErr(detail ?? 'Analysis failed. Please try again.');
    } finally { setLoading(false); }
  }

  const scoreColor = result ? (result.score >= 80 ? GREEN : result.score >= 60 ? CYAN : result.score >= 40 ? AMBER : RED) : CYAN;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ background: CARD, border: BORDER, borderRadius: 20, padding: '1.5rem' }}>
        <div style={{ color: TEXT, fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>Paste Your Resume Text</div>
        <input
          placeholder="Target role (optional, e.g. AI Engineer)"
          value={role} onChange={e => setRole(e.target.value)}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: BORDER, borderRadius: 10, padding: '0.65rem 1rem', color: TEXT, fontSize: '0.9rem', marginBottom: '0.75rem', boxSizing: 'border-box' }}
        />
        <textarea
          placeholder="Paste your full resume text here..."
          value={text} onChange={e => setText(e.target.value)} rows={10}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: BORDER, borderRadius: 10, padding: '0.75rem 1rem', color: TEXT, fontSize: '0.85rem', resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box' }}
        />
        <button onClick={analyze} disabled={loading || !text.trim()}
          style={{ marginTop: '0.75rem', padding: '0.65rem 2rem', background: loading || !text.trim() ? DIM : `linear-gradient(135deg,${INDIGO},${CYAN})`, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: loading || !text.trim() ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>
          {loading ? 'Analyzing…' : 'Analyze Resume'}
        </button>
        {err && <div style={{ color: RED, fontSize: '0.85rem', marginTop: 8 }}>{err}</div>}
      </div>

      {loading && <Loader />}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Scores */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: MUTED, textTransform: 'uppercase', letterSpacing: 1 }}>Resume Score</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: scoreColor, margin: '0.25rem 0' }}>{result.score}</div>
              <div style={{ color: MUTED, fontSize: '0.75rem' }}>/ 100</div>
            </div>
            <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: MUTED, textTransform: 'uppercase', letterSpacing: 1 }}>ATS Score</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: result.ats_score >= 70 ? GREEN : AMBER, margin: '0.25rem 0' }}>{result.ats_score}</div>
              <div style={{ color: MUTED, fontSize: '0.75rem' }}>/ 100</div>
            </div>
          </div>

          {/* Section scores */}
          <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem' }}>
            <div style={{ color: TEXT, fontWeight: 700, marginBottom: '1rem' }}>Section Analysis</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {result.sections.map(s => {
                const c = s.score >= 75 ? GREEN : s.score >= 50 ? AMBER : RED;
                return (
                  <div key={s.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.85rem', color: TEXT }}>{s.name}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: c }}>{s.score}/100</span>
                    </div>
                    <ProgressBar value={s.score} color={c} />
                    <div style={{ fontSize: '0.75rem', color: MUTED, marginTop: 4 }}>{s.feedback}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strengths & Suggestions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem' }}>
              <div style={{ color: GREEN, fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>✓ Strengths</div>
              {result.strengths.map((s, i) => <div key={i} style={{ color: MUTED, fontSize: '0.82rem', marginBottom: 4 }}>• {s}</div>)}
            </div>
            <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem' }}>
              <div style={{ color: CYAN, fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>💡 Suggestions</div>
              {result.suggestions.map((s, i) => <div key={i} style={{ color: MUTED, fontSize: '0.82rem', marginBottom: 4 }}>• {s}</div>)}
            </div>
          </div>

          {/* Missing keywords */}
          {result.missing_keywords.length > 0 && (
            <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem' }}>
              <div style={{ color: AMBER, fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>⚠ Missing Keywords</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.missing_keywords.map(k => <Tag key={k} text={k} color={AMBER} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section: LinkedIn Optimizer ──────────────────────────────────────────

function LinkedInSection() {
  const [text, setText] = useState('');
  const [role, setRole] = useState('');
  const [result, setResult] = useState<LinkedInResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function analyze() {
    if (!text.trim()) return;
    setLoading(true); setErr(''); setResult(null);
    try {
      const r = await api.post<LinkedInResult>('/career/linkedin/analyze', { profile_text: text, target_role: role || undefined });
      setResult(r.data);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErr(detail ?? 'Analysis failed.');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ background: CARD, border: BORDER, borderRadius: 20, padding: '1.5rem' }}>
        <div style={{ color: TEXT, fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>Paste LinkedIn Profile Text</div>
        <input placeholder="Target role (optional)" value={role} onChange={e => setRole(e.target.value)}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: BORDER, borderRadius: 10, padding: '0.65rem 1rem', color: TEXT, fontSize: '0.9rem', marginBottom: '0.75rem', boxSizing: 'border-box' }} />
        <textarea placeholder="Paste your LinkedIn profile content (headline, about, experience, skills...)..." value={text} onChange={e => setText(e.target.value)} rows={8}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: BORDER, borderRadius: 10, padding: '0.75rem 1rem', color: TEXT, fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box' }} />
        <button onClick={analyze} disabled={loading || !text.trim()}
          style={{ marginTop: '0.75rem', padding: '0.65rem 2rem', background: loading || !text.trim() ? DIM : `linear-gradient(135deg,#0077b5,${CYAN})`, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: loading || !text.trim() ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>
          {loading ? 'Analyzing…' : 'Optimize LinkedIn'}
        </button>
        {err && <div style={{ color: RED, fontSize: '0.85rem', marginTop: 8 }}>{err}</div>}
      </div>

      {loading && <Loader />}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: MUTED }}>Profile Score</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: result.score >= 70 ? GREEN : result.score >= 50 ? AMBER : RED }}>{result.score}</div>
            </div>
            <div style={{ flex: 1 }}>
              {Object.entries(result.section_scores).map(([k, v]) => (
                <div key={k} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: '0.8rem', color: MUTED }}>{k}</span>
                    <span style={{ fontSize: '0.8rem', color: v >= 70 ? GREEN : AMBER }}>{v}/100</span>
                  </div>
                  <ProgressBar value={v} color={v >= 70 ? GREEN : AMBER} height={4} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem' }}>
            <div style={{ color: CYAN, fontWeight: 700, fontSize: '0.85rem', marginBottom: 6 }}>Optimized Headline</div>
            <div style={{ color: TEXT, fontSize: '0.95rem', lineHeight: 1.5, background: 'rgba(0,212,255,0.06)', border: `1px solid ${CYAN}30`, borderRadius: 8, padding: '0.75rem' }}>{result.optimized_headline}</div>
          </div>

          <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem' }}>
            <div style={{ color: CYAN, fontWeight: 700, fontSize: '0.85rem', marginBottom: 6 }}>Optimized About Section</div>
            <div style={{ color: MUTED, fontSize: '0.88rem', lineHeight: 1.7, background: 'rgba(0,212,255,0.04)', border: `1px solid ${CYAN}20`, borderRadius: 8, padding: '0.75rem' }}>{result.optimized_summary}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem' }}>
              <div style={{ color: INDIGO, fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>💡 Suggestions</div>
              {result.suggestions.map((s, i) => <div key={i} style={{ color: MUTED, fontSize: '0.82rem', marginBottom: 4 }}>• {s}</div>)}
            </div>
            <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem' }}>
              <div style={{ color: AMBER, fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>Missing Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.missing_skills.map(s => <Tag key={s} text={s} color={AMBER} />)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section: Mock Interview ──────────────────────────────────────────────

function InterviewSection() {
  const [role, setRole] = useState('AI Engineer');
  const [started, setStarted] = useState(false);
  const [history, setHistory] = useState<InterviewMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [scores, setScores] = useState<Record<string, number> | null>(null);
  const [feedback, setFeedback] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  async function startInterview() {
    setStarted(true); setHistory([]); setComplete(false); setScores(null); setFeedback('');
    setLoading(true);
    try {
      const r = await api.post<InterviewChatResp>('/career/interview/chat', { role, history: [], mode: 'question' });
      setHistory([{ role: 'assistant', content: r.data.message }]);
    } finally { setLoading(false); }
  }

  async function sendAnswer() {
    if (!input.trim()) return;
    const newHistory: InterviewMsg[] = [...history, { role: 'user', content: input.trim() }];
    setHistory(newHistory); setInput(''); setLoading(true);
    try {
      const userCount = newHistory.filter(m => m.role === 'user').length;
      const mode = userCount >= 8 ? 'evaluate' : 'question';
      const r = await api.post<InterviewChatResp>('/career/interview/chat', { role, history: newHistory, mode });
      setHistory(prev => [...prev, { role: 'assistant', content: r.data.message }]);
      if (r.data.is_complete) {
        setComplete(true);
        if (r.data.scores) setScores(r.data.scores);
        if (r.data.feedback) setFeedback(r.data.feedback);
      }
    } finally { setLoading(false); }
  }

  if (!started) {
    return (
      <div style={{ background: CARD, border: BORDER, borderRadius: 20, padding: '2rem', maxWidth: 540, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎤</div>
        <div style={{ color: TEXT, fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.5rem' }}>AI Mock Interview</div>
        <div style={{ color: MUTED, fontSize: '0.88rem', marginBottom: '1.5rem' }}>Practice with 8 mixed technical, behavioral, and HR questions. Get scored on communication, confidence, and technical depth.</div>
        <select value={role} onChange={e => setRole(e.target.value)}
          style={{ width: '100%', background: '#0d1117', border: BORDER, borderRadius: 10, padding: '0.65rem 1rem', color: TEXT, fontSize: '0.9rem', marginBottom: '1rem' }}>
          {CAREER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <button onClick={startInterview}
          style={{ width: '100%', padding: '0.75rem', background: `linear-gradient(135deg,${INDIGO},${PURPLE})`, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
          Start Interview
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '65vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: MUTED, fontSize: '0.85rem' }}>Mock Interview — <span style={{ color: CYAN }}>{role}</span></div>
        <button onClick={() => { setStarted(false); setHistory([]); }}
          style={{ padding: '0.4rem 1rem', background: 'rgba(255,255,255,0.05)', border: BORDER, borderRadius: 8, color: MUTED, cursor: 'pointer', fontSize: '0.82rem' }}>
          New Interview
        </button>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem' }}>
        {history.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '78%', padding: '0.75rem 1rem', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: m.role === 'user' ? `linear-gradient(135deg,${INDIGO},${PURPLE})` : 'rgba(255,255,255,0.06)',
              border: m.role === 'user' ? 'none' : BORDER,
              color: TEXT, fontSize: '0.88rem', lineHeight: 1.6,
            }}>
              {m.role === 'assistant' && <div style={{ color: CYAN, fontSize: '0.72rem', fontWeight: 700, marginBottom: 4 }}>AI INTERVIEWER</div>}
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: '0.82rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: INDIGO, animation: 'pulse 1s infinite' }} />
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Score cards on completion */}
      {complete && scores && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.75rem' }}>
          {Object.entries(scores).map(([k, v]) => (
            <div key={k} style={{ background: CARD, border: BORDER, borderRadius: 12, padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: MUTED, textTransform: 'capitalize' }}>{k}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: v >= 75 ? GREEN : v >= 55 ? AMBER : RED }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {!complete && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendAnswer()}
            placeholder="Type your answer…"
            disabled={loading}
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: BORDER, borderRadius: 10, padding: '0.65rem 1rem', color: TEXT, fontSize: '0.9rem' }} />
          <button onClick={sendAnswer} disabled={loading || !input.trim()}
            style={{ padding: '0.65rem 1.25rem', background: loading || !input.trim() ? DIM : INDIGO, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Send
          </button>
        </div>
      )}
    </div>
  );
}

// ── Section: Coding Practice ─────────────────────────────────────────────

function CodingSection() {
  const [difficulty, setDifficulty] = useState('medium');
  const [topic, setTopic] = useState('arrays');
  const [challenge, setChallenge] = useState<CodingChallenge | null>(null);
  const [code, setCode] = useState('');
  const [lang, setLang] = useState('python');
  const [evalResult, setEvalResult] = useState<CodingEval | null>(null);
  const [loading, setLoading] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);

  async function getChallenge() {
    setLoading(true); setChallenge(null); setEvalResult(null); setCode('');
    try {
      const r = await api.post<CodingChallenge>('/career/coding/challenge', { difficulty, topic });
      setChallenge(r.data);
    } finally { setLoading(false); }
  }

  async function submitSolution() {
    if (!challenge || !code.trim()) return;
    setEvalLoading(true); setEvalResult(null);
    try {
      const r = await api.post<CodingEval>('/career/coding/evaluate', { problem: challenge.problem, solution: code, language: lang });
      setEvalResult(r.data);
    } finally { setEvalLoading(false); }
  }

  const TOPICS = ['Arrays', 'Linked Lists', 'Trees', 'Graphs', 'Dynamic Programming', 'Sorting', 'Binary Search', 'Strings', 'Machine Learning', 'System Design'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Controls */}
      <div style={{ background: CARD, border: BORDER, borderRadius: 20, padding: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ color: MUTED, fontSize: '0.75rem', marginBottom: 4 }}>Difficulty</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['easy', 'medium', 'hard'].map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: `1px solid ${difficulty === d ? (d === 'easy' ? GREEN : d === 'medium' ? AMBER : RED) : 'rgba(255,255,255,0.1)'}`, background: difficulty === d ? `${d === 'easy' ? GREEN : d === 'medium' ? AMBER : RED}22` : 'transparent', color: difficulty === d ? (d === 'easy' ? GREEN : d === 'medium' ? AMBER : RED) : MUTED, cursor: 'pointer', fontSize: '0.82rem', textTransform: 'capitalize', fontWeight: 600 }}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: MUTED, fontSize: '0.75rem', marginBottom: 4 }}>Topic</div>
          <select value={topic} onChange={e => setTopic(e.target.value)}
            style={{ background: '#0d1117', border: BORDER, borderRadius: 8, padding: '0.4rem 0.75rem', color: TEXT, fontSize: '0.85rem' }}>
            {TOPICS.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
          </select>
        </div>
        <button onClick={getChallenge} disabled={loading}
          style={{ padding: '0.6rem 1.5rem', background: `linear-gradient(135deg,${CYAN},${INDIGO})`, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer', marginTop: 16 }}>
          {loading ? 'Loading…' : 'Get Challenge'}
        </button>
      </div>

      {loading && <Loader />}

      {challenge && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Problem */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 800, color: TEXT, fontSize: '1rem' }}>{challenge.title}</span>
                <Tag text={challenge.difficulty} color={challenge.difficulty === 'easy' ? GREEN : challenge.difficulty === 'medium' ? AMBER : RED} />
              </div>
              <div style={{ color: MUTED, fontSize: '0.87rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{challenge.problem}</div>
            </div>
            {challenge.examples.length > 0 && (
              <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem' }}>
                <div style={{ color: TEXT, fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.85rem' }}>Examples</div>
                {challenge.examples.map((ex, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '0.6rem 0.75rem', marginBottom: 8, fontFamily: 'monospace', fontSize: '0.82rem' }}>
                    <div style={{ color: CYAN }}>Input: <span style={{ color: TEXT }}>{ex.input}</span></div>
                    <div style={{ color: GREEN }}>Output: <span style={{ color: TEXT }}>{ex.output}</span></div>
                    {ex.explanation && <div style={{ color: MUTED }}>// {ex.explanation}</div>}
                  </div>
                ))}
              </div>
            )}
            {challenge.constraints.length > 0 && (
              <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1rem' }}>
                <div style={{ color: TEXT, fontWeight: 700, marginBottom: 6, fontSize: '0.82rem' }}>Constraints</div>
                {challenge.constraints.map((c, i) => <div key={i} style={{ color: MUTED, fontSize: '0.8rem' }}>• {c}</div>)}
              </div>
            )}
            <button onClick={() => setShowHint(!showHint)}
              style={{ padding: '0.5rem 1rem', background: 'rgba(245,158,11,0.1)', border: `1px solid ${AMBER}40`, borderRadius: 8, color: AMBER, cursor: 'pointer', fontSize: '0.82rem', width: 'fit-content' }}>
              {showHint ? 'Hide Hints' : 'Show Hints 💡'}
            </button>
            {showHint && challenge.hints.map((h, i) => (
              <div key={i} style={{ background: `${AMBER}0a`, border: `1px solid ${AMBER}30`, borderRadius: 8, padding: '0.6rem 0.75rem', color: AMBER, fontSize: '0.82rem' }}>Hint {i + 1}: {h}</div>
            ))}
          </div>

          {/* Code editor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: TEXT, fontWeight: 700, fontSize: '0.9rem' }}>Your Solution</div>
                <select value={lang} onChange={e => setLang(e.target.value)}
                  style={{ background: '#0d1117', border: BORDER, borderRadius: 6, padding: '0.3rem 0.5rem', color: MUTED, fontSize: '0.78rem' }}>
                  {['python', 'javascript', 'java', 'c++', 'go'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <textarea value={code} onChange={e => setCode(e.target.value)} rows={16} placeholder={`# Write your ${lang} solution here...`}
                style={{ width: '100%', background: '#0d1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '0.75rem', color: '#e2e8f0', fontSize: '0.83rem', fontFamily: '"JetBrains Mono", "Fira Code", monospace', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
              <button onClick={submitSolution} disabled={evalLoading || !code.trim()}
                style={{ padding: '0.65rem', background: evalLoading || !code.trim() ? DIM : `linear-gradient(135deg,${GREEN},${CYAN})`, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                {evalLoading ? 'Evaluating…' : 'Submit Solution'}
              </button>
            </div>

            {evalLoading && <Loader />}

            {evalResult && (
              <div style={{ background: CARD, border: `1px solid ${evalResult.is_correct ? GREEN : AMBER}50`, borderRadius: 16, padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontWeight: 700, color: evalResult.is_correct ? GREEN : AMBER }}>{evalResult.is_correct ? '✓ Accepted' : '◎ Needs Work'}</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: evalResult.score >= 75 ? GREEN : evalResult.score >= 50 ? AMBER : RED }}>{evalResult.score}/100</span>
                </div>
                <div style={{ color: MUTED, fontSize: '0.85rem', marginBottom: '0.75rem' }}>{evalResult.feedback}</div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                  <Tag text={`Time: ${evalResult.time_complexity}`} color={CYAN} />
                  <Tag text={`Space: ${evalResult.space_complexity}`} color={INDIGO} />
                </div>
                {evalResult.improvements.length > 0 && (
                  <>
                    <div style={{ color: AMBER, fontWeight: 600, fontSize: '0.8rem', marginBottom: 6 }}>Improvements:</div>
                    {evalResult.improvements.map((imp, i) => <div key={i} style={{ color: MUTED, fontSize: '0.8rem' }}>• {imp}</div>)}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section: Skill Gap ───────────────────────────────────────────────────

function SkillGapSection() {
  const [target, setTarget] = useState('AI Engineer');
  const [result, setResult] = useState<SkillGap | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true); setResult(null);
    try {
      const r = await api.get<SkillGap>(`/career/skill-gap?target=${encodeURIComponent(target)}`);
      setResult(r.data);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ background: CARD, border: BORDER, borderRadius: 20, padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: MUTED, fontSize: '0.8rem', marginBottom: 6 }}>Target Career</div>
          <select value={target} onChange={e => setTarget(e.target.value)}
            style={{ width: '100%', background: '#0d1117', border: BORDER, borderRadius: 10, padding: '0.65rem 1rem', color: TEXT, fontSize: '0.9rem' }}>
            {CAREER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <button onClick={analyze} disabled={loading}
          style={{ padding: '0.65rem 1.75rem', background: `linear-gradient(135deg,${INDIGO},${PURPLE})`, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          {loading ? 'Analyzing…' : 'Analyze Gap'}
        </button>
      </div>

      {loading && <Loader />}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Compat score */}
          <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ScoreRing score={result.compatibility_score} color={result.compatibility_score >= 70 ? GREEN : result.compatibility_score >= 45 ? AMBER : RED} size={90} />
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: TEXT }}>{result.compatibility_score}%</div>
              </div>
            </div>
            <div>
              <div style={{ color: TEXT, fontWeight: 700, fontSize: '1.1rem' }}>Compatibility with {result.target_career}</div>
              <div style={{ color: MUTED, fontSize: '0.85rem', marginTop: 4 }}>Based on your current subjects and learning profile.</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem' }}>
              <div style={{ color: GREEN, fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>✓ Current Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.current_skills.map(s => <Tag key={s} text={s} color={GREEN} />)}
              </div>
            </div>
            <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem' }}>
              <div style={{ color: RED, fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>⚠ Missing Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.missing_skills.map(s => <Tag key={s} text={s} color={RED} />)}
              </div>
            </div>
          </div>

          {/* Learning plan */}
          <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem' }}>
            <div style={{ color: TEXT, fontWeight: 700, marginBottom: '1rem' }}>Learning Plan to Close the Gap</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {result.learning_plan.map((step, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: `1px solid rgba(255,255,255,0.06)` }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${INDIGO}30`, border: `1px solid ${INDIGO}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: INDIGO, flexShrink: 0, fontSize: '0.85rem' }}>{step.step}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: TEXT, fontWeight: 600, fontSize: '0.9rem' }}>{step.title}</div>
                    <div style={{ color: MUTED, fontSize: '0.82rem', marginTop: 2 }}>{step.description}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {step.resources.map(r => <Tag key={r} text={r} color={CYAN} />)}
                      <Tag text={step.duration} color={AMBER} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section: Career Recommendations ─────────────────────────────────────

function RecommendationsSection() {
  const [data, setData] = useState<CareerRecs | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    if (loaded) return;
    setLoading(true);
    try {
      const r = await api.get<CareerRecs>('/career/recommendations');
      setData(r.data); setLoaded(true);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Loader />;
  if (!data) return <div style={{ padding: '2rem', color: MUTED, textAlign: 'center' }}>No data yet. Add subjects and check-ins to get personalized recommendations.</div>;

  const COLORS = [CYAN, INDIGO, PURPLE, GREEN, AMBER, '#ec4899'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Twin insight */}
      <div style={{ background: `linear-gradient(135deg,${INDIGO}18,${PURPLE}18)`, border: `1px solid ${INDIGO}40`, borderRadius: 16, padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '1.8rem' }}>🤖</span>
        <div>
          <div style={{ color: CYAN, fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Twin Insight</div>
          <div style={{ color: TEXT, fontSize: '0.95rem', lineHeight: 1.6 }}>{data.twin_insight}</div>
          <div style={{ color: MUTED, fontSize: '0.8rem', marginTop: 6 }}>Top match: <span style={{ color: CYAN, fontWeight: 700 }}>{data.top_match}</span></div>
        </div>
      </div>

      {/* Recommendations grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {data.recommendations.map((rec, i) => (
          <div key={rec.role} style={{ background: CARD, border: i === 0 ? `1px solid ${CYAN}40` : BORDER, borderRadius: 16, padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
            {i === 0 && <div style={{ position: 'absolute', top: 0, right: 0, background: `${CYAN}22`, padding: '2px 10px', borderRadius: '0 16px 0 10px', fontSize: '0.7rem', color: CYAN, fontWeight: 700 }}>TOP MATCH</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{ color: TEXT, fontWeight: 700, fontSize: '0.95rem' }}>{rec.role}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: COLORS[i % COLORS.length] }}>{rec.compatibility}%</div>
            </div>
            <ProgressBar value={rec.compatibility} color={COLORS[i % COLORS.length]} />
            <div style={{ color: MUTED, fontSize: '0.8rem', marginTop: '0.6rem', lineHeight: 1.5 }}>{rec.reasoning}</div>
            {rec.key_matches.length > 0 && (
              <div style={{ marginTop: '0.6rem', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {rec.key_matches.slice(0, 3).map(m => <Tag key={m} text={m} color={GREEN} />)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Job Role Matching ───────────────────────────────────────────

function JobMatchSection() {
  const [data, setData] = useState<JobMatches | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    setLoading(true);
    api.get<JobMatches>('/career/job-matching')
      .then(r => { setData(r.data); setLoaded(true); })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Loader />;
  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ color: MUTED, fontSize: '0.88rem', marginBottom: 4 }}>
        Based on your profile, subjects, and performance data. Match scores update as your Digital Twin learns more about you.
      </div>
      {data.matches.map((m, i) => {
        const c = m.match_percent >= 80 ? GREEN : m.match_percent >= 65 ? CYAN : m.match_percent >= 50 ? AMBER : RED;
        return (
          <div key={m.role} style={{ background: CARD, border: i === 0 ? `1px solid ${c}40` : BORDER, borderRadius: 16, padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.6rem' }}>
              {i === 0 && <span style={{ fontSize: '1.2rem' }}>🏆</span>}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: TEXT, fontWeight: 700 }}>{m.role}</span>
                  <span style={{ fontWeight: 800, color: c, fontSize: '1.1rem' }}>{m.match_percent}%</span>
                </div>
                <ProgressBar value={m.match_percent} color={c} height={8} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: 6 }}>
              {m.key_skills_matched.length > 0 && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.72rem', color: MUTED, marginBottom: 4 }}>Matched skills</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {m.key_skills_matched.map(s => <Tag key={s} text={s} color={GREEN} />)}
                  </div>
                </div>
              )}
              {m.missing_skills.length > 0 && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.72rem', color: MUTED, marginBottom: 4 }}>Gaps to fill</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {m.missing_skills.map(s => <Tag key={s} text={s} color={RED} />)}
                  </div>
                </div>
              )}
            </div>
            <div style={{ color: DIM, fontSize: '0.78rem', marginTop: 6 }}>{m.reasoning}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Section: Career Roadmap ──────────────────────────────────────────────

function RoadmapSection() {
  const [target, setTarget] = useState('AI Engineer');
  const [data, setData] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true); setData(null);
    try {
      const r = await api.get<Roadmap>(`/career/roadmap?target=${encodeURIComponent(target)}`);
      setData(r.data);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ background: CARD, border: BORDER, borderRadius: 20, padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: MUTED, fontSize: '0.8rem', marginBottom: 6 }}>Target Career</div>
          <select value={target} onChange={e => setTarget(e.target.value)}
            style={{ width: '100%', background: '#0d1117', border: BORDER, borderRadius: 10, padding: '0.65rem 1rem', color: TEXT, fontSize: '0.9rem' }}>
            {CAREER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <button onClick={load} disabled={loading}
          style={{ padding: '0.65rem 1.75rem', background: `linear-gradient(135deg,${PURPLE},${INDIGO})`, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          {loading ? 'Generating…' : 'Generate Roadmap'}
        </button>
      </div>

      {loading && <Loader />}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div style={{ background: CARD, border: BORDER, borderRadius: 14, padding: '1rem', textAlign: 'center' }}>
              <div style={{ color: MUTED, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 1 }}>Current Position</div>
              <div style={{ color: TEXT, fontWeight: 700, fontSize: '0.95rem', marginTop: 4 }}>{data.current_position}</div>
            </div>
            <div style={{ background: CARD, border: BORDER, borderRadius: 14, padding: '1rem', textAlign: 'center' }}>
              <div style={{ color: MUTED, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 1 }}>Target Career</div>
              <div style={{ color: CYAN, fontWeight: 700, fontSize: '0.95rem', marginTop: 4 }}>{data.target_career}</div>
            </div>
            <div style={{ background: CARD, border: BORDER, borderRadius: 14, padding: '1rem', textAlign: 'center' }}>
              <div style={{ color: MUTED, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 1 }}>Est. Time</div>
              <div style={{ color: AMBER, fontWeight: 700, fontSize: '0.95rem', marginTop: 4 }}>{data.estimated_time}</div>
            </div>
          </div>

          {/* Steps */}
          <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.5rem' }}>
            <div style={{ color: TEXT, fontWeight: 700, marginBottom: '1.25rem' }}>Your Personalized Roadmap</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {data.steps.map((step, i) => {
                const isCurrent = step.status === 'current';
                const isLast = i === data.steps.length - 1;
                return (
                  <div key={i} style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: isCurrent ? `linear-gradient(135deg,${CYAN},${INDIGO})` : 'rgba(255,255,255,0.06)', border: `2px solid ${isCurrent ? CYAN : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: isCurrent ? '#fff' : MUTED, fontSize: '0.85rem' }}>
                        {isCurrent ? '▶' : step.step}
                      </div>
                      {!isLast && <div style={{ width: 2, flex: 1, background: 'rgba(255,255,255,0.06)', minHeight: 20, margin: '4px 0' }} />}
                    </div>
                    <div style={{ flex: 1, paddingBottom: isLast ? 0 : '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4 }}>
                        <span style={{ color: isCurrent ? TEXT : MUTED, fontWeight: isCurrent ? 700 : 500, fontSize: '0.92rem' }}>{step.title}</span>
                        <Tag text={step.duration} color={isCurrent ? CYAN : DIM} />
                        {isCurrent && <Tag text="CURRENT" color={GREEN} />}
                      </div>
                      <div style={{ color: DIM, fontSize: '0.82rem', lineHeight: 1.5, marginBottom: 6 }}>{step.description}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {step.resources.map(r => <Tag key={r} text={r} color={INDIGO} />)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Twin success */}
          <div style={{ background: `linear-gradient(135deg,${GREEN}12,${CYAN}08)`, border: `1px solid ${GREEN}35`, borderRadius: 14, padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '2rem' }}>🤖</span>
            <div>
              <div style={{ color: GREEN, fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Twin Success Probability</div>
              <div style={{ color: TEXT, fontSize: '0.95rem' }}>Your Digital Twin estimates a <strong style={{ color: GREEN }}>{Math.round(data.twin_success_probability * 100)}%</strong> probability of successfully transitioning to <strong style={{ color: CYAN }}>{data.target_career}</strong> by following this roadmap.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section: Resource Hub ────────────────────────────────────────────────

function ResourceHub() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
      {RESOURCES.map(res => (
        <a key={res.name} href={res.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s', height: '100%', boxSizing: 'border-box' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.6rem' }}>{res.icon}</span>
              <span style={{ color: TEXT, fontWeight: 700, fontSize: '0.95rem' }}>{res.name}</span>
            </div>
            <div style={{ color: MUTED, fontSize: '0.82rem', lineHeight: 1.6, marginBottom: '0.6rem' }}>{res.desc}</div>
            <div style={{ color: DIM, fontSize: '0.77rem', fontStyle: 'italic' }}>💡 {res.tip}</div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────

export default function CareerDevelopment() {
  const [activeTab, setActiveTab] = useState('overview');
  const scrollRef = useRef<HTMLDivElement>(null);

  const renderSection = useCallback(() => {
    switch (activeTab) {
      case 'overview':      return <OverviewSection />;
      case 'resume':        return <ResumeSection />;
      case 'linkedin':      return <LinkedInSection />;
      case 'interview':     return <InterviewSection />;
      case 'coding':        return <CodingSection />;
      case 'skillgap':      return <SkillGapSection />;
      case 'recommendations': return <RecommendationsSection />;
      case 'jobmatch':      return <JobMatchSection />;
      case 'roadmap':       return <RoadmapSection />;
      case 'resources':     return <ResourceHub />;
      default:              return null;
    }
  }, [activeTab]);

  return (
    <div style={{ minHeight: '100svh', background: BG, color: TEXT, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent; }
        *::-webkit-scrollbar { width: 4px; height: 4px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        select option { background: #0d1117; color: #f1f5f9; }
        input, textarea, select { outline: none; }
        input:focus, textarea:focus, select:focus { border-color: rgba(99,102,241,0.5) !important; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: BORDER, padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(6,11,24,0.9)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <BackButton />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.4rem' }}>🚀</span>
            <span style={{ fontWeight: 800, fontSize: '1.2rem', color: TEXT }}>Career Development Mode</span>
          </div>
          <div style={{ color: MUTED, fontSize: '0.78rem' }}>Your Digital Twin's career intelligence hub</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Link to="/" style={{ color: MUTED, fontSize: '0.82rem', textDecoration: 'none' }}>← Dashboard</Link>
        </div>
      </div>

      {/* Tab bar */}
      <div ref={scrollRef} style={{ overflowX: 'auto', borderBottom: BORDER, background: 'rgba(6,11,24,0.7)', backdropFilter: 'blur(8px)', position: 'sticky', top: 65, zIndex: 40 }}>
        <div style={{ display: 'flex', gap: 0, minWidth: 'max-content', padding: '0 1.5rem' }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ padding: '0.85rem 1.1rem', background: 'none', border: 'none', borderBottom: active ? `2px solid ${CYAN}` : '2px solid transparent', color: active ? CYAN : MUTED, cursor: 'pointer', fontSize: '0.82rem', fontWeight: active ? 700 : 400, display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'color 0.2s', whiteSpace: 'nowrap' }}>
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {renderSection()}
      </div>
    </div>
  );
}

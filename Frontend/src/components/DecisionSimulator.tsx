﻿import { useState, useCallback } from 'react';

/* ── Types (local, mirrors DPT interfaces — no cross-page imports) ── */
interface TwinInfo {
  overall_score: number; consistency_score: number; wellness_score: number;
  academic_score: number; trend: 'improving'|'declining'|'stable';
  twin_age: number; data_points: number; strengths: string[];
  areas_to_improve: string[];
  twin_intelligence_score: number; confidence_level: number;
  prediction_reliability: number; behavior_understanding: string;
  current_state_label: string; ai_insights: string[];
  cognitive_heatmap?: {
    knowledge_areas: number; memory_strength: number; focus_stability: number;
    learning_speed: number; prediction_confidence: number;
  } | null;
}
interface SubjectInfo {
  weakest: { subject: string; avg_score: number; recommended_daily_minutes: number } | null;
  strongest: { subject: string; avg_score: number } | null;
}
export interface Props {
  twin: TwinInfo | null;
  subjects: SubjectInfo | null;
  progress: unknown;
}

/* ── Local storage ───────────────────────────────────────────────── */
const STORAGE_KEY = 'twinmind_decision_history_v1';
const FEEDBACK_BOOST_KEY = 'twinmind_decision_boost_v1';

interface Alternative { label: string; probability: number }
interface DecisionRecord {
  id: string;
  question: string;
  prediction: string;
  confidence: number;
  alternatives: Alternative[];
  reasoning: string[];
  twinReasoning: string;
  alignment: 'High'|'Medium'|'Low';
  timestamp: string;
  feedback?: 'yes'|'no';
}

function loadHistory(): DecisionRecord[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveHistory(h: DecisionRecord[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(0, 10))); }
  catch { /* quota exceeded */ }
}
function getBoost(): number {
  try { return parseFloat(localStorage.getItem(FEEDBACK_BOOST_KEY) || '0'); }
  catch { return 0; }
}
function addBoost(delta: number) {
  try { localStorage.setItem(FEEDBACK_BOOST_KEY, String(Math.min(8, Math.max(-5, getBoost() + delta)))); }
  catch { /* ignore */ }
}

/* ── Sub-components ──────────────────────────────────────────────── */
function ConfidenceMeter({ confidence }: { confidence: number }) {
  const R = 52, Cx = 64, Cy = 64, sw = 10;
  const circ = 2 * Math.PI * R;
  const fillLen = Math.min(1, confidence / 100) * circ;
  const color = confidence >= 90 ? '#10b981'
    : confidence >= 70 ? '#3b82f6'
    : confidence >= 50 ? '#f59e0b'
    : '#ef4444';
  const label = confidence >= 90 ? 'Very Confident'
    : confidence >= 70 ? 'Confident'
    : confidence >= 50 ? 'Moderate'
    : 'Low Confidence';

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.35rem' }}>
      <svg width={Cx*2} height={Cy*2} style={{ overflow:'visible' }}>
        <defs>
          <filter id="sim-glow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <circle cx={Cx} cy={Cy} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw}/>
        <circle
          cx={Cx} cy={Cy} r={R} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={`${fillLen} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${Cx} ${Cy})`}
          filter="url(#sim-glow)"
          style={{ transition:'stroke-dasharray 1s cubic-bezier(0.34,1.56,0.64,1)', boxShadow:`0 0 12px ${color}` }}
        />
        <text x={Cx} y={Cy-4} textAnchor="middle" fill="#FFFFFF" fontSize="22" fontWeight="800" fontFamily="inherit">{confidence}%</text>
        <text x={Cx} y={Cy+14} textAnchor="middle" fill={color} fontSize="9.5" fontWeight="700" fontFamily="inherit">{label}</text>
      </svg>
    </div>
  );
}

function ProbBar({ label, prob, rank }: { label: string; prob: number; rank: number }) {
  const colors = ['linear-gradient(90deg,#6366f1,#8b5cf6)', 'linear-gradient(90deg,#3b82f6,#06b6d4)', 'linear-gradient(90deg,#8b5cf6,#ec4899)'];
  const bg = colors[rank % colors.length];
  return (
    <div style={{ marginBottom:'0.75rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.3rem' }}>
        <span style={{ fontSize:'0.83rem', color:'#D1D5DB', fontWeight:600 }}>{label}</span>
        <span style={{ fontSize:'0.85rem', fontWeight:800, color:'#FFFFFF' }}>{prob}%</span>
      </div>
      <div style={{ height:9, background:'rgba(255,255,255,0.08)', borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${prob}%`, background:bg, borderRadius:99, boxShadow:`0 0 6px rgba(99,102,241,0.4)`, transition:'width 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}/>
      </div>
    </div>
  );
}

function AlignBadge({ alignment }: { alignment: 'High'|'Medium'|'Low' }) {
  const cfg = {
    High:   { bg:'rgba(16,185,129,0.12)', border:'rgba(16,185,129,0.35)', color:'#34d399', icon:'◈' },
    Medium: { bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.35)', color:'#fbbf24', icon:'◉' },
    Low:    { bg:'rgba(239,68,68,0.12)',  border:'rgba(239,68,68,0.35)',  color:'#f87171', icon:'○' },
  }[alignment];
  return (
    <span style={{ padding:'0.3rem 0.75rem', borderRadius:99, background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color, fontSize:'0.78rem', fontWeight:700 }}>
      {cfg.icon} {alignment} Alignment
    </span>
  );
}

/* ── Prediction engine ───────────────────────────────────────────── */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  frontend:    ['react','next','vue','angular','svelte','css','html','ui','interface','web','frontend','tailwind'],
  backend:     ['node','express','django','fastapi','api','server','backend','database','sql','postgres','mongo'],
  dsa:         ['dsa','algorithm','leetcode','data structure','competitive','sorting','graph','tree','dynamic programming'],
  ml:          ['machine learning','ml','ai','deep learning','dl','pytorch','tensorflow','kaggle','neural','nlp'],
  revision:    ['revise','revision','review','flashcard','recall','memorize'],
  quiz:        ['quiz','test','mock','exam','assessment','practice test'],
  project:     ['project','build','create','implement','deploy','portfolio'],
  career:      ['internship','job','interview','career','hire','placement'],
  rest:        ['break','rest','relax','sleep','pause','stop'],
};

function topicsFromText(text: string): string[] {
  const tl = text.toLowerCase();
  return Object.entries(DOMAIN_KEYWORDS)
    .filter(([, kws]) => kws.some(k => tl.includes(k)))
    .map(([domain]) => domain);
}

function extractOptions(question: string): string[] {
  const q = question.replace(/^(should i|will i|can i|do i|would i)\s+/i, '').trim();
  const orRx = /^(.+?)\s+(?:or|vs\.?|versus)\s+(.+?)(?:\?|$)/i;
  const m = q.match(orRx);
  if (m) {
    return [
      m[1].replace(/^(learn|do|start|use|try|focus on|study|pick|choose|take|go with|work on)\s+/i,'').trim(),
      m[2].trim(),
    ];
  }
  const topic = q.replace(/\?$/,'').trim();
  return [`Yes — ${topic}`, 'Maybe later', 'Modified approach'];
}

function scoreOption(opt: string, twin: TwinInfo | null, subjects: SubjectInfo | null): number {
  if (!twin) return Math.random() * 3;
  let score = 1.0;
  const ol = opt.toLowerCase();
  const optTopics = topicsFromText(ol + ' ' + ol);

  twin.strengths?.forEach(s => {
    if (ol.includes(s.toLowerCase()) || s.toLowerCase().split(' ').some(w => ol.includes(w))) score += 2.5;
  });
  twin.areas_to_improve?.forEach(a => {
    if (ol.includes(a.toLowerCase()) || a.toLowerCase().split(' ').some(w => ol.includes(w))) score += 1.5;
  });
  if (subjects?.strongest?.subject) {
    const ss = subjects.strongest.subject.toLowerCase();
    if (ol.includes(ss) || ss.split(' ').some(w => ol.includes(w) && w.length > 3)) score += 2;
  }

  if (twin.trend === 'improving') {
    if (optTopics.includes('project') || optTopics.includes('ml') || optTopics.includes('dsa')) score += 1.2;
  } else if (twin.trend === 'declining') {
    if (optTopics.includes('revision') || optTopics.includes('rest')) score += 1.5;
    if (optTopics.includes('quiz')) score -= 0.5;
  }
  if ((twin.consistency_score ?? 50) > 72) {
    if (optTopics.includes('dsa') || optTopics.includes('project')) score += 0.8;
  }
  if ((twin.twin_intelligence_score ?? 50) > 70) {
    if (optTopics.includes('ml') || optTopics.includes('backend')) score += 0.6;
  }
  if ((twin.overall_score ?? 50) < 45) {
    if (optTopics.includes('revision') || optTopics.includes('rest')) score += 1.2;
  }
  score += (twin.overall_score ?? 50) / 500;
  return Math.max(0.1, score);
}

function buildReasoning(twin: TwinInfo | null, subjects: SubjectInfo | null): string[] {
  const r: string[] = [];
  if (twin?.data_points)           r.push(`Based on ${twin.data_points} tracked behavioral data points`);
  if (twin?.trend)                 r.push(`Your learning trajectory is currently ${twin.trend}`);
  if (subjects?.strongest?.subject) r.push(`Strongest academic domain: ${subjects.strongest.subject} (${Math.round(subjects.strongest.avg_score ?? 0)}% avg)`);
  if (twin?.consistency_score)     r.push(`Consistency score of ${Math.round(twin.consistency_score)}% reflects your learning rhythm`);
  if (twin?.cognitive_heatmap?.learning_speed) r.push(`Learning speed index calibrated from cognitive heatmap`);
  if (twin?.ai_insights?.[0])      r.push(twin.ai_insights[0]);
  if (r.length < 3) r.push('Based on your previous decision patterns and goal alignment');
  return r.slice(0, 5);
}

function buildTwinReasoning(winner: string, twin: TwinInfo | null, subjects: SubjectInfo | null): string {
  const name = winner.replace(/^Yes — /, '');
  let out = `Your twin predicts "${name}" as the most aligned choice. `;
  if (twin) {
    out += `With an overall learning score of ${Math.round(twin.overall_score)} and a ${twin.trend} trend, `;
    out += `your behavioral patterns strongly indicate this direction. `;
  }
  if (subjects?.strongest) {
    out += `Your strongest domain (${subjects.strongest.subject}) supports this choice. `;
  }
  if (twin?.areas_to_improve?.[0]) {
    out += `This also aligns with your current growth area: improving "${twin.areas_to_improve[0]}". `;
  }
  if (twin?.current_state_label) {
    out += `Your current state "${twin.current_state_label}" makes this the optimal decision for now.`;
  }
  return out;
}

function runPredict(question: string, twin: TwinInfo | null, subjects: SubjectInfo | null): Omit<DecisionRecord,'id'|'timestamp'|'feedback'> {
  const options = extractOptions(question);
  const scored = options.map(opt => ({ opt, score: scoreOption(opt, twin, subjects) }))
                        .sort((a, b) => b.score - a.score);

  const boost = getBoost();
  const rawConf = Math.round(
    (twin?.prediction_reliability ?? 55) * 0.55 +
    (twin?.cognitive_heatmap?.prediction_confidence ?? 50) * 0.25 +
    Math.min(20, (twin?.data_points ?? 0) / 8) +
    boost
  );
  const confidence = Math.max(35, Math.min(92, rawConf));

  const totalScore = scored.reduce((s, x) => s + x.score, 0);
  const winProb = Math.max(50, Math.min(85, Math.round(45 + confidence * 0.4)));
  const rest = 100 - winProb;

  const alternatives: Alternative[] = scored.map((x, i) => {
    if (i === 0) return { label: x.opt, probability: winProb };
    const share = Math.round((x.score / (totalScore - scored[0].score + 0.01)) * rest);
    return { label: x.opt, probability: share };
  });

  const alignment: 'High'|'Medium'|'Low' = confidence >= 70 ? 'High' : confidence >= 50 ? 'Medium' : 'Low';

  return {
    question,
    prediction: scored[0].opt,
    confidence,
    alternatives,
    reasoning: buildReasoning(twin, subjects),
    twinReasoning: buildTwinReasoning(scored[0].opt, twin, subjects),
    alignment,
  };
}

/* ── Card style (matches DPT/Twin.tsx aesthetic) ─────────────────── */
const CARD: React.CSSProperties = {
  background:'rgba(8,12,30,0.82)', border:'1px solid rgba(255,255,255,0.14)',
  borderRadius:20, padding:'1.6rem', backdropFilter:'blur(10px)',
  boxShadow:'0 4px 24px rgba(0,0,0,0.6)',
};
const LABEL: React.CSSProperties = { margin:'0 0 0.2rem', fontSize:'0.6rem', fontWeight:700, color:'#6B7280', letterSpacing:'0.08em', textTransform:'uppercase' as const };

/* ── Main component ──────────────────────────────────────────────── */
export default function DecisionSimulator({ twin, subjects, progress }: Props) {
  const [question, setQuestion]     = useState('');
  const [result,   setResult]       = useState<DecisionRecord | null>(null);
  const [loading,  setLoading]      = useState(false);
  const [history,  setHistory]      = useState<DecisionRecord[]>(loadHistory);
  const [showHist, setShowHist]     = useState(false);

  const PLACEHOLDERS = [
    'Should I learn React or Next.js?',
    'Should I start a Kaggle project now?',
    'Should I focus on DSA or Machine Learning?',
    'Should I revise or take a quiz today?',
    'Should I take a study break or push through?',
  ];
  const [phIdx] = useState(() => Math.floor(Math.random() * PLACEHOLDERS.length));

  const accuracy = useCallback(() => {
    const rated = history.filter(r => r.feedback);
    if (!rated.length) return null;
    const correct = rated.filter(r => r.feedback === 'yes').length;
    return Math.round((correct / rated.length) * 100);
  }, [history]);

  const simulate = useCallback(() => {
    if (!question.trim()) return;
    setLoading(true);
    setTimeout(() => {
      const partial = runPredict(question.trim(), twin, subjects);
      const record: DecisionRecord = {
        ...partial,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
      };
      setResult(record);
      const next = [record, ...history].slice(0, 10);
      setHistory(next);
      saveHistory(next);
      setLoading(false);
    }, 1200);
  }, [question, twin, subjects, history]);

  const recordFeedback = useCallback((id: string, feedback: 'yes'|'no') => {
    const next = history.map(r => r.id === id ? { ...r, feedback } : r);
    setHistory(next);
    saveHistory(next);
    if (result?.id === id) setResult(prev => prev ? { ...prev, feedback } : prev);
    addBoost(feedback === 'yes' ? 1.5 : -0.8);
  }, [history, result]);

  const acc = accuracy();

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>

      {/* ── Header ── */}
      <div style={{ ...CARD, padding:'1.75rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'1rem' }}>
          <div>
            <h2 style={{ margin:'0 0 0.4rem', fontSize:'1.4rem', fontWeight:800, color:'#FFFFFF', letterSpacing:'-0.3px' }}>Decision Simulator</h2>
            <p style={{ margin:0, color:'#9CA3AF', fontSize:'0.88rem', maxWidth:480 }}>
              See how your Digital Twin predicts your likely choices based on your historical behavior and learning patterns.
            </p>
          </div>
          {acc !== null && (
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <p style={LABEL}>Decision Accuracy</p>
              <p style={{ margin:0, fontSize:'1.8rem', fontWeight:800, color: acc >= 70 ? '#34d399' : acc >= 50 ? '#fbbf24' : '#f87171' }}>{acc}%</p>
              <p style={{ margin:'0.1rem 0 0', fontSize:'0.68rem', color:'#6B7280' }}>Based on {history.filter(r=>r.feedback).length} rated predictions</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Input ── */}
      <div style={{ ...CARD }}>
        <p style={LABEL}>Your Question</p>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder={PLACEHOLDERS[phIdx]}
          rows={3}
          style={{
            width:'100%', boxSizing:'border-box' as const,
            background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.12)',
            borderRadius:14, padding:'0.9rem 1rem', color:'#FFFFFF',
            fontSize:'0.93rem', fontFamily:'inherit', resize:'vertical' as const,
            outline:'none', lineHeight:1.55, marginBottom:'1rem',
          }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) simulate(); }}
        />
        <button
          onClick={simulate}
          disabled={loading || !question.trim()}
          style={{
            width:'100%', padding:'0.85rem', borderRadius:14,
            background: loading || !question.trim()
              ? 'rgba(99,102,241,0.25)'
              : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            border:'none', color:'#fff', fontSize:'0.95rem', fontWeight:800,
            cursor: loading || !question.trim() ? 'not-allowed' : 'pointer',
            fontFamily:'inherit', letterSpacing:'-0.2px',
            boxShadow: loading || !question.trim() ? 'none' : '0 4px 20px rgba(99,102,241,0.45)',
            transition:'all 0.2s',
          }}
        >
          {loading ? '◈ Analysing patterns…' : 'Predict My Decision'}
        </button>
        <p style={{ margin:'0.6rem 0 0', fontSize:'0.7rem', color:'#6B7280', textAlign:'center' as const }}>Ctrl+Enter to predict · Uses your real Twin data</p>
      </div>

      {/* ── Loading pulse ── */}
      {loading && (
        <div style={{ ...CARD, textAlign:'center' as const, padding:'2.5rem' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem', animation:'float 1.4s ease-in-out infinite' }}></div>
          <p style={{ color:'#9CA3AF', margin:'0 0 0.4rem', fontWeight:600 }}>Consulting your Digital Twin…</p>
          <p style={{ color:'#6B7280', margin:0, fontSize:'0.8rem' }}>Analysing {twin?.data_points ?? 0} data points</p>
        </div>
      )}

      {/* ── Results ── */}
      {result && !loading && (
        <>
          {/* Top row: prediction + confidence meter */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:'1.25rem', alignItems:'stretch' }} className="mob-twin-row">

            {/* Predicted choice */}
            <div style={{ ...CARD }}>
              <p style={LABEL}>Predicted Choice</p>
              <p style={{ margin:'0 0 0.85rem', fontSize:'1.2rem', fontWeight:800, color:'#FFFFFF', lineHeight:1.3 }}>
                {result.prediction}
              </p>
              <AlignBadge alignment={result.alignment} />

              <div style={{ marginTop:'1.2rem', paddingTop:'1rem', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
                <p style={LABEL}>Twin Reasoning</p>
                <p style={{ margin:0, fontSize:'0.83rem', color:'#D1D5DB', lineHeight:1.65 }}>
                  {result.twinReasoning}
                </p>
              </div>
            </div>

            {/* Confidence meter */}
            <div style={{ ...CARD, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minWidth:160 }}>
              <p style={{ ...LABEL, marginBottom:'0.8rem' }}>Confidence</p>
              <ConfidenceMeter confidence={result.confidence} />
            </div>
          </div>

          {/* Reasoning list */}
          <div style={{ ...CARD }}>
            <p style={LABEL}>Reasoning Factors</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {result.reasoning.map((r, i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'0.7rem' }}>
                  <span style={{ color:'#6366f1', fontWeight:700, flexShrink:0, marginTop:'0.1rem' }}>▸</span>
                  <span style={{ color:'#D1D5DB', fontSize:'0.85rem', lineHeight:1.55 }}>{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alternative outcomes */}
          <div style={{ ...CARD }}>
            <p style={{ ...LABEL, marginBottom:'1rem' }}>Other Possible Choices</p>
            {result.alternatives.map((alt, i) => (
              <ProbBar key={i} label={alt.label} prob={alt.probability} rank={i} />
            ))}
          </div>

          {/* Feedback loop */}
          {!result.feedback ? (
            <div style={{ ...CARD, textAlign:'center' as const }}>
              <p style={{ margin:'0 0 1rem', fontSize:'0.95rem', fontWeight:700, color:'#FFFFFF' }}>
                Did you actually choose this?
              </p>
              <p style={{ margin:'0 0 1.2rem', fontSize:'0.8rem', color:'#9CA3AF' }}>
                Your feedback trains the Twin's prediction accuracy.
              </p>
              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'center' }}>
                <button
                  onClick={() => recordFeedback(result.id, 'yes')}
                  style={{ padding:'0.7rem 2rem', borderRadius:12, background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.35)', color:'#34d399', fontWeight:800, fontSize:'0.88rem', cursor:'pointer', fontFamily:'inherit' }}>Yes</button>
                <button
                  onClick={() => recordFeedback(result.id, 'no')}
                  style={{ padding:'0.7rem 2rem', borderRadius:12, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171', fontWeight:800, fontSize:'0.88rem', cursor:'pointer', fontFamily:'inherit' }}>No</button>
              </div>
            </div>
          ) : (
            <div style={{ ...CARD, textAlign:'center' as const }}>
              {result.feedback === 'yes' ? (
                <p style={{ margin:0, color:'#34d399', fontWeight:700 }}>Great! Prediction confidence calibrated upward.</p>
              ) : (
                <p style={{ margin:0, color:'#f87171', fontWeight:700 }}>Noted. Twin will factor this into future predictions.</p>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Decision History ── */}
      {history.length > 0 && (
        <div style={{ ...CARD }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: showHist ? '1.2rem' : 0 }}>
            <p style={{ ...LABEL, margin:0 }}>Last {history.length} Decision{history.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => setShowHist(v => !v)}
              style={{ background:'none', border:'none', color:'#818cf8', fontSize:'0.78rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit', padding:'0.2rem 0.4rem' }}>
              {showHist ? '▲ Hide' : '▼ Show'}
            </button>
          </div>

          {showHist && (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
              {/* Table header */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 80px 64px', gap:'0.5rem', paddingBottom:'0.5rem', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
                {['Question','Prediction','Outcome','Conf'].map(h => (
                  <span key={h} style={LABEL}>{h}</span>
                ))}
              </div>
              {history.map(rec => (
                <div key={rec.id} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 80px 64px', gap:'0.5rem', paddingBottom:'0.55rem', borderBottom:'1px solid rgba(255,255,255,0.05)', alignItems:'center' }}>
                  <span style={{ fontSize:'0.78rem', color:'#D1D5DB', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }} title={rec.question}>{rec.question}</span>
                  <span style={{ fontSize:'0.78rem', color:'#FFFFFF', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{rec.prediction}</span>
                  <span style={{ fontSize:'0.78rem', fontWeight:700, color: rec.feedback === 'yes' ? '#34d399' : rec.feedback === 'no' ? '#f87171' : '#6B7280' }}>
                    {rec.feedback === 'yes' ? 'Correct' : rec.feedback === 'no' ? 'Wrong' : '—'}
                  </span>
                  <span style={{ fontSize:'0.78rem', color:'#9CA3AF' }}>{rec.confidence}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!twin && (
        <div style={{ ...CARD, textAlign:'center' as const, padding:'2.5rem' }}>
          <p style={{ color:'#9CA3AF', margin:'0 0 0.4rem', fontSize:'0.95rem', fontWeight:600 }}>Twin data not yet loaded</p>
          <p style={{ color:'#6B7280', margin:0, fontSize:'0.82rem' }}>Log check-ins to build your Digital Twin's prediction model.</p>
        </div>
      )}
    </div>
  );
}

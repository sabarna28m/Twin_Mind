import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import type { GamificationProgress } from '../utils/gamification';

/* ════════════════════════════════════════════
   TYPES
════════════════════════════════════════════ */
type TabId = 'monthly' | 'weekly' | 'twin';
type WeekNum = 1 | 2 | 3 | 4;
type BlockType = 'study' | 'break' | 'quiz' | 'revision' | 'ai_session' | 'catchup';
type Level = 'weak' | 'average' | 'strong';
type BurnoutRisk = 'Low' | 'Medium' | 'High';

interface TimeBlock {
  id: string;
  startTime: string;
  endTime: string;
  type: BlockType;
  subject?: string;
  topic?: string;
  durationMins: number;
  xp: number;
  focusDemand: number;
  completed: boolean;
  missed: boolean;
}

interface DaySchedule {
  dayKey: string;
  dayName: string;
  dayLabel: string;
  blocks: TimeBlock[];
  totalStudyMins: number;
  expectedXP: number;
  expectedFocusScore: number;
  expectedRetention: number;
}

interface SubjectAlloc {
  subject: string;
  percentage: number;
  level: Level;
  color: string;
  topics: string[];
}

interface WeekSchedule {
  weekNum: WeekNum;
  days: DaySchedule[];
  subjectAllocation: SubjectAlloc[];
  totalHours: number;
  generatedAt: string;
}

interface MonthlyGoal {
  id: string;
  subject: string;
  fromScore: number;
  toScore: number;
  hoursTarget: number;
  weeklyFocus: [string, string, string, string];
  color: string;
}

interface TwinSim {
  completionProbability: number;
  currentScore: number;
  predictedScore: number;
  totalStudyHours: number;
  retentionPrediction: number;
  burnoutRisk: BurnoutRisk;
  focusScore: number;
  predictedWeakness: string;
  predictedStrength: string;
  aiRecommendation: string;
  whatIf: { id: string; label: string; change: string; score: number; impact: 'positive' | 'negative' | 'neutral'; icon: string }[];
}

interface SmartPlan {
  current_score: number;
  target_score: number;
  daily_hours: number;
  forecast: string;
  days: { day: string; tasks: string[] }[];
}

interface LiveData {
  weekHours: number;
  monthHours: number;
  sessionCount: number;
  noteCount: number;
  quizCount: number;
  streakDays: number;
  entries: { date: string; study_hours: number }[];
}

interface PlannerV2 {
  monthKey: string;
  monthlyGoals: MonthlyGoal[];
  weekSchedules: Partial<Record<WeekNum, WeekSchedule>>;
  subjectAllocation: SubjectAlloc[];
  twinSim: TwinSim | null;
  awardedBlocks: Record<string, boolean>;
}

/* ════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════ */
const PLAN_KEY = 'tm_planner_v2';
const SUBJECT_COLORS = ['#ef4444', '#f59e0b', '#8b5cf6', '#10b981', '#00D4FF', '#ec4899', '#f97316', '#06b6d4'];
const MONTH_COLORS  = ['#00D4FF', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const TOPIC_BANK: Record<string, string[]> = {
  anatomy:           ['Upper Limb Anatomy', 'Lower Limb Anatomy', 'Thoracic Cavity', 'Abdominal Cavity', 'Head & Neck', 'Neuroanatomy', 'Histology & Cell Structure', 'Embryological Development', 'Radiological Anatomy', 'Heart Blood Supply', 'Coronary Circulation', 'Lymphatic System'],
  physiology:        ['Cardiac Cycle & ECG', 'Blood Pressure Regulation', 'Respiratory Physiology', 'Renal Function & GFR', 'Neurophysiology', 'Endocrine Physiology', 'GI Motility & Absorption', 'Haematopoiesis', 'Temperature Regulation', 'Reproductive Physiology'],
  pharmacology:      ['Autonomic Nervous System Drugs', 'Beta Blockers & CCBs', 'Antihypertensives', 'Antibiotics & Antimicrobials', 'CNS Depressants', 'Analgesics & NSAIDs', 'Chemotherapy Agents', 'Pharmacokinetics', 'Endocrine Drugs', 'Drug Interactions'],
  pathology:         ['Cell Injury & Death', 'Acute Inflammation', 'Chronic Inflammation', 'Neoplasia Basics', 'Cardiovascular Pathology', 'Pulmonary Pathology', 'GI & Hepatic Pathology', 'Neurological Pathology', 'Immune-mediated Disease', 'Haematological Disorders'],
  biochemistry:      ['Carbohydrate Metabolism', 'Lipid Metabolism', 'Amino Acid Metabolism', 'Enzyme Kinetics', 'Vitamins & Cofactors', 'DNA Replication', 'Transcription & Translation', 'Metabolic Integration', 'Nucleotide Metabolism', 'Hormonal Signalling'],
  microbiology:      ['Gram-positive Bacteria', 'Gram-negative Bacteria', 'DNA & RNA Viruses', 'Mycology Fundamentals', 'Parasitology Overview', 'Antimicrobial Resistance', 'Clinical Microbiology', 'Sterilisation & Disinfection', 'Immunology Basics', 'Vaccine Mechanisms'],
  mathematics:       ['Differential Calculus', 'Integral Calculus', 'Differential Equations', 'Linear Algebra', 'Vector Calculus', 'Complex Analysis', 'Statistics & Probability', 'Numerical Methods', 'Discrete Mathematics', 'Fourier Transforms'],
  physics:           ['Classical Mechanics', 'Thermodynamics', 'Electromagnetic Theory', 'Optics & Wave Theory', 'Modern Physics', 'Nuclear Physics', 'Solid State Physics', 'Quantum Mechanics', 'Electronics', 'Fluid Mechanics'],
  chemistry:         ['Organic Reaction Mechanisms', 'Stereochemistry', 'Inorganic Periodic Trends', 'Coordination Chemistry', 'Physical Chemistry', 'Electrochemistry', 'Chemical Kinetics', 'Spectroscopic Methods', 'Polymer Chemistry', 'Industrial Chemistry'],
  'computer science':['Data Structures', 'Algorithms Analysis', 'Operating Systems', 'Computer Networks', 'Database Management', 'Software Engineering', 'Compiler Design', 'Cryptography', 'Machine Learning Basics', 'System Design'],
  economics:         ['Supply & Demand', 'Market Structures', 'Macroeconomic Models', 'International Trade', 'Monetary Policy', 'Fiscal Policy', 'Development Economics', 'Microeconomic Theory', 'Econometrics', 'Behavioural Economics'],
  default:           ['Core Theoretical Concepts', 'Applied Framework', 'Problem-Solving Techniques', 'Case Study Analysis', 'Conceptual Review', 'Advanced Applications', 'Practical Exercises', 'Integration & Synthesis', 'Key Definitions', 'Examination Strategies'],
};

const BLOCK_META: Record<BlockType, { color: string; bg: string; icon: string; label: string }> = {
  study:      { color: 'var(--primary)',  bg: 'rgba(var(--primary-rgb),0.09)', icon: '📚', label: 'Study'      },
  catchup:    { color: '#ef4444',         bg: 'rgba(239,68,68,0.09)',          icon: '⚡', label: 'Catch-up'   },
  break:      { color: '#64748b',         bg: 'rgba(100,116,139,0.06)',        icon: '☕', label: 'Break'      },
  quiz:       { color: '#f59e0b',         bg: 'rgba(245,158,11,0.09)',         icon: '📝', label: 'Quiz'       },
  revision:   { color: '#8b5cf6',         bg: 'rgba(139,92,246,0.09)',         icon: '🔁', label: 'Revision'   },
  ai_session: { color: '#10b981',         bg: 'rgba(16,185,129,0.09)',         icon: '◈',  label: 'AI Session' },
};

/* ════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════ */
function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function weekOfMonth(): WeekNum {
  return Math.min(4, Math.ceil(new Date().getDate() / 7)) as WeekNum;
}
function getMonthName() {
  return new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function minsToTime(m: number) {
  const h = Math.floor(m / 60); const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
function getWeekStart(w: WeekNum): Date {
  const d = new Date();
  d.setDate((w - 1) * 7 + 1);
  return d;
}
function isToday(dayKey: string) { return dayKey === new Date().toISOString().split('T')[0]; }
function isPast(dayKey: string)  { return dayKey <  new Date().toISOString().split('T')[0]; }
function getTopicsFor(subject: string): string[] {
  const sl = subject.toLowerCase();
  const key = Object.keys(TOPIC_BANK).find(k => sl.includes(k) || k.includes(sl.split(' ')[0]));
  return TOPIC_BANK[key ?? 'default'];
}

/* ════════════════════════════════════════════
   PLAN GENERATION ENGINE
════════════════════════════════════════════ */
function computeAllocation(subjects: string[]): SubjectAlloc[] {
  if (!subjects.length) subjects = ['Core Subject'];
  const perfBase = [45, 70, 82, 58, 65, 78, 50, 72];
  const allocs: SubjectAlloc[] = subjects.map((sub, i) => {
    const perf = perfBase[i % perfBase.length];
    const level: Level = perf < 60 ? 'weak' : perf < 75 ? 'average' : 'strong';
    return { subject: sub, percentage: 0, level, color: SUBJECT_COLORS[i % SUBJECT_COLORS.length], topics: getTopicsFor(sub) };
  });
  const invScores = allocs.map((_, i) => 100 - perfBase[i % perfBase.length]);
  const total = invScores.reduce((a, b) => a + b, 0) || 1;
  allocs.forEach((a, i) => { a.percentage = Math.max(5, Math.round((invScores[i] / total) * 80)); });
  return allocs;
}

function generateDayBlocks(dayKey: string, dayIdx: number, allocs: SubjectAlloc[], dailyHours: number): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  let cur = 8 * 60;
  const studyMinsTotal = Math.round(dailyHours * 60);
  let studyMinsUsed = 0;

  const ordered = [...allocs].sort((a, b) => {
    if (a.level === 'weak' && b.level !== 'weak') return -1;
    if (b.level === 'weak' && a.level !== 'weak') return 1;
    return dayIdx % 2 === 0 ? b.percentage - a.percentage : a.percentage - b.percentage;
  });

  ordered.forEach((subj, si) => {
    const subjectMins = Math.round((subj.percentage / 100) * studyMinsTotal);
    const numBlocks = Math.max(1, Math.floor(subjectMins / 45));
    for (let bi = 0; bi < numBlocks; bi++) {
      if (studyMinsUsed >= studyMinsTotal) break;
      const blockMins = Math.min(45, studyMinsTotal - studyMinsUsed);
      const topicIdx = (dayIdx * 3 + si * 5 + bi * 7) % subj.topics.length;
      blocks.push({
        id: `${dayKey}_${subj.subject.replace(/\s/g, '_')}_${bi}`,
        startTime: minsToTime(cur), endTime: minsToTime(cur + blockMins),
        type: 'study', subject: subj.subject, topic: subj.topics[topicIdx],
        durationMins: blockMins, xp: Math.round(blockMins * 1.8),
        focusDemand: subj.level === 'weak' ? 88 : subj.level === 'average' ? 72 : 60,
        completed: false, missed: false,
      });
      cur += blockMins; studyMinsUsed += blockMins;
      if (bi < numBlocks - 1 || si < ordered.length - 1) {
        blocks.push({ id: `${dayKey}_brk_${si}_${bi}`, startTime: minsToTime(cur), endTime: minsToTime(cur + 15), type: 'break', durationMins: 15, xp: 0, focusDemand: 0, completed: false, missed: false });
        cur += 15;
      }
    }
  });

  const qCount = Math.max(5, Math.round(studyMinsTotal / 45) * 2);
  blocks.push({ id: `${dayKey}_quiz`, startTime: minsToTime(cur), endTime: minsToTime(cur + 30), type: 'quiz', subject: 'Practice Quiz', topic: `${qCount} Questions from Today's Topics`, durationMins: 30, xp: 55, focusDemand: 78, completed: false, missed: false });
  cur += 30;
  blocks.push({ id: `${dayKey}_ai`, startTime: minsToTime(cur), endTime: minsToTime(cur + 20), type: 'ai_session', subject: 'AI Revision', topic: 'Spaced repetition · Weak concept reinforcement', durationMins: 20, xp: 35, focusDemand: 65, completed: false, missed: false });

  return blocks;
}

function generateWeekSchedule(weekNum: WeekNum, allocs: SubjectAlloc[], dailyHours: number): WeekSchedule {
  const weekStart = getWeekStart(weekNum);
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const days: DaySchedule[] = DAY_NAMES.map((dayName, di) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + di);
    const dayKey = d.toISOString().split('T')[0];
    const blocks = generateDayBlocks(dayKey, di, allocs, dailyHours);
    const studyBlocks = blocks.filter(b => b.type !== 'break');
    return {
      dayKey, dayName,
      dayLabel: `${dayName.slice(0, 3)}, ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      blocks,
      totalStudyMins: studyBlocks.reduce((s, b) => s + b.durationMins, 0),
      expectedXP:         blocks.reduce((s, b) => s + b.xp, 0),
      expectedFocusScore: Math.min(95, 72 + (di === 0 ? 6 : di === 5 ? -4 : 0)),
      expectedRetention:  Math.min(92, 68 + weekNum * 3),
    };
  });
  return { weekNum, days, subjectAllocation: allocs, totalHours: Math.round(dailyHours * 6), generatedAt: new Date().toISOString() };
}

/* ════════════════════════════════════════════
   TWIN SIMULATION ENGINE
════════════════════════════════════════════ */
function computeTwinSim(ld: LiveData, allocs: SubjectAlloc[], smartPlan: SmartPlan | null, weekSchedule: WeekSchedule | null): TwinSim {
  const { streakDays, weekHours, quizCount } = ld;
  let prob = 48 + Math.min(22, streakDays * 2.2) + Math.min(16, weekHours * 2) + Math.min(10, quizCount * 0.4);
  prob = Math.min(97, Math.max(32, Math.round(prob)));
  const curScore    = smartPlan?.current_score ?? 62;
  const targetScore = smartPlan?.target_score  ?? 85;
  const gain        = Math.round((targetScore - curScore) * (prob / 100) * 0.92);
  const predictedScore = Math.min(targetScore, curScore + gain);
  const totalH = weekSchedule?.totalHours ?? 36;
  const burnoutRisk: BurnoutRisk = totalH > 50 ? 'High' : totalH > 35 ? 'Medium' : 'Low';
  const retention   = Math.min(93, Math.round(58 + streakDays * 1.6 + quizCount * 0.28));
  const focusScore  = Math.min(96, Math.round(63 + streakDays * 1.1 + weekHours  * 1.8));
  const weakest  = allocs.find(a => a.level === 'weak')?.subject   ?? 'Core Topics';
  const strongest = allocs.find(a => a.level === 'strong')?.subject ?? 'Practice Areas';
  const recs = [
    `Completing the current plan gives a ${prob}% probability of reaching your target score of ${targetScore}%.`,
    `Your ${streakDays}-day streak is a key predictor of success — keep the momentum going.`,
    `${weakest} needs the most attention. The plan maximises time here to close the performance gap.`,
    `Quiz activity is ${quizCount > 20 ? 'strong — maintain this cadence' : 'below target — aim for 5+ quizzes daily'}.`,
  ];
  return {
    completionProbability: prob, currentScore: curScore, predictedScore,
    totalStudyHours: totalH, retentionPrediction: retention,
    burnoutRisk, focusScore, predictedWeakness: weakest, predictedStrength: strongest,
    aiRecommendation: recs[streakDays % recs.length],
    whatIf: [
      { id: 'current',     label: 'Current Plan',          change: `${totalH}h/week as planned`,    score: predictedScore,                           impact: 'neutral',  icon: '📋' },
      { id: 'extra_hours', label: '+5 Extra Hours',        change: 'Add 1h per day Mon–Fri',        score: Math.min(targetScore, predictedScore + 3), impact: 'positive', icon: '⏱' },
      { id: 'extra_quiz',  label: '+2 Quizzes Daily',      change: 'Double daily practice tests',   score: Math.min(targetScore, predictedScore + 5), impact: 'positive', icon: '📝' },
      { id: 'skip_weak',   label: `Skip ${weakest.split(' ')[0]}`, change: `Remove ${weakest} from plan`, score: Math.max(curScore, predictedScore - 11), impact: 'negative', icon: '⚠️' },
    ],
  };
}

/* ════════════════════════════════════════════
   CONFETTI
════════════════════════════════════════════ */
function spawnConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const pieces = Array.from({ length: 130 }, () => ({
    x: Math.random() * canvas.width, y: -20 - Math.random() * 200,
    r: 4 + Math.random() * 6, d: 2 + Math.random() * 4,
    color: ['#00D4FF','#8b5cf6','#ffd700','#10b981','#ef4444','#ec4899'][Math.floor(Math.random() * 6)],
    tilt: Math.random() * 20 - 10, tiltAngle: 0, tiltSpeed: 0.05 + Math.random() * 0.1,
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.beginPath(); ctx.fillStyle = p.color;
      ctx.ellipse(p.x, p.y, p.r, p.r * 0.5, p.tilt, 0, Math.PI * 2); ctx.fill();
      p.y += p.d; p.x += Math.sin(frame * 0.02 + p.tiltAngle) * 1.5; p.tiltAngle += p.tiltSpeed;
    });
    frame++;
    if (frame < 200) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
export default function StudyPlanner() {
  const { studentProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [activeTab,    setActiveTab]    = useState<TabId>('monthly');
  const [selectedWeek, setSelectedWeek] = useState<WeekNum>(weekOfMonth());
  const [selectedDay,  setSelectedDay]  = useState(0);
  const [planner,      setPlanner]      = useState<PlannerV2 | null>(null);
  const [liveData,     setLiveData]     = useState<LiveData>({ weekHours: 0, monthHours: 0, sessionCount: 0, noteCount: 0, quizCount: 0, streakDays: 0, entries: [] });
  const [smartPlan,    setSmartPlan]    = useState<SmartPlan | null>(null);
  const [gamProgress,  setGamProgress]  = useState<GamificationProgress | null>(null);
  const [generating,   setGenerating]   = useState(false);
  const [genError,     setGenError]     = useState<string | null>(null);
  const [celebration,  setCelebration]  = useState<{ title: string; xp: number; msg: string } | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [simRunning,   setSimRunning]   = useState(false);

  const mk = monthKey();

  function savePlanner(p: PlannerV2) { setPlanner(p); localStorage.setItem(PLAN_KEY, JSON.stringify(p)); }

  function buildMonthlyGoals(subjects: string[], plan: SmartPlan | null): MonthlyGoal[] {
    return subjects.map((sub, i) => ({
      id: `g${i}`, subject: sub,
      fromScore:   plan ? Math.max(40, plan.current_score - i * 3) : 60 + i * 4,
      toScore:     plan ? Math.min(99, plan.target_score  - i * 2) : 80 + i * 2,
      hoursTarget: Math.max(10, 30 - i * 4),
      weeklyFocus: [
        `Fundamentals & core concepts of ${sub}`,
        `Practice problems, past papers & applications`,
        `Mock tests, gap analysis & weak topic revision`,
        `Final revision, exam strategy & consolidation`,
      ],
      color: MONTH_COLORS[i % MONTH_COLORS.length],
    }));
  }

  const initPlanner = useCallback((plan: SmartPlan | null, ld: LiveData, gam: GamificationProgress | null) => {
    const subjects   = studentProfile?.subjects?.slice(0, 6) ?? ['Core Subject'];
    const allocs     = computeAllocation(subjects);
    const dailyHours = plan?.daily_hours ?? 4;
    const monthlyGoals = buildMonthlyGoals(subjects, plan);
    const weekSchedules: Partial<Record<WeekNum, WeekSchedule>> = {};
    ([1, 2, 3, 4] as WeekNum[]).forEach(w => { weekSchedules[w] = generateWeekSchedule(w, allocs, dailyHours); });
    const twinSim = computeTwinSim(ld, allocs, plan, weekSchedules[weekOfMonth()] ?? null);
    const newState: PlannerV2 = { monthKey: mk, monthlyGoals, weekSchedules, subjectAllocation: allocs, twinSim, awardedBlocks: {} };
    savePlanner(newState);
    void gam;
  }, [studentProfile, mk]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ldRes, sessRes, notesRes, gamRes, planRes] = await Promise.allSettled([
        api.get<{ date: string; study_hours: number }[]>('/learning-data?limit=90'),
        api.get<unknown[]>('/sessions'),
        api.get<unknown[]>('/notes'),
        api.get<GamificationProgress>('/gamification/progress'),
        api.get<SmartPlan>('/smart-plan/current'),
      ]);
      const entries  = ldRes.status    === 'fulfilled' ? ldRes.value.data    : [];
      const sessions = sessRes.status  === 'fulfilled' ? sessRes.value.data  : [];
      const notes    = notesRes.status === 'fulfilled' ? notesRes.value.data : [];
      const gam      = gamRes.status   === 'fulfilled' ? gamRes.value.data   : null;
      const plan     = planRes.status  === 'fulfilled' ? planRes.value.data  : null;

      setGamProgress(gam);
      if (plan) setSmartPlan(plan);

      const now = new Date();
      const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      let weekH = 0, monthH = 0;
      for (const e of entries) {
        const d = new Date(e.date);
        if (d >= weekStart)  weekH  += e.study_hours;
        if (d >= monthStart) monthH += e.study_hours;
      }
      const ld: LiveData = {
        weekHours: Math.round(weekH * 10) / 10, monthHours: Math.round(monthH * 10) / 10,
        sessionCount: sessions.length, noteCount: notes.length,
        quizCount: gam?.breakdown.quizzes ?? 0, streakDays: gam?.streak_days ?? 0, entries,
      };
      setLiveData(ld);

      try {
        const raw = localStorage.getItem(PLAN_KEY);
        if (raw) {
          const stored: PlannerV2 = JSON.parse(raw);
          if (stored.monthKey === mk) { setPlanner(stored); setLoading(false); return; }
        }
      } catch { /**/ }

      initPlanner(plan, ld, gam);
    } catch { /**/ }
    setLoading(false);
  }, [studentProfile, mk, initPlanner]);

  useEffect(() => { loadData(); }, [loadData]);

  async function generateAIPlan() {
    setGenerating(true); setGenError(null);
    try {
      const { data } = await api.post<SmartPlan>('/smart-plan/generate');
      setSmartPlan(data);
      await api.post('/smart-plan/save', data).catch(() => {});
      initPlanner(data, liveData, gamProgress);
      setSimRunning(true);
      await new Promise(r => setTimeout(r, 2000));
      setSimRunning(false);
      setActiveTab('twin');
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setGenError(detail ?? 'Generation failed. Please try again.');
    }
    setGenerating(false);
  }

  /* ── auto-complete past blocks ── */
  useEffect(() => {
    if (!planner) return;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    let changed = false;
    const awarded = { ...planner.awardedBlocks };

    Object.values(planner.weekSchedules).forEach(ws => {
      ws?.days.forEach(day => {
        day.blocks.forEach(block => {
          if (awarded[block.id] || block.type === 'break') return;
          if (isPast(day.dayKey)) {
            const entry = liveData.entries.find(e => e.date === day.dayKey);
            if (entry && entry.study_hours >= 0.5) { awarded[block.id] = true; changed = true; }
          }
          if (isToday(day.dayKey)) {
            const [bH, bM] = block.endTime.split(':').map(Number);
            if ((bH * 60 + bM) < nowMins && liveData.weekHours >= 0.3) { awarded[block.id] = true; changed = true; }
          }
        });
      });
    });

    if (changed) {
      const updated = { ...planner, awardedBlocks: awarded };
      const curWeekSched = planner.weekSchedules[selectedWeek];
      const weekBlocks = curWeekSched?.days.flatMap(d => d.blocks).filter(b => b.type !== 'break') ?? [];
      const allDone = weekBlocks.length > 0 && weekBlocks.every(b => awarded[b.id]);
      if (allDone && !awarded[`week_${selectedWeek}_done`]) {
        awarded[`week_${selectedWeek}_done`] = true;
        savePlanner({ ...updated, awardedBlocks: awarded });
        setCelebration({ title: `🎉 Week ${selectedWeek} Complete!`, xp: 250, msg: 'Incredible! Every scheduled block finished. +250 XP awarded.' });
        if (canvasRef.current) spawnConfetti(canvasRef.current);
      } else {
        savePlanner(updated);
      }
    }
  }, [liveData, selectedWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── derived ── */
  const currentWeekSched = planner?.weekSchedules[selectedWeek];
  const currentDay       = currentWeekSched?.days[selectedDay];
  const allWeekBlocks    = currentWeekSched?.days.flatMap(d => d.blocks) ?? [];
  const nonBreakWeek     = allWeekBlocks.filter(b => b.type !== 'break');
  const completedIds     = planner?.awardedBlocks ?? {};
  const weekPct  = nonBreakWeek.length  ? Math.round((nonBreakWeek.filter(b  => completedIds[b.id]).length  / nonBreakWeek.length)  * 100) : 0;
  const allMonthBlocks   = Object.values(planner?.weekSchedules ?? {}).flatMap(w => w?.days.flatMap(d => d.blocks.filter(b => b.type !== 'break')) ?? []);
  const monthPct = allMonthBlocks.length ? Math.round((allMonthBlocks.filter(b => completedIds[b.id]).length / allMonthBlocks.length) * 100) : 0;
  const expectedGain = (planner?.twinSim?.predictedScore ?? 0) - (planner?.twinSim?.currentScore ?? 0);

  const TABS = [
    { id: 'monthly' as TabId, label: 'Monthly Plan',    icon: '📅' },
    { id: 'weekly'  as TabId, label: 'Weekly Schedule', icon: '📋' },
    { id: 'twin'    as TabId, label: 'Twin Simulation', icon: '🧠' },
  ];

  /* ════════ RENDER ════════ */
  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: "'Inter',sans-serif", position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 999, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,15,0.5)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>

        {/* ── Header nav ── */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', height: '58px', borderBottom: '1.5px solid rgba(var(--primary-rgb),0.15)', background: 'rgba(4,8,22,0.9)', backdropFilter: 'blur(24px)', position: 'sticky', top: 0, zIndex: 30, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Link to="/" style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--primary)', textDecoration: 'none' }}>◈ TwinMind</Link>
            <span style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0' }}>📅 AI Study Planner</span>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <button onClick={generateAIPlan} disabled={generating}
              style={{ padding: '0.42rem 1rem', background: generating ? 'rgba(var(--primary-rgb),0.15)' : 'linear-gradient(135deg,var(--primary),rgba(var(--primary-rgb),0.7))', color: '#fff', border: 'none', borderRadius: '9px', fontSize: '0.8rem', fontWeight: 700, cursor: generating ? 'default' : 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(var(--primary-rgb),0.3)' }}>
              {generating ? '⟳ Generating…' : smartPlan ? '⟳ Regenerate AI Plan' : '✦ Generate AI Plan'}
            </button>
            <Link to="/" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', padding: '0.32rem 0.85rem', border: '1px solid rgba(var(--primary-rgb),0.25)', borderRadius: '8px' }}>← Dashboard</Link>
          </div>
        </header>

        {/* ── KPI strip ── */}
        <div style={{ background: 'rgba(4,8,22,0.82)', borderBottom: '1.5px solid rgba(var(--primary-rgb),0.12)', backdropFilter: 'blur(20px)', padding: '1rem 1.5rem', flexShrink: 0 }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{getMonthName()}</p>
                <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#f1f5f9' }}>AI-Powered Academic Planner</p>
              </div>
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'Month Hours',  value: `${liveData.monthHours}h`, color: '#6366f1' },
                  { label: 'Week Hours',   value: `${liveData.weekHours}h`,  color: '#00D4FF' },
                  { label: 'Streak',       value: `${liveData.streakDays}d`, color: '#ef4444' },
                  { label: 'Quizzes',      value: `${liveData.quizCount}`,   color: '#f59e0b' },
                  { label: 'Expected Gain',value: `+${expectedGain}%`,       color: '#10b981' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: s.color, textShadow: `0 0 12px ${s.color}66` }}>{s.value}</p>
                    <p style={{ margin: 0, fontSize: '0.58rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              {[
                { label: 'Monthly Goal Progress', pct: monthPct, color: monthPct >= 70 ? '#10b981' : '#f59e0b' },
                { label: `Week ${selectedWeek} Progress`,   pct: weekPct,  color: weekPct  >= 70 ? '#00D4FF' : '#8b5cf6' },
              ].map(bar => (
                <div key={bar.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.28rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#cbd5e1', fontWeight: 600 }}>{bar.label}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 900, color: bar.color }}>{bar.pct}%</span>
                  </div>
                  <div style={{ height: '7px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}>
                    <div style={{ height: '100%', width: `${bar.pct}%`, background: bar.color, borderRadius: '99px', transition: 'width 0.8s ease', boxShadow: `0 0 8px ${bar.color}55` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div style={{ background: 'rgba(4,8,22,0.65)', borderBottom: '1px solid rgba(var(--primary-rgb),0.1)', backdropFilter: 'blur(16px)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem', display: 'flex', gap: '0.1rem' }}>
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.7rem 1.05rem', background: 'none', border: 'none', borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent', color: active ? 'var(--primary)' : '#94a3b8', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s', marginBottom: '-1px' }}>
                  {tab.icon} {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {genError && <div style={{ padding: '0.65rem 1.5rem', background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '0.8rem' }}>{genError}</div>}

        {/* ── Content ── */}
        <main style={{ flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '1.75rem 1.5rem', boxSizing: 'border-box' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '260px', gap: '0.75rem', color: '#94a3b8' }}>
              <div style={{ width: '20px', height: '20px', border: '2px solid rgba(var(--primary-rgb),0.3)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Analysing your academic profile…
            </div>
          ) : activeTab === 'monthly' ? (

            /* ══════ MONTHLY TAB ══════ */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#f1f5f9' }}>Monthly Goals — {getMonthName()}</h2>
                {!smartPlan && (
                  <button onClick={generateAIPlan} disabled={generating} style={{ padding: '0.45rem 1.05rem', background: 'linear-gradient(135deg,var(--primary),rgba(var(--primary-rgb),0.7))', color: '#fff', border: 'none', borderRadius: '9px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>✦ Generate AI Plan</button>
                )}
              </div>

              {/* Subject allocation */}
              {planner && planner.subjectAllocation.length > 0 && (
                <div style={{ background: 'rgba(4,8,22,0.90)', border: '1.5px solid rgba(var(--primary-rgb),0.18)', borderRadius: '16px', padding: '1.1rem 1.35rem', backdropFilter: 'blur(28px)' }}>
                  <p style={{ margin: '0 0 0.8rem', fontSize: '0.82rem', fontWeight: 800, color: '#f1f5f9' }}>Intelligent Time Allocation</p>
                  <div style={{ display: 'flex', height: '22px', borderRadius: '8px', overflow: 'hidden', marginBottom: '0.7rem', gap: '1px' }}>
                    {planner.subjectAllocation.map(a => (
                      <div key={a.subject} style={{ flex: a.percentage, background: a.color, opacity: 0.82, minWidth: '4px' }} title={`${a.subject}: ${a.percentage}%`} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {planner.subjectAllocation.map(a => (
                      <div key={a.subject} style={{ display: 'flex', alignItems: 'center', gap: '0.32rem', fontSize: '0.7rem', color: '#cbd5e1' }}>
                        <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: a.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, color: a.color }}>{a.percentage}%</span>
                        <span>{a.subject}</span>
                        <span style={{ fontSize: '0.6rem', padding: '0.06rem 0.32rem', borderRadius: '99px', background: a.level === 'weak' ? 'rgba(239,68,68,0.14)' : a.level === 'strong' ? 'rgba(16,185,129,0.14)' : 'rgba(245,158,11,0.14)', color: a.level === 'weak' ? '#f87171' : a.level === 'strong' ? '#34d399' : '#fbbf24', fontWeight: 700 }}>{a.level}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Goal cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '1rem' }}>
                {(planner?.monthlyGoals ?? []).map(goal => (
                  <div key={goal.id} style={{ background: 'rgba(4,8,22,0.90)', border: `1.5px solid ${goal.color}33`, borderRadius: '18px', padding: '1.25rem', backdropFilter: 'blur(28px)', boxShadow: `0 12px 40px rgba(0,0,0,0.6), 0 0 18px ${goal.color}0d` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.7rem' }}>
                      <div>
                        <p style={{ margin: '0 0 0.15rem', fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>{goal.subject}</p>
                        <div style={{ display: 'flex', gap: '0.42rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{goal.fromScore}%</span>
                          <span style={{ color: goal.color }}>→</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: goal.color }}>{goal.toScore}%</span>
                          <span style={{ fontSize: '0.62rem', background: `${goal.color}18`, color: goal.color, padding: '0.07rem 0.4rem', borderRadius: '99px', fontWeight: 700 }}>+{goal.toScore - goal.fromScore}%</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ margin: '0 0 0.05rem', fontSize: '1.2rem', fontWeight: 900, color: goal.color, textShadow: `0 0 12px ${goal.color}88` }}>{monthPct}%</p>
                        <p style={{ margin: 0, fontSize: '0.58rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Done</p>
                      </div>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden', marginBottom: '0.8rem', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}>
                      <div style={{ height: '100%', width: `${monthPct}%`, background: goal.color, borderRadius: '99px', transition: 'width 0.8s ease', boxShadow: `0 0 10px ${goal.color}66` }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {goal.weeklyFocus.map((f, wi) => (
                        <div key={wi} style={{ display: 'flex', alignItems: 'center', gap: '0.42rem', padding: '0.32rem 0.52rem', background: wi < weekOfMonth() - 1 ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.02)', borderRadius: '7px', border: `1px solid ${wi < weekOfMonth() - 1 ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.05)'}` }}>
                          <span style={{ fontSize: '0.68rem', flexShrink: 0, color: wi < weekOfMonth() - 1 ? '#34d399' : '#64748b', fontWeight: 700 }}>{wi < weekOfMonth() - 1 ? '✅' : `W${wi + 1}`}</span>
                          <span style={{ fontSize: '0.7rem', color: wi < weekOfMonth() - 1 ? '#a7f3d0' : '#94a3b8' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* AI Prediction */}
              {smartPlan && (
                <div style={{ background: 'rgba(4,8,22,0.90)', border: '1.5px solid rgba(var(--primary-rgb),0.22)', borderRadius: '18px', padding: '1.35rem 1.5rem', backdropFilter: 'blur(28px)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>◈</span>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#f1f5f9' }}>Twin AI Performance Prediction</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '0.7rem', marginBottom: '1rem' }}>
                    {[
                      { label: 'Current Score', value: `${smartPlan.current_score}%`, color: '#94a3b8' },
                      { label: 'Target Score',  value: `${smartPlan.target_score}%`,  color: '#10b981' },
                      { label: 'Daily Hours',   value: `${smartPlan.daily_hours}h`,   color: '#00D4FF' },
                      { label: 'Expected Gain', value: `+${smartPlan.target_score - smartPlan.current_score}%`, color: '#f59e0b' },
                    ].map(s => (
                      <div key={s.label} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <p style={{ margin: '0 0 0.12rem', fontSize: '1.3rem', fontWeight: 900, color: s.color, textShadow: `0 0 14px ${s.color}55` }}>{s.value}</p>
                        <p style={{ margin: 0, fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.83rem', color: '#cbd5e1', lineHeight: 1.65, padding: '0.85rem', background: 'rgba(var(--primary-rgb),0.06)', borderRadius: '10px', border: '1px solid rgba(var(--primary-rgb),0.12)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>◈ Twin Forecast: </span>{smartPlan.forecast}
                  </p>
                </div>
              )}

              {/* Month week grid */}
              <div style={{ background: 'rgba(4,8,22,0.90)', border: '1.5px solid rgba(var(--primary-rgb),0.18)', borderRadius: '18px', padding: '1.25rem', backdropFilter: 'blur(28px)' }}>
                <h3 style={{ margin: '0 0 0.9rem', fontSize: '0.92rem', fontWeight: 800, color: '#f1f5f9' }}>Month Overview</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.6rem' }}>
                  {([1,2,3,4] as WeekNum[]).map(w => {
                    const isNow = w === weekOfMonth();
                    return (
                      <button key={w} onClick={() => { setSelectedWeek(w); setActiveTab('weekly'); }}
                        style={{ padding: '0.85rem 0.65rem', background: isNow ? 'rgba(var(--primary-rgb),0.12)' : 'rgba(255,255,255,0.03)', border: `1.5px solid ${isNow ? 'rgba(var(--primary-rgb),0.35)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '13px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.18s' }}>
                        <p style={{ margin: '0 0 0.1rem', fontSize: '0.68rem', color: isNow ? 'var(--primary)' : '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Week {w} {isNow ? '· Now' : ''}</p>
                        <p style={{ margin: '0 0 0.4rem', fontSize: '0.62rem', color: '#64748b' }}>{getWeekStart(w).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#f1f5f9' }}>View →</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

          ) : activeTab === 'weekly' ? (

            /* ══════ WEEKLY SCHEDULE TAB ══════ */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {/* Week selector */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {([1,2,3,4] as WeekNum[]).map(w => (
                  <button key={w} onClick={() => { setSelectedWeek(w); setSelectedDay(0); }}
                    style={{ padding: '0.38rem 0.85rem', borderRadius: '8px', border: `1.5px solid ${selectedWeek === w ? 'rgba(var(--primary-rgb),0.55)' : 'rgba(255,255,255,0.1)'}`, background: selectedWeek === w ? 'rgba(var(--primary-rgb),0.16)' : 'rgba(255,255,255,0.04)', color: selectedWeek === w ? 'var(--primary)' : '#94a3b8', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                    Week {w}{w === weekOfMonth() ? ' · Now' : ''}
                  </button>
                ))}
              </div>

              {/* Day selector */}
              {currentWeekSched && (
                <div style={{ display: 'flex', gap: '0.42rem', overflowX: 'auto', paddingBottom: '0.15rem' }}>
                  {currentWeekSched.days.map((day, di) => {
                    const active = selectedDay === di;
                    const today  = isToday(day.dayKey);
                    const past   = isPast(day.dayKey);
                    const dayNonBreak = day.blocks.filter(b => b.type !== 'break');
                    const dayDone = dayNonBreak.length > 0 && dayNonBreak.every(b => completedIds[b.id]);
                    return (
                      <button key={day.dayKey} onClick={() => setSelectedDay(di)}
                        style={{ flexShrink: 0, padding: '0.6rem 0.85rem', borderRadius: '12px', border: `1.5px solid ${active ? 'rgba(var(--primary-rgb),0.55)' : today ? 'rgba(var(--primary-rgb),0.25)' : 'rgba(255,255,255,0.08)'}`, background: active ? 'rgba(var(--primary-rgb),0.14)' : today ? 'rgba(var(--primary-rgb),0.05)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', minWidth: '78px', transition: 'all 0.15s' }}>
                        <p style={{ margin: '0 0 0.05rem', fontSize: '0.6rem', fontWeight: 700, color: active || today ? 'var(--primary)' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{day.dayName.slice(0, 3)}{today ? ' ·' : ''}</p>
                        <p style={{ margin: '0 0 0.22rem', fontSize: '0.62rem', color: '#64748b' }}>{new Date(day.dayKey + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                        <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: dayDone ? '#34d399' : past && !dayDone ? '#f87171' : '#f1f5f9' }}>{dayDone ? '✅' : past && !dayDone ? '⚠' : `+${day.expectedXP}XP`}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* No schedule state */}
              {!currentDay && (
                <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(4,8,22,0.88)', border: '1.5px solid rgba(var(--primary-rgb),0.2)', borderRadius: '18px', backdropFilter: 'blur(28px)' }}>
                  <p style={{ fontSize: '2.5rem', margin: '0 0 0.6rem' }}>🧠</p>
                  <p style={{ margin: '0 0 0.4rem', fontWeight: 800, color: '#f1f5f9' }}>No AI schedule yet</p>
                  <p style={{ margin: '0 0 1.25rem', fontSize: '0.83rem', color: '#94a3b8' }}>Generate your personalised plan to see an hour-by-hour daily schedule with exact topics.</p>
                  <button onClick={generateAIPlan} disabled={generating} style={{ padding: '0.62rem 1.5rem', background: 'linear-gradient(135deg,var(--primary),rgba(var(--primary-rgb),0.7))', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{generating ? 'Generating…' : '✦ Generate AI Study Plan'}</button>
                </div>
              )}

              {/* Day stats */}
              {currentDay && (
                <div style={{ background: 'rgba(4,8,22,0.90)', border: '1.5px solid rgba(var(--primary-rgb),0.2)', borderRadius: '16px', padding: '1rem 1.3rem', backdropFilter: 'blur(28px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.9rem' }}>
                  <div>
                    <p style={{ margin: '0 0 0.08rem', fontSize: '1rem', fontWeight: 800, color: '#f1f5f9' }}>{currentDay.dayName}</p>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>{currentDay.dayLabel} · {currentDay.blocks.length} blocks scheduled</p>
                  </div>
                  <div style={{ display: 'flex', gap: '1.1rem', flexWrap: 'wrap' }}>
                    {[
                      { v: `${Math.round(currentDay.totalStudyMins / 60 * 10) / 10}h`, l: 'Study', c: '#00D4FF' },
                      { v: `+${currentDay.expectedXP}`,                                 l: 'Max XP', c: '#f59e0b' },
                      { v: `${currentDay.expectedFocusScore}%`,                          l: 'Focus',  c: '#8b5cf6' },
                      { v: `${currentDay.expectedRetention}%`,                           l: 'Retention', c: '#10b981' },
                    ].map(s => (
                      <div key={s.l} style={{ textAlign: 'center' }}>
                        <p style={{ margin: '0 0 0.05rem', fontSize: '1rem', fontWeight: 900, color: s.c, textShadow: `0 0 12px ${s.c}55` }}>{s.v}</p>
                        <p style={{ margin: 0, fontSize: '0.58rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hour-by-hour timeline */}
              {currentDay && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {currentDay.blocks.map(block => {
                    const meta     = BLOCK_META[block.type];
                    const done     = !!completedIds[block.id];
                    const isBreak  = block.type === 'break';
                    return (
                      <div key={block.id} style={{ display: 'flex', gap: '0.8rem', alignItems: 'stretch', opacity: done ? 0.68 : 1, transition: 'opacity 0.3s' }}>
                        {/* Time column */}
                        <div style={{ flexShrink: 0, width: '48px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingTop: '0.4rem', gap: '1px' }}>
                          <span style={{ fontSize: '0.66rem', fontWeight: 700, color: done ? '#34d399' : '#64748b', fontVariantNumeric: 'tabular-nums' }}>{block.startTime}</span>
                          <span style={{ fontSize: '0.58rem', color: '#374151' }}>{block.endTime}</span>
                        </div>
                        {/* Block */}
                        <div style={{ flex: 1, background: done ? 'rgba(16,185,129,0.07)' : isBreak ? 'rgba(255,255,255,0.02)' : meta.bg, border: `1.5px solid ${done ? 'rgba(16,185,129,0.28)' : isBreak ? 'rgba(255,255,255,0.05)' : `${meta.color}28`}`, borderLeft: `3px solid ${done ? '#10b981' : meta.color}`, borderRadius: '12px', padding: isBreak ? '0.5rem 0.85rem' : '0.82rem 1.05rem', transition: 'all 0.18s' }}>
                          {isBreak ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.48rem' }}>
                              <span style={{ fontSize: '0.8rem' }}>{meta.icon}</span>
                              <span style={{ fontSize: '0.75rem', color: '#4b5563', fontWeight: 600 }}>Break · {block.durationMins} min · Rest & hydrate</span>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.7rem', marginBottom: '0.42rem' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.42rem', marginBottom: '0.18rem' }}>
                                    <span style={{ fontSize: '0.82rem' }}>{meta.icon}</span>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{block.subject}</span>
                                    {done && <span style={{ fontSize: '0.72rem' }}>✅</span>}
                                  </div>
                                  <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: done ? '#a7f3d0' : '#f1f5f9', lineHeight: 1.35 }}>{block.topic}</p>
                                </div>
                                {block.xp > 0 && (
                                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                    <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 900, color: '#fbbf24', textShadow: '0 0 10px rgba(251,191,36,0.5)' }}>+{block.xp} XP</p>
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '0.38rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.63rem', padding: '0.1rem 0.44rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.07)' }}>⏱ {block.durationMins}m</span>
                                <span style={{ fontSize: '0.63rem', padding: '0.1rem 0.44rem', borderRadius: '6px', background: `${meta.color}12`, color: meta.color, border: `1px solid ${meta.color}22`, fontWeight: 600 }}>{meta.label}</span>
                                {block.focusDemand >= 80 && <span style={{ fontSize: '0.63rem', padding: '0.1rem 0.44rem', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 700 }}>High Focus</span>}
                                {block.type === 'catchup' && <span style={{ fontSize: '0.63rem', padding: '0.1rem 0.44rem', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.22)', fontWeight: 700 }}>Adaptive Carry-forward</span>}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ padding: '0.7rem 0.9rem', background: 'rgba(var(--primary-rgb),0.05)', border: '1px solid rgba(var(--primary-rgb),0.12)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <span style={{ fontSize: '0.82rem' }}>🤖</span>
                    <p style={{ margin: 0, fontSize: '0.73rem', color: '#94a3b8', lineHeight: 1.5 }}>
                      <strong style={{ color: '#cbd5e1' }}>Auto-tracked:</strong> Blocks complete automatically as you study, quiz, and check in. No manual input required.
                    </p>
                  </div>
                </div>
              )}
            </div>

          ) : (

            /* ══════ TWIN SIMULATION TAB ══════ */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {!planner?.twinSim ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(4,8,22,0.88)', border: '1.5px solid rgba(var(--primary-rgb),0.2)', borderRadius: '18px', backdropFilter: 'blur(28px)' }}>
                  <p style={{ fontSize: '2.5rem', margin: '0 0 0.6rem' }}>🧠</p>
                  <p style={{ margin: '0 0 0.4rem', fontWeight: 800, color: '#f1f5f9' }}>No Twin Simulation yet</p>
                  <p style={{ margin: '0 0 1.25rem', fontSize: '0.83rem', color: '#94a3b8' }}>Generate your AI plan to run a Digital Twin simulation and see predicted outcomes before you start studying.</p>
                  <button onClick={generateAIPlan} disabled={generating} style={{ padding: '0.62rem 1.5rem', background: 'linear-gradient(135deg,var(--primary),rgba(var(--primary-rgb),0.7))', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{generating ? 'Simulating…' : '✦ Run Twin Simulation'}</button>
                </div>
              ) : simRunning ? (
                <div style={{ padding: '2.5rem 1.5rem', background: 'rgba(4,8,22,0.95)', border: '1.5px solid rgba(var(--primary-rgb),0.3)', borderRadius: '18px', backdropFilter: 'blur(40px)', textAlign: 'center' }}>
                  <div style={{ width: '44px', height: '44px', border: '3px solid rgba(var(--primary-rgb),0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.75s linear infinite', margin: '0 auto 1.1rem' }} />
                  <p style={{ margin: '0 0 0.35rem', fontWeight: 800, color: 'var(--primary)', fontSize: '1rem' }}>◈ Running Digital Twin Simulation…</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>Analysing habits · Projecting performance · Simulating outcomes</p>
                </div>
              ) : (
                <>
                  {/* Completion probability hero */}
                  <div style={{ background: 'rgba(4,8,22,0.93)', border: '1.5px solid rgba(var(--primary-rgb),0.28)', borderRadius: '20px', padding: '2rem', backdropFilter: 'blur(32px)', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(var(--primary-rgb),0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
                    <p style={{ margin: '0 0 0.3rem', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Digital Twin Simulation Result</p>
                    <p style={{ margin: '0 0 0.1rem', fontSize: '4.2rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1, textShadow: '0 0 40px rgba(var(--primary-rgb),0.55)' }}>{planner.twinSim.completionProbability}%</p>
                    <p style={{ margin: '0 0 1.5rem', fontSize: '0.88rem', color: '#cbd5e1', fontWeight: 600 }}>Plan Completion Probability</p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.7rem', padding: '0.7rem 1.5rem', background: 'rgba(var(--primary-rgb),0.1)', border: '1px solid rgba(var(--primary-rgb),0.2)', borderRadius: '12px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current</p>
                        <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#94a3b8' }}>{planner.twinSim.currentScore}%</p>
                      </div>
                      <span style={{ color: '#4b5563', fontSize: '1.5rem' }}>→</span>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Predicted</p>
                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#10b981', textShadow: '0 0 18px rgba(16,185,129,0.55)' }}>{planner.twinSim.predictedScore}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Metrics grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(165px,1fr))', gap: '0.8rem' }}>
                    {[
                      { label: 'Expected Study Hours', value: `${planner.twinSim.totalStudyHours}h`,    color: '#00D4FF', icon: '⏱' },
                      { label: 'Retention Prediction', value: `${planner.twinSim.retentionPrediction}%`, color: '#8b5cf6', icon: '🧠' },
                      { label: 'Expected Focus Score', value: `${planner.twinSim.focusScore}%`,          color: '#f59e0b', icon: '🎯' },
                      { label: 'Burnout Risk',         value: planner.twinSim.burnoutRisk,               color: planner.twinSim.burnoutRisk === 'Low' ? '#10b981' : planner.twinSim.burnoutRisk === 'Medium' ? '#f59e0b' : '#ef4444', icon: '⚡' },
                      { label: 'Most Likely Strength', value: planner.twinSim.predictedStrength,         color: '#34d399', icon: '💪' },
                      { label: 'Most Likely Weakness', value: planner.twinSim.predictedWeakness,         color: '#f87171', icon: '⚠️' },
                    ].map(s => (
                      <div key={s.label} style={{ background: 'rgba(4,8,22,0.90)', border: `1.5px solid ${s.color}25`, borderRadius: '16px', padding: '1.05rem', backdropFilter: 'blur(24px)', boxShadow: `0 8px 28px rgba(0,0,0,0.5), 0 0 14px ${s.color}0b` }}>
                        <p style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>{s.icon}</p>
                        <p style={{ margin: '0 0 0.15rem', fontSize: '1.05rem', fontWeight: 900, color: s.color, textShadow: `0 0 12px ${s.color}55`, lineHeight: 1.25, wordBreak: 'break-word' }}>{s.value}</p>
                        <p style={{ margin: 0, fontSize: '0.58rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* AI Recommendation */}
                  <div style={{ background: 'rgba(4,8,22,0.90)', border: '1.5px solid rgba(var(--primary-rgb),0.22)', borderRadius: '18px', padding: '1.3rem 1.5rem', backdropFilter: 'blur(28px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.8rem' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(var(--primary-rgb),0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>◈</div>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f1f5f9' }}>AI Recommendation</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.7, padding: '0.85rem 1rem', background: 'rgba(var(--primary-rgb),0.06)', borderRadius: '10px', border: '1px solid rgba(var(--primary-rgb),0.12)' }}>
                      "{planner.twinSim.aiRecommendation}"
                    </p>
                  </div>

                  {/* What-If Scenarios */}
                  <div>
                    <h3 style={{ margin: '0 0 0.9rem', fontSize: '0.95rem', fontWeight: 800, color: '#f1f5f9' }}>What-If Scenarios</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '0.8rem' }}>
                      {planner.twinSim.whatIf.map(s => {
                        const isBase    = s.id === 'current';
                        const bColor    = isBase ? 'rgba(var(--primary-rgb),0.3)' : s.impact === 'positive' ? 'rgba(16,185,129,0.28)' : s.impact === 'negative' ? 'rgba(239,68,68,0.28)' : 'rgba(255,255,255,0.1)';
                        const scoreColor = isBase ? 'var(--primary)' : s.impact === 'positive' ? '#34d399' : '#f87171';
                        const delta      = s.score - (planner.twinSim?.predictedScore ?? 0);
                        return (
                          <div key={s.id} style={{ background: isBase ? 'rgba(var(--primary-rgb),0.07)' : 'rgba(4,8,22,0.88)', border: `1.5px solid ${bColor}`, borderRadius: '16px', padding: '1.05rem', backdropFilter: 'blur(24px)', transition: 'all 0.18s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.48rem', marginBottom: '0.55rem' }}>
                              <span style={{ fontSize: '1.05rem' }}>{s.icon}</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f1f5f9' }}>{s.label}</span>
                              {isBase && <span style={{ fontSize: '0.6rem', padding: '0.07rem 0.36rem', background: 'rgba(var(--primary-rgb),0.2)', color: 'var(--primary)', borderRadius: '99px', fontWeight: 700 }}>Current</span>}
                            </div>
                            <p style={{ margin: '0 0 0.65rem', fontSize: '0.73rem', color: '#94a3b8', lineHeight: 1.4 }}>{s.change}</p>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.38rem' }}>
                              <span style={{ fontSize: '1.75rem', fontWeight: 900, color: scoreColor, textShadow: `0 0 14px ${scoreColor}55` }}>{s.score}%</span>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>predicted</span>
                              {!isBase && delta !== 0 && (
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: scoreColor, marginLeft: 'auto' }}>
                                  {delta > 0 ? '+' : ''}{delta}%
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <button onClick={generateAIPlan} disabled={generating} style={{ padding: '0.65rem 1.75rem', background: 'linear-gradient(135deg,var(--primary),rgba(var(--primary-rgb),0.7))', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 20px rgba(var(--primary-rgb),0.4)' }}>
                      {generating ? '⟳ Simulating…' : '⟳ Re-run Twin Simulation'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Celebration popup */}
      {celebration && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setCelebration(null)}>
          <div style={{ background: 'rgba(4,8,22,0.97)', border: '2px solid rgba(var(--primary-rgb),0.4)', borderRadius: '24px', padding: '2.5rem 2rem', textAlign: 'center', maxWidth: '360px', width: '90%', boxShadow: '0 30px 80px rgba(0,0,0,0.85)', backdropFilter: 'blur(40px)', animation: 'popIn 0.3s ease' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: '3rem', margin: '0 0 0.5rem' }}>🎉</p>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 900, color: '#f1f5f9' }}>{celebration.title}</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>{celebration.msg}</p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.2rem', background: 'linear-gradient(135deg,#ffd700,#f59e0b)', borderRadius: '99px', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#0f172a' }}>⭐ +{celebration.xp} XP</span>
            </div>
            <br />
            <button onClick={() => setCelebration(null)} style={{ padding: '0.62rem 1.6rem', background: 'linear-gradient(135deg,var(--primary),rgba(var(--primary-rgb),0.7))', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}>Awesome! 🚀</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes popIn { from { opacity:0; transform:scale(0.88); } to { opacity:1; transform:scale(1); } }
      `}</style>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { getLevelColor, getLevelGradient, type GamificationProgress } from '../utils/gamification';

/* ─── Types ─── */
type TabId = 'monthly' | 'weekly';
type Priority = 'high' | 'medium' | 'low';
type TrackerKey = 'study_hours' | 'quiz_count' | 'session_count' | 'checkin_days' | 'note_count';
type WeekNum = 1 | 2 | 3 | 4;

interface MonthlyGoal {
  id: string;
  subject: string;
  fromScore: number;
  toScore: number;
  hoursTarget: number;
  weeklyFocus: [string, string, string, string];
  color: string;
}

interface WeekTask {
  id: string;
  subject: string;
  description: string;
  durationMins: number;
  priority: Priority;
  tracker: TrackerKey;
  weekTarget: number;
  xp: number;
  week: WeekNum;
}

interface LiveData {
  weekHours: number;
  monthHours: number;
  sessionCount: number;
  noteCount: number;
  quizCount: number;
  streakDays: number;
  badgeCount: number;
}

interface SmartPlan {
  current_score: number;
  target_score: number;
  daily_hours: number;
  forecast: string;
  days: { day: string; tasks: string[] }[];
}

interface PlannerState {
  monthKey: string;
  monthlyGoals: MonthlyGoal[];
  weekTasks: WeekTask[];
  awardedXP: Record<string, boolean>;
}

const PLAN_KEY = 'tm_planner_v1';

const MONTH_COLORS = ['#00D4FF', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const PRIORITY_COLORS: Record<Priority, string> = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function weekOfMonth(): WeekNum {
  const day = new Date().getDate();
  return (Math.min(4, Math.ceil(day / 7))) as WeekNum;
}

function getMonthName() {
  return new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function startOfWeek(weekNum: WeekNum): Date {
  const d = new Date();
  d.setDate((weekNum - 1) * 7 + 1);
  return d;
}

function calcLiveData(entries: { date: string; study_hours: number }[], gam: GamificationProgress | null, sessionCount: number, noteCount: number): LiveData {
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let weekHours = 0;
  let monthHours = 0;
  for (const e of entries) {
    const d = new Date(e.date);
    if (d >= weekStart) weekHours += e.study_hours;
    if (d >= monthStart) monthHours += e.study_hours;
  }
  return {
    weekHours: Math.round(weekHours * 10) / 10,
    monthHours: Math.round(monthHours * 10) / 10,
    sessionCount,
    noteCount,
    quizCount: gam?.breakdown.quizzes ?? 0,
    streakDays: gam?.streak_days ?? 0,
    badgeCount: 0,
  };
}

function getLive(task: WeekTask, ld: LiveData, baseHours: number): number {
  switch (task.tracker) {
    case 'study_hours':   return Math.round(Math.max(0, ld.weekHours - baseHours) * 10) / 10;
    case 'quiz_count':    return ld.quizCount;
    case 'session_count': return ld.sessionCount;
    case 'checkin_days':  return ld.streakDays;
    case 'note_count':    return ld.noteCount;
  }
}

/* ─── Confetti ─── */
function spawnConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 200,
    r: 4 + Math.random() * 6,
    d: 2 + Math.random() * 4,
    color: ['#00D4FF', '#8b5cf6', '#ffd700', '#10b981', '#ef4444', '#ec4899'][Math.floor(Math.random() * 6)],
    tilt: Math.random() * 20 - 10,
    tiltAngle: 0,
    tiltSpeed: 0.05 + Math.random() * 0.1,
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.ellipse(p.x, p.y, p.r, p.r * 0.5, p.tilt, 0, Math.PI * 2);
      ctx.fill();
      p.y += p.d;
      p.x += Math.sin(frame * 0.02 + p.tiltAngle) * 1.5;
      p.tiltAngle += p.tiltSpeed;
    });
    frame++;
    if (frame < 180) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

/* ─── Seed AI tasks from smart plan days ─── */
function seedTasksFromPlan(plan: SmartPlan, goals: MonthlyGoal[]): WeekTask[] {
  const tasks: WeekTask[] = [];
  const allTasks = plan.days.flatMap(d => d.tasks);
  const perWeek = Math.ceil(allTasks.length / 4);

  for (let w = 1; w <= 4; w++) {
    const weekTasks = allTasks.slice((w - 1) * perWeek, w * perWeek);
    weekTasks.forEach((desc, i) => {
      const goal = goals[i % Math.max(1, goals.length)];
      const subject = goal?.subject ?? 'General Study';
      const color = goal?.color ?? '#00D4FF';
      tasks.push({
        id: `ai_w${w}_${i}`,
        subject,
        description: desc,
        durationMins: [30, 45, 60, 90][Math.floor(Math.random() * 4)],
        priority: (['high', 'medium', 'low'] as Priority[])[i % 3],
        tracker: (['study_hours', 'quiz_count', 'session_count'] as TrackerKey[])[i % 3],
        weekTarget: [2, 3, 1][i % 3],
        xp: [40, 30, 25][i % 3],
        week: w as WeekNum,
      });
      void color;
    });
    // Always add one quiz and one session task per week
    tasks.push({
      id: `quiz_w${w}`,
      subject: goals[w % goals.length]?.subject ?? 'Practice',
      description: `Complete ${w + 1} practice quizzes`,
      durationMins: 30,
      priority: 'medium',
      tracker: 'quiz_count',
      weekTarget: w + 1,
      xp: 35,
      week: w as WeekNum,
    });
    tasks.push({
      id: `session_w${w}`,
      subject: 'Focus Session',
      description: `Log ${w + 2} study sessions this week`,
      durationMins: 60,
      priority: 'high',
      tracker: 'session_count',
      weekTarget: w + 2,
      xp: 50,
      week: w as WeekNum,
    });
  }
  return tasks;
}

/* ─── Default goals (used when no AI plan yet) ─── */
function defaultGoals(studentProfile: { course?: string; subjects?: string[] } | null): MonthlyGoal[] {
  const subjects = studentProfile?.subjects?.slice(0, 3) ?? ['Core Subject'];
  return subjects.map((sub, i) => ({
    id: `goal_${i}`,
    subject: sub,
    fromScore: 60 + i * 5,
    toScore: 80 + i * 3,
    hoursTarget: 30 - i * 5,
    weeklyFocus: [
      `Week 1: Review fundamentals of ${sub}`,
      `Week 2: Practice problems & past papers`,
      `Week 3: Mock tests & gap analysis`,
      `Week 4: Revision + final assessment`,
    ],
    color: MONTH_COLORS[i % MONTH_COLORS.length],
  }));
}

/* ─── Default tasks (used when no AI plan yet) ─── */
function defaultTasks(goals: MonthlyGoal[]): WeekTask[] {
  const tasks: WeekTask[] = [];
  for (let w = 1; w <= 4; w++) {
    goals.forEach((g, gi) => {
      tasks.push({
        id: `def_${w}_${gi}_study`,
        subject: g.subject,
        description: g.weeklyFocus[w - 1],
        durationMins: 60,
        priority: gi === 0 ? 'high' : 'medium',
        tracker: 'study_hours',
        weekTarget: Math.round(g.hoursTarget / 4),
        xp: 50,
        week: w as WeekNum,
      });
    });
    tasks.push({
      id: `def_${w}_quiz`,
      subject: 'Practice',
      description: `Complete ${w + 1} quizzes this week`,
      durationMins: 30,
      priority: 'medium',
      tracker: 'quiz_count',
      weekTarget: w + 1,
      xp: 35,
      week: w as WeekNum,
    });
    tasks.push({
      id: `def_${w}_checkin`,
      subject: 'Consistency',
      description: 'Maintain daily check-in streak',
      durationMins: 5,
      priority: 'high',
      tracker: 'checkin_days',
      weekTarget: w * 2,
      xp: 25,
      week: w as WeekNum,
    });
  }
  return tasks;
}

/* ──────────────────────────────────────────────
   MAIN COMPONENT
   ────────────────────────────────────────────── */
export default function StudyPlanner() {
  const { studentProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const awardedRef = useRef<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<TabId>('monthly');
  const [selectedWeek, setSelectedWeek] = useState<WeekNum>(weekOfMonth());
  const [plannerState, setPlannerState] = useState<PlannerState | null>(null);
  const [liveData, setLiveData] = useState<LiveData>({ weekHours: 0, monthHours: 0, sessionCount: 0, noteCount: 0, quizCount: 0, streakDays: 0, badgeCount: 0 });
  const [gamProgress, setGamProgress] = useState<GamificationProgress | null>(null);
  const [smartPlan, setSmartPlan] = useState<SmartPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ title: string; xp: number; msg: string } | null>(null);
  const [baseHours, setBaseHours] = useState(0);
  const [loading, setLoading] = useState(true);

  const mk = monthKey();

  /* ── Load or seed planner state ── */
  function loadOrSeedState(goals: MonthlyGoal[], tasks: WeekTask[], awardedXP: Record<string, boolean> = {}) {
    const state: PlannerState = { monthKey: mk, monthlyGoals: goals, weekTasks: tasks, awardedXP };
    setPlannerState(state);
    awardedRef.current = awardedXP;
    localStorage.setItem(PLAN_KEY, JSON.stringify(state));
  }

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

      const entries = ldRes.status === 'fulfilled' ? ldRes.value.data : [];
      const sessions = sessRes.status === 'fulfilled' ? sessRes.value.data : [];
      const notes = notesRes.status === 'fulfilled' ? notesRes.value.data : [];
      const gam = gamRes.status === 'fulfilled' ? gamRes.value.data : null;
      const plan = planRes.status === 'fulfilled' ? planRes.value.data : null;

      setGamProgress(gam);
      if (plan) setSmartPlan(plan);

      const ld = calcLiveData(entries, gam, sessions.length, notes.length);
      setLiveData(ld);

      // Try loading stored planner state
      try {
        const raw = localStorage.getItem(PLAN_KEY);
        if (raw) {
          const stored: PlannerState = JSON.parse(raw);
          if (stored.monthKey === mk) {
            setPlannerState(stored);
            awardedRef.current = stored.awardedXP ?? {};
            setLoading(false);
            return;
          }
        }
      } catch { /**/ }

      // Fresh state for this month
      const goals = defaultGoals(studentProfile);
      const tasks = plan ? seedTasksFromPlan(plan, goals) : defaultTasks(goals);
      loadOrSeedState(goals, tasks, {});
    } catch { /**/ }
    setLoading(false);
  }, [studentProfile, mk]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Auto-completion detection ── */
  useEffect(() => {
    if (!plannerState) return;
    const currentWeekTasks = plannerState.weekTasks.filter(t => t.week === selectedWeek);
    let newAwards = false;
    const updatedAwarded = { ...awardedRef.current };
    const celebrationQueue: { title: string; xp: number; msg: string }[] = [];

    for (const task of currentWeekTasks) {
      if (awardedRef.current[task.id]) continue;
      const cur = getLive(task, liveData, baseHours);
      if (cur >= task.weekTarget) {
        updatedAwarded[task.id] = true;
        newAwards = true;
        celebrationQueue.push({
          title: `✅ ${task.subject} Complete!`,
          xp: task.xp,
          msg: `"${task.description}" — target reached!`,
        });
      }
    }

    // Check if entire week is complete
    const weekDone = currentWeekTasks.every(t => updatedAwarded[t.id]);
    if (weekDone && !awardedRef.current[`week_${selectedWeek}_done`]) {
      updatedAwarded[`week_${selectedWeek}_done`] = true;
      newAwards = true;
      celebrationQueue.unshift({ title: `🎉 Week ${selectedWeek} Complete!`, xp: 200, msg: 'Outstanding! All weekly tasks finished. +200 XP earned.' });
      if (canvasRef.current) spawnConfetti(canvasRef.current);
    }

    if (newAwards) {
      awardedRef.current = updatedAwarded;
      const updated = { ...plannerState, awardedXP: updatedAwarded };
      setPlannerState(updated);
      localStorage.setItem(PLAN_KEY, JSON.stringify(updated));
      if (celebrationQueue.length) setCelebration(celebrationQueue[0]);
    }
  }, [liveData, selectedWeek, plannerState, baseHours]);

  async function generateAIPlan() {
    setGenerating(true); setGenError(null);
    try {
      const { data } = await api.post<SmartPlan>('/smart-plan/generate');
      setSmartPlan(data);
      await api.post('/smart-plan/save', data).catch(() => {});
      const goals = plannerState?.monthlyGoals ?? defaultGoals(studentProfile);
      const tasks = seedTasksFromPlan(data, goals);
      loadOrSeedState(goals, tasks, awardedRef.current);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setGenError(detail ?? 'Failed to generate plan. Try again.');
    }
    setGenerating(false);
  }

  /* ── Derived ── */
  const weekTasks = plannerState?.weekTasks.filter(t => t.week === selectedWeek) ?? [];
  const allWeekTasks = plannerState?.weekTasks ?? [];
  const weekCompletedCount = weekTasks.filter(t => plannerState?.awardedXP[t.id]).length;
  const weekPct = weekTasks.length ? Math.round((weekCompletedCount / weekTasks.length) * 100) : 0;
  const totalCompleted = allWeekTasks.filter(t => plannerState?.awardedXP[t.id]).length;
  const monthPct = allWeekTasks.length ? Math.round((totalCompleted / allWeekTasks.length) * 100) : 0;
  const expectedImprovement = smartPlan ? (smartPlan.target_score - smartPlan.current_score) : (plannerState?.monthlyGoals[0] ? plannerState.monthlyGoals[0].toScore - plannerState.monthlyGoals[0].fromScore : 0);

  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'monthly', label: 'Monthly Plan', icon: '📅' },
    { id: 'weekly',  label: 'Weekly Tasks', icon: '📋' },
  ];

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: "'Inter',sans-serif", position: 'relative' }}>
      {/* Confetti canvas */}
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 999, pointerEvents: 'none' }} />

      {/* Dark scrim */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,15,0.5)', zIndex: 0, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>

        {/* ── Top nav ── */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', height: '58px', borderBottom: '1.5px solid rgba(var(--primary-rgb),0.15)', background: 'rgba(4,8,22,0.88)', backdropFilter: 'blur(24px)', position: 'sticky', top: 0, zIndex: 30, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Link to="/" style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--primary)', textDecoration: 'none' }}>◈ TwinMind</Link>
            <span style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0' }}>📅 Study Planner</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={generateAIPlan} disabled={generating}
              style={{ padding: '0.42rem 1rem', background: generating ? 'rgba(var(--primary-rgb),0.2)' : 'linear-gradient(135deg,var(--primary),rgba(var(--primary-rgb),0.7))', color: '#fff', border: 'none', borderRadius: '9px', fontSize: '0.8rem', fontWeight: 700, cursor: generating ? 'default' : 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(var(--primary-rgb),0.3)' }}>
              {generating ? '⟳ Generating…' : smartPlan ? '⟳ Regenerate AI Plan' : '✦ Generate AI Plan'}
            </button>
            <Link to="/" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', padding: '0.32rem 0.85rem', border: '1px solid rgba(var(--primary-rgb),0.25)', borderRadius: '8px' }}>← Dashboard</Link>
          </div>
        </header>

        {/* ── Header stats strip ── */}
        <div style={{ background: 'rgba(4,8,22,0.82)', borderBottom: '1.5px solid rgba(var(--primary-rgb),0.12)', backdropFilter: 'blur(20px)', padding: '1rem 1.5rem', flexShrink: 0 }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{getMonthName()}</p>
                <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#f1f5f9' }}>Study Planner</p>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {[
                  { icon: '⏱', label: 'Hours This Month', value: `${liveData.monthHours}h`, color: '#6366f1' },
                  { icon: '📅', label: 'Hours This Week',  value: `${liveData.weekHours}h`,  color: '#00D4FF' },
                  { icon: '🔥', label: 'Current Streak',   value: `${liveData.streakDays}d`,  color: '#ef4444' },
                  { icon: '📈', label: 'Expected Gain',    value: `+${expectedImprovement}%`, color: '#10b981' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: s.color, textShadow: `0 0 12px ${s.color}66` }}>{s.value}</p>
                    <p style={{ margin: 0, fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly + Weekly progress bars */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[
                { label: 'Monthly Goal Progress', pct: monthPct, color: monthPct >= 70 ? '#10b981' : '#f59e0b' },
                { label: `Week ${selectedWeek} Progress`, pct: weekPct, color: weekPct >= 70 ? '#00D4FF' : '#8b5cf6' },
              ].map(bar => (
                <div key={bar.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600 }}>{bar.label}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 900, color: bar.color }}>{bar.pct}%</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}>
                    <div style={{ height: '100%', width: `${bar.pct}%`, background: bar.color, borderRadius: '99px', transition: 'width 0.8s ease', boxShadow: `0 0 10px ${bar.color}66` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ background: 'rgba(4,8,22,0.65)', borderBottom: '1px solid rgba(var(--primary-rgb),0.1)', backdropFilter: 'blur(16px)' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1.5rem', display: 'flex', gap: '0.25rem' }}>
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.72rem 1.1rem', background: 'none', border: 'none', borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent', color: active ? 'var(--primary)' : '#94a3b8', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s', marginBottom: '-1px' }}>
                  <span>{tab.icon}</span>{tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Content ── */}
        <main style={{ flex: 1, maxWidth: '1100px', width: '100%', margin: '0 auto', padding: '2rem 1.5rem', boxSizing: 'border-box' }}>
          {genError && <div style={{ marginBottom: '1rem', padding: '0.7rem 1rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '10px', color: '#f87171', fontSize: '0.85rem' }}>{genError}</div>}

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '0.75rem', color: '#94a3b8', fontSize: '0.9rem' }}>
              <div style={{ width: '20px', height: '20px', border: '2px solid rgba(var(--primary-rgb),0.3)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Loading your study plan…
            </div>
          ) : (

          /* ════ MONTHLY TAB ════ */
          activeTab === 'monthly' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Monthly goals grid */}
              <div>
                <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 800, color: '#f1f5f9' }}>Monthly Goals — {getMonthName()}</h2>
                {!plannerState?.monthlyGoals.length && (
                  <div style={{ padding: '2.5rem', textAlign: 'center', background: 'rgba(4,8,22,0.88)', border: '1.5px solid rgba(var(--primary-rgb),0.2)', borderRadius: '18px', backdropFilter: 'blur(28px)' }}>
                    <p style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>🧠</p>
                    <p style={{ margin: '0 0 0.35rem', fontWeight: 800, color: '#f1f5f9' }}>No goals yet for this month</p>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: '#94a3b8' }}>Generate an AI plan to auto-create monthly goals from your profile & performance data.</p>
                    <button onClick={generateAIPlan} disabled={generating} style={{ padding: '0.6rem 1.4rem', background: 'linear-gradient(135deg,var(--primary),rgba(var(--primary-rgb),0.7))', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.88rem' }}>
                      {generating ? 'Generating…' : '✦ Generate AI Study Plan'}
                    </button>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1rem' }}>
                  {plannerState?.monthlyGoals.map(goal => {
                    const improvePct = goal.toScore - goal.fromScore;
                    const weekDone = [1,2,3,4].filter(w => allWeekTasks.filter(t => t.week === w && t.subject === goal.subject).every(t => plannerState.awardedXP[t.id])).length;
                    const goalPct = Math.round((weekDone / 4) * 100);
                    return (
                      <div key={goal.id} style={{ background: 'rgba(4,8,22,0.90)', border: `1.5px solid ${goal.color}33`, borderRadius: '18px', padding: '1.35rem', backdropFilter: 'blur(28px)', boxShadow: `0 12px 40px rgba(0,0,0,0.6), 0 0 20px ${goal.color}12` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                          <div>
                            <p style={{ margin: '0 0 0.2rem', fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>{goal.subject}</p>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{goal.fromScore}%</span>
                              <span style={{ fontSize: '0.75rem', color: goal.color }}>→</span>
                              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: goal.color }}>{goal.toScore}%</span>
                              <span style={{ fontSize: '0.68rem', background: `${goal.color}18`, color: goal.color, padding: '0.1rem 0.45rem', borderRadius: '99px', fontWeight: 700, border: `1px solid ${goal.color}33` }}>+{improvePct}%</span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ margin: '0 0 0.05rem', fontSize: '1.3rem', fontWeight: 900, color: goal.color, textShadow: `0 0 12px ${goal.color}88` }}>{goalPct}%</p>
                            <p style={{ margin: 0, fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Complete</p>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div style={{ height: '7px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden', marginBottom: '0.9rem', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}>
                          <div style={{ height: '100%', width: `${goalPct}%`, background: goal.color, borderRadius: '99px', transition: 'width 0.8s ease', boxShadow: `0 0 10px ${goal.color}66` }} />
                        </div>

                        {/* Study hours target */}
                        <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)' }}>⏱ {goal.hoursTarget}h target</span>
                          <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)' }}>📅 {weekDone}/4 weeks</span>
                        </div>

                        {/* Weekly focus breakdown */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.38rem' }}>
                          {goal.weeklyFocus.map((focus, wi) => {
                            const weekIdx = (wi + 1) as WeekNum;
                            const tasksForWeek = allWeekTasks.filter(t => t.week === weekIdx && t.subject === goal.subject);
                            const done = tasksForWeek.every(t => plannerState.awardedXP[t.id]) && tasksForWeek.length > 0;
                            return (
                              <div key={wi} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', background: done ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: '8px', border: `1px solid ${done ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.07)'}` }}>
                                <span style={{ fontSize: '0.75rem', flexShrink: 0, color: done ? '#34d399' : '#94a3b8' }}>{done ? '✅' : `W${wi + 1}`}</span>
                                <span style={{ fontSize: '0.72rem', color: done ? '#a7f3d0' : '#cbd5e1', fontWeight: done ? 600 : 400 }}>{focus.replace(/^Week \d+: /, '')}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI Prediction card */}
              {smartPlan && (
                <div style={{ background: 'rgba(4,8,22,0.90)', border: '1.5px solid rgba(var(--primary-rgb),0.22)', borderRadius: '18px', padding: '1.35rem 1.5rem', backdropFilter: 'blur(28px)', boxShadow: '0 16px 50px rgba(0,0,0,0.65)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'rgba(var(--primary-rgb),0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>◈</div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#f1f5f9' }}>AI Performance Prediction</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
                    {[
                      { label: 'Current Score',   value: `${smartPlan.current_score}%`, color: '#94a3b8' },
                      { label: 'Target Score',    value: `${smartPlan.target_score}%`,  color: '#10b981' },
                      { label: 'Daily Hours',     value: `${smartPlan.daily_hours}h`,   color: '#00D4FF' },
                      { label: 'Expected Gain',   value: `+${smartPlan.target_score - smartPlan.current_score}%`, color: '#f59e0b' },
                    ].map(s => (
                      <div key={s.label} style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <p style={{ margin: '0 0 0.15rem', fontSize: '1.4rem', fontWeight: 900, color: s.color, textShadow: `0 0 14px ${s.color}66` }}>{s.value}</p>
                        <p style={{ margin: 0, fontSize: '0.62rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.83rem', color: '#cbd5e1', lineHeight: 1.6, padding: '0.85rem', background: 'rgba(var(--primary-rgb),0.06)', borderRadius: '10px', border: '1px solid rgba(var(--primary-rgb),0.12)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>◈ Twin Forecast: </span>{smartPlan.forecast}
                  </p>
                </div>
              )}

              {/* Month calendar grid */}
              <div style={{ background: 'rgba(4,8,22,0.90)', border: '1.5px solid rgba(var(--primary-rgb),0.18)', borderRadius: '18px', padding: '1.35rem 1.5rem', backdropFilter: 'blur(28px)', boxShadow: '0 16px 50px rgba(0,0,0,0.65)' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 800, color: '#f1f5f9' }}>Month Overview</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.65rem' }}>
                  {([1,2,3,4] as WeekNum[]).map(w => {
                    const weekDoneCount = allWeekTasks.filter(t => t.week === w && plannerState?.awardedXP[t.id]).length;
                    const weekTotal = allWeekTasks.filter(t => t.week === w).length;
                    const pct = weekTotal ? Math.round((weekDoneCount / weekTotal) * 100) : 0;
                    const isActive = w === weekOfMonth();
                    const start = startOfWeek(w);
                    return (
                      <button key={w} onClick={() => { setSelectedWeek(w); setActiveTab('weekly'); }}
                        style={{ padding: '0.9rem 0.75rem', background: isActive ? 'rgba(var(--primary-rgb),0.12)' : 'rgba(255,255,255,0.03)', border: `1.5px solid ${isActive ? 'rgba(var(--primary-rgb),0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '14px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.18s', boxShadow: isActive ? '0 4px 16px rgba(var(--primary-rgb),0.15)' : 'none' }}>
                        <p style={{ margin: '0 0 0.1rem', fontSize: '0.7rem', color: isActive ? 'var(--primary)' : '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Week {w} {isActive ? '· Now' : ''}</p>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.68rem', color: '#94a3b8' }}>
                          {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </p>
                        <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden', marginBottom: '0.35rem' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#10b981' : 'var(--primary)', borderRadius: '99px' }} />
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, color: pct === 100 ? '#34d399' : '#f1f5f9' }}>{pct}%</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

          /* ════ WEEKLY TAB ════ */
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Week selector */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {([1,2,3,4] as WeekNum[]).map(w => {
                  const cnt = allWeekTasks.filter(t => t.week === w).length;
                  const done = allWeekTasks.filter(t => t.week === w && plannerState?.awardedXP[t.id]).length;
                  const pct = cnt ? Math.round((done/cnt)*100) : 0;
                  const isNow = w === weekOfMonth();
                  const active = selectedWeek === w;
                  return (
                    <button key={w} onClick={() => setSelectedWeek(w)}
                      style={{ padding: '0.5rem 1rem', borderRadius: '10px', border: `1.5px solid ${active ? 'rgba(var(--primary-rgb),0.5)' : 'rgba(255,255,255,0.1)'}`, background: active ? 'rgba(var(--primary-rgb),0.14)' : 'rgba(255,255,255,0.04)', color: active ? 'var(--primary)' : '#cbd5e1', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      Week {w} {isNow && <span style={{ fontSize: '0.62rem', background: 'rgba(var(--primary-rgb),0.2)', padding: '0.08rem 0.35rem', borderRadius: '99px', color: 'var(--primary)' }}>Now</span>}
                      {pct === 100 && <span style={{ fontSize: '0.7rem' }}>✅</span>}
                      {pct > 0 && pct < 100 && <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{pct}%</span>}
                    </button>
                  );
                })}
              </div>

              {/* Week summary bar */}
              <div style={{ background: 'rgba(4,8,22,0.90)', border: '1.5px solid rgba(var(--primary-rgb),0.2)', borderRadius: '16px', padding: '1rem 1.35rem', backdropFilter: 'blur(28px)', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600 }}>Week {selectedWeek} Progress</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 900, color: weekPct >= 70 ? '#34d399' : weekPct >= 40 ? '#fbbf24' : 'var(--primary)' }}>{weekPct}%</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}>
                    <div style={{ height: '100%', width: `${weekPct}%`, background: weekPct >= 70 ? '#10b981' : weekPct >= 40 ? '#f59e0b' : 'var(--primary)', borderRadius: '99px', transition: 'width 0.7s ease' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexShrink: 0, flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#00D4FF' }}>{weekCompletedCount}/{weekTasks.length}</p>
                    <p style={{ margin: 0, fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Tasks Done</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#f59e0b' }}>{weekTasks.reduce((s,t)=>s+t.xp,0)} XP</p>
                    <p style={{ margin: 0, fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Available</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>{liveData.weekHours}h</p>
                    <p style={{ margin: 0, fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Studied</p>
                  </div>
                </div>
              </div>

              {/* Auto-tracking note */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.65rem 1rem', background: 'rgba(var(--primary-rgb),0.06)', border: '1px solid rgba(var(--primary-rgb),0.15)', borderRadius: '10px' }}>
                <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>🤖</span>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  <strong style={{ color: '#cbd5e1' }}>Auto-tracked:</strong> Tasks complete automatically when you study, quiz, or check in — no manual input needed.
                  <button onClick={() => { setBaseHours(liveData.weekHours); }} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, padding: 0 }}>Reset week baseline</button>
                </p>
              </div>

              {/* Task cards */}
              {weekTasks.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', background: 'rgba(4,8,22,0.88)', border: '1.5px solid rgba(var(--primary-rgb),0.2)', borderRadius: '18px', backdropFilter: 'blur(28px)' }}>
                  <p style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>📋</p>
                  <p style={{ margin: '0 0 0.35rem', fontWeight: 800, color: '#f1f5f9' }}>No tasks for Week {selectedWeek}</p>
                  <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: '#94a3b8' }}>Generate an AI plan to populate your weekly tasks.</p>
                  <button onClick={generateAIPlan} disabled={generating} style={{ padding: '0.6rem 1.4rem', background: 'linear-gradient(135deg,var(--primary),rgba(var(--primary-rgb),0.7))', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {generating ? 'Generating…' : '✦ Generate AI Plan'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '0.9rem' }}>
                  {weekTasks.map(task => {
                    const done = !!plannerState?.awardedXP[task.id];
                    const cur = getLive(task, liveData, baseHours);
                    const pct = Math.min(100, Math.round((cur / task.weekTarget) * 100));
                    const pColor = PRIORITY_COLORS[task.priority];
                    return (
                      <div key={task.id} style={{ background: done ? 'rgba(16,185,129,0.06)' : 'rgba(4,8,22,0.90)', border: `1.5px solid ${done ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '16px', padding: '1.1rem', backdropFilter: 'blur(24px)', boxShadow: done ? '0 8px 28px rgba(16,185,129,0.1)' : '0 8px 28px rgba(0,0,0,0.5)', transition: 'all 0.2s' }}>
                        {/* Header row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: '0 0 0.15rem', fontSize: '0.9rem', fontWeight: 800, color: done ? '#a7f3d0' : '#f1f5f9' }}>{task.description}</p>
                            <p style={{ margin: 0, fontSize: '0.72rem', color: done ? '#6ee7b7' : '#94a3b8', fontWeight: 600 }}>{task.subject}</p>
                          </div>
                          {done && <span style={{ fontSize: '1.2rem', flexShrink: 0, marginLeft: '0.5rem' }}>✅</span>}
                        </div>

                        {/* Progress bar */}
                        <div style={{ marginBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.28rem' }}>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                              {cur.toFixed(cur % 1 ? 1 : 0)} / {task.weekTarget} {task.tracker === 'study_hours' ? 'hrs' : task.tracker === 'quiz_count' ? 'quizzes' : task.tracker === 'session_count' ? 'sessions' : task.tracker === 'note_count' ? 'notes' : 'days'}
                            </span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: done ? '#34d399' : 'var(--primary)' }}>{pct}%</span>
                          </div>
                          <div style={{ height: '5px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: done ? '#10b981' : 'var(--primary)', borderRadius: '99px', transition: 'width 0.6s ease' }} />
                          </div>
                        </div>

                        {/* Footer chips */}
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '6px', background: `${pColor}15`, color: pColor, border: `1px solid ${pColor}30`, fontWeight: 700 }}>{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority</span>
                          <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' }}>⏱ {task.durationMins < 60 ? `${task.durationMins}m` : `${task.durationMins / 60}h`}</span>
                          <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '6px', background: done ? 'rgba(16,185,129,0.12)' : 'rgba(251,191,36,0.12)', color: done ? '#34d399' : '#fbbf24', border: `1px solid ${done ? 'rgba(16,185,129,0.3)' : 'rgba(251,191,36,0.25)'}`, fontWeight: 700 }}>+{task.xp} XP</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </main>
      </div>

      {/* ── Celebration popup ── */}
      {celebration && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={() => setCelebration(null)}>
          <div style={{ background: 'rgba(4,8,22,0.97)', border: '2px solid rgba(var(--primary-rgb),0.4)', borderRadius: '24px', padding: '2.5rem 2rem', textAlign: 'center', maxWidth: '360px', width: '90%', boxShadow: '0 0 0 1px rgba(var(--primary-rgb),0.12), 0 30px 80px rgba(0,0,0,0.8)', backdropFilter: 'blur(40px)', animation: 'prof-slide 0.3s ease' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: '3rem', margin: '0 0 0.5rem' }}>🎉</p>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 900, color: '#f1f5f9' }}>{celebration.title}</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>{celebration.msg}</p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.2rem', background: 'linear-gradient(135deg,#ffd700,#f59e0b)', borderRadius: '99px', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#0f172a' }}>⭐ +{celebration.xp} XP Earned!</span>
            </div>
            <br />
            <button onClick={() => setCelebration(null)} style={{ padding: '0.6rem 1.6rem', background: 'linear-gradient(135deg,var(--primary),rgba(var(--primary-rgb),0.7))', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', boxShadow: '0 4px 16px rgba(var(--primary-rgb),0.4)' }}>Awesome! 🚀</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes prof-slide { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }
      `}</style>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import api from '../services/api';
import type { WeeklyChallengeData, GamificationProgress } from '../utils/gamification';

// ── Types ─────────────────────────────────────────────────────────────────────
type TrackerKey = 'study_hours'|'quiz_count'|'checkin_days'|'streak_days'|'session_count'|'note_count'|'badge_earned';
type GoalStatus  = 'not_started'|'in_progress'|'completed';

interface GoalTemplate { id:string; text:string; tracker:TrackerKey; target:number; category:string; xp:number; icon:string; }
interface ProgressData  { study_hours:number; quiz_count:number; checkin_days:number; streak_days:number; session_count:number; note_count:number; badge_count:number; }
interface WeekState     { weekKey:string; activeGoalIds:string[]; awardedXP:Record<string,boolean>; sessionBaseline:number; noteBaseline:number; badgeBaseline:number; }
interface Notif         { id:string; icon:string; title:string; body:string; }

// ── Constants ─────────────────────────────────────────────────────────────────
const CATS = [
  { key:'study',    label:'Study Hours',      icon:'⏱',  color:'#6366f1' },
  { key:'quiz',     label:'Quiz Performance', icon:'🎯', color:'#00D4FF' },
  { key:'subject',  label:'Subject Mastery',  icon:'📖', color:'#10b981' },
  { key:'streak',   label:'Consistency',      icon:'🔥', color:'#f59e0b' },
  { key:'career',   label:'Career Dev',       icon:'💼', color:'#8b5cf6' },
  { key:'wellness', label:'Wellness',         icon:'🧘', color:'#ec4899' },
];

const GOAL_CATALOG: GoalTemplate[] = [
  { id:'sh_10',  text:'Study 10 hours this week',          tracker:'study_hours',   target:10,  category:'study',    xp:100, icon:'⏱'  },
  { id:'sh_15',  text:'Study 15 hours this week',          tracker:'study_hours',   target:15,  category:'study',    xp:150, icon:'⏱'  },
  { id:'sh_20',  text:'Study 20 hours this week',          tracker:'study_hours',   target:20,  category:'study',    xp:200, icon:'⏱'  },
  { id:'qz_5',   text:'Complete 5 quizzes this week',      tracker:'quiz_count',    target:5,   category:'quiz',     xp:80,  icon:'🎯' },
  { id:'qz_10',  text:'Complete 10 quizzes this week',     tracker:'quiz_count',    target:10,  category:'quiz',     xp:150, icon:'🎯' },
  { id:'ci_5',   text:'Log 5 check-ins this week',         tracker:'checkin_days',  target:5,   category:'streak',   xp:100, icon:'✅'  },
  { id:'ci_7',   text:'Check in every day this week',      tracker:'checkin_days',  target:7,   category:'streak',   xp:180, icon:'✅'  },
  { id:'sk_7',   text:'Maintain a 7-day streak',           tracker:'streak_days',   target:7,   category:'streak',   xp:200, icon:'🔥'  },
  { id:'sk_14',  text:'Maintain a 14-day streak',          tracker:'streak_days',   target:14,  category:'streak',   xp:350, icon:'🔥'  },
  { id:'sk_30',  text:'Maintain a 30-day streak',          tracker:'streak_days',   target:30,  category:'streak',   xp:500, icon:'🔥'  },
  { id:'nt_5',   text:'Create 5 smart notes this week',    tracker:'note_count',    target:5,   category:'subject',  xp:80,  icon:'📝'  },
  { id:'nt_10',  text:'Create 10 smart notes this week',   tracker:'note_count',    target:10,  category:'subject',  xp:150, icon:'📝'  },
  { id:'ss_3',   text:'Complete 3 study sessions',         tracker:'session_count', target:3,   category:'study',    xp:90,  icon:'▶'   },
  { id:'ss_5',   text:'Complete 5 study sessions',         tracker:'session_count', target:5,   category:'study',    xp:130, icon:'▶'   },
  { id:'bd_1',   text:'Earn 1 new achievement badge',      tracker:'badge_earned',  target:1,   category:'career',   xp:120, icon:'🏅'  },
  { id:'bd_3',   text:'Earn 3 new achievement badges',     tracker:'badge_earned',  target:3,   category:'career',   xp:250, icon:'🏅'  },
];

const TRACKER_META: Record<TrackerKey,{unit:string;label:string}> = {
  study_hours:   { unit:'h',          label:'Study Hours'  },
  quiz_count:    { unit:' quizzes',   label:'Quizzes'      },
  checkin_days:  { unit:' days',      label:'Check-ins'    },
  streak_days:   { unit:' days',      label:'Streak'       },
  session_count: { unit:' sessions',  label:'Sessions'     },
  note_count:    { unit:' notes',     label:'Notes'        },
  badge_earned:  { unit:' badges',    label:'Badges'       },
};

const REWARD_TIERS = [
  { pct:25,  label:'Bronze',  icon:'🥉', color:'#cd7f32', xp:100 },
  { pct:50,  label:'Silver',  icon:'🥈', color:'#c0c0c0', xp:200 },
  { pct:75,  label:'Gold',    icon:'🥇', color:'#ffd700', xp:350 },
  { pct:100, label:'Diamond', icon:'💎', color:'#00D4FF', xp:500 },
];

const WC_KEY = 'twinmind_wc_v2';
const CONF_COLORS = ['#00D4FF','#7C3AED','#F59E0B','#10B981','#EF4444','#F97316','#EC4899','#6366f1'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function isoWeekKey(d = new Date()): string {
  const dt = new Date(d); dt.setHours(0,0,0,0);
  dt.setDate(dt.getDate() + 3 - ((dt.getDay()+6)%7));
  const w1 = new Date(dt.getFullYear(),0,4);
  const wn = 1 + Math.round(((dt.getTime()-w1.getTime())/86400000 - 3 + ((w1.getDay()+6)%7))/7);
  return `${dt.getFullYear()}-W${String(wn).padStart(2,'0')}`;
}

function readStoredState(): WeekState|null {
  try {
    const raw = localStorage.getItem(WC_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as WeekState;
    return s.weekKey === isoWeekKey() ? s : null;
  } catch { return null; }
}

function saveState(s: WeekState) { localStorage.setItem(WC_KEY, JSON.stringify(s)); }

function freshState(sc:number, nc:number, bc:number): WeekState {
  return { weekKey:isoWeekKey(), activeGoalIds:[], awardedXP:{}, sessionBaseline:sc, noteBaseline:nc, badgeBaseline:bc };
}

function getProgress(g: GoalTemplate, p: ProgressData, ws: WeekState): number {
  switch (g.tracker) {
    case 'study_hours':   return p.study_hours;
    case 'quiz_count':    return p.quiz_count;
    case 'checkin_days':  return p.checkin_days;
    case 'streak_days':   return p.streak_days;
    case 'session_count': return Math.max(0, p.session_count - ws.sessionBaseline);
    case 'note_count':    return Math.max(0, p.note_count    - ws.noteBaseline);
    case 'badge_earned':  return Math.max(0, p.badge_count   - ws.badgeBaseline);
  }
}

function goalStatus(cur:number, target:number): GoalStatus {
  if (cur >= target) return 'completed';
  if (cur > 0)       return 'in_progress';
  return 'not_started';
}

function makeConfetti() {
  return Array.from({length:60},(_,i) => ({
    id:i, x:Math.random()*100, color:CONF_COLORS[i%CONF_COLORS.length],
    delay:Math.random()*1.8, dur:1.6+Math.random()*1.4, size:6+Math.random()*8, round:i%3===0,
  }));
}

// ── Progress ring ─────────────────────────────────────────────────────────────
function Ring({ pct, size=120, stroke=11, color='#00D4FF' }: { pct:number; size?:number; stroke?:number; color?:string }) {
  const r = (size-stroke)/2;
  const circ = 2*Math.PI*r;
  const offset = circ - (Math.min(pct,100)/100)*circ;
  return (
    <div style={{position:'relative',width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:'rotate(-90deg)',display:'block'}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{transition:'stroke-dashoffset 0.9s ease',filter:`drop-shadow(0 0 6px ${color}88)`}}/>
      </svg>
      <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'0.1rem'}}>
        <span style={{fontSize:size<100?'0.85rem':'1.35rem',fontWeight:900,color:'#f1f5f9',lineHeight:1}}>{Math.round(pct)}%</span>
        <span style={{fontSize:'0.55rem',color:'rgba(148,163,184,0.45)',fontWeight:600,letterSpacing:'0.05em'}}>DONE</span>
      </div>
    </div>
  );
}

// ── Goal card ─────────────────────────────────────────────────────────────────
function GoalCard({ g, cur, pct, status, onRemove }: { g:GoalTemplate; cur:number; pct:number; status:GoalStatus; onRemove:()=>void }) {
  const cat  = CATS.find(c => c.key===g.category)!;
  const meta = TRACKER_META[g.tracker];
  const sm = status==='completed'
    ? { label:'Completed ✓', color:'#10b981', bg:'rgba(16,185,129,0.12)' }
    : status==='in_progress'
    ? { label:'In Progress',  color:'#f59e0b', bg:'rgba(245,158,11,0.1)'  }
    : { label:'Not Started',  color:'rgba(148,163,184,0.45)', bg:'rgba(255,255,255,0.04)' };
  return (
    <div style={{padding:'1rem 1.1rem',background:status==='completed'?'rgba(16,185,129,0.06)':'rgba(255,255,255,0.03)',border:`1px solid ${status==='completed'?'rgba(16,185,129,0.3)':status==='in_progress'?cat.color+'40':'rgba(255,255,255,0.07)'}`,borderRadius:'16px',transition:'all 0.25s'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:'0.75rem',marginBottom:'0.7rem'}}>
        <div style={{width:'38px',height:'38px',borderRadius:'10px',background:`${cat.color}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',flexShrink:0,border:`1px solid ${cat.color}30`}}>{g.icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{margin:'0 0 0.2rem',fontSize:'0.84rem',fontWeight:700,color:status==='completed'?'#10b981':'#e2e8f0',lineHeight:1.3}}>{g.text}</p>
          <div style={{display:'flex',alignItems:'center',gap:'0.45rem',flexWrap:'wrap'}}>
            <span style={{fontSize:'0.62rem',fontWeight:700,padding:'0.12rem 0.45rem',borderRadius:'99px',background:sm.bg,color:sm.color,border:`1px solid ${sm.color}45`}}>{sm.label}</span>
            <span style={{fontSize:'0.62rem',color:cat.color,fontWeight:600}}>{cat.icon} {cat.label}</span>
            <span style={{fontSize:'0.63rem',color:'#f59e0b',fontWeight:700}}>+{g.xp} XP</span>
          </div>
        </div>
        <button onClick={onRemove} style={{background:'none',border:'none',color:'rgba(148,163,184,0.22)',cursor:'pointer',padding:'0.15rem 0.25rem',borderRadius:'5px',fontSize:'0.78rem',flexShrink:0,lineHeight:1,fontFamily:'inherit'}}>✕</button>
      </div>
      <div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.28rem'}}>
          <span style={{fontSize:'0.68rem',color:'rgba(148,163,184,0.45)',fontWeight:500}}>{meta.label}</span>
          <span style={{fontSize:'0.7rem',fontWeight:700,color:status==='completed'?'#10b981':'#94a3b8'}}>{cur}{meta.unit} / {g.target}{meta.unit}</span>
        </div>
        <div style={{height:'6px',background:'rgba(255,255,255,0.07)',borderRadius:'99px',overflow:'hidden'}}>
          <div style={{height:'100%',width:`${pct}%`,borderRadius:'99px',transition:'width 0.8s ease',
            background:status==='completed'?'linear-gradient(90deg,#10b981,#34d399)':status==='in_progress'?`linear-gradient(90deg,${cat.color},${cat.color}bb)`:'rgba(255,255,255,0.08)',
            boxShadow:status==='completed'?'0 0 8px rgba(16,185,129,0.5)':undefined}}/>
        </div>
        <p style={{margin:'0.22rem 0 0',fontSize:'0.62rem',color:'rgba(148,163,184,0.32)',fontWeight:500}}>{pct}% complete</p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function WeeklyChallengesModal({ isOpen, onClose }: { isOpen:boolean; onClose:()=>void }) {
  const [weeklyData,  setWeeklyData]  = useState<WeeklyChallengeData|null>(null);
  const [gamProgress, setGamProgress] = useState<GamificationProgress|null>(null);
  const [rawSessions, setRawSessions] = useState(0);
  const [rawNotes,    setRawNotes]    = useState(0);
  const [rawBadges,   setRawBadges]   = useState(0);
  const [weekState,   setWeekState]   = useState<WeekState|null>(null);
  const [loading,     setLoading]     = useState(false);
  const [tab,         setTab]         = useState<'week'|'catalog'|'rewards'>('week');
  const [catFilter,   setCatFilter]   = useState('all');
  const [celebrating, setCelebrating] = useState(false);
  const [celebMsg,    setCelebMsg]    = useState('');
  const [celebXP,     setCelebXP]     = useState(0);
  const [confetti,    setConfetti]    = useState<ReturnType<typeof makeConfetti>>([]);
  const [notifs,      setNotifs]      = useState<Notif[]>([]);
  const celebTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const awardedRef  = useRef<Record<string,boolean>>({});

  // Immediately show goals from localStorage before API resolves
  useEffect(() => {
    if (!isOpen) return;
    const stored = readStoredState();
    if (stored) { setWeekState(stored); awardedRef.current = { ...stored.awardedXP }; }
  }, [isOpen]);

  // Load all backend data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [wc, gp, sess, notes, ach] = await Promise.all([
        api.get<WeeklyChallengeData>('/gamification/weekly-challenge'),
        api.get<GamificationProgress>('/gamification/progress'),
        api.get<unknown[]>('/sessions'),
        api.get<unknown[]>('/notes'),
        api.get<{earned:boolean}[]>('/achievements'),
      ]);
      const sc = (sess.data as unknown[]).length;
      const nc = (notes.data as unknown[]).length;
      const bc = (ach.data as {earned:boolean}[]).filter(b => b.earned).length;
      setWeeklyData(wc.data);
      setGamProgress(gp.data);
      setRawSessions(sc); setRawNotes(nc); setRawBadges(bc);
      // Fix weekState if week rolled over or was never initialized
      setWeekState(prev => {
        const wk = isoWeekKey();
        if (prev && prev.weekKey === wk) return prev;
        const f = freshState(sc, nc, bc);
        saveState(f);
        awardedRef.current = {};
        return f;
      });
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isOpen) loadData(); }, [isOpen, loadData]);

  // Keyboard / scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key==='Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const pushNotif = useCallback((icon:string, title:string, body:string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotifs(prev => [...prev.slice(-3), {id, icon, title, body}]);
    setTimeout(() => setNotifs(prev => prev.filter(n => n.id!==id)), 4500);
  }, []);

  const triggerCelebration = useCallback((msg:string, xp:number) => {
    setCelebMsg(msg); setCelebXP(xp); setConfetti(makeConfetti()); setCelebrating(true);
    if (celebTimer.current) clearTimeout(celebTimer.current);
    celebTimer.current = setTimeout(() => setCelebrating(false), 4000);
  }, []);

  // Derived progress data
  const progressData: ProgressData|null = useMemo(() => {
    if (!weeklyData || !gamProgress) return null;
    return {
      study_hours: weeklyData.progress.study_hours,
      quiz_count:  weeklyData.progress.quiz_count,
      checkin_days:weeklyData.progress.checkin_days,
      streak_days: gamProgress.streak_days,
      session_count: rawSessions,
      note_count:    rawNotes,
      badge_count:   rawBadges,
    };
  }, [weeklyData, gamProgress, rawSessions, rawNotes, rawBadges]);

  // Active goals list
  const activeGoals = useMemo(() =>
    (weekState?.activeGoalIds ?? []).map(id => GOAL_CATALOG.find(g => g.id===id)).filter((g): g is GoalTemplate => !!g),
    [weekState]
  );

  // Auto-completion detection — fires whenever data refreshes
  useEffect(() => {
    if (!progressData || !weekState || activeGoals.length===0) return;
    const newly: GoalTemplate[] = [];
    activeGoals.forEach(g => {
      const cur = getProgress(g, progressData, weekState);
      if (cur >= g.target && !awardedRef.current[g.id]) newly.push(g);
    });
    if (newly.length===0) return;
    const updAward: Record<string,boolean> = { ...weekState.awardedXP };
    newly.forEach(g => { updAward[g.id]=true; awardedRef.current[g.id]=true; });
    const updated = { ...weekState, awardedXP: updAward };
    saveState(updated);
    setWeekState(updated);
    newly.forEach((g,i) => setTimeout(() => {
      triggerCelebration(g.text, g.xp);
      pushNotif('🎉', 'Challenge Completed!', `${g.text} — +${g.xp} XP`);
    }, i*700));
  }, [progressData, weekState, activeGoals, triggerCelebration, pushNotif]);

  function addGoal(g: GoalTemplate) {
    if (!weekState || weekState.activeGoalIds.includes(g.id)) return;
    const alreadyDone = progressData ? getProgress(g, progressData, weekState) >= g.target : false;
    const updAward = alreadyDone ? { ...weekState.awardedXP, [g.id]:true } : weekState.awardedXP;
    if (alreadyDone) awardedRef.current[g.id] = true;
    const updated = { ...weekState, activeGoalIds:[...weekState.activeGoalIds, g.id], awardedXP:updAward };
    saveState(updated); setWeekState(updated);
    pushNotif('✅', 'Challenge Added!', g.text);
    setTab('week');
  }

  function removeGoal(id: string) {
    if (!weekState) return;
    const updated = { ...weekState, activeGoalIds: weekState.activeGoalIds.filter(x => x!==id) };
    saveState(updated); setWeekState(updated);
  }

  if (!isOpen) return null;

  // ── Derived metrics ──
  const totalGoals = activeGoals.length;
  const completedGoals = activeGoals.filter(g => progressData && weekState && getProgress(g,progressData,weekState)>=g.target);
  const inProgressGoals = activeGoals.filter(g => {
    if (!progressData || !weekState) return false;
    const cur = getProgress(g,progressData,weekState);
    return cur>0 && cur<g.target;
  });
  const notStartedGoals = activeGoals.filter(g => {
    if (!progressData || !weekState) return g;
    return getProgress(g,progressData,weekState)===0;
  });
  const overallPct   = totalGoals ? Math.round((completedGoals.length/totalGoals)*100) : 0;
  const totalXPEarned = completedGoals.reduce((s,g) => s+g.xp, 0);
  const weekLabel    = weeklyData?.week_start
    ? `Week of ${new Date(weeklyData.week_start+'T00:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}`
    : 'This Week';
  const ringColor    = overallPct===100?'#10b981':overallPct>=75?'#ffd700':overallPct>=50?'#c0c0c0':'#00D4FF';
  const catalogList  = catFilter==='all' ? GOAL_CATALOG : GOAL_CATALOG.filter(g => g.category===catFilter);

  return (
    <>
      <style>{`
        @keyframes conf-fall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:0}}
        @keyframes cel-pop{0%{transform:scale(0.4) translateY(20px);opacity:0}60%{transform:scale(1.06) translateY(0);opacity:1}100%{transform:scale(1) translateY(0);opacity:1}}
        @keyframes notif-in{0%{transform:translateX(110%);opacity:0}15%{transform:translateX(0);opacity:1}80%{transform:translateX(0);opacity:1}100%{transform:translateX(110%);opacity:0}}
        @keyframes wc-enter{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* ── Confetti ── */}
      {celebrating && (
        <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:1001}}>
          {confetti.map(p=>(
            <div key={p.id} style={{position:'absolute',top:'-20px',left:`${p.x}%`,width:`${p.size}px`,height:`${p.size}px`,background:p.color,borderRadius:p.round?'50%':'2px',animation:`conf-fall ${p.dur}s ${p.delay}s ease-in forwards`}}/>
          ))}
        </div>
      )}

      {/* ── Celebration popup ── */}
      {celebrating && (
        <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,pointerEvents:'none'}}>
          <div style={{background:'rgba(4,8,22,0.97)',border:'1px solid rgba(0,212,255,0.45)',borderRadius:'28px',padding:'2.25rem 3rem',textAlign:'center',backdropFilter:'blur(32px)',boxShadow:'0 0 80px rgba(0,212,255,0.2),0 24px 64px rgba(0,0,0,0.7)',animation:'cel-pop 0.45s cubic-bezier(0.175,0.885,0.32,1.275) forwards',maxWidth:'360px',width:'90%'}}>
            <div style={{fontSize:'3.5rem',marginBottom:'0.6rem'}}>🎉</div>
            <p style={{margin:'0 0 0.2rem',fontSize:'1.05rem',fontWeight:900,color:'#f1f5f9',letterSpacing:'-0.2px'}}>Weekly Challenge Completed!</p>
            <p style={{margin:'0 0 0.65rem',fontSize:'0.85rem',color:'rgba(148,163,184,0.65)',lineHeight:1.45}}>{celebMsg}</p>
            <p style={{margin:'0 0 0.2rem',fontSize:'1.25rem',fontWeight:900,color:'#00D4FF'}}>+{celebXP} XP</p>
            <p style={{margin:0,fontSize:'0.78rem',color:'rgba(148,163,184,0.5)'}}>🏆 Badge Unlocked · Keep going!</p>
          </div>
        </div>
      )}

      {/* ── Notification stack ── */}
      <div style={{position:'fixed',top:'76px',right:'1rem',display:'flex',flexDirection:'column',gap:'0.45rem',zIndex:600,pointerEvents:'none'}}>
        {notifs.map(n=>(
          <div key={n.id} style={{display:'flex',alignItems:'center',gap:'0.65rem',background:'rgba(4,8,22,0.97)',border:'1px solid rgba(0,212,255,0.25)',borderRadius:'14px',padding:'0.65rem 1rem',backdropFilter:'blur(20px)',boxShadow:'0 8px 32px rgba(0,0,0,0.5)',animation:'notif-in 4.5s ease forwards',minWidth:'240px',maxWidth:'310px'}}>
            <span style={{fontSize:'1.25rem',flexShrink:0}}>{n.icon}</span>
            <div style={{minWidth:0}}>
              <p style={{margin:0,fontSize:'0.8rem',fontWeight:700,color:'#f1f5f9',lineHeight:1.2}}>{n.title}</p>
              <p style={{margin:'0.1rem 0 0',fontSize:'0.7rem',color:'rgba(148,163,184,0.6)',lineHeight:1.3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Modal ── */}
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.78)',backdropFilter:'blur(10px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
        <div onClick={e=>e.stopPropagation()} style={{background:'rgba(4,8,22,0.97)',border:'1px solid rgba(0,212,255,0.16)',borderRadius:'28px',width:'100%',maxWidth:'840px',maxHeight:'88vh',display:'flex',flexDirection:'column',backdropFilter:'blur(32px) saturate(200%)',boxShadow:'0 0 0 1px rgba(0,212,255,0.06),0 32px 80px rgba(0,0,0,0.75)',animation:'wc-enter 0.28s ease forwards'}}>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'1.25rem 1.75rem',borderBottom:'1px solid rgba(255,255,255,0.07)',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
              <div style={{width:'40px',height:'40px',borderRadius:'11px',flexShrink:0,background:'linear-gradient(135deg,#00D4FF,#7C3AED)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.15rem',boxShadow:'0 4px 18px rgba(0,212,255,0.35)'}}>🏋️</div>
              <div>
                <h2 style={{margin:0,fontSize:'1.05rem',fontWeight:900,color:'#f1f5f9',letterSpacing:'-0.3px'}}>Weekly Challenges</h2>
                <p style={{margin:0,fontSize:'0.67rem',color:'rgba(148,163,184,0.42)',fontWeight:500}}>{weekLabel} · Fully Automated Tracking</p>
              </div>
              {completedGoals.length>0 && (
                <span style={{padding:'0.2rem 0.65rem',background:'rgba(16,185,129,0.12)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:'99px',fontSize:'0.68rem',fontWeight:700,color:'#10b981'}}>{completedGoals.length}/{totalGoals} done · +{totalXPEarned} XP</span>
              )}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'0.6rem'}}>
              <button onClick={loadData} disabled={loading} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',color:'rgba(148,163,184,0.6)',fontSize:'0.7rem',fontWeight:600,cursor:'pointer',padding:'0.26rem 0.6rem',fontFamily:'inherit',transition:'all 0.18s'}}>{loading?'⟳ Syncing…':'⟳ Refresh'}</button>
              <button onClick={onClose} style={{background:'transparent',border:'none',color:'rgba(148,163,184,0.5)',fontSize:'1.3rem',cursor:'pointer',padding:'0.25rem 0.45rem',borderRadius:'8px',lineHeight:1,fontFamily:'inherit'}}>✕</button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:'flex',gap:'0.25rem',padding:'0.65rem 1.75rem',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0}}>
            {(['week','catalog','rewards'] as const).map((k,i)=>{
              const m=[['📊','This Week'],['➕','Add Goals'],['🏆','Rewards']][i];
              const active=tab===k;
              return (
                <button key={k} onClick={()=>setTab(k)} style={{display:'flex',alignItems:'center',gap:'0.4rem',padding:'0.4rem 0.88rem',borderRadius:'10px',background:active?'rgba(0,212,255,0.12)':'transparent',border:active?'1px solid rgba(0,212,255,0.35)':'1px solid transparent',color:active?'#00D4FF':'rgba(148,163,184,0.52)',fontSize:'0.8rem',fontWeight:active?700:500,cursor:'pointer',fontFamily:'inherit',transition:'all 0.18s'}}>
                  <span>{m[0]}</span><span>{m[1]}</span>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div style={{flex:1,overflowY:'auto',padding:'1.4rem 1.75rem',display:'flex',flexDirection:'column',gap:'1.5rem'}}>

            {/* ═══════════ THIS WEEK TAB ═══════════ */}
            {tab==='week' && (
              <>
                {/* Summary hero */}
                <div style={{display:'flex',alignItems:'center',gap:'1.75rem',padding:'1.4rem 1.6rem',background:'rgba(255,255,255,0.025)',border:`1px solid ${ringColor}22`,borderRadius:'22px'}}>
                  <Ring pct={overallPct} size={128} stroke={12} color={ringColor} />
                  <div style={{flex:1,display:'flex',flexDirection:'column',gap:'0.85rem'}}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.65rem'}}>
                      {[
                        {icon:'✅',v:`${completedGoals.length}/${totalGoals}`,l:'Completed',   c:'#10b981'},
                        {icon:'⭐',v:`+${totalXPEarned}`,                      l:'XP Earned',   c:'#f59e0b'},
                        {icon:'🔥',v:`${inProgressGoals.length}`,              l:'In Progress', c:'#00D4FF'},
                      ].map(s=>(
                        <div key={s.l} style={{textAlign:'center',padding:'0.55rem 0.4rem',background:'rgba(255,255,255,0.03)',borderRadius:'12px',border:`1px solid ${s.c}22`}}>
                          <p style={{margin:'0 0 0.15rem',fontSize:'0.95rem'}}>{s.icon}</p>
                          <p style={{margin:'0 0 0.08rem',fontSize:'1.05rem',fontWeight:900,color:s.c}}>{s.v}</p>
                          <p style={{margin:0,fontSize:'0.6rem',color:'rgba(148,163,184,0.42)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em'}}>{s.l}</p>
                        </div>
                      ))}
                    </div>
                    {/* Reward tier chips */}
                    <div style={{display:'flex',gap:'0.4rem'}}>
                      {REWARD_TIERS.map(r=>{
                        const unlocked=overallPct>=r.pct;
                        return (
                          <div key={r.label} title={`${r.label}: complete ${r.pct}% of goals · +${r.xp} XP`} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'0.18rem',padding:'0.4rem 0.2rem',borderRadius:'10px',background:unlocked?`${r.color}14`:'rgba(255,255,255,0.03)',border:`1px solid ${unlocked?r.color+'45':'rgba(255,255,255,0.07)'}`,transition:'all 0.35s',cursor:'default'}}>
                            <span style={{fontSize:'1.05rem',filter:unlocked?'none':'grayscale(1) opacity(0.3)'}}>{r.icon}</span>
                            <span style={{fontSize:'0.58rem',fontWeight:700,color:unlocked?r.color:'rgba(148,163,184,0.3)'}}>{r.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Empty state */}
                {totalGoals===0 && (
                  <div style={{textAlign:'center',padding:'2.5rem 1rem'}}>
                    <p style={{fontSize:'2.5rem',margin:'0 0 0.65rem'}}>🏋️</p>
                    <p style={{margin:'0 0 0.35rem',fontSize:'0.9rem',fontWeight:700,color:'rgba(148,163,184,0.65)'}}>No active challenges</p>
                    <p style={{margin:'0 0 1.1rem',fontSize:'0.78rem',color:'rgba(148,163,184,0.38)'}}>All progress is tracked automatically — just add goals from the catalog</p>
                    <button onClick={()=>setTab('catalog')} style={{padding:'0.52rem 1.4rem',background:'linear-gradient(135deg,#00D4FF,#7C3AED)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'0.82rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit',boxShadow:'0 4px 18px rgba(0,212,255,0.3)'}}>Browse Goal Catalog →</button>
                  </div>
                )}

                {/* In Progress */}
                {inProgressGoals.length>0 && (
                  <div>
                    <p style={sLbl}>IN PROGRESS ({inProgressGoals.length})</p>
                    <div style={{display:'flex',flexDirection:'column',gap:'0.55rem',marginTop:'0.65rem'}}>
                      {inProgressGoals.map(g=>{
                        const cur=progressData&&weekState?getProgress(g,progressData,weekState):0;
                        return <GoalCard key={g.id} g={g} cur={cur} pct={Math.min(100,Math.round((cur/g.target)*100))} status="in_progress" onRemove={()=>removeGoal(g.id)}/>;
                      })}
                    </div>
                  </div>
                )}

                {/* Not started */}
                {notStartedGoals.length>0 && (
                  <div>
                    <p style={sLbl}>NOT STARTED ({notStartedGoals.length})</p>
                    <div style={{display:'flex',flexDirection:'column',gap:'0.55rem',marginTop:'0.65rem'}}>
                      {notStartedGoals.map(g=>(
                        <GoalCard key={g.id} g={g} cur={0} pct={0} status="not_started" onRemove={()=>removeGoal(g.id)}/>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed */}
                {completedGoals.length>0 && (
                  <div>
                    <p style={sLbl}>COMPLETED CHALLENGES ({completedGoals.length})</p>
                    <div style={{display:'flex',flexDirection:'column',gap:'0.55rem',marginTop:'0.65rem'}}>
                      {completedGoals.map(g=>(
                        <GoalCard key={g.id} g={g} cur={g.target} pct={100} status="completed" onRemove={()=>removeGoal(g.id)}/>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ═══════════ CATALOG TAB ═══════════ */}
            {tab==='catalog' && (
              <>
                <div>
                  <p style={{...sLbl,marginBottom:'0.65rem'}}>FILTER BY CATEGORY</p>
                  <div style={{display:'flex',gap:'0.4rem',flexWrap:'wrap'}}>
                    <button onClick={()=>setCatFilter('all')} style={{...chip,...(catFilter==='all'?activeChip:{})}} >All</button>
                    {CATS.map(c=>(
                      <button key={c.key} onClick={()=>setCatFilter(c.key)} style={{...chip,...(catFilter===c.key?{background:`${c.color}18`,border:`1px solid ${c.color}45`,color:c.color}:{})}}>{c.icon} {c.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{...sLbl,marginBottom:'0.65rem'}}>GOAL CATALOG — progress tracked automatically, no manual input needed</p>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))',gap:'0.75rem'}}>
                    {catalogList.map(g=>{
                      const cat      = CATS.find(c=>c.key===g.category)!;
                      const isActive = weekState?.activeGoalIds.includes(g.id)??false;
                      const cur      = progressData&&weekState ? getProgress(g,progressData,weekState) : 0;
                      const pct      = Math.min(100,Math.round((cur/g.target)*100));
                      const done     = cur>=g.target;
                      return (
                        <div key={g.id} style={{padding:'1.1rem',background:'rgba(255,255,255,0.03)',border:`1px solid ${done?'rgba(16,185,129,0.35)':isActive?cat.color+'40':cat.color+'22'}`,borderRadius:'16px',display:'flex',flexDirection:'column',gap:'0.55rem',transition:'border-color 0.2s'}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                            <div style={{display:'flex',alignItems:'center',gap:'0.4rem'}}>
                              <span style={{fontSize:'1rem'}}>{g.icon}</span>
                              <span style={{fontSize:'0.62rem',fontWeight:700,color:cat.color,textTransform:'uppercase',letterSpacing:'0.08em'}}>{cat.label}</span>
                            </div>
                            <span style={{fontSize:'0.7rem',fontWeight:700,color:'#f59e0b'}}>+{g.xp} XP</span>
                          </div>
                          <p style={{margin:0,fontSize:'0.82rem',fontWeight:600,color:'#e2e8f0',lineHeight:1.4,flex:1}}>{g.text}</p>
                          {isActive && (
                            <>
                              <div style={{height:'4px',background:'rgba(255,255,255,0.07)',borderRadius:'99px',overflow:'hidden'}}>
                                <div style={{height:'100%',width:`${pct}%`,background:done?'#10b981':cat.color,borderRadius:'99px',transition:'width 0.7s ease'}}/>
                              </div>
                              <p style={{margin:0,fontSize:'0.65rem',color:'rgba(148,163,184,0.42)'}}>{cur}{TRACKER_META[g.tracker].unit} / {g.target}{TRACKER_META[g.tracker].unit} · {pct}%</p>
                            </>
                          )}
                          <button onClick={()=>addGoal(g)} disabled={isActive} style={{padding:'0.32rem 0.75rem',borderRadius:'8px',fontSize:'0.72rem',fontWeight:700,cursor:isActive?'default':'pointer',fontFamily:'inherit',alignSelf:'flex-start',transition:'all 0.18s',
                            background:done?'rgba(16,185,129,0.1)':isActive?'rgba(255,255,255,0.04)':`${cat.color}1c`,
                            border:`1px solid ${done?'rgba(16,185,129,0.3)':isActive?'rgba(255,255,255,0.1)':cat.color+'45'}`,
                            color:done?'#10b981':isActive?'rgba(148,163,184,0.4)':cat.color}}>
                            {done?'✓ Completed':isActive?'✓ Tracking':'+ Track This Goal'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ═══════════ REWARDS TAB ═══════════ */}
            {tab==='rewards' && (
              <>
                {/* Big ring */}
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'0.65rem',padding:'1.5rem',background:'rgba(255,255,255,0.025)',border:`1px solid ${ringColor}22`,borderRadius:'22px'}}>
                  <Ring pct={overallPct} size={160} stroke={14} color={ringColor}/>
                  <p style={{margin:0,fontSize:'1rem',fontWeight:800,color:'#f1f5f9'}}>{completedGoals.length} of {totalGoals} challenges completed</p>
                  <p style={{margin:0,fontSize:'0.8rem',color:'rgba(148,163,184,0.5)'}}>+{totalXPEarned} XP earned this week</p>
                </div>

                {/* Tier cards */}
                <div>
                  <p style={{...sLbl,marginBottom:'0.65rem'}}>WEEKLY REWARD TIERS</p>
                  <div style={{display:'flex',flexDirection:'column',gap:'0.6rem'}}>
                    {REWARD_TIERS.map(r=>{
                      const unlocked = overallPct>=r.pct;
                      const tierPct  = Math.min(100,Math.round((overallPct/r.pct)*100));
                      return (
                        <div key={r.label} style={{padding:'1rem 1.1rem',background:unlocked?`${r.color}0e`:'rgba(255,255,255,0.03)',border:`1px solid ${unlocked?r.color+'40':'rgba(255,255,255,0.07)'}`,borderRadius:'16px',display:'flex',alignItems:'center',gap:'1rem',transition:'all 0.3s'}}>
                          <span style={{fontSize:'1.9rem',filter:unlocked?'none':'grayscale(1) opacity(0.28)',flexShrink:0}}>{r.icon}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.35rem'}}>
                              <p style={{margin:0,fontSize:'0.87rem',fontWeight:700,color:unlocked?r.color:'#e2e8f0'}}>{r.label} Reward</p>
                              <span style={{fontSize:'0.75rem',fontWeight:700,color:'#f59e0b'}}>+{r.xp} XP</span>
                            </div>
                            <p style={{margin:'0 0 0.45rem',fontSize:'0.7rem',color:'rgba(148,163,184,0.45)'}}>Complete {r.pct}% of your goals this week</p>
                            <div style={{height:'6px',background:'rgba(255,255,255,0.07)',borderRadius:'99px',overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${unlocked?100:tierPct}%`,background:unlocked?r.color:`linear-gradient(90deg,${r.color},${r.color}88)`,borderRadius:'99px',transition:'width 0.7s ease',boxShadow:unlocked?`0 0 8px ${r.color}55`:undefined}}/>
                            </div>
                          </div>
                          <span style={{fontSize:'1.05rem',flexShrink:0,opacity:unlocked?1:0}}>{unlocked?'✅':''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Live backend metrics */}
                {progressData && (
                  <div>
                    <p style={{...sLbl,marginBottom:'0.65rem'}}>LIVE PROGRESS METRICS</p>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:'0.5rem'}}>
                      {[
                        {icon:'⏱',l:'Study Hours',  v:progressData.study_hours,  u:'h',     c:'#6366f1'},
                        {icon:'🎯',l:'Quizzes',      v:progressData.quiz_count,   u:'',      c:'#00D4FF'},
                        {icon:'✅',l:'Check-ins',    v:progressData.checkin_days, u:' days', c:'#10b981'},
                        {icon:'🔥',l:'Streak',       v:progressData.streak_days,  u:' days', c:'#f59e0b'},
                      ].map(m=>(
                        <div key={m.l} style={{padding:'0.85rem',background:'rgba(255,255,255,0.03)',border:`1px solid ${m.c}22`,borderRadius:'12px',textAlign:'center'}}>
                          <p style={{margin:'0 0 0.2rem',fontSize:'1.1rem'}}>{m.icon}</p>
                          <p style={{margin:'0 0 0.08rem',fontSize:'1.25rem',fontWeight:900,color:m.c}}>{m.v}{m.u}</p>
                          <p style={{margin:0,fontSize:'0.63rem',color:'rgba(148,163,184,0.42)',fontWeight:600}}>{m.l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

// ── Shared micro-styles ───────────────────────────────────────────────────────
const sLbl:      React.CSSProperties = { margin:0, fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(148,163,184,0.3)' };
const chip:      React.CSSProperties = { padding:'0.3rem 0.7rem', borderRadius:'99px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)', color:'rgba(148,163,184,0.52)', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.18s' };
const activeChip:React.CSSProperties = { background:'rgba(0,212,255,0.12)', border:'1px solid rgba(0,212,255,0.35)', color:'#00D4FF' };

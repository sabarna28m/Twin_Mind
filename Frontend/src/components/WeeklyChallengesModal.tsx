import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import type { WeeklyChallengeData } from '../utils/gamification';

interface CustomGoal {
  id: string; text: string; category: string; xp: number; done: boolean; createdAt: string;
}
interface Notif { id: string; icon: string; title: string; body: string; }

const CATS = [
  { key: 'study',    label: 'Study Hours',      icon: '⏱',  color: '#6366f1' },
  { key: 'quiz',     label: 'Quiz Performance', icon: '🎯', color: '#00D4FF' },
  { key: 'subject',  label: 'Subject Mastery',  icon: '📖', color: '#10b981' },
  { key: 'streak',   label: 'Consistency',      icon: '🔥', color: '#f59e0b' },
  { key: 'career',   label: 'Career Dev',       icon: '💼', color: '#8b5cf6' },
  { key: 'wellness', label: 'Wellness',         icon: '🧘', color: '#ec4899' },
];

const SUGGESTIONS = [
  { text: 'Study 15 hours this week',               category: 'study',    xp: 150 },
  { text: 'Complete 5 practice quizzes',            category: 'quiz',     xp: 100 },
  { text: 'Create 10 smart notes',                  category: 'subject',  xp: 120 },
  { text: 'Maintain a 7-day check-in streak',       category: 'streak',   xp: 200 },
  { text: 'Finish reviewing your weakest subject',  category: 'subject',  xp: 180 },
  { text: 'Complete a career assessment session',   category: 'career',   xp: 80  },
  { text: 'Log 3 wellness check-ins',               category: 'wellness', xp: 60  },
  { text: 'Score 80%+ on a Focus Mode quiz',        category: 'quiz',     xp: 150 },
  { text: 'Study at least 2 hours daily, 5 days',   category: 'study',    xp: 175 },
  { text: 'Reduce stress level below 5 this week',  category: 'wellness', xp: 90  },
  { text: 'Watch 3 video learning sessions',        category: 'subject',  xp: 75  },
  { text: 'Complete all daily missions this week',  category: 'streak',   xp: 220 },
];

const REWARDS = [
  { icon: '🏆', title: 'Challenge Champion', desc: 'Complete 3+ custom goals',           xp: 300 },
  { icon: '🔥', title: 'Streak Guardian',    desc: 'Hit your check-in target',           xp: 200 },
  { icon: '⭐', title: 'XP Surge',           desc: 'Earn 300+ XP from goals this week', xp: 100 },
  { icon: '🎯', title: 'Quiz Master',        desc: 'Hit your quiz target',              xp: 150 },
  { icon: '📚', title: 'Scholar',            desc: 'Hit your study hours target',       xp: 200 },
  { icon: '💎', title: 'Wellness Warrior',   desc: 'Complete a wellness goal',          xp: 80  },
];

const STORAGE_KEY = 'twinmind_weekly_goals';

function loadGoals(): CustomGoal[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as CustomGoal[]; } catch { return []; }
}
function persistGoals(goals: CustomGoal[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

const CONF_COLORS = ['#00D4FF','#7C3AED','#F59E0B','#10B981','#EF4444','#F97316','#EC4899','#6366f1'];
function makeConfetti() {
  return Array.from({ length: 60 }, (_, i) => ({
    id: i, x: Math.random() * 100,
    color: CONF_COLORS[i % CONF_COLORS.length],
    delay: Math.random() * 1.8, dur: 1.6 + Math.random() * 1.4,
    size: 6 + Math.random() * 8, round: i % 3 === 0,
  }));
}

export default function WeeklyChallengesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [weeklyData, setWeeklyData]   = useState<WeeklyChallengeData | null>(null);
  const [goals, setGoals]             = useState<CustomGoal[]>([]);
  const [tab, setTab]                 = useState<'goals'|'suggest'|'rewards'>('goals');
  const [catFilter, setCatFilter]     = useState('all');
  const [celebrating, setCelebrating] = useState(false);
  const [celebMsg, setCelebMsg]       = useState('');
  const [celebXP, setCelebXP]         = useState(0);
  const [confetti, setConfetti]       = useState<ReturnType<typeof makeConfetti>>([]);
  const [notifs, setNotifs]           = useState<Notif[]>([]);
  const [adding, setAdding]           = useState(false);
  const [addText, setAddText]         = useState('');
  const [addCat, setAddCat]           = useState('study');
  const [addXP, setAddXP]             = useState(50);
  const [editId, setEditId]           = useState<string|null>(null);
  const [editText, setEditText]       = useState('');
  const [showTargets, setShowTargets] = useState(false);
  const [chStudy, setChStudy]         = useState('');
  const [chQuiz, setChQuiz]           = useState('');
  const [chCheckin, setChCheckin]     = useState('');
  const [saving, setSaving]           = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setGoals(loadGoals());
    api.get<WeeklyChallengeData>('/gamification/weekly-challenge').then(r => setWeeklyData(r.data)).catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const pushNotif = useCallback((icon: string, title: string, body: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotifs(prev => [...prev.slice(-3), { id, icon, title, body }]);
    setTimeout(() => setNotifs(prev => prev.filter(n => n.id !== id)), 4200);
  }, []);

  const celebrate = useCallback((msg: string, xp: number) => {
    setCelebMsg(msg); setCelebXP(xp);
    setConfetti(makeConfetti()); setCelebrating(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCelebrating(false), 3800);
  }, []);

  function toggleGoal(id: string) {
    const g = goals.find(g => g.id === id); if (!g) return;
    const will = !g.done;
    const upd = goals.map(x => x.id === id ? { ...x, done: will } : x);
    setGoals(upd); persistGoals(upd);
    if (will) { celebrate('Weekly Challenge Completed!', g.xp); pushNotif('🎉', 'Challenge Complete!', `${g.text} — +${g.xp} XP`); }
  }

  function deleteGoal(id: string) {
    const upd = goals.filter(g => g.id !== id); setGoals(upd); persistGoals(upd);
  }

  function addGoal() {
    if (!addText.trim()) return;
    const g: CustomGoal = { id: `${Date.now()}`, text: addText.trim(), category: addCat, xp: addXP, done: false, createdAt: new Date().toISOString() };
    const upd = [...goals, g]; setGoals(upd); persistGoals(upd);
    setAddText(''); setAddCat('study'); setAddXP(50); setAdding(false);
    pushNotif('✅', 'Goal Added', addText.trim());
  }

  function addSuggestion(s: typeof SUGGESTIONS[number]) {
    if (goals.some(g => g.text === s.text)) return;
    const g: CustomGoal = { id: `${Date.now()}`, text: s.text, category: s.category, xp: s.xp, done: false, createdAt: new Date().toISOString() };
    const upd = [...goals, g]; setGoals(upd); persistGoals(upd);
    pushNotif('✅', 'Goal Added', s.text); setTab('goals');
  }

  function commitEdit() {
    if (!editId || !editText.trim()) { setEditId(null); return; }
    const upd = goals.map(g => g.id === editId ? { ...g, text: editText.trim() } : g);
    setGoals(upd); persistGoals(upd); setEditId(null);
  }

  async function saveTargets() {
    setSaving(true);
    try {
      await api.post('/gamification/weekly-challenge', {
        target_study_hours:  chStudy   ? parseFloat(chStudy)  : null,
        target_quiz_count:   chQuiz    ? parseInt(chQuiz)     : null,
        target_checkin_days: chCheckin ? parseInt(chCheckin)  : null,
      });
      const { data } = await api.get<WeeklyChallengeData>('/gamification/weekly-challenge');
      setWeeklyData(data); setShowTargets(false);
      setChStudy(''); setChQuiz(''); setChCheckin('');
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  if (!isOpen) return null;

  const doneCt  = goals.filter(g => g.done).length;
  const totalXP = goals.filter(g => g.done).reduce((s, g) => s + g.xp, 0);
  const filtSug = catFilter === 'all' ? SUGGESTIONS : SUGGESTIONS.filter(s => s.category === catFilter);
  const weekLabel = weeklyData?.week_start
    ? `Week of ${new Date(weeklyData.week_start + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : 'This Week';

  const tracked = [
    { icon: '⏱', label: 'Study Hours',   cur: weeklyData?.progress.study_hours  ?? 0, target: weeklyData?.targets?.study_hours  ?? null, unit: 'h', color: '#6366f1' },
    { icon: '🎯', label: 'Quizzes',       cur: weeklyData?.progress.quiz_count   ?? 0, target: weeklyData?.targets?.quiz_count   ?? null, unit: '',  color: '#00D4FF' },
    { icon: '✅', label: 'Check-in Days', cur: weeklyData?.progress.checkin_days ?? 0, target: weeklyData?.targets?.checkin_days ?? null, unit: 'd', color: '#10b981' },
  ];

  const rewardUnlocked = (r: typeof REWARDS[number], i: number) => {
    if (i === 0) return doneCt >= 3;
    if (i === 1) return !!(weeklyData?.targets?.checkin_days && weeklyData.progress.checkin_days >= weeklyData.targets.checkin_days);
    if (i === 2) return totalXP >= 300;
    if (i === 3) return !!(weeklyData?.targets?.quiz_count && weeklyData.progress.quiz_count >= weeklyData.targets.quiz_count);
    if (i === 4) return !!(weeklyData?.targets?.study_hours && weeklyData.progress.study_hours >= weeklyData.targets.study_hours);
    if (i === 5) return goals.some(g => g.category === 'wellness' && g.done);
    return false;
  };

  return (
    <>
      <style>{`
        @keyframes conf-fall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:0}}
        @keyframes cel-pop{0%{transform:scale(0.4) translateY(24px);opacity:0}60%{transform:scale(1.06) translateY(0);opacity:1}100%{transform:scale(1) translateY(0);opacity:1}}
        @keyframes notif-in{0%{transform:translateX(110%);opacity:0}18%{transform:translateX(0);opacity:1}80%{transform:translateX(0);opacity:1}100%{transform:translateX(110%);opacity:0}}
        @keyframes wc-slide{0%{opacity:0;transform:translateY(18px)}100%{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Confetti */}
      {celebrating && (
        <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:1000 }}>
          {confetti.map(p => (
            <div key={p.id} style={{ position:'absolute', top:'-20px', left:`${p.x}%`, width:`${p.size}px`, height:`${p.size}px`, background:p.color, borderRadius: p.round ? '50%' : '2px', animation:`conf-fall ${p.dur}s ${p.delay}s ease-in forwards` }} />
          ))}
        </div>
      )}

      {/* Celebration popup */}
      {celebrating && (
        <div style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:999, pointerEvents:'none' }}>
          <div style={{ background:'rgba(4,8,22,0.97)', border:'1px solid rgba(0,212,255,0.4)', borderRadius:'24px', padding:'2rem 2.75rem', textAlign:'center', backdropFilter:'blur(28px)', boxShadow:'0 0 60px rgba(0,212,255,0.25),0 20px 60px rgba(0,0,0,0.6)', animation:'cel-pop 0.45s cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}>
            <div style={{ fontSize:'3rem', marginBottom:'0.5rem' }}>🎉</div>
            <p style={{ margin:'0 0 0.3rem', fontSize:'1.25rem', fontWeight:900, color:'#f1f5f9' }}>{celebMsg}</p>
            <p style={{ margin:'0 0 0.1rem', fontSize:'1rem', fontWeight:700, color:'#00D4FF' }}>+{celebXP} XP Earned</p>
            <p style={{ margin:0, fontSize:'0.8rem', color:'rgba(148,163,184,0.55)' }}>🏆 New Badge Unlocked</p>
          </div>
        </div>
      )}

      {/* Notification stack */}
      <div style={{ position:'fixed', top:'80px', right:'1rem', display:'flex', flexDirection:'column', gap:'0.45rem', zIndex:600, pointerEvents:'none' }}>
        {notifs.map(n => (
          <div key={n.id} style={{ display:'flex', alignItems:'center', gap:'0.65rem', background:'rgba(4,8,22,0.97)', border:'1px solid rgba(0,212,255,0.22)', borderRadius:'14px', padding:'0.65rem 1rem', backdropFilter:'blur(20px)', boxShadow:'0 8px 32px rgba(0,0,0,0.5)', animation:'notif-in 4.2s ease forwards', minWidth:'240px', maxWidth:'320px' }}>
            <span style={{ fontSize:'1.2rem', flexShrink:0 }}>{n.icon}</span>
            <div>
              <p style={{ margin:0, fontSize:'0.8rem', fontWeight:700, color:'#f1f5f9' }}>{n.title}</p>
              <p style={{ margin:'0.1rem 0 0', fontSize:'0.7rem', color:'rgba(148,163,184,0.6)' }}>{n.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Overlay */}
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(10px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
        <div onClick={e => e.stopPropagation()} style={{ background:'rgba(4,8,22,0.97)', border:'1px solid rgba(0,212,255,0.18)', borderRadius:'28px', width:'100%', maxWidth:'820px', maxHeight:'88vh', display:'flex', flexDirection:'column', backdropFilter:'blur(28px) saturate(200%)', boxShadow:'0 0 0 1px rgba(0,212,255,0.06),0 32px 80px rgba(0,0,0,0.7)', animation:'wc-slide 0.3s ease forwards' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.35rem 1.75rem', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <div style={{ width:'40px', height:'40px', borderRadius:'11px', flexShrink:0, background:'linear-gradient(135deg,#00D4FF,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.15rem', boxShadow:'0 4px 18px rgba(0,212,255,0.35)' }}>🏋️</div>
              <div>
                <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:900, color:'#f1f5f9', letterSpacing:'-0.3px' }}>Weekly Challenges</h2>
                <p style={{ margin:0, fontSize:'0.68rem', color:'rgba(148,163,184,0.45)', fontWeight:500 }}>{weekLabel}</p>
              </div>
              {doneCt > 0 && (
                <span style={{ padding:'0.2rem 0.65rem', background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:'99px', fontSize:'0.7rem', fontWeight:700, color:'#10b981' }}>{doneCt} done · +{totalXP} XP</span>
              )}
            </div>
            <button onClick={onClose} style={{ background:'transparent', border:'none', color:'rgba(148,163,184,0.55)', fontSize:'1.3rem', cursor:'pointer', padding:'0.25rem 0.5rem', borderRadius:'8px', lineHeight:1, fontFamily:'inherit' }}>✕</button>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:'0.25rem', padding:'0.7rem 1.75rem', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
            {(['goals','suggest','rewards'] as const).map((k, i) => {
              const meta = [['🎯','My Goals'],['✨','AI Suggestions'],['🏆','Rewards']][i];
              const active = tab === k;
              return (
                <button key={k} onClick={() => setTab(k)} style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.42rem 0.9rem', borderRadius:'10px', background: active ? 'rgba(0,212,255,0.12)' : 'transparent', border: active ? '1px solid rgba(0,212,255,0.35)' : '1px solid transparent', color: active ? '#00D4FF' : 'rgba(148,163,184,0.55)', fontSize:'0.8rem', fontWeight: active ? 700 : 500, cursor:'pointer', fontFamily:'inherit', transition:'all 0.18s' }}>
                  <span>{meta[0]}</span><span>{meta[1]}</span>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div style={{ flex:1, overflowY:'auto', padding:'1.5rem 1.75rem', display:'flex', flexDirection:'column', gap:'1.35rem' }}>

            {/* ── GOALS TAB ── */}
            {tab === 'goals' && (
              <>
                {/* Auto-tracked */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.7rem' }}>
                    <p style={sLbl}>AUTO-TRACKED TARGETS</p>
                    <button onClick={() => setShowTargets(t => !t)} style={ghostBtn}>{showTargets ? 'Cancel' : 'Set Targets'}</button>
                  </div>

                  {showTargets && (
                    <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap', alignItems:'flex-end', marginBottom:'0.85rem', padding:'1rem', background:'rgba(0,212,255,0.05)', border:'1px solid rgba(0,212,255,0.15)', borderRadius:'14px' }}>
                      {[
                        { label:'Study Hours / week', val:chStudy,   set:setChStudy,   ph:'15' },
                        { label:'Quizzes / week',     val:chQuiz,    set:setChQuiz,    ph:'5'  },
                        { label:'Check-in days',      val:chCheckin, set:setChCheckin, ph:'7'  },
                      ].map(f => (
                        <label key={f.label} style={{ display:'flex', flexDirection:'column', gap:'0.2rem', fontSize:'0.72rem', color:'rgba(148,163,184,0.65)', fontWeight:500 }}>
                          {f.label}
                          <input type="number" value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} min={0} style={{ width:'88px', padding:'0.38rem 0.5rem', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', background:'rgba(255,255,255,0.05)', color:'#f1f5f9', fontSize:'0.82rem', outline:'none', fontFamily:'inherit' }} />
                        </label>
                      ))}
                      <button onClick={saveTargets} disabled={saving} style={{ ...accentBtn, alignSelf:'flex-end' }}>{saving ? 'Saving…' : 'Save Targets'}</button>
                    </div>
                  )}

                  <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
                    {tracked.map(m => {
                      const pct  = m.target ? Math.min(100, Math.round((m.cur / m.target) * 100)) : 0;
                      const done = m.target !== null && pct >= 100;
                      return (
                        <div key={m.label} style={{ padding:'0.9rem 1rem', background:'rgba(255,255,255,0.03)', border:`1px solid ${done ? m.color + '45' : 'rgba(255,255,255,0.07)'}`, borderRadius:'14px', transition:'border-color 0.3s' }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: m.target ? '0.55rem' : 0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                              <span style={{ fontSize:'1rem' }}>{m.icon}</span>
                              <span style={{ fontSize:'0.83rem', fontWeight:600, color:'#e2e8f0' }}>{m.label}</span>
                              {done && <span style={{ fontSize:'0.62rem', fontWeight:700, color:m.color, background:`${m.color}18`, border:`1px solid ${m.color}35`, borderRadius:'99px', padding:'0.1rem 0.45rem' }}>✓ Complete</span>}
                            </div>
                            <span style={{ fontSize:'0.8rem', fontWeight:700, color: done ? m.color : '#94a3b8' }}>
                              {m.cur}{m.unit}{m.target !== null ? ` / ${m.target}${m.unit}` : ' — no target set'}
                            </span>
                          </div>
                          {m.target !== null && (
                            <>
                              <div style={{ height:'6px', background:'rgba(255,255,255,0.07)', borderRadius:'99px', overflow:'hidden', marginBottom:'0.28rem' }}>
                                <div style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg,${m.color},${m.color}aa)`, borderRadius:'99px', transition:'width 0.7s ease', boxShadow:`0 0 8px ${m.color}55` }} />
                              </div>
                              <p style={{ margin:0, fontSize:'0.62rem', color:'rgba(148,163,184,0.4)', fontWeight:500 }}>{pct}% complete</p>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Custom goals */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.7rem' }}>
                    <p style={sLbl}>CUSTOM GOALS</p>
                    <button onClick={() => setAdding(a => !a)} style={ghostBtn}>{adding ? 'Cancel' : '+ Add Goal'}</button>
                  </div>

                  {adding && (
                    <div style={{ padding:'1rem', background:'rgba(0,212,255,0.05)', border:'1px solid rgba(0,212,255,0.15)', borderRadius:'14px', marginBottom:'0.75rem', display:'flex', flexDirection:'column', gap:'0.65rem' }}>
                      <input autoFocus value={addText} onChange={e => setAddText(e.target.value)} onKeyDown={e => { if (e.key==='Enter') addGoal(); if (e.key==='Escape') setAdding(false); }} placeholder="Describe your goal…" style={{ width:'100%', padding:'0.55rem 0.75rem', border:'1px solid rgba(0,212,255,0.25)', borderRadius:'10px', background:'rgba(255,255,255,0.04)', color:'#f1f5f9', fontSize:'0.85rem', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
                      <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'center' }}>
                        <select value={addCat} onChange={e => setAddCat(e.target.value)} style={{ padding:'0.38rem 0.55rem', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', background:'rgba(4,8,22,0.9)', color:'#94a3b8', fontSize:'0.78rem', cursor:'pointer', fontFamily:'inherit' }}>
                          {CATS.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                        </select>
                        <label style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.75rem', color:'rgba(148,163,184,0.6)' }}>
                          XP:
                          <input type="number" value={addXP} onChange={e => setAddXP(Number(e.target.value))} min={10} max={500} step={10} style={{ width:'62px', padding:'0.35rem 0.45rem', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', background:'rgba(255,255,255,0.04)', color:'#f1f5f9', fontSize:'0.8rem', outline:'none', fontFamily:'inherit' }} />
                        </label>
                        <button onClick={addGoal} disabled={!addText.trim()} style={{ ...accentBtn, opacity: addText.trim() ? 1 : 0.4 }}>Add Goal</button>
                      </div>
                    </div>
                  )}

                  {goals.length === 0 && !adding ? (
                    <div style={{ textAlign:'center', padding:'2rem 1rem', color:'rgba(148,163,184,0.38)' }}>
                      <p style={{ fontSize:'2rem', margin:'0 0 0.5rem' }}>🎯</p>
                      <p style={{ margin:0, fontSize:'0.85rem', fontWeight:600 }}>No custom goals yet</p>
                      <p style={{ margin:'0.3rem 0 0', fontSize:'0.75rem' }}>Add one above or grab an AI suggestion</p>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                      {goals.map(goal => {
                        const cat = CATS.find(c => c.key === goal.category);
                        return (
                          <div key={goal.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.8rem 1rem', borderRadius:'14px', background: goal.done ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)', border:`1px solid ${goal.done ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.07)'}`, transition:'all 0.2s' }}>
                            <button onClick={() => toggleGoal(goal.id)} style={{ width:'22px', height:'22px', borderRadius:'6px', flexShrink:0, background: goal.done ? '#10b981' : 'transparent', border:`2px solid ${goal.done ? '#10b981' : 'rgba(255,255,255,0.2)'}`, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'0.75rem', transition:'all 0.2s' }}>
                              {goal.done ? '✓' : ''}
                            </button>
                            <div style={{ flex:1, minWidth:0 }}>
                              {editId === goal.id ? (
                                <input autoFocus value={editText} onChange={e => setEditText(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key==='Enter') commitEdit(); if (e.key==='Escape') setEditId(null); }} style={{ width:'100%', padding:'0.25rem 0.4rem', border:'1px solid rgba(0,212,255,0.35)', borderRadius:'6px', background:'rgba(255,255,255,0.05)', color:'#f1f5f9', fontSize:'0.82rem', outline:'none', fontFamily:'inherit' }} />
                              ) : (
                                <p style={{ margin:0, fontSize:'0.82rem', fontWeight:500, color: goal.done ? 'rgba(148,163,184,0.45)' : '#e2e8f0', textDecoration: goal.done ? 'line-through' : 'none', lineHeight:1.35 }}>{goal.text}</p>
                              )}
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.45rem', flexShrink:0 }}>
                              {cat && <span style={{ fontSize:'0.65rem', padding:'0.15rem 0.5rem', borderRadius:'99px', background:`${cat.color}18`, color:cat.color, fontWeight:600, border:`1px solid ${cat.color}30` }}>{cat.icon} {cat.label}</span>}
                              <span style={{ fontSize:'0.7rem', color:'#f59e0b', fontWeight:700 }}>+{goal.xp}XP</span>
                              <button onClick={() => { setEditId(goal.id); setEditText(goal.text); }} style={{ background:'none', border:'none', color:'rgba(148,163,184,0.3)', cursor:'pointer', padding:'0.15rem', borderRadius:'5px', fontSize:'0.72rem' }}>✏️</button>
                              <button onClick={() => deleteGoal(goal.id)} style={{ background:'none', border:'none', color:'rgba(239,68,68,0.4)', cursor:'pointer', padding:'0.15rem', borderRadius:'5px', fontSize:'0.72rem' }}>🗑</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── SUGGESTIONS TAB ── */}
            {tab === 'suggest' && (
              <>
                <div>
                  <p style={{ ...sLbl, marginBottom:'0.65rem' }}>FILTER BY CATEGORY</p>
                  <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
                    <button onClick={() => setCatFilter('all')} style={{ ...filterChip, ...(catFilter==='all' ? activeChip : {}) }}>All</button>
                    {CATS.map(c => (
                      <button key={c.key} onClick={() => setCatFilter(c.key)} style={{ ...filterChip, ...(catFilter===c.key ? { background:`${c.color}18`, border:`1px solid ${c.color}45`, color:c.color } : {}) }}>
                        {c.icon} {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'0.75rem' }}>
                  {filtSug.map((s, i) => {
                    const cat    = CATS.find(c => c.key === s.category)!;
                    const exists = goals.some(g => g.text === s.text);
                    return (
                      <div key={i} style={{ padding:'1.1rem', background:'rgba(255,255,255,0.03)', border:`1px solid ${cat.color}28`, borderRadius:'16px', display:'flex', flexDirection:'column', gap:'0.55rem' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.45rem' }}>
                          <span style={{ fontSize:'1.05rem' }}>{cat.icon}</span>
                          <span style={{ fontSize:'0.63rem', fontWeight:700, color:cat.color, textTransform:'uppercase', letterSpacing:'0.08em' }}>{cat.label}</span>
                        </div>
                        <p style={{ margin:0, fontSize:'0.82rem', fontWeight:600, color:'#e2e8f0', lineHeight:1.45, flex:1 }}>{s.text}</p>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <span style={{ fontSize:'0.75rem', fontWeight:700, color:'#f59e0b' }}>+{s.xp} XP</span>
                          <button onClick={() => addSuggestion(s)} disabled={exists} style={{ padding:'0.3rem 0.75rem', borderRadius:'8px', fontSize:'0.72rem', fontWeight:700, background: exists ? 'rgba(16,185,129,0.1)' : `${cat.color}1c`, border:`1px solid ${exists ? 'rgba(16,185,129,0.3)' : cat.color+'45'}`, color: exists ? '#10b981' : cat.color, cursor: exists ? 'default' : 'pointer', fontFamily:'inherit' }}>
                            {exists ? '✓ Added' : '+ Add Goal'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── REWARDS TAB ── */}
            {tab === 'rewards' && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.75rem' }}>
                  {[
                    { icon:'⭐', val:totalXP,                      label:'XP Earned',   sub:'from goals', color:'#f59e0b', suffix:'' },
                    { icon:'✅', val:doneCt,                       label:'Goals Done',  sub:`of ${goals.length} total`, color:'#10b981', suffix:'' },
                    { icon:'📈', val:weeklyData?.completion_pct??0, label:'Tracked %',  sub:'target completion', color:'#00D4FF', suffix:'%' },
                  ].map(r => (
                    <div key={r.label} style={{ padding:'1.1rem', background:'rgba(255,255,255,0.03)', border:`1px solid ${r.color}28`, borderRadius:'16px', textAlign:'center' }}>
                      <p style={{ margin:'0 0 0.25rem', fontSize:'1.55rem' }}>{r.icon}</p>
                      <p style={{ margin:'0 0 0.1rem', fontSize:'1.45rem', fontWeight:900, color:r.color }}>{r.val}{r.suffix}</p>
                      <p style={{ margin:'0 0 0.05rem', fontSize:'0.72rem', fontWeight:700, color:'#e2e8f0' }}>{r.label}</p>
                      <p style={{ margin:0, fontSize:'0.62rem', color:'rgba(148,163,184,0.4)' }}>{r.sub}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p style={{ ...sLbl, marginBottom:'0.65rem' }}>AVAILABLE REWARDS</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.55rem' }}>
                    {REWARDS.map((r, i) => {
                      const unlocked = rewardUnlocked(r, i);
                      return (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'0.9rem 1rem', borderRadius:'14px', background: unlocked ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.03)', border:`1px solid ${unlocked ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
                          <span style={{ fontSize:'1.5rem', filter: unlocked ? 'none' : 'grayscale(1) opacity(0.35)', flexShrink:0 }}>{r.icon}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ margin:'0 0 0.1rem', fontSize:'0.85rem', fontWeight:700, color: unlocked ? '#10b981' : '#e2e8f0' }}>{r.title}</p>
                            <p style={{ margin:0, fontSize:'0.72rem', color:'rgba(148,163,184,0.5)' }}>{r.desc}</p>
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <p style={{ margin:'0 0 0.2rem', fontSize:'0.8rem', fontWeight:700, color:'#f59e0b' }}>+{r.xp} XP</p>
                            <span style={{ fontSize:'0.62rem', fontWeight:700, padding:'0.15rem 0.5rem', borderRadius:'99px', background: unlocked ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)', color: unlocked ? '#10b981' : 'rgba(148,163,184,0.45)', border:`1px solid ${unlocked ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}` }}>{unlocked ? '✓ Unlocked' : 'Locked'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p style={{ ...sLbl, marginBottom:'0.65rem' }}>PROGRESS BY CATEGORY</p>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'0.5rem' }}>
                    {CATS.map(c => {
                      const tot  = goals.filter(g => g.category === c.key).length;
                      const done = goals.filter(g => g.category === c.key && g.done).length;
                      const pct  = tot ? Math.round((done / tot) * 100) : 0;
                      return (
                        <div key={c.key} style={{ padding:'0.75rem 0.85rem', background:'rgba(255,255,255,0.03)', border:`1px solid ${c.color}22`, borderRadius:'12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.45rem' }}>
                            <span style={{ fontSize:'0.95rem' }}>{c.icon}</span>
                            <span style={{ fontSize:'0.7rem', fontWeight:700, color:c.color }}>{c.label}</span>
                          </div>
                          <p style={{ margin:'0 0 0.35rem', fontSize:'0.66rem', color:'rgba(148,163,184,0.45)' }}>{done}/{tot} goals done</p>
                          <div style={{ height:'4px', background:'rgba(255,255,255,0.07)', borderRadius:'99px', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${pct}%`, background:c.color, borderRadius:'99px', transition:'width 0.6s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const sLbl: React.CSSProperties = { margin:0, fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(148,163,184,0.32)' };

const ghostBtn: React.CSSProperties = { padding:'0.28rem 0.75rem', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', color:'rgba(148,163,184,0.65)', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit' };

const accentBtn: React.CSSProperties = { padding:'0.38rem 0.9rem', background:'linear-gradient(135deg,#00D4FF,#7C3AED)', border:'none', borderRadius:'9px', color:'#fff', fontSize:'0.78rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 16px rgba(0,212,255,0.25)' };

const filterChip: React.CSSProperties = { padding:'0.3rem 0.7rem', borderRadius:'99px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)', color:'rgba(148,163,184,0.55)', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.18s' };

const activeChip: React.CSSProperties = { background:'rgba(0,212,255,0.12)', border:'1px solid rgba(0,212,255,0.35)', color:'#00D4FF' };

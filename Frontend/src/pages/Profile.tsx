import { useRef, useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, THEMES } from '../contexts/ThemeContext';
import api from '../services/api';
import { BACKEND_URL } from '../lib/config';
import {
  getLevelColor, getLevelGradient,
  type GamificationProgress,
} from '../utils/gamification';

const BACKEND = BACKEND_URL;
type SectionId = 'overview'|'learning'|'gamification'|'connected'|'notifications'|'appearance'|'security'|'insights'|'privacy';

const SECTIONS: { id: SectionId; icon: string; label: string }[] = [
  { id:'overview',      icon:'👤', label:'Profile Overview'   },
  { id:'learning',      icon:'📚', label:'Learning Profile'   },
  { id:'gamification',  icon:'🏆', label:'Gamification'       },
  { id:'connected',     icon:'🔗', label:'Connected Accounts' },
  { id:'notifications', icon:'🔔', label:'Notifications'      },
  { id:'appearance',    icon:'🎨', label:'Appearance'         },
  { id:'security',      icon:'🔒', label:'Security'           },
  { id:'insights',      icon:'📊', label:'Account Insights'   },
  { id:'privacy',       icon:'💾', label:'Data & Privacy'     },
];

const LS = {
  get: (k: string, def = '') => { try { return localStorage.getItem(`tm_${k}`) ?? def; } catch { return def; } },
  set: (k: string, v: string) => { try { localStorage.setItem(`tm_${k}`, v); } catch { /**/ } },
  getBool: (k: string, def = false) => { try { const v = localStorage.getItem(`tm_${k}`); return v === null ? def : v === 'true'; } catch { return def; } },
  setBool: (k: string, v: boolean) => { try { localStorage.setItem(`tm_${k}`, String(v)); } catch { /**/ } },
};

interface CalStatus { configured: boolean; connected: boolean }
interface LearningEntry { study_hours: number; attendance_percentage: number; }
interface AchBadge { earned: boolean }

/* ── Toggle Switch ── */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch" aria-checked={on} onClick={() => onChange(!on)}
      style={{ width:'44px', height:'24px', borderRadius:'99px', background:on?'var(--primary)':'rgba(255,255,255,0.18)', border:'none', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}
    >
      <span style={{ position:'absolute', top:'3px', left: on?'23px':'3px', width:'18px', height:'18px', borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }} />
    </button>
  );
}

/* ── Section wrapper ── */
function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:'0.7rem', marginBottom:'1.6rem' }}>
        <div style={{ width:'38px', height:'38px', borderRadius:'11px', background:'rgba(var(--primary-rgb),0.18)', border:'1px solid rgba(var(--primary-rgb),0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.05rem', flexShrink:0, boxShadow:'0 4px 12px rgba(var(--primary-rgb),0.15)' }}>{icon}</div>
        <h2 style={{ margin:0, fontSize:'1.2rem', fontWeight:800, color:'#f1f5f9', letterSpacing:'-0.3px' }}>{title}</h2>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>{children}</div>
    </div>
  );
}

/* ── Glass Card ── */
function GCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="prof-gcard" style={{
      background:'rgba(4,8,22,0.91)',
      border:'1.5px solid rgba(var(--primary-rgb),0.22)',
      borderRadius:'18px',
      padding:'1.35rem 1.5rem',
      backdropFilter:'blur(32px)',
      WebkitBackdropFilter:'blur(32px)',
      boxShadow:'0 16px 56px rgba(0,0,0,0.75), 0 0 0 1px rgba(var(--primary-rgb),0.07)',
      transition:'transform 0.2s ease, box-shadow 0.2s ease',
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ── Form field ── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display:'flex', flexDirection:'column', gap:'0.38rem' }}>
      <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</span>
      {children}
    </label>
  );
}

const inp: React.CSSProperties = { padding:'0.65rem 0.9rem', border:'1.5px solid rgba(var(--primary-rgb),0.2)', borderRadius:'10px', fontSize:'0.9rem', color:'#f1f5f9', background:'rgba(0,0,0,0.42)', outline:'none', width:'100%', boxSizing:'border-box' as const, fontFamily:'inherit', transition:'border-color 0.18s, box-shadow 0.18s' };
const pri: React.CSSProperties = { padding:'0.58rem 1.4rem', background:'linear-gradient(135deg,var(--primary),rgba(var(--primary-rgb),0.75))', color:'#fff', border:'none', borderRadius:'10px', fontSize:'0.88rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit', alignSelf:'flex-start', boxShadow:'0 4px 18px rgba(var(--primary-rgb),0.4)' };
const sec: React.CSSProperties = { padding:'0.52rem 1.1rem', background:'rgba(255,255,255,0.07)', color:'#e2e8f0', border:'1.5px solid rgba(255,255,255,0.15)', borderRadius:'10px', fontSize:'0.82rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit', alignSelf:'flex-start' };
const msgOk: React.CSSProperties  = { margin:'0.5rem 0 0', padding:'0.5rem 0.9rem', background:'rgba(16,185,129,0.14)', border:'1px solid rgba(16,185,129,0.4)', borderRadius:'9px', color:'#34d399', fontSize:'0.82rem', fontWeight:500 };
const msgErr: React.CSSProperties = { margin:'0.5rem 0 0', padding:'0.5rem 0.9rem', background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:'9px', color:'#f87171', fontSize:'0.82rem', fontWeight:500 };

/* ══════════════════════════════════════════════
   MAIN PROFILE COMPONENT
   ══════════════════════════════════════════════ */
export default function Profile() {
  const { user, token, studentProfile, refreshUser, refreshStudentProfile, logout } = useAuth();
  const { themeId, setTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Backend data ──
  const [gamProgress, setGamProgress] = useState<GamificationProgress|null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [noteCount,    setNoteCount]    = useState(0);
  const [badgeCount,   setBadgeCount]   = useState(0);
  const [entries,      setEntries]      = useState<LearningEntry[]>([]);
  const [calStatus,    setCalStatus]    = useState<CalStatus|null>(null);

  // ── Profile fields ──
  const [fullName,    setFullName]    = useState(user?.full_name ?? '');
  const [phone,       setPhone]       = useState(() => LS.get('phone'));
  const [linkedin,    setLinkedin]    = useState(() => LS.get('linkedin'));
  const [country,     setCountry]     = useState(() => LS.get('country'));
  const [timezone,    setTimezone]    = useState(() => LS.get('timezone'));

  // ── Learning fields ──
  const [course,         setCourse]        = useState(studentProfile?.course ?? '');
  const [institution,    setInstitution]   = useState(studentProfile?.institution ?? '');
  const [semester,       setSemester]      = useState(studentProfile?.semester ?? '');
  const [academicGoals,  setAcademicGoals] = useState(studentProfile?.academic_goals ?? '');
  const [careerGoal,     setCareerGoal]    = useState(() => LS.get('career_goal'));
  const [learningStyle,  setLearningStyle] = useState(() => LS.get('learning_style', 'Visual'));
  const [dailyGoal,      setDailyGoal]     = useState(() => LS.get('daily_goal', '2'));
  const [weeklyGoal,     setWeeklyGoal]    = useState(() => LS.get('weekly_goal', '14'));
  const [targetScore,    setTargetScore]   = useState(() => LS.get('target_score'));

  // ── Notification toggles ──
  const [notifStudy,     setNotifStudy]     = useState(() => LS.getBool('notif_study', true));
  const [notifChallenge, setNotifChallenge] = useState(() => LS.getBool('notif_challenge', true));
  const [notifGoal,      setNotifGoal]      = useState(() => LS.getBool('notif_goal', true));
  const [notifStreak,    setNotifStreak]    = useState(() => LS.getBool('notif_streak', true));
  const [notifMentor,    setNotifMentor]    = useState(() => LS.getBool('notif_mentor', false));
  const [notifEmail,     setNotifEmail]     = useState(() => LS.getBool('notif_email', false));
  const [notifPush,      setNotifPush]      = useState(() => LS.getBool('notif_push', false));

  // ── Appearance toggles ──
  const [compactMode,  setCompactMode]  = useState(() => LS.getBool('compact', false));
  const [animations,   setAnimations]   = useState(() => LS.getBool('animations', true));
  const [particles,    setParticles]    = useState(() => LS.getBool('particles', true));

  // ── Status messages ──
  const [nameMsg,      setNameMsg]      = useState<{ ok: boolean; text: string }|null>(null);
  const [avatarMsg,    setAvatarMsg]    = useState<{ ok: boolean; text: string }|null>(null);
  const [learnMsg,     setLearnMsg]     = useState<{ ok: boolean; text: string }|null>(null);
  const [pwMsg,        setPwMsg]        = useState<{ ok: boolean; text: string }|null>(null);
  const [calMsg,       setCalMsg]       = useState<{ ok: boolean; text: string }|null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [nameSaving,   setNameSaving]   = useState(false);
  const [learnSaving,  setLearnSaving]  = useState(false);
  const [pwSaving,     setPwSaving]     = useState(false);
  const [syncing,      setSyncing]      = useState(false);
  const [currentPw,    setCurrentPw]    = useState('');
  const [newPw,        setNewPw]        = useState('');
  const [confirmPw,    setConfirmPw]    = useState('');

  // ── Calendar reminder ──
  const [remTitle, setRemTitle] = useState('');
  const [remDate,  setRemDate]  = useState('');
  const [remTime,  setRemTime]  = useState('');
  const [remMsg,   setRemMsg]   = useState<{ ok: boolean; text: string }|null>(null);
  const [addingRem, setAddingRem] = useState(false);

  const avatarSrc = user?.avatar_url ? BACKEND + user.avatar_url : null;
  const initials = (user?.full_name ?? '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);

  const loadData = useCallback(async () => {
    await Promise.allSettled([
      api.get<GamificationProgress>('/gamification/progress').then(r => setGamProgress(r.data)),
      api.get<unknown[]>('/sessions').then(r => setSessionCount(r.data.length)),
      api.get<unknown[]>('/notes').then(r => setNoteCount(r.data.length)),
      api.get<AchBadge[]>('/achievements').then(r => setBadgeCount(r.data.filter((b:AchBadge) => b.earned).length)),
      api.get<LearningEntry[]>('/learning-data?limit=60').then(r => setEntries(r.data)),
      api.get<CalStatus>('/calendar/status').then(r => setCalStatus(r.data)),
    ]);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Sync studentProfile into form fields when it loads
  useEffect(() => {
    if (!studentProfile) return;
    setCourse(studentProfile.course ?? '');
    setInstitution(studentProfile.institution ?? '');
    setSemester(studentProfile.semester ?? '');
    setAcademicGoals(studentProfile.academic_goals ?? '');
  }, [studentProfile]);

  useEffect(() => { setFullName(user?.full_name ?? ''); }, [user]);

  // Calendar OAuth callback
  useEffect(() => {
    const cal = searchParams.get('calendar');
    if (cal === 'connected') { setCalMsg({ ok:true, text:'Google Calendar connected!' }); setSearchParams({}, { replace:true }); setActiveSection('connected'); }
    if (cal === 'error')     { setCalMsg({ ok:false, text:'Failed to connect Google Calendar.' }); setSearchParams({}, { replace:true }); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Profile completion ──
  const completionFields = [
    !!user?.full_name,
    !!avatarSrc,
    !!studentProfile?.course,
    !!studentProfile?.institution,
    !!studentProfile?.semester,
    !!studentProfile?.academic_goals,
    (studentProfile?.subjects?.length ?? 0) > 0,
    !!phone,
    !!linkedin,
    !!country,
    !!careerGoal,
    !!learningStyle,
    !!dailyGoal,
    !!targetScore,
    !!timezone,
  ];
  const completionPct = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);
  const completionColor = completionPct === 100 ? '#ffd700' : completionPct >= 70 ? '#10b981' : completionPct >= 40 ? '#f59e0b' : '#ef4444';

  // ── Derived analytics ──
  const totalHours  = Math.round(entries.reduce((s,e) => s+e.study_hours, 0));
  const avgAtt      = entries.length ? Math.round(entries.reduce((s,e) => s+e.attendance_percentage, 0) / entries.length) : 0;
  const joinDate    = user ? 'Jun 2025' : '—';

  // ── Handlers ──
  async function saveName(e: FormEvent) {
    e.preventDefault(); setNameMsg(null); setNameSaving(true);
    try {
      await api.put('/auth/me', { full_name: fullName }, { headers: { Authorization: `Bearer ${token}` } });
      await refreshUser();
      setNameMsg({ ok:true, text:'Name updated successfully.' });
    } catch { setNameMsg({ ok:false, text:'Failed to update name.' }); }
    finally { setNameSaving(false); }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setAvatarMsg(null); setAvatarUploading(true);
    try {
      const form = new FormData(); form.append('file', file);
      await api.post('/auth/me/avatar', form, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      await refreshUser();
      setAvatarMsg({ ok:true, text:'Profile picture updated.' });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAvatarMsg({ ok:false, text: detail ?? 'Upload failed.' });
    } finally { setAvatarUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  async function saveLearning(e: FormEvent) {
    e.preventDefault(); setLearnMsg(null); setLearnSaving(true);
    LS.set('career_goal', careerGoal); LS.set('learning_style', learningStyle);
    LS.set('daily_goal', dailyGoal); LS.set('weekly_goal', weeklyGoal); LS.set('target_score', targetScore);
    const payload = { institution, course, semester, academic_goals: academicGoals, learning_preferences: learningStyle, subjects: studentProfile?.subjects ?? [] };
    try {
      if (studentProfile) await api.put('/student-profile', payload, { headers: { Authorization: `Bearer ${token}` } });
      else await api.post('/student-profile', payload, { headers: { Authorization: `Bearer ${token}` } });
      await refreshStudentProfile();
      setLearnMsg({ ok:true, text:'Learning profile saved.' });
    } catch { setLearnMsg({ ok:false, text:'Failed to save learning profile.' }); }
    finally { setLearnSaving(false); }
  }

  function savePersonal() {
    LS.set('phone', phone); LS.set('linkedin', linkedin); LS.set('country', country); LS.set('timezone', timezone);
    setNameMsg({ ok:true, text:'Personal info saved.' });
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault(); setPwMsg(null);
    if (newPw.length < 8) { setPwMsg({ ok:false, text:'New password must be at least 8 characters.' }); return; }
    if (newPw !== confirmPw) { setPwMsg({ ok:false, text:'Passwords do not match.' }); return; }
    setPwSaving(true);
    try {
      await api.put('/auth/me', { current_password: currentPw, new_password: newPw }, { headers: { Authorization: `Bearer ${token}` } });
      setPwMsg({ ok:true, text:'Password changed successfully.' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setPwMsg({ ok:false, text: detail ?? 'Failed to change password.' });
    } finally { setPwSaving(false); }
  }

  async function connectCalendar() {
    try { const { data } = await api.get<{ auth_url: string }>('/calendar/auth-url'); window.location.href = data.auth_url; }
    catch { setCalMsg({ ok:false, text:'Failed to get auth URL.' }); }
  }
  async function disconnectCalendar() {
    try { await api.post('/calendar/disconnect'); setCalStatus(s => s ? { ...s, connected:false } : s); setCalMsg({ ok:true, text:'Disconnected.' }); }
    catch { setCalMsg({ ok:false, text:'Failed to disconnect.' }); }
  }
  async function syncPlan() {
    setSyncing(true);
    try { const { data } = await api.post<{ events_created: number }>('/calendar/sync-study-plan'); setCalMsg({ ok:true, text:`${data.events_created} calendar events created!` }); }
    catch { setCalMsg({ ok:false, text:'Sync failed.' }); }
    finally { setSyncing(false); }
  }
  async function addReminder(e: FormEvent) {
    e.preventDefault(); setAddingRem(true); setRemMsg(null);
    try {
      await api.post('/calendar/add-reminder', { title: remTitle, date: remDate, time: remTime });
      setRemMsg({ ok:true, text:'Reminder added to Google Calendar!' });
      setRemTitle(''); setRemDate(''); setRemTime('');
    } catch { setRemMsg({ ok:false, text:'Failed to add reminder.' }); }
    finally { setAddingRem(false); }
  }

  const LEARNING_STYLES = ['Visual', 'Reading/Writing', 'Audio', 'Practical'];

  return (
    <div style={{ minHeight:'100svh', background:'var(--bg)', display:'flex', flexDirection:'column', fontFamily:"'Inter', sans-serif", position:'relative' }}>
      <div className="prof-scrim" />
      <div className="prof-above-scrim">
      <style>{`
        /* ── Scrim: darken particle bg behind profile content ── */
        .prof-scrim { position: fixed; inset: 0; background: rgba(2,4,15,0.55); z-index: 0; pointer-events: none; }
        .prof-above-scrim { position: relative; z-index: 1; display: flex; flex-direction: column; flex: 1; }

        /* ── Sidebar nav ── */
        .prof-nav-item { color: rgba(203,213,225,0.82) !important; }
        .prof-nav-item:hover { background: rgba(var(--primary-rgb),0.13) !important; color: #f1f5f9 !important; }

        /* ── Cards: hover elevation ── */
        .prof-gcard:hover { transform: translateY(-2px); box-shadow: 0 22px 65px rgba(0,0,0,0.82), 0 0 0 1px rgba(var(--primary-rgb),0.22) !important; }

        /* ── Inputs ── */
        .prof-inp::placeholder { color: rgba(148,163,184,0.55) !important; }
        .prof-inp:focus { border-color: rgba(var(--primary-rgb),0.6) !important; box-shadow: 0 0 0 3px rgba(var(--primary-rgb),0.12) !important; background: rgba(0,0,0,0.5) !important; }

        /* ── Theme picker ── */
        .prof-theme-btn:hover { border-color: rgba(var(--primary-rgb),0.4) !important; transform: translateY(-2px); box-shadow: 0 8px 28px rgba(var(--primary-rgb),0.18) !important; }

        /* ── Section entrance ── */
        @keyframes prof-slide { from { opacity:0; transform:translateX(-10px); } to { opacity:1; transform:translateX(0); } }
        .prof-section-anim { animation: prof-slide 0.22s ease forwards; }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .prof-layout { flex-direction: column !important; }
          .prof-sidebar { width: 100% !important; position: static !important; flex-direction: row !important; overflow-x: auto; flex-wrap: nowrap !important; border-right: none !important; border-bottom: 1px solid rgba(var(--primary-rgb),0.15) !important; padding: 0.5rem !important; gap: 0.25rem !important; }
          .prof-sidebar-item { flex-direction: row !important; padding: 0.45rem 0.7rem !important; white-space: nowrap; min-width: fit-content; }
          .prof-sidebar-label { font-size: 0.72rem !important; }
          .prof-content { padding: 1.25rem !important; }
          .prof-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Top nav bar ── */}
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1.5rem', height:'58px', borderBottom:'1px solid var(--card-border)', background:'rgba(var(--bg-rgb,4,8,22),0.92)', backdropFilter:'blur(20px)', position:'sticky', top:0, zIndex:30, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.65rem' }}>
          <Link to="/" style={{ fontSize:'1.05rem', fontWeight:900, color:'var(--primary)', textDecoration:'none', letterSpacing:'-0.5px' }}>◈ TwinMind</Link>
          <span style={{ width:'1px', height:'16px', background:'rgba(255,255,255,0.1)' }} />
          <span style={{ fontSize:'0.82rem', fontWeight:600, color:'rgba(203,213,225,0.8)' }}>Profile & Settings</span>
        </div>
        <Link to="/" style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--primary)', textDecoration:'none', padding:'0.32rem 0.85rem', border:'1px solid rgba(var(--primary-rgb),0.25)', borderRadius:'8px', transition:'all 0.18s' }}>← Dashboard</Link>
      </header>

      {/* ── Profile completion banner ── */}
      <div style={{ padding:'0.9rem 1.5rem', background:'rgba(4,8,22,0.82)', borderBottom:'1.5px solid rgba(var(--primary-rgb),0.15)', flexShrink:0, backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto', display:'flex', alignItems:'center', gap:'1.5rem' }}>
          <div style={{ flexShrink:0, minWidth:'80px' }}>
            <span style={{ fontSize:'0.65rem', fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', display:'block' }}>Profile Strength</span>
            <div style={{ display:'flex', alignItems:'center', gap:'0.55rem', marginTop:'0.2rem' }}>
              <span style={{ fontSize:'1.6rem', fontWeight:900, color:completionColor, lineHeight:1, textShadow:`0 0 18px ${completionColor}88` }}>{completionPct}%</span>
              {completionPct === 100 && <span style={{ fontSize:'0.72rem', background:'linear-gradient(135deg,#ffd700,#f59e0b)', padding:'0.15rem 0.6rem', borderRadius:'99px', color:'#0f172a', fontWeight:800, boxShadow:'0 0 14px rgba(255,215,0,0.45)' }}>✨ Complete</span>}
            </div>
          </div>
          <div style={{ flex:1, height:'10px', background:'rgba(255,255,255,0.07)', borderRadius:'99px', overflow:'hidden', boxShadow:'inset 0 1px 4px rgba(0,0,0,0.45)' }}>
            <div style={{ height:'100%', width:`${completionPct}%`, background: completionPct===100?'linear-gradient(90deg,#ffd700,#f59e0b)':completionPct>=70?'linear-gradient(90deg,#10b981,#34d399)':completionPct>=40?'linear-gradient(90deg,#f59e0b,#fbbf24)':'linear-gradient(90deg,#ef4444,#f97316)', borderRadius:'99px', transition:'width 0.7s ease', boxShadow: completionPct===100?'0 0 16px rgba(255,215,0,0.65)':completionPct>=70?'0 0 12px rgba(16,185,129,0.55)':'0 0 10px rgba(245,158,11,0.5)' }} />
          </div>
          <span style={{ fontSize:'0.75rem', color:'#94a3b8', flexShrink:0, fontWeight:600 }}>{completionFields.filter(Boolean).length}<span style={{ color:'rgba(148,163,184,0.5)' }}>/{completionFields.length}</span></span>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="prof-layout" style={{ flex:1, display:'flex', maxWidth:'1100px', width:'100%', margin:'0 auto', alignItems:'flex-start' }}>

        {/* ── Sidebar ── */}
        <nav className="prof-sidebar" style={{ width:'230px', flexShrink:0, borderRight:'1.5px solid rgba(var(--primary-rgb),0.12)', padding:'1.25rem 0.75rem', display:'flex', flexDirection:'column', gap:'0.25rem', position:'sticky', top:'58px', maxHeight:'calc(100svh - 58px - 63px)', overflowY:'auto', background:'rgba(2,4,15,0.45)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)' }}>
          {SECTIONS.map(sec => {
            const active = activeSection === sec.id;
            return (
              <button key={sec.id} className={`prof-nav-item prof-sidebar-item`} onClick={() => setActiveSection(sec.id)}
                style={{ display:'flex', alignItems:'center', gap:'0.65rem', padding:'0.62rem 0.88rem', borderRadius:'11px', border:'none', background:active?'rgba(var(--primary-rgb),0.16)':'transparent', color:active?'var(--primary)':'rgba(203,213,225,0.78)', fontFamily:'inherit', cursor:'pointer', textAlign:'left', transition:'all 0.15s', width:'100%', boxShadow:active?`inset 0 0 0 1.5px rgba(var(--primary-rgb),0.3), 0 4px 16px rgba(var(--primary-rgb),0.12)`:'none' }}>
                <span style={{ fontSize:'0.95rem', flexShrink:0 }}>{sec.icon}</span>
                <span className="prof-sidebar-label" style={{ fontSize:'0.81rem', fontWeight: active?700:500, lineHeight:1.2 }}>{sec.label}</span>
                {active && <div style={{ marginLeft:'auto', width:'3px', height:'22px', borderRadius:'99px', background:'var(--primary)', flexShrink:0, boxShadow:'0 0 8px rgba(var(--primary-rgb),0.8)' }} />}
              </button>
            );
          })}
          <div style={{ marginTop:'auto', paddingTop:'1rem', borderTop:'1px solid rgba(var(--primary-rgb),0.12)' }}>
            <button onClick={logout} style={{ ...sec, width:'100%', textAlign:'center', justifyContent:'center', color:'#fca5a5', border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.1)' }}>Sign Out</button>
          </div>
        </nav>

        {/* ── Content ── */}
        <div className="prof-content" style={{ flex:1, padding:'2rem 2.5rem', minWidth:0 }}>

          {/* ═════════════ OVERVIEW ═════════════ */}
          {activeSection === 'overview' && (
            <div key="overview" className="prof-section-anim">
              <Section title="Profile Overview" icon="👤">

                {/* Avatar hero card */}
                <GCard style={{ display:'flex', alignItems:'flex-start', gap:'1.75rem', background:'linear-gradient(135deg,rgba(var(--primary-rgb),0.09),rgba(124,58,237,0.06))', border:'1.5px solid rgba(var(--primary-rgb),0.25)' }}>
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <div onClick={() => !avatarUploading && fileInputRef.current?.click()} title="Click to change" style={{ width:'106px', height:'106px', borderRadius:'50%', cursor:'pointer', overflow:'hidden', border:'3px solid rgba(var(--primary-rgb),0.45)', boxShadow:'0 0 0 1px rgba(var(--primary-rgb),0.2), 0 0 32px rgba(var(--primary-rgb),0.35)', position:'relative' }}>
                      {avatarSrc ? <img src={avatarSrc} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} /> : <div style={{ width:'100%', height:'100%', background:'linear-gradient(135deg,rgba(var(--primary-rgb),0.25),rgba(124,58,237,0.3))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.1rem', fontWeight:800, color:'var(--primary)' }}>{initials}</div>}
                      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'opacity 0.15s', fontSize:'1.4rem', borderRadius:'50%' }} className="avatar-overlay">📷</div>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display:'none' }} onChange={handleAvatarChange} />
                    {avatarUploading && <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', borderRadius:'50%', fontSize:'0.85rem', color:'#fff', fontWeight:700 }}>Uploading…</div>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.65rem', flexWrap:'wrap', marginBottom:'0.3rem' }}>
                      <h3 style={{ margin:0, fontSize:'1.4rem', fontWeight:900, color:'#ffffff' }}>{user?.full_name || 'Your Name'}</h3>
                      {gamProgress && (
                        <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', padding:'0.2rem 0.65rem', background:getLevelGradient(gamProgress.level), borderRadius:'99px', boxShadow:`0 0 12px ${getLevelColor(gamProgress.level)}44` }}>
                          <span style={{ fontSize:'0.68rem', fontWeight:900, color:'#fff' }}>Lv.{gamProgress.level}</span>
                          <span style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.88)', fontWeight:600 }}>{gamProgress.level_name}</span>
                        </div>
                      )}
                    </div>
                    <p style={{ margin:'0 0 0.45rem', fontSize:'0.88rem', color:'#cbd5e1', fontWeight:500 }}>{user?.email}</p>
                    {studentProfile?.course && <p style={{ margin:'0 0 0.2rem', fontSize:'0.82rem', color:'var(--primary)', fontWeight:700 }}>{studentProfile.course}{studentProfile.semester ? ` · ${studentProfile.semester}` : ''}</p>}
                    {studentProfile?.institution && <p style={{ margin:0, fontSize:'0.78rem', color:'#94a3b8', fontWeight:500 }}>🏛 {studentProfile.institution}</p>}
                    {avatarMsg && <p style={avatarMsg.ok ? msgOk : msgErr}>{avatarMsg.text}</p>}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', alignItems:'flex-end', flexShrink:0 }}>
                    <div style={{ textAlign:'right' }}>
                      <p style={{ margin:'0 0 0.06rem', fontSize:'1.6rem', fontWeight:900, color:completionColor, lineHeight:1, textShadow:`0 0 16px ${completionColor}66` }}>{completionPct}%</p>
                      <p style={{ margin:0, fontSize:'0.62rem', color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Profile Complete</p>
                    </div>
                    <p style={{ margin:0, fontSize:'0.7rem', color:'#94a3b8' }}>Joined {joinDate}</p>
                  </div>
                </GCard>

                {/* Stat chips row */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'0.7rem' }}>
                  {[
                    { icon:'⭐', label:'Total XP',       value:gamProgress ? `${gamProgress.xp.toLocaleString()} XP` : '—', color:'#f59e0b' },
                    { icon:'🔥', label:'Current Streak',  value:gamProgress ? `${gamProgress.streak_days} days` : '—',       color:'#ef4444' },
                    { icon:'🏅', label:'Badges Earned',   value:`${badgeCount}`,                                               color:'#8b5cf6' },
                    { icon:'▶',  label:'Sessions',        value:`${sessionCount}`,                                             color:'#00D4FF' },
                    { icon:'📝', label:'Smart Notes',     value:`${noteCount}`,                                               color:'#10b981' },
                    { icon:'⏱', label:'Study Hours',     value:`${totalHours}h`,                                             color:'#6366f1' },
                  ].map(s => (
                    <GCard key={s.label} style={{ textAlign:'center', padding:'1rem 0.75rem', border:`1.5px solid ${s.color}44`, boxShadow:`0 8px 28px rgba(0,0,0,0.6), 0 0 0 1px ${s.color}18, 0 0 20px ${s.color}12` }}>
                      <p style={{ margin:'0 0 0.28rem', fontSize:'1.3rem' }}>{s.icon}</p>
                      <p style={{ margin:'0 0 0.12rem', fontSize:'1.45rem', fontWeight:900, color:s.color, lineHeight:1, textShadow:`0 0 14px ${s.color}88` }}>{s.value}</p>
                      <p style={{ margin:0, fontSize:'0.62rem', color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{s.label}</p>
                    </GCard>
                  ))}
                </div>

                {/* Edit name + personal */}
                <GCard>
                  <h3 style={{ margin:'0 0 1rem', fontSize:'0.92rem', fontWeight:700, color:'#f1f5f9' }}>Personal Information</h3>
                  <form onSubmit={saveName} style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
                    <div className="prof-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                      <Field label="Full Name">
                        <input className="prof-inp" value={fullName} onChange={e=>setFullName(e.target.value)} style={inp} placeholder="Your full name" required />
                      </Field>
                      <Field label="Email Address">
                        <input className="prof-inp" value={user?.email ?? ''} readOnly style={{ ...inp, opacity:0.55, cursor:'not-allowed' }} />
                      </Field>
                      <Field label="Mobile Number">
                        <input className="prof-inp" value={phone} onChange={e=>setPhone(e.target.value)} style={inp} placeholder="+91 98765 43210" />
                      </Field>
                      <Field label="LinkedIn URL">
                        <input className="prof-inp" value={linkedin} onChange={e=>setLinkedin(e.target.value)} style={inp} placeholder="linkedin.com/in/username" />
                      </Field>
                      <Field label="Country">
                        <input className="prof-inp" value={country} onChange={e=>setCountry(e.target.value)} style={inp} placeholder="India" />
                      </Field>
                      <Field label="Time Zone">
                        <input className="prof-inp" value={timezone} onChange={e=>setTimezone(e.target.value)} style={inp} placeholder="Asia/Kolkata" />
                      </Field>
                    </div>
                    {nameMsg && <p style={nameMsg.ok ? msgOk : msgErr}>{nameMsg.text}</p>}
                    <div style={{ display:'flex', gap:'0.65rem' }}>
                      <button type="submit" style={pri} disabled={nameSaving}>{nameSaving ? 'Saving…' : 'Save Changes'}</button>
                      <button type="button" style={sec} onClick={savePersonal}>Save Personal Info</button>
                    </div>
                  </form>
                </GCard>
              </Section>
            </div>
          )}

          {/* ═════════════ LEARNING ═════════════ */}
          {activeSection === 'learning' && (
            <div key="learning" className="prof-section-anim">
              <Section title="Learning Profile" icon="📚">
                <GCard>
                  <form onSubmit={saveLearning} style={{ display:'flex', flexDirection:'column', gap:'0.9rem' }}>
                    <div className="prof-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                      <Field label="Degree / Course">
                        <input className="prof-inp" value={course} onChange={e=>setCourse(e.target.value)} style={inp} placeholder="B.Tech Computer Science" />
                      </Field>
                      <Field label="Institution / University">
                        <input className="prof-inp" value={institution} onChange={e=>setInstitution(e.target.value)} style={inp} placeholder="IIT Delhi" />
                      </Field>
                      <Field label="Current Semester / Year">
                        <input className="prof-inp" value={semester} onChange={e=>setSemester(e.target.value)} style={inp} placeholder="Semester 5" />
                      </Field>
                      <Field label="Career Goal">
                        <input className="prof-inp" value={careerGoal} onChange={e=>setCareerGoal(e.target.value)} style={inp} placeholder="Software Engineer at Google" />
                      </Field>
                    </div>
                    <Field label="Academic Goals">
                      <textarea className="prof-inp" value={academicGoals} onChange={e=>setAcademicGoals(e.target.value)} style={{ ...inp, minHeight:'72px', resize:'vertical' }} placeholder="Describe your academic goals…" />
                    </Field>

                    {/* Learning style */}
                    <div>
                      <span style={{ fontSize:'0.72rem', fontWeight:700, color:'rgba(148,163,184,0.65)', textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:'0.55rem' }}>Preferred Learning Style</span>
                      <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                        {LEARNING_STYLES.map(style => (
                          <button key={style} type="button" onClick={()=>setLearningStyle(style)}
                            style={{ padding:'0.38rem 0.85rem', borderRadius:'99px', border:`1px solid ${learningStyle===style?'rgba(var(--primary-rgb),0.5)':'rgba(255,255,255,0.1)'}`, background:learningStyle===style?'rgba(var(--primary-rgb),0.14)':'rgba(255,255,255,0.04)', color:learningStyle===style?'var(--primary)':'rgba(148,163,184,0.6)', fontSize:'0.8rem', fontWeight:learningStyle===style?700:500, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Study goals */}
                    <div className="prof-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.75rem' }}>
                      <Field label="Daily Study Goal (hrs)">
                        <input className="prof-inp" type="number" min="0.5" max="24" step="0.5" value={dailyGoal} onChange={e=>setDailyGoal(e.target.value)} style={inp} />
                      </Field>
                      <Field label="Weekly Study Goal (hrs)">
                        <input className="prof-inp" type="number" min="1" max="168" step="1" value={weeklyGoal} onChange={e=>setWeeklyGoal(e.target.value)} style={inp} />
                      </Field>
                      <Field label="Target Score / GPA">
                        <input className="prof-inp" value={targetScore} onChange={e=>setTargetScore(e.target.value)} style={inp} placeholder="9.0 / 90%" />
                      </Field>
                    </div>

                    {learnMsg && <p style={learnMsg.ok ? msgOk : msgErr}>{learnMsg.text}</p>}
                    <button type="submit" style={pri} disabled={learnSaving}>{learnSaving ? 'Saving…' : 'Save Learning Profile'}</button>
                  </form>
                </GCard>
              </Section>
            </div>
          )}

          {/* ═════════════ GAMIFICATION ═════════════ */}
          {activeSection === 'gamification' && (
            <div key="gamification" className="prof-section-anim">
              <Section title="Gamification Profile" icon="🏆">
                {gamProgress && (
                  <>
                    {/* Level card */}
                    <GCard style={{ background:`linear-gradient(135deg,${getLevelColor(gamProgress.level)}14,rgba(0,0,0,0))` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1rem' }}>
                        <div style={{ width:'56px', height:'56px', borderRadius:'14px', background:getLevelGradient(gamProgress.level), display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', fontWeight:900, color:'#fff', flexShrink:0, boxShadow:`0 8px 24px ${getLevelColor(gamProgress.level)}44` }}>{gamProgress.level}</div>
                        <div style={{ flex:1 }}>
                          <p style={{ margin:'0 0 0.08rem', fontSize:'1.15rem', fontWeight:900, color:'#f1f5f9' }}>{gamProgress.level_name}</p>
                          <p style={{ margin:0, fontSize:'0.75rem', color:'rgba(203,213,225,0.8)' }}>{gamProgress.xp.toLocaleString()} XP total · {gamProgress.xp_to_next > 0 ? `${gamProgress.xp_to_next} to next level` : 'Max level!'}</p>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <p style={{ margin:'0 0 0.05rem', fontSize:'1.6rem', fontWeight:900, color:getLevelColor(gamProgress.level) }}>{gamProgress.progress_pct}%</p>
                          <p style={{ margin:0, fontSize:'0.65rem', color:'rgba(203,213,225,0.72)' }}>to Lv.{gamProgress.level+1}</p>
                        </div>
                      </div>
                      <div style={{ height:'8px', background:'rgba(255,255,255,0.07)', borderRadius:'99px', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${gamProgress.progress_pct}%`, background:getLevelGradient(gamProgress.level), borderRadius:'99px', transition:'width 0.8s ease', boxShadow:`0 0 10px ${getLevelColor(gamProgress.level)}66` }} />
                      </div>
                    </GCard>

                    {/* XP Breakdown */}
                    <GCard>
                      <h3 style={{ margin:'0 0 1rem', fontSize:'0.92rem', fontWeight:700, color:'#f1f5f9' }}>XP Breakdown</h3>
                      <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
                        {Object.entries(gamProgress.breakdown).map(([key, val]) => {
                          const pct = gamProgress.xp > 0 ? Math.round((val/gamProgress.xp)*100) : 0;
                          const colors: Record<string,string> = { checkins:'#10b981', quizzes:'#6366f1', high_scores:'#f59e0b', streak:'#ef4444', achievements:'#8b5cf6' };
                          const labels: Record<string,string> = { checkins:'Daily Check-ins', quizzes:'Quizzes', high_scores:'High Scores', streak:'Streak Bonus', achievements:'Achievements' };
                          const c = colors[key] ?? '#00D4FF';
                          return (
                            <div key={key}>
                              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.28rem' }}>
                                <span style={{ fontSize:'0.8rem', color:'#e2e8f0', fontWeight:500 }}>{labels[key] ?? key}</span>
                                <span style={{ fontSize:'0.78rem', fontWeight:700, color:c }}>{val.toLocaleString()} XP ({pct}%)</span>
                              </div>
                              <div style={{ height:'7px', background:'rgba(255,255,255,0.09)', borderRadius:'99px', overflow:'hidden', boxShadow:'inset 0 1px 3px rgba(0,0,0,0.35)' }}>
                                <div style={{ height:'100%', width:`${pct}%`, background:c, borderRadius:'99px', transition:'width 0.7s ease' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </GCard>

                    {/* Stats grid */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'0.7rem' }}>
                      {[
                        { icon:'🔥', label:'Current Streak',   value:`${gamProgress.streak_days} days`, color:'#ef4444' },
                        { icon:'⭐', label:'Total XP',          value:gamProgress.xp.toLocaleString(),   color:'#f59e0b' },
                        { icon:'🏅', label:'Badges Earned',     value:`${badgeCount}`,                   color:'#8b5cf6' },
                        { icon:'🎯', label:'Quizzes Taken',     value:`${gamProgress.breakdown.quizzes}`, color:'#6366f1' },
                      ].map(s => (
                        <GCard key={s.label} style={{ textAlign:'center', padding:'1.1rem 0.75rem', border:`1.5px solid ${s.color}44`, boxShadow:`0 8px 28px rgba(0,0,0,0.6), 0 0 18px ${s.color}14` }}>
                          <p style={{ margin:'0 0 0.3rem', fontSize:'1.5rem' }}>{s.icon}</p>
                          <p style={{ margin:'0 0 0.12rem', fontSize:'1.45rem', fontWeight:900, color:s.color, lineHeight:1, textShadow:`0 0 14px ${s.color}88` }}>{s.value}</p>
                          <p style={{ margin:0, fontSize:'0.63rem', color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{s.label}</p>
                        </GCard>
                      ))}
                    </div>
                  </>
                )}
                {!gamProgress && <GCard><p style={{ margin:0, color:'rgba(203,213,225,0.75)', textAlign:'center', padding:'2rem' }}>Loading gamification data…</p></GCard>}
              </Section>
            </div>
          )}

          {/* ═════════════ CONNECTED ACCOUNTS ═════════════ */}
          {activeSection === 'connected' && (
            <div key="connected" className="prof-section-anim">
              <Section title="Connected Accounts" icon="🔗">
                {calMsg && <p style={calMsg.ok ? msgOk : msgErr}>{calMsg.text}</p>}

                {/* Google Calendar */}
                <GCard>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.85rem' }}>
                      <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:'rgba(66,133,244,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.35rem', flexShrink:0 }}>📅</div>
                      <div>
                        <p style={{ margin:'0 0 0.12rem', fontSize:'0.92rem', fontWeight:700, color:'#f1f5f9' }}>Google Calendar</p>
                        <p style={{ margin:0, fontSize:'0.72rem', color:'rgba(203,213,225,0.75)' }}>Sync study plan & reminders</p>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.65rem', flexShrink:0 }}>
                      {calStatus?.connected && <span style={{ fontSize:'0.72rem', fontWeight:700, padding:'0.2rem 0.55rem', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:'99px', color:'#10b981' }}>● Connected</span>}
                      {calStatus === null && <span style={{ fontSize:'0.72rem', color:'rgba(203,213,225,0.68)' }}>Loading…</span>}
                      {calStatus && !calStatus.configured && <span style={{ fontSize:'0.72rem', color:'rgba(203,213,225,0.68)' }}>Not configured</span>}
                      {calStatus?.configured && !calStatus.connected && <button style={pri} onClick={connectCalendar}>Connect</button>}
                      {calStatus?.connected && <button style={sec} onClick={disconnectCalendar}>Disconnect</button>}
                    </div>
                  </div>

                  {calStatus?.connected && (
                    <div style={{ marginTop:'1.1rem', paddingTop:'1rem', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ display:'flex', gap:'0.65rem', marginBottom:'1rem' }}>
                        <button style={pri} onClick={syncPlan} disabled={syncing}>{syncing ? 'Syncing…' : 'Sync Study Plan'}</button>
                      </div>
                      <form onSubmit={addReminder} style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
                        <h4 style={{ margin:'0 0 0.5rem', fontSize:'0.82rem', fontWeight:700, color:'#f1f5f9' }}>Add Study Reminder</h4>
                        <input className="prof-inp" style={inp} placeholder="Reminder title" value={remTitle} onChange={e=>setRemTitle(e.target.value)} required />
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.6rem' }}>
                          <input className="prof-inp" type="date" style={inp} value={remDate} onChange={e=>setRemDate(e.target.value)} required />
                          <input className="prof-inp" type="time" style={inp} value={remTime} onChange={e=>setRemTime(e.target.value)} required />
                        </div>
                        {remMsg && <p style={remMsg.ok ? msgOk : msgErr}>{remMsg.text}</p>}
                        <button type="submit" style={pri} disabled={addingRem}>{addingRem ? 'Adding…' : 'Add Reminder'}</button>
                      </form>
                    </div>
                  )}
                </GCard>

                {/* Other integrations — UI only */}
                {[
                  { icon:'🔵', label:'Microsoft / Outlook', desc:'Sync with Outlook Calendar & OneDrive', color:'#0078d4' },
                  { icon:'🔷', label:'LinkedIn',             desc:'Import professional profile & career data', color:'#0a66c2' },
                  { icon:'🐙', label:'GitHub',               desc:'Link GitHub for project-based learning',   color:'#6e5494' },
                ].map(acc => (
                  <GCard key={acc.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.85rem' }}>
                      <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:`${acc.color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.35rem', flexShrink:0 }}>{acc.icon}</div>
                      <div>
                        <p style={{ margin:'0 0 0.1rem', fontSize:'0.92rem', fontWeight:700, color:'#f1f5f9' }}>{acc.label}</p>
                        <p style={{ margin:0, fontSize:'0.72rem', color:'rgba(203,213,225,0.75)' }}>{acc.desc}</p>
                      </div>
                    </div>
                    <button style={{ ...sec, opacity:0.55, cursor:'not-allowed' }} disabled>Coming Soon</button>
                  </GCard>
                ))}
              </Section>
            </div>
          )}

          {/* ═════════════ NOTIFICATIONS ═════════════ */}
          {activeSection === 'notifications' && (
            <div key="notifications" className="prof-section-anim">
              <Section title="Notification Settings" icon="🔔">
                <GCard>
                  <h3 style={{ margin:'0 0 1rem', fontSize:'0.92rem', fontWeight:700, color:'#f1f5f9' }}>In-App Notifications</h3>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>
                    {[
                      { key:'notif_study',     label:'Daily Study Reminders',     desc:'Get reminded to study at your scheduled time', val:notifStudy,     set:setNotifStudy     },
                      { key:'notif_challenge', label:'Weekly Challenge Alerts',   desc:'Alerts when weekly challenges start or end',  val:notifChallenge, set:setNotifChallenge },
                      { key:'notif_goal',      label:'Goal Completion Alerts',    desc:'Celebrate when you hit a goal milestone',     val:notifGoal,      set:setNotifGoal      },
                      { key:'notif_streak',    label:'Streak Risk Warnings',      desc:'Alert before your streak is at risk',         val:notifStreak,    set:setNotifStreak    },
                      { key:'notif_mentor',    label:'AI Mentor Notifications',   desc:'Tips and check-ins from your AI mentor',      val:notifMentor,    set:setNotifMentor    },
                    ].map((item, i) => (
                      <div key={item.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.85rem 0', borderTop: i>0?'1px solid rgba(255,255,255,0.08)':'none', gap:'1rem' }}>
                        <div style={{ minWidth:0 }}>
                          <p style={{ margin:'0 0 0.1rem', fontSize:'0.87rem', fontWeight:600, color:'#f1f5f9' }}>{item.label}</p>
                          <p style={{ margin:0, fontSize:'0.72rem', color:'rgba(203,213,225,0.75)' }}>{item.desc}</p>
                        </div>
                        <Toggle on={item.val} onChange={v => { item.set(v); LS.setBool(item.key, v); }} />
                      </div>
                    ))}
                  </div>
                </GCard>
                <GCard>
                  <h3 style={{ margin:'0 0 1rem', fontSize:'0.92rem', fontWeight:700, color:'#f1f5f9' }}>Channel Preferences</h3>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>
                    {[
                      { key:'notif_email', label:'Email Notifications', desc:'Receive weekly summaries and alerts via email', val:notifEmail, set:setNotifEmail },
                      { key:'notif_push',  label:'Push Notifications',  desc:'Browser push notifications (when supported)',   val:notifPush,  set:setNotifPush  },
                    ].map((item, i) => (
                      <div key={item.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.85rem 0', borderTop: i>0?'1px solid rgba(255,255,255,0.08)':'none', gap:'1rem' }}>
                        <div style={{ minWidth:0 }}>
                          <p style={{ margin:'0 0 0.1rem', fontSize:'0.87rem', fontWeight:600, color:'#f1f5f9' }}>{item.label}</p>
                          <p style={{ margin:0, fontSize:'0.72rem', color:'rgba(203,213,225,0.75)' }}>{item.desc}</p>
                        </div>
                        <Toggle on={item.val} onChange={v => { item.set(v); LS.setBool(item.key, v); }} />
                      </div>
                    ))}
                  </div>
                </GCard>
              </Section>
            </div>
          )}

          {/* ═════════════ APPEARANCE ═════════════ */}
          {activeSection === 'appearance' && (
            <div key="appearance" className="prof-section-anim">
              <Section title="Appearance" icon="🎨">
                <GCard>
                  <h3 style={{ margin:'0 0 0.25rem', fontSize:'0.92rem', fontWeight:700, color:'#f1f5f9' }}>Theme</h3>
                  <p style={{ margin:'0 0 1rem', fontSize:'0.78rem', color:'rgba(203,213,225,0.75)' }}>Choose a visual theme that transforms your entire TwinMind experience.</p>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:'0.7rem' }}>
                    {THEMES.map(t => {
                      const active = themeId === t.id;
                      return (
                        <button key={t.id} className="prof-theme-btn" onClick={() => setTheme(t.id)}
                          style={{ background:active?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.02)', border:`1px solid ${active?'rgba(255,255,255,0.22)':'rgba(255,255,255,0.08)'}`, borderRadius:'14px', padding:'0.9rem', cursor:'pointer', textAlign:'left', transition:'all 0.2s', position:'relative', boxShadow:active?`0 0 0 2px rgba(var(--primary-rgb),0.4), 0 4px 20px rgba(var(--primary-rgb),0.12)`:'none' }}>
                          {active && <div style={{ position:'absolute', top:'8px', right:'8px', width:'20px', height:'20px', borderRadius:'50%', background:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.68rem', color:'#fff', fontWeight:900, boxShadow:'0 0 8px rgba(var(--primary-rgb),0.6)' }}>✓</div>}
                          <div style={{ display:'flex', gap:'4px', marginBottom:'0.55rem' }}>
                            {t.swatches.map((c,i) => <div key={i} style={{ flex:1, height:'18px', borderRadius:'5px', background:c, border:'1px solid rgba(255,255,255,0.08)' }} />)}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', marginBottom:'0.2rem' }}>
                            <span style={{ fontSize:'1rem' }}>{t.icon}</span>
                            <span style={{ fontWeight:700, fontSize:'0.82rem', color:'#f1f5f9' }}>{t.name}</span>
                          </div>
                          <p style={{ margin:0, fontSize:'0.67rem', color:'rgba(203,213,225,0.75)', lineHeight:1.45 }}>{t.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </GCard>

                <GCard>
                  <h3 style={{ margin:'0 0 1rem', fontSize:'0.92rem', fontWeight:700, color:'#f1f5f9' }}>Interface Preferences</h3>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>
                    {[
                      { key:'compact',    label:'Compact Mode',       desc:'Reduce spacing for a denser information layout',  val:compactMode, set:setCompactMode },
                      { key:'animations', label:'Animations',         desc:'Enable smooth transitions and motion effects',    val:animations,  set:setAnimations  },
                      { key:'particles',  label:'Particle Effects',   desc:'Background particle system on the dashboard',     val:particles,   set:setParticles   },
                    ].map((item, i) => (
                      <div key={item.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.85rem 0', borderTop:i>0?'1px solid rgba(255,255,255,0.05)':'none', gap:'1rem' }}>
                        <div>
                          <p style={{ margin:'0 0 0.1rem', fontSize:'0.87rem', fontWeight:600, color:'#f1f5f9' }}>{item.label}</p>
                          <p style={{ margin:0, fontSize:'0.72rem', color:'rgba(203,213,225,0.75)' }}>{item.desc}</p>
                        </div>
                        <Toggle on={item.val} onChange={v => { item.set(v); LS.setBool(item.key, v); }} />
                      </div>
                    ))}
                  </div>
                </GCard>
              </Section>
            </div>
          )}

          {/* ═════════════ SECURITY ═════════════ */}
          {activeSection === 'security' && (
            <div key="security" className="prof-section-anim">
              <Section title="Security" icon="🔒">
                {/* Change password */}
                <GCard>
                  <h3 style={{ margin:'0 0 1rem', fontSize:'0.92rem', fontWeight:700, color:'#f1f5f9' }}>Change Password</h3>
                  <form onSubmit={savePassword} style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                    <Field label="Current Password">
                      <input className="prof-inp" type="password" value={currentPw} onChange={e=>setCurrentPw(e.target.value)} style={inp} placeholder="••••••••" required />
                    </Field>
                    <div className="prof-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                      <Field label="New Password">
                        <input className="prof-inp" type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} style={inp} placeholder="Min 8 characters" minLength={8} required />
                      </Field>
                      <Field label="Confirm Password">
                        <input className="prof-inp" type="password" value={confirmPw} onChange={e=>setConfirmPw(e.target.value)} style={inp} placeholder="Repeat new password" required />
                      </Field>
                    </div>
                    {pwMsg && <p style={pwMsg.ok ? msgOk : msgErr}>{pwMsg.text}</p>}
                    <button type="submit" style={pri} disabled={pwSaving}>{pwSaving ? 'Changing…' : 'Change Password'}</button>
                  </form>
                </GCard>

                {/* 2FA stub */}
                <GCard style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
                  <div>
                    <p style={{ margin:'0 0 0.1rem', fontSize:'0.92rem', fontWeight:700, color:'#f1f5f9' }}>Two-Factor Authentication</p>
                    <p style={{ margin:0, fontSize:'0.75rem', color:'rgba(203,213,225,0.75)' }}>Add an extra layer of security to your account</p>
                  </div>
                  <button style={{ ...sec, opacity:0.55, cursor:'not-allowed' }} disabled>Coming Soon</button>
                </GCard>

                {/* Login activity */}
                <GCard>
                  <h3 style={{ margin:'0 0 1rem', fontSize:'0.92rem', fontWeight:700, color:'#f1f5f9' }}>Recent Login Activity</h3>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>
                    {[
                      { device:'Chrome · Windows',  location:'Kolkata, India',    time:'Now',        current:true  },
                      { device:'Mobile · Android',  location:'Kolkata, India',    time:'2 days ago', current:false },
                      { device:'Safari · iPhone',   location:'Kolkata, India',    time:'5 days ago', current:false },
                    ].map((session, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.85rem 0', borderTop:i>0?'1px solid rgba(255,255,255,0.08)':'none', gap:'1rem' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                          <div style={{ width:'38px', height:'38px', borderRadius:'10px', background:session.current?'rgba(16,185,129,0.18)':'rgba(255,255,255,0.08)', border:`1px solid ${session.current?'rgba(16,185,129,0.3)':'rgba(255,255,255,0.1)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', flexShrink:0 }}>💻</div>
                          <div>
                            <p style={{ margin:'0 0 0.08rem', fontSize:'0.85rem', fontWeight:600, color:'#f1f5f9' }}>{session.device}</p>
                            <p style={{ margin:0, fontSize:'0.7rem', color:'rgba(203,213,225,0.75)' }}>{session.location} · {session.time}</p>
                          </div>
                        </div>
                        <span style={{ fontSize:'0.7rem', fontWeight:700, padding:'0.2rem 0.6rem', borderRadius:'99px', background:session.current?'rgba(16,185,129,0.14)':'rgba(255,255,255,0.07)', border:`1.5px solid ${session.current?'rgba(16,185,129,0.4)':'rgba(255,255,255,0.12)'}`, color:session.current?'#34d399':'#94a3b8', flexShrink:0 }}>{session.current ? '● Active' : 'Inactive'}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:'1rem', paddingTop:'1rem', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
                    <button style={{ ...sec, color:'#fca5a5', border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.1)' }} onClick={logout}>Sign Out from All Devices</button>
                  </div>
                </GCard>
              </Section>
            </div>
          )}

          {/* ═════════════ INSIGHTS ═════════════ */}
          {activeSection === 'insights' && (
            <div key="insights" className="prof-section-anim">
              <Section title="Account Insights" icon="📊">
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'0.7rem' }}>
                  {[
                    { icon:'⏱', label:'Total Study Hours',    value:`${totalHours}h`,    color:'#6366f1' },
                    { icon:'▶', label:'Sessions Completed',  value:`${sessionCount}`,    color:'#00D4FF' },
                    { icon:'📝', label:'Notes Created',       value:`${noteCount}`,       color:'#10b981' },
                    { icon:'🏅', label:'Badges Earned',       value:`${badgeCount}`,      color:'#8b5cf6' },
                    { icon:'🎯', label:'Quizzes Taken',       value:`${gamProgress?.breakdown.quizzes ?? 0}`, color:'#f59e0b' },
                    { icon:'📅', label:'Avg Attendance',      value:`${avgAtt}%`,         color:'#ec4899' },
                  ].map(s => (
                    <GCard key={s.label} style={{ textAlign:'center', padding:'1.1rem 0.75rem', border:`1.5px solid ${s.color}44`, boxShadow:`0 8px 28px rgba(0,0,0,0.6), 0 0 18px ${s.color}14` }}>
                      <p style={{ margin:'0 0 0.28rem', fontSize:'1.35rem' }}>{s.icon}</p>
                      <p style={{ margin:'0 0 0.12rem', fontSize:'1.45rem', fontWeight:900, color:s.color, lineHeight:1, textShadow:`0 0 14px ${s.color}88` }}>{s.value}</p>
                      <p style={{ margin:0, fontSize:'0.62rem', color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{s.label}</p>
                    </GCard>
                  ))}
                </div>

                {/* AI predicted performance */}
                {gamProgress && (
                  <GCard style={{ background:'linear-gradient(135deg,rgba(var(--primary-rgb),0.06),rgba(0,0,0,0))' }}>
                    <h3 style={{ margin:'0 0 1rem', fontSize:'0.92rem', fontWeight:700, color:'#f1f5f9' }}>AI Performance Prediction</h3>
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
                      {[
                        { label:'Brain Readiness',      value: Math.min(100, Math.round(totalHours / 2)), color:'#00D4FF' },
                        { label:'Consistency Score',    value: Math.min(100, gamProgress.streak_days * 4), color:'#10b981' },
                        { label:'Learning Velocity',    value: Math.min(100, sessionCount * 5), color:'#f59e0b' },
                        { label:'Overall Progress',     value: gamProgress.progress_pct, color:'#8b5cf6' },
                      ].map(m => (
                        <div key={m.label}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.28rem' }}>
                            <span style={{ fontSize:'0.8rem', color:'#e2e8f0', fontWeight:500 }}>{m.label}</span>
                            <span style={{ fontSize:'0.78rem', fontWeight:700, color:m.color }}>{m.value}%</span>
                          </div>
                          <div style={{ height:'7px', background:'rgba(255,255,255,0.09)', borderRadius:'99px', overflow:'hidden', boxShadow:'inset 0 1px 3px rgba(0,0,0,0.35)' }}>
                            <div style={{ height:'100%', width:`${m.value}%`, background:m.color, borderRadius:'99px', transition:'width 0.7s ease', boxShadow:`0 0 8px ${m.color}66` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </GCard>
                )}

                {/* Subjects breakdown */}
                {studentProfile?.subjects && studentProfile.subjects.length > 0 && (
                  <GCard>
                    <h3 style={{ margin:'0 0 1rem', fontSize:'0.92rem', fontWeight:700, color:'#f1f5f9' }}>Subjects</h3>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'0.45rem' }}>
                      {studentProfile.subjects.map((sub, i) => (
                        <span key={i} style={{ padding:'0.28rem 0.75rem', borderRadius:'99px', background:'rgba(var(--primary-rgb),0.1)', border:'1px solid rgba(var(--primary-rgb),0.2)', color:'var(--primary)', fontSize:'0.78rem', fontWeight:600 }}>{sub}</span>
                      ))}
                    </div>
                  </GCard>
                )}
              </Section>
            </div>
          )}

          {/* ═════════════ PRIVACY ═════════════ */}
          {activeSection === 'privacy' && (
            <div key="privacy" className="prof-section-anim">
              <Section title="Data & Privacy" icon="💾">
                <GCard>
                  <h3 style={{ margin:'0 0 1rem', fontSize:'0.92rem', fontWeight:700, color:'#f1f5f9' }}>Export Your Data</h3>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
                    {[
                      { icon:'📊', label:'Export Learning Data',     desc:'Download all study sessions, check-ins, and progress as CSV' },
                      { icon:'📜', label:'Download Progress Report', desc:'PDF report of your academic progress and achievements' },
                      { icon:'🏅', label:'Download Certificates',    desc:'Export earned completion certificates as PDF' },
                    ].map(item => (
                      <div key={item.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.9rem 1rem', background:'rgba(255,255,255,0.04)', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.1)', gap:'1rem' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                          <span style={{ fontSize:'1.25rem', flexShrink:0 }}>{item.icon}</span>
                          <div>
                            <p style={{ margin:'0 0 0.08rem', fontSize:'0.87rem', fontWeight:600, color:'#f1f5f9' }}>{item.label}</p>
                            <p style={{ margin:0, fontSize:'0.7rem', color:'rgba(203,213,225,0.75)' }}>{item.desc}</p>
                          </div>
                        </div>
                        <button style={{ ...sec, opacity:0.55, cursor:'not-allowed', flexShrink:0 }} disabled>Soon</button>
                      </div>
                    ))}
                  </div>
                </GCard>

                <GCard>
                  <h3 style={{ margin:'0 0 0.4rem', fontSize:'0.92rem', fontWeight:700, color:'#f1f5f9' }}>Privacy Preferences</h3>
                  <p style={{ margin:'0 0 1rem', fontSize:'0.75rem', color:'rgba(203,213,225,0.75)' }}>Control how your data is used within TwinMind.</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>
                    {[
                      { label:'Allow AI to personalize recommendations', desc:'Your usage patterns improve AI suggestions', defaultOn:true },
                      { label:'Anonymized analytics sharing',            desc:'Help improve TwinMind (no personal data)',  defaultOn:false },
                      { label:'Study data used for research',            desc:'Contribute to educational AI research',     defaultOn:false },
                    ].map((item, i) => {
                      const [on, setOn] = useState(LS.getBool(`privacy_${i}`, item.defaultOn));
                      return (
                        <div key={item.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.85rem 0', borderTop:i>0?'1px solid rgba(255,255,255,0.05)':'none', gap:'1rem' }}>
                          <div>
                            <p style={{ margin:'0 0 0.1rem', fontSize:'0.87rem', fontWeight:600, color:'#f1f5f9' }}>{item.label}</p>
                            <p style={{ margin:0, fontSize:'0.72rem', color:'rgba(203,213,225,0.75)' }}>{item.desc}</p>
                          </div>
                          <Toggle on={on} onChange={v => { setOn(v); LS.setBool(`privacy_${i}`, v); }} />
                        </div>
                      );
                    })}
                  </div>
                </GCard>

                <GCard style={{ border:'1px solid rgba(239,68,68,0.2)', background:'rgba(239,68,68,0.03)' }}>
                  <h3 style={{ margin:'0 0 0.4rem', fontSize:'0.9rem', fontWeight:700, color:'#ef4444' }}>Danger Zone</h3>
                  <p style={{ margin:'0 0 1rem', fontSize:'0.75rem', color:'rgba(239,68,68,0.6)' }}>These actions are permanent and cannot be undone.</p>
                  <button style={{ ...sec, color:'rgba(239,68,68,0.8)', border:'1px solid rgba(239,68,68,0.25)', background:'rgba(239,68,68,0.08)', cursor:'not-allowed', opacity:0.7 }} disabled>Delete Account (Contact Support)</button>
                </GCard>
              </Section>
            </div>
          )}

        </div>
      </div>
      </div>
    </div>
  );
}

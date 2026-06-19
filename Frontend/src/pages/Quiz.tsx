import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PracticeQuiz   from '../components/quiz/PracticeQuiz';
import FocusModeQuiz  from '../components/quiz/FocusModeQuiz';
import StudyResources from '../components/quiz/StudyResources';
import PaperAnalyzer  from '../components/quiz/PaperAnalyzer';

type View = 'hub' | 'practice' | 'focus';
type Tab  = 'modes' | 'resources' | 'papers';

const TABS: { key: Tab; icon: string; label: string; desc: string }[] = [
  { key: 'modes',     icon: '🧠', label: 'Quiz Modes',      desc: 'Practice & Focus' },
  { key: 'resources', icon: '📚', label: 'Study Resources', desc: 'Upload & Analyze' },
  { key: 'papers',    icon: '📄', label: 'Paper Analyzer',  desc: 'Exam Pattern AI' },
];

export default function Quiz() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('hub');
  const [tab,  setTab]  = useState<Tab>('modes');

  if (view === 'practice') return <PracticeQuiz  onBack={() => setView('hub')} />;
  if (view === 'focus')    return <FocusModeQuiz onBack={() => setView('hub')} />;

  const currentTabLabel = TABS.find(t => t.key === tab)?.label ?? 'Quiz Modes';

  return (
    <div style={s.shell}>
      {/* ── Top bar ── */}
      <header style={s.topBar}>
        <div style={s.topBarInner}>
          {/* Back + breadcrumb row */}
          <div style={s.navRow}>
            <button onClick={() => navigate('/')} style={s.backBtn}>
              ← Dashboard
            </button>
            <nav style={s.breadcrumb} aria-label="breadcrumb">
              <span style={s.bcDim}>Dashboard</span>
              <span style={s.bcSep}>›</span>
              <span style={s.bcDim}>Learning Hub</span>
              <span style={s.bcSep}>›</span>
              <span style={s.bcActive}>{currentTabLabel}</span>
            </nav>
          </div>
          {/* Brand row */}
          <div style={s.brandRow}>
            <span style={s.brandIcon}>🎓</span>
            <div>
              <p style={s.brandName}>Learning &amp; Assessment Hub</p>
              <p style={s.brandSub}>AI-powered study tools in one place</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab navigation ── */}
      <div style={s.tabRailWrap}>
        <div style={s.tabRail}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  ...s.tabBtn,
                  background:  active ? 'rgba(0,212,255,0.12)' : 'transparent',
                  borderColor: active ? 'rgba(0,212,255,0.4)'  : 'transparent',
                  color:       active ? '#00D4FF'               : 'rgba(148,163,184,0.55)',
                }}
              >
                <span style={{ fontSize: '1rem' }}>{t.icon}</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: active ? 800 : 600, fontSize: '0.8rem', lineHeight: 1.1 }}>
                    {t.label}
                  </span>
                  <span style={{ fontSize: '0.6rem', opacity: 0.6, lineHeight: 1.1 }}>{t.desc}</span>
                </div>
                {active && <div style={s.activeBar} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <main style={s.main}>
        {tab === 'modes' && (
          <div style={s.modesWrap}>
            <p style={s.sectionLabel}>Choose your session type</p>
            <div style={s.modesGrid}>
              {/* Practice Quiz */}
              <button onClick={() => setView('practice')} style={s.modeCard}>
                <div style={s.modeCardGlow} />
                <div style={{ ...s.modeIcon, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>📚</div>
                <p style={s.modeTitle}>Practice Quiz</p>
                <p style={s.modeDesc}>
                  Flexible, self-paced learning. No monitoring required. Pause anytime
                  and review answers at your own speed.
                </p>
                <div style={s.modeFeats}>
                  {['No camera or mic', 'Pause & resume', 'Full answer review', 'Performance history'].map(f => (
                    <div key={f} style={s.modeFeat}>
                      <span style={{ ...s.featDot, background: '#6366f1' }} />
                      <span style={s.featLabel}>{f}</span>
                    </div>
                  ))}
                </div>
                <div style={{ ...s.modeCTA, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                  Start Practice →
                </div>
              </button>

              {/* Focus Mode */}
              <button onClick={() => setView('focus')} style={{ ...s.modeCard, borderColor: 'rgba(0,212,255,0.2)' }}>
                <div style={{ ...s.modeCardGlow, background: 'radial-gradient(circle, rgba(0,212,255,0.1) 0%, transparent 65%)' }} />
                <div style={{ ...s.modeIcon, background: 'linear-gradient(135deg,#00D4FF,#7c3aed)' }}>👁</div>
                <p style={{ ...s.modeTitle, color: '#00D4FF' }}>Focus Mode Quiz</p>
                <p style={s.modeDesc}>
                  Full exam simulation with AI integrity monitoring. Camera and
                  microphone required for proctoring.
                </p>
                <div style={s.modeFeats}>
                  {['AI webcam monitoring', 'Tab-switch detection', '6-warning system', 'Integrity report'].map(f => (
                    <div key={f} style={s.modeFeat}>
                      <span style={{ ...s.featDot, background: '#00D4FF' }} />
                      <span style={s.featLabel}>{f}</span>
                    </div>
                  ))}
                </div>
                <div style={{ ...s.modeCTA, background: 'linear-gradient(135deg,#00D4FF,#7c3aed)' }}>
                  Start Focus Mode →
                </div>
              </button>
            </div>

            {/* Quick links to other tabs */}
            <p style={{ ...s.sectionLabel, marginTop: '1.5rem' }}>AI-powered tools</p>
            <div style={s.quickRow}>
              {[
                { icon: '📚', label: 'Upload, analyze & generate quizzes from study materials', tab: 'resources' as Tab, color: '#10b981' },
                { icon: '📄', label: 'Analyze exam paper patterns & generate new papers',       tab: 'papers'    as Tab, color: '#f59e0b' },
              ].map(item => (
                <button key={item.tab} onClick={() => setTab(item.tab)} style={{
                  ...s.quickCard, borderColor: `${item.color}30`,
                }}>
                  <span style={{ fontSize: '1.4rem' }}>{item.icon}</span>
                  <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600,
                    color: 'rgba(226,232,240,0.78)', lineHeight: 1.4 }}>
                    {item.label}
                  </p>
                  <span style={{ fontSize: '0.65rem', color: item.color, fontWeight: 700, marginTop: 'auto' }}>
                    Open →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'resources' && <StudyResources />}
        {tab === 'papers'    && <PaperAnalyzer />}
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100svh', background: 'var(--bg)',
    display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif",
  },
  topBar: {
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: 'rgba(6,11,24,0.92)', backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)', position: 'sticky', top: 0, zIndex: 20,
  },
  topBarInner: { maxWidth: '960px', margin: '0 auto', padding: '0.65rem 1.25rem',
    display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  navRow:   { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  backBtn:  {
    padding: '0.3rem 0.75rem', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
    color: 'rgba(148,163,184,0.75)', fontSize: '0.75rem', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
    transition: 'background 0.15s, color 0.15s',
  },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' as const },
  bcDim:    { fontSize: '0.68rem', color: 'rgba(148,163,184,0.35)', fontWeight: 500 },
  bcSep:    { fontSize: '0.68rem', color: 'rgba(148,163,184,0.25)' },
  bcActive: { fontSize: '0.68rem', color: '#00D4FF', fontWeight: 700 },
  brandRow: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  brandIcon:{ fontSize: '1.35rem' },
  brandName:{ margin: '0 0 0.05rem', fontWeight: 900, fontSize: '0.92rem',
    background: 'linear-gradient(135deg,#00D4FF,#a78bfa)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' },
  brandSub: { margin: 0, fontSize: '0.6rem', color: 'rgba(148,163,184,0.4)' },
  tabRailWrap: {
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(6,11,24,0.6)',
  },
  tabRail: {
    display: 'flex', overflowX: 'auto' as const, gap: '0.25rem',
    padding: '0.5rem 1.25rem', scrollbarWidth: 'none' as const,
    maxWidth: '960px', margin: '0 auto',
  },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 0.85rem', borderRadius: '10px', border: '1.5px solid',
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const,
    transition: 'background 0.18s, color 0.18s, border-color 0.18s',
    position: 'relative', flexShrink: 0,
  },
  activeBar: {
    position: 'absolute', bottom: '-0.52rem', left: '50%',
    transform: 'translateX(-50%)', width: '60%', height: '2px',
    background: '#00D4FF', borderRadius: '99px', boxShadow: '0 0 8px rgba(0,212,255,0.6)',
  },
  main:        { flex: 1, maxWidth: '960px', width: '100%', margin: '0 auto', boxSizing: 'border-box' as const },
  modesWrap:   { padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  sectionLabel:{ margin: 0, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' as const,
    letterSpacing: '0.08em', color: 'rgba(148,163,184,0.38)' },
  modesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' },
  modeCard: {
    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    gap: '0.6rem', padding: '1.5rem 1.25rem',
    background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(99,102,241,0.2)',
    borderRadius: '18px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const,
    transition: 'border-color 0.2s, transform 0.15s', overflow: 'hidden',
  },
  modeCardGlow: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 65%)',
  },
  modeIcon: {
    width: '44px', height: '44px', borderRadius: '12px', fontSize: '1.4rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  modeTitle: { margin: '0.1rem 0 0', fontWeight: 800, fontSize: '1rem', color: '#818cf8' },
  modeDesc:  { margin: 0, fontSize: '0.78rem', color: 'rgba(148,163,184,0.65)', lineHeight: 1.5 },
  modeFeats: { display: 'flex', flexDirection: 'column' as const, gap: '0.25rem', width: '100%' },
  modeFeat:  { display: 'flex', alignItems: 'center', gap: '0.45rem' },
  featDot:   { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  featLabel: { fontSize: '0.72rem', color: 'rgba(148,163,184,0.7)', fontWeight: 500 },
  modeCTA: {
    marginTop: '0.3rem', width: '100%', padding: '0.6rem',
    borderRadius: '10px', border: 'none', color: '#fff',
    fontWeight: 800, fontSize: '0.82rem', textAlign: 'center' as const,
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  },
  quickRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' },
  quickCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.45rem',
    padding: '0.9rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid',
    borderRadius: '14px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const,
    transition: 'background 0.18s', minHeight: '110px',
  },
};

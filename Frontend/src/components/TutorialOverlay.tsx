import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface TourStep {
  target: string;
  title: string;
  desc: string;
  icon: string;
}

const STEPS: TourStep[] = [
  {
    target: 'dashboard',
    title: 'Welcome to TwinMind',
    desc: 'Your intelligent academic companion. TwinMind tracks your study habits, predicts your performance, and delivers personalised AI advice — all in one place.',
    icon: '◈',
  },
  {
    target: 'profile',
    title: 'Complete Your Profile',
    desc: 'Set your course, semester, academic goals, and learning preferences so TwinMind can personalise every recommendation specifically for you.',
    icon: '👤',
  },
  {
    target: 'checkin',
    title: 'Log Your First Check-in',
    desc: 'Daily check-ins are the heartbeat of TwinMind. Log your study hours, attendance, sleep, and stress levels to keep your Digital Twin accurate.',
    icon: '✓',
  },
  {
    target: 'twin',
    title: 'Meet Your Digital Twin',
    desc: 'Your Digital Twin is an AI model of your academic self. It learns from your data and reflects your academic health and trajectory in real time.',
    icon: '◈',
  },
  {
    target: 'mentor',
    title: 'Try the AI Mentor',
    desc: 'Chat with your personalised AI mentor for study strategies, stress management tips, and advice grounded in your actual academic data.',
    icon: '💬',
  },
  {
    target: 'predict',
    title: 'Predict Your Score',
    desc: 'Our ML model uses your study habits, attendance, and performance history to predict your exam score — with actionable recommendations to improve it.',
    icon: '🎯',
  },
  {
    target: 'simulate',
    title: 'Simulate What-If Scenarios',
    desc: 'Explore how changing your study hours, attendance, or sleep would affect your predicted score. Plan smarter with data-driven simulations.',
    icon: '⚡',
  },
  {
    target: 'quiz',
    title: 'Take a Quiz',
    desc: 'Test your knowledge with AI-generated quizzes tailored to your subjects. Track your performance over time and identify areas to improve.',
    icon: '🧠',
  },
];

// Deterministic confetti (no Math.random on render)
const CONFETTI = Array.from({ length: 68 }, (_, i) => ({
  left:     `${(i * 31 + 7) % 100}%`,
  delay:    `${((i * 17) % 40) / 20}s`,
  duration: `${2.4 + ((i * 13) % 20) / 10}s`,
  color:    ['#6366f1','#8b5cf6','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899','#fbbf24'][i % 8],
  size:     `${6 + (i % 7)}px`,
  rotate:   `${(i * 43) % 360}deg`,
  circle:   i % 3 !== 0,
}));

const TOUR_KEY = (uid: string | number) => `twinmind_tour_v1_${uid}`;

function getTooltipPos(rect: DOMRect | null): React.CSSProperties {
  const W = 360;
  if (!rect) {
    return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: W };
  }
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const CARD_H = 230;
  const spaceBelow = vh - rect.bottom;
  const spaceAbove = rect.top;
  let top = spaceBelow >= CARD_H + 16 || spaceBelow >= spaceAbove
    ? rect.bottom + 14
    : Math.max(8, rect.top - CARD_H - 14);
  let left = Math.max(12, Math.min(rect.left + rect.width / 2 - W / 2, vw - W - 12));
  return { position: 'fixed', top, left, width: W };
}

export default function TutorialOverlay() {
  const { user } = useAuth();
  const [visible,      setVisible]      = useState(false);
  const [phase,        setPhase]        = useState<'welcome' | 'tour' | 'done'>('welcome');
  const [step,         setStep]         = useState(0);
  const [rect,         setRect]         = useState<DOMRect | null>(null);
  const [tipStyle,     setTipStyle]     = useState<React.CSSProperties>({});
  const [tipReady,     setTipReady]     = useState(false);

  // Inject keyframe CSS once
  useEffect(() => {
    if (document.getElementById('tm-tour-css')) return;
    const el = document.createElement('style');
    el.id = 'tm-tour-css';
    el.textContent = `
      @keyframes tm-glow {
        0%,100%{box-shadow:0 0 0 3px rgba(99,102,241,0.4),0 0 18px rgba(99,102,241,0.3);}
        50%    {box-shadow:0 0 0 4px rgba(99,102,241,0.75),0 0 36px rgba(99,102,241,0.55);}
      }
      @keyframes tm-in {
        from{opacity:0;transform:scale(0.88) translateY(8px);}
        to  {opacity:1;transform:scale(1)    translateY(0);}
      }
      @keyframes tm-pop {
        0%  {transform:scale(0.7);opacity:0;}
        65% {transform:scale(1.06);}
        100%{transform:scale(1);opacity:1;}
      }
      @keyframes tm-confetti {
        0%  {transform:translateY(-12px) rotate(0deg);  opacity:1;}
        100%{transform:translateY(108vh) rotate(680deg);opacity:0;}
      }
    `;
    document.head.appendChild(el);
  }, []);

  // Show on first login only
  useEffect(() => {
    if (!user?.id) return;
    if (!localStorage.getItem(TOUR_KEY(user.id))) {
      const t = setTimeout(() => setVisible(true), 700);
      return () => clearTimeout(t);
    }
  }, [user?.id]);

  const updateRect = useCallback(() => {
    if (phase !== 'tour') return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${STEPS[step].target}"]`);
    const r = el ? el.getBoundingClientRect() : null;
    setRect(r);
    setTipStyle(getTooltipPos(r));
    setTipReady(true);
  }, [step, phase]);

  useEffect(() => {
    setTipReady(false);
    const t = setTimeout(updateRect, 90);
    return () => clearTimeout(t);
  }, [updateRect]);

  useEffect(() => {
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [updateRect]);

  function markDone() {
    if (user?.id) localStorage.setItem(TOUR_KEY(user.id), '1');
  }

  function skip()   { markDone(); setVisible(false); }
  function start()  { setPhase('tour'); }
  function prev()   { if (step > 0) setStep(s => s - 1); }
  function next()   {
    if (step < STEPS.length - 1) { setStep(s => s + 1); }
    else { markDone(); setPhase('done'); }
  }
  function finish() { setVisible(false); }

  if (!visible) return null;

  const cur = STEPS[step];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9996, pointerEvents: 'none' }}>

      {/* ─── WELCOME SCREEN ─────────────────────────────────────── */}
      {phase === 'welcome' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'all',
          background: 'rgba(0,0,0,0.84)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: '20px', padding: '2.5rem 2rem',
            maxWidth: '440px', width: '100%', margin: '1rem',
            textAlign: 'center', boxShadow: '0 32px 80px rgba(0,0,0,0.65)',
            animation: 'tm-pop 0.38s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <div style={{ fontSize: '3.2rem', lineHeight: 1, marginBottom: '0.85rem', color: '#6366f1' }}>◈</div>
            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-h)', margin: '0 0 0.55rem', letterSpacing: '-0.5px' }}>
              Welcome to TwinMind!
            </h2>
            <p style={{ color: 'var(--text)', fontSize: '0.9rem', lineHeight: '1.65', margin: '0 0 0.5rem' }}>
              Your AI-powered academic companion is ready.
            </p>
            <p style={{ color: 'var(--text)', fontSize: '0.875rem', lineHeight: '1.6', margin: '0 0 2rem' }}>
              Take a quick{' '}
              <strong style={{ color: 'var(--text-h)' }}>2-minute tour</strong>
              {' '}to discover everything TwinMind can do for your academic journey.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={skip} style={{ padding: '0.6rem 1.3rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Skip Tour
              </button>
              <button onClick={start} style={{ padding: '0.6rem 1.5rem', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 18px rgba(99,102,241,0.5)' }}>
                Start Tour →
              </button>
            </div>
            <p style={{ margin: '1.1rem 0 0', fontSize: '0.7rem', color: 'var(--text)', opacity: 0.55 }}>
              8 steps · ~2 minutes · won't show again
            </p>
          </div>
        </div>
      )}

      {/* ─── TOUR STEPS ─────────────────────────────────────────── */}
      {phase === 'tour' && (
        <>
          {/* SVG spotlight mask — dark overlay with transparent cutout */}
          <svg
            style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 9997, pointerEvents: 'none' }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <mask id="tm-spotlight">
                <rect width="100%" height="100%" fill="white" />
                {rect && (
                  <rect
                    x={rect.left - 8} y={rect.top - 8}
                    width={rect.width + 16} height={rect.height + 16}
                    rx="10" fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.78)" mask="url(#tm-spotlight)" />
          </svg>

          {/* Glowing ring around target element */}
          {rect && (
            <div style={{
              position: 'fixed',
              top: rect.top - 8, left: rect.left - 8,
              width: rect.width + 16, height: rect.height + 16,
              borderRadius: '10px',
              border: '2px solid #6366f1',
              zIndex: 9998,
              pointerEvents: 'none',
              animation: 'tm-glow 2s ease-in-out infinite',
            }} />
          )}

          {/* Click absorber (blocks stray clicks outside tooltip) */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'all' }}
            onClick={e => e.stopPropagation()}
          />

          {/* Tooltip card */}
          {tipReady && (
            <div style={{
              ...tipStyle,
              zIndex: 10000,
              pointerEvents: 'all',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              padding: '1.2rem 1.2rem 1rem',
              boxShadow: '0 16px 52px rgba(0,0,0,0.55)',
              animation: 'tm-in 0.22s ease-out',
            }}>
              {/* Progress bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                <div style={{ flex: 1, height: '4px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${((step + 1) / STEPS.length) * 100}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: '99px', transition: 'width 0.3s ease' }} />
                </div>
                <span style={{ fontSize: '0.67rem', color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap' as const }}>
                  {step + 1} / {STEPS.length}
                </span>
              </div>

              {/* Icon + heading */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', marginBottom: '0.55rem' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0, boxShadow: '0 3px 10px rgba(99,102,241,0.4)' }}>
                  {cur.icon}
                </div>
                <div>
                  <p style={{ margin: '0 0 0.1rem', fontSize: '0.63rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>
                    Step {step + 1} of {STEPS.length}
                  </p>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-h)', lineHeight: 1.25 }}>
                    {cur.title}
                  </h3>
                </div>
              </div>

              <p style={{ margin: '0 0 0.85rem', fontSize: '0.825rem', color: 'var(--text)', lineHeight: '1.62' }}>
                {cur.desc}
              </p>

              {/* Step dot indicators */}
              <div style={{ display: 'flex', gap: '5px', marginBottom: '0.9rem' }}>
                {STEPS.map((_, i) => (
                  <span key={i} style={{
                    width: i === step ? '18px' : '6px',
                    height: '6px',
                    borderRadius: '99px',
                    background: i < step ? '#6366f1' : i === step ? '#8b5cf6' : 'var(--border)',
                    transition: 'all 0.25s ease',
                    flexShrink: 0,
                  }} />
                ))}
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={skip} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '0.74rem', cursor: 'pointer', fontFamily: 'inherit', padding: 0, opacity: 0.65 }}>
                  Skip Tour
                </button>
                <div style={{ display: 'flex', gap: '0.45rem' }}>
                  {step > 0 && (
                    <button onClick={prev} style={{ padding: '0.42rem 0.85rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-h)', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                      ← Back
                    </button>
                  )}
                  <button onClick={next} style={{ padding: '0.42rem 1.1rem', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 12px rgba(99,102,241,0.45)' }}>
                    {step === STEPS.length - 1 ? 'Finish! 🎉' : 'Next →'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── CELEBRATION SCREEN ─────────────────────────────────── */}
      {phase === 'done' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'all',
          background: 'rgba(0,0,0,0.86)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {/* Confetti rain */}
          {CONFETTI.map((c, i) => (
            <div key={i} style={{
              position: 'absolute', left: c.left, top: '-12px',
              width: c.size, height: c.size,
              background: c.color,
              borderRadius: c.circle ? '50%' : '2px',
              transform: `rotate(${c.rotate})`,
              animation: `tm-confetti ${c.duration} ${c.delay} ease-in forwards`,
              pointerEvents: 'none',
            }} />
          ))}

          {/* Card */}
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: '20px', padding: '2.5rem 2rem',
            maxWidth: '420px', width: '100%', margin: '1rem',
            textAlign: 'center', boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
            animation: 'tm-pop 0.45s cubic-bezier(0.34,1.56,0.64,1)',
            position: 'relative',
          }}>
            <div style={{ fontSize: '3.6rem', lineHeight: 1, marginBottom: '0.6rem' }}>🎉</div>
            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-h)', margin: '0 0 0.5rem', letterSpacing: '-0.5px' }}>
              You're all set!
            </h2>
            <p style={{ color: 'var(--text)', fontSize: '0.88rem', lineHeight: '1.65', margin: '0 0 0.4rem' }}>
              You've completed the TwinMind tour.
            </p>
            <p style={{ color: 'var(--text)', fontSize: '0.85rem', lineHeight: '1.6', margin: '0 0 1.5rem' }}>
              Start by completing your{' '}
              <strong style={{ color: 'var(--text-h)' }}>profile</strong>
              {' '}and logging your first{' '}
              <strong style={{ color: 'var(--text-h)' }}>check-in</strong>
              {' '}to activate your Digital Twin.
            </p>

            {/* Feature chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.35rem', justifyContent: 'center', marginBottom: '1.75rem' }}>
              {STEPS.slice(1).map((st, i) => (
                <span key={i} style={{
                  padding: '0.22rem 0.6rem',
                  background: 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(99,102,241,0.22)',
                  borderRadius: '99px',
                  fontSize: '0.67rem', color: '#818cf8', fontWeight: 600,
                }}>
                  {st.icon} {st.title}
                </span>
              ))}
            </div>

            <button onClick={finish} style={{
              padding: '0.75rem 2rem', width: '100%',
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              border: 'none', borderRadius: '12px',
              color: '#fff', fontSize: '0.95rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 6px 24px rgba(99,102,241,0.55)',
            }}>
              Let's Go! 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { Link } from 'react-router-dom';
import TwinMindLogo, { BrainIcon } from '../components/TwinMindLogo';
import { useAuth } from '../contexts/AuthContext';
import type { CSSProperties } from 'react';

const PALETTE = [
  { name: 'Electric Blue',  hex: '#3B82F6', role: 'Primary'    },
  { name: 'Neon Purple',    hex: '#A855F7', role: 'Secondary'  },
  { name: 'Cyan Glow',      hex: '#22D3EE', role: 'Accent'     },
  { name: 'Deep Navy',      hex: '#050816', role: 'Background' },
  { name: 'Cyan Core',      hex: '#00D4FF', role: 'Brand Core' },
  { name: 'Violet Deep',    hex: '#7C3AED', role: 'Deep Accent'},
];

const FEATURES = [
  { icon: '🧠', title: 'Digital Twin AI',       color: '#00D4FF', desc: 'Your personal AI model learns your study patterns, strengths, and knowledge gaps to predict outcomes and adapt recommendations in real time.' },
  { icon: '⚡', title: 'AI-Powered Sessions',   color: '#3B82F6', desc: 'Smart focus timer with Pomodoro, deep work modes, and real-time concentration analytics to maximise every study session.' },
  { icon: '📊', title: 'Predictive Analytics',  color: '#A855F7', desc: 'ML models analyse your learning velocity and predict exam performance up to weeks in advance, so you can intervene early.' },
  { icon: '🛡️', title: 'Burnout Guardian',      color: '#22D3EE', desc: 'Proactive early-warning system detecting cognitive fatigue patterns before burnout sets in, keeping you at peak performance.' },
  { icon: '🏆', title: 'Gamified Learning',     color: '#F59E0B', desc: 'XP system, achievement badges, skill trees, and competitive battles with peers to make consistent studying genuinely engaging.' },
  { icon: '🤖', title: 'AI Mentor & Coach',     color: '#10B981', desc: 'Multi-agent AI with specialised tutors per subject, providing Socratic guidance and deeply personalised explanations.' },
];

const LOGO_VARIANTS = ['icon', 'compact', 'full', 'stacked'] as const;

export default function About() {
  const { token } = useAuth();

  return (
    <div style={s.page}>
      {/* Ambient orbs */}
      <div style={{ ...s.orb, top: '-14%', left: '-8%',  background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)', animation: 'orb-drift-1 14s ease-in-out infinite' }} />
      <div style={{ ...s.orb, bottom: '-15%', right: '-8%', background: 'radial-gradient(circle, rgba(168,85,247,0.13) 0%, transparent 70%)', animation: 'orb-drift-2 17s ease-in-out infinite' }} />
      <div style={{ ...s.orb, top: '42%', left: '55%', width: '360px', height: '360px', background: 'radial-gradient(circle, rgba(34,211,238,0.07) 0%, transparent 70%)', animation: 'orb-drift-3 11s ease-in-out infinite' }} />

      {/* Nav */}
      <header style={s.nav}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <TwinMindLogo size={28} variant="compact" />
        </Link>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          {token
            ? <Link to="/" style={s.navLink}>Dashboard</Link>
            : <>
                <Link to="/login"    style={s.navLink}>Sign In</Link>
                <Link to="/register" style={s.navBtn}>Get Started</Link>
              </>
          }
        </div>
      </header>

      {/* Hero */}
      <section style={s.hero}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.75rem' }}>
          <div style={s.logoHalo} />
          <TwinMindLogo size={96} variant="stacked" />
        </div>

        <h1 style={s.heroTitle}>
          Meet{' '}
          <span style={{ background: 'linear-gradient(135deg,#22D3EE,#3B82F6 45%,#A855F7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            TwinMind
          </span>
        </h1>

        <p style={s.heroSub}>
          The AI learning platform that builds a digital twin of your mind,
          <br />predicts your academic trajectory, and guides you to peak performance.
        </p>

        <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {token
            ? <Link to="/" style={s.ctaPrimary}>Go to Dashboard</Link>
            : <>
                <Link to="/register" style={s.ctaPrimary}>Start Free</Link>
                <Link to="/login"    style={s.ctaGhost}>Sign In</Link>
              </>
          }
        </div>
      </section>

      {/* Features */}
      <section style={s.section}>
        <SectionHead eyebrow="CAPABILITIES" title="Everything you need to excel" />
        <div style={s.grid3}>
          {FEATURES.map(f => (
            <div key={f.title} style={s.featureCard}>
              <div style={{ ...s.featureIcon, background: `${f.color}18`, border: `1px solid ${f.color}30` }}>
                <span style={{ fontSize: '1.5rem' }}>{f.icon}</span>
              </div>
              <h3 style={{ ...s.featureTitle, color: f.color }}>{f.title}</h3>
              <p style={s.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Logo system */}
      <section style={{ ...s.section, maxWidth: '900px' }}>
        <SectionHead eyebrow="BRAND IDENTITY" title="Logo system" />
        <div style={s.variantRow}>
          {LOGO_VARIANTS.map(v => (
            <div key={v} style={s.variantCard}>
              <TwinMindLogo
                size={v === 'icon' ? 52 : v === 'stacked' ? 52 : 40}
                variant={v}
              />
              <span style={s.variantLabel}>{v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Colour palette */}
      <section style={{ ...s.section, maxWidth: '820px' }}>
        <SectionHead eyebrow="DESIGN SYSTEM" title="Brand colour palette" />
        <div style={s.grid3}>
          {PALETTE.map(p => (
            <div key={p.hex} style={s.swatchCard}>
              <div style={{ ...s.swatch, background: p.hex, boxShadow: `0 0 22px ${p.hex}40` }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f1f5f9' }}>{p.name}</span>
                <span style={{ fontSize: '0.68rem', color: '#64748b', fontFamily: 'monospace' }}>{p.hex}</span>
                <span style={{ ...s.roleBadge, color: p.hex, background: `${p.hex}14`, border: `1px solid ${p.hex}28` }}>{p.role}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section style={{ ...s.section, maxWidth: '680px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <BrainIcon size={48} />
        </div>
        <SectionHead eyebrow="OUR MISSION" title="AI that learns you, not just from you" />
        <p style={{ color: '#94a3b8', lineHeight: 1.8, fontSize: '1rem', marginTop: '0.25rem' }}>
          TwinMind was built on the belief that every student deserves a personalised AI companion —
          one that understands their unique learning DNA, predicts challenges before they arise, and
          celebrates every milestone on the journey to mastery. We're not just building study tools.
          We're building digital twins.
        </p>
      </section>

      {/* Tech stack */}
      <section style={{ ...s.section, maxWidth: '680px', textAlign: 'center' }}>
        <SectionHead eyebrow="TECHNOLOGY" title="Built with the best" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', justifyContent: 'center' }}>
          {['React 18', 'TypeScript', 'Vite', 'FastAPI', 'PostgreSQL', 'WebSocket', 'Gemini AI', 'OAuth 2.0'].map(t => (
            <span key={t} style={s.techTag}>{t}</span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={s.footer}>
        <TwinMindLogo size={22} variant="compact" />
        <p style={{ margin: 0, color: '#475569', fontSize: '0.8rem' }}>
          © 2026 TwinMind. All rights reserved.
        </p>
        <div style={{ display: 'flex', gap: '1.25rem' }}>
          {token
            ? <Link to="/" style={s.footLink}>Dashboard</Link>
            : <Link to="/login" style={s.footLink}>Sign In</Link>
          }
          <Link to="/about" style={{ ...s.footLink, color: '#3B82F6' }}>About</Link>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
      <span style={{ fontSize: '0.68rem', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#3B82F6', fontWeight: 700 }}>
        {eyebrow}
      </span>
      <h2 style={{ margin: '0.3rem 0 0', fontSize: 'clamp(1.35rem,3vw,1.9rem)', fontWeight: 800, letterSpacing: '-0.5px', color: '#f1f5f9' }}>
        {title}
      </h2>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, CSSProperties> = {
  page: {
    minHeight: '100svh',
    background: 'linear-gradient(160deg, #050816 0%, #0a0a24 50%, #050816 100%)',
    position: 'relative',
    overflow: 'hidden',
    color: '#94a3b8',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  orb: {
    position: 'absolute',
    width: '500px', height: '500px',
    borderRadius: '50%',
    pointerEvents: 'none',
  },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1.1rem 2rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    position: 'sticky', top: 0,
    background: 'rgba(5,8,22,0.88)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    zIndex: 100,
  },
  navLink: {
    color: '#94a3b8', textDecoration: 'none',
    fontSize: '0.875rem', fontWeight: 500,
    padding: '0.38rem 0.75rem', borderRadius: '8px',
  },
  navBtn: {
    background: 'linear-gradient(135deg,#3B82F6,#A855F7)',
    color: '#fff', textDecoration: 'none',
    fontSize: '0.84rem', fontWeight: 700,
    padding: '0.42rem 1.1rem', borderRadius: '10px',
  },
  hero: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center',
    padding: 'clamp(3rem,8vh,6rem) 1.5rem 3rem',
    maxWidth: '720px', margin: '0 auto',
    position: 'relative', zIndex: 1,
  },
  logoHalo: {
    position: 'absolute', inset: '-44px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,212,255,0.2) 0%, rgba(168,85,247,0.1) 55%, transparent 75%)',
    animation: 'breathe 3.5s ease-in-out infinite',
    pointerEvents: 'none',
  },
  heroTitle: {
    fontSize: 'clamp(2.2rem,6vw,3.6rem)',
    fontWeight: 900, letterSpacing: '-1.5px',
    color: '#f1f5f9', margin: '0 0 1rem', lineHeight: 1.1,
  },
  heroSub: {
    fontSize: 'clamp(0.95rem,2.5vw,1.12rem)',
    color: '#94a3b8', lineHeight: 1.72, margin: '0 0 2rem',
  },
  ctaPrimary: {
    display: 'inline-block',
    background: 'linear-gradient(135deg,#3B82F6,#A855F7)',
    color: '#fff', textDecoration: 'none',
    fontSize: '0.95rem', fontWeight: 700,
    padding: '0.72rem 2rem', borderRadius: '12px',
    boxShadow: '0 0 24px rgba(59,130,246,0.35)',
  },
  ctaGhost: {
    display: 'inline-block',
    border: '1px solid rgba(255,255,255,0.14)',
    color: '#f1f5f9', textDecoration: 'none',
    fontSize: '0.95rem', fontWeight: 600,
    padding: '0.72rem 2rem', borderRadius: '12px',
    background: 'rgba(255,255,255,0.04)',
  },
  section: {
    position: 'relative', zIndex: 1,
    maxWidth: '1100px', margin: '0 auto',
    padding: '3rem 1.5rem',
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1rem',
  },
  featureCard: {
    padding: '1.4rem', borderRadius: '16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', flexDirection: 'column', gap: '0.6rem',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
  featureIcon: {
    width: '44px', height: '44px', borderRadius: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  featureTitle: { fontSize: '1rem', fontWeight: 700, margin: 0 },
  featureDesc:  { fontSize: '0.82rem', color: '#64748b', lineHeight: 1.65, margin: 0 },
  swatchCard: {
    display: 'flex', gap: '0.75rem', alignItems: 'center',
    padding: '0.85rem', borderRadius: '12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  swatch: { width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0 },
  roleBadge: {
    display: 'inline-block',
    padding: '0.1rem 0.45rem', borderRadius: '6px',
    fontSize: '0.61rem', fontWeight: 700, letterSpacing: '0.04em',
    width: 'fit-content',
  },
  variantRow: {
    display: 'flex', gap: '1rem',
    justifyContent: 'center', flexWrap: 'wrap',
  },
  variantCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
    padding: '1.5rem 1.75rem', borderRadius: '16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    minWidth: '140px',
  },
  variantLabel: {
    fontSize: '0.68rem', fontWeight: 600,
    letterSpacing: '0.1em', textTransform: 'uppercase' as const,
    color: '#475569',
  },
  techTag: {
    padding: '0.28rem 0.85rem', borderRadius: '99px',
    background: 'rgba(59,130,246,0.1)',
    border: '1px solid rgba(59,130,246,0.25)',
    color: '#93c5fd', fontSize: '0.78rem', fontWeight: 600,
  },
  footer: {
    position: 'relative', zIndex: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: '0.75rem',
    padding: '1.5rem 2rem',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    marginTop: '2rem',
  },
  footLink: { color: '#475569', textDecoration: 'none', fontSize: '0.8rem' },
};

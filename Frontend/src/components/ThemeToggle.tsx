import { useEffect, useRef, useState } from 'react';
import { useTheme, THEMES, type ThemeMeta } from '../contexts/ThemeContext';
import { useParticles, PARTICLE_STYLES, THEME_DEFAULT_PARTICLE, type ParticleStyle } from '../contexts/ParticleContext';

// ── Mini theme card inside the picker panel ───────────────────────────────────

function PickerCard({ theme, active, onClick }:
  { theme: ThemeMeta; active: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: active
          ? 'rgba(255,255,255,0.12)'
          : hov ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 14,
        padding: '0.6rem 0.65rem',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.18s ease',
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        boxShadow: active ? `0 0 0 1px rgba(255,255,255,0.15), 0 4px 20px rgba(0,0,0,0.4)` : 'none',
      }}
    >
      {/* Active dot */}
      {active && (
        <div style={{
          position: 'absolute', top: 6, right: 7,
          width: 7, height: 7, borderRadius: '50%',
          background: '#10b981', boxShadow: '0 0 8px #10b981',
        }} />
      )}

      {/* Colour swatches */}
      <div style={{ display: 'flex', gap: 3, marginBottom: '0.4rem' }}>
        {theme.swatches.map((c, i) => (
          <div key={i} style={{
            flex: 1, height: 16, borderRadius: 4, background: c,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: active && i > 0 ? `0 0 6px ${c}88` : 'none',
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: 1 }}>
        <span style={{ fontSize: '0.82rem' }}>{theme.icon}</span>
        <span style={{
          fontWeight: 700, fontSize: '0.73rem',
          color: active ? '#fff' : '#cbd5e1',
          letterSpacing: '0.01em',
        }}>{theme.name}</span>
      </div>
      <div style={{ fontSize: '0.6rem', color: '#64748b', lineHeight: 1.35 }}>
        {theme.tagline}
      </div>
    </button>
  );
}

// ── Particle Style Button ─────────────────────────────────────────────────────

function ParticleBtn({ ps, active, onClick }: {
  ps: typeof PARTICLE_STYLES[number];
  active: boolean;
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={ps.description}
      style={{
        flex: '1 1 auto',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.2rem',
        padding: '0.45rem 0.3rem',
        background: active ? 'rgba(255,255,255,0.1)' : hov ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        boxShadow: active ? '0 0 12px rgba(0,212,255,0.15)' : 'none',
      }}
    >
      <span style={{ fontSize: '0.9rem' }}>{ps.icon}</span>
      <span style={{
        fontSize: '0.58rem',
        fontWeight: active ? 700 : 500,
        color: active ? '#e2e8f0' : '#64748b',
        textAlign: 'center',
        lineHeight: 1.25,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
      }}>
        {ps.name}
      </span>
    </button>
  );
}

export default function ThemeToggle() {
  const { themeId, setTheme, themeMeta } = useTheme();
  const { particleStyle, setParticleStyle } = useParticles();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Trigger button */}
      <button
        className="theme-toggle"
        onClick={() => setOpen(o => !o)}
        title={`${themeMeta.name} — click to change theme`}
        aria-label="Change theme"
        aria-expanded={open}
        style={{ fontSize: '1.05rem', transition: 'all 0.2s' }}
      >
        {themeMeta.icon}
      </button>

      {/* Picker panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 12px)',
          right: 0,
          width: 380,
          background: 'rgba(4,6,16,0.97)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 22,
          padding: '1.1rem',
          zIndex: 9999,
          boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
          backdropFilter: 'blur(32px)',
          animation: 'slide-up 0.2s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.9rem' }}>
            <div>
              <div style={{ fontWeight: 800, color: '#f1f5f9', fontSize: '0.9rem', marginBottom: 2 }}>
                🎨 Choose Your Experience
              </div>
              <div style={{ fontSize: '0.63rem', color: '#475569' }}>
                Active: {themeMeta.icon} {themeMeta.name} — {themeMeta.tagline}
              </div>
            </div>
            <button onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '1rem', padding: '2px 6px', borderRadius: 6 }}>
              ✕
            </button>
          </div>

          {/* Theme grid — 2×4 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
            {THEMES.map(t => (
              <PickerCard
                key={t.id}
                theme={t}
                active={themeId === t.id}
                onClick={() => { setTheme(t.id); setOpen(false); }}
              />
            ))}
          </div>

          {/* Particle Style Picker */}
          <div style={{ marginTop: '0.85rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '0.45rem',
            }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.06em' }}>
                ✦ PARTICLE STYLE
              </span>
              {particleStyle !== THEME_DEFAULT_PARTICLE[themeId] && (
                <button
                  onClick={() => setParticleStyle(THEME_DEFAULT_PARTICLE[themeId] as ParticleStyle)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '0.58rem', color: '#475569',
                    padding: '1px 5px', borderRadius: 4,
                  }}
                >
                  reset
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {PARTICLE_STYLES.map(ps => (
                <ParticleBtn
                  key={ps.id}
                  ps={ps}
                  active={particleStyle === ps.id}
                  onClick={() => setParticleStyle(ps.id)}
                />
              ))}
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.58rem', color: '#334155', textAlign: 'center' }}>
              {PARTICLE_STYLES.find(p => p.id === particleStyle)?.description}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: '0.75rem', padding: '0.55rem 0.8rem',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, fontSize: '0.62rem', color: '#475569',
          }}>
            💡 Particle style is saved per theme — switch themes to see defaults
          </div>
        </div>
      )}
    </div>
  );
}

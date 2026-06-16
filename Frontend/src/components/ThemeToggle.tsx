import { useEffect, useRef, useState } from 'react';
import { useTheme, THEMES, type ThemeMeta } from '../contexts/ThemeContext';

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

// ── Main ThemeToggle ──────────────────────────────────────────────────────────

export default function ThemeToggle() {
  const { themeId, setTheme, themeMeta } = useTheme();
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

          {/* Footer */}
          <div style={{
            marginTop: '0.85rem', padding: '0.55rem 0.8rem',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, fontSize: '0.62rem', color: '#475569',
          }}>
            💡 Full theme controls & personalization score in{' '}
            <a href="/profile" onClick={() => setOpen(false)} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
              Settings
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

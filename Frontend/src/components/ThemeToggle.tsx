import { useEffect, useRef, useState } from 'react';
import { useTheme, THEMES, type ThemeMeta } from '../contexts/ThemeContext';

// ── Theme card inside the picker panel ───────────────────────────────────────

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
        border: `1px solid ${active ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 14,
        padding: '0.65rem 0.7rem',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.18s',
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {/* Active dot */}
      {active && (
        <div style={{
          position: 'absolute', top: 7, right: 8,
          width: 7, height: 7, borderRadius: '50%',
          background: '#10b981', boxShadow: '0 0 6px #10b981',
        }} />
      )}

      {/* Colour swatches */}
      <div style={{ display: 'flex', gap: 3, marginBottom: '0.45rem' }}>
        {theme.swatches.map((c, i) => (
          <div key={i} style={{
            flex: 1, height: 18, borderRadius: 5, background: c,
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: active && i > 0 ? `0 0 6px ${c}88` : 'none',
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: 2 }}>
        <span style={{ fontSize: '0.9rem' }}>{theme.icon}</span>
        <span style={{
          fontWeight: 700, fontSize: '0.78rem',
          color: active ? '#fff' : '#cbd5e1',
        }}>{theme.name}</span>
      </div>
      <div style={{ fontSize: '0.63rem', color: '#64748b', lineHeight: 1.4 }}>
        {theme.description}
      </div>
    </button>
  );
}

// ── Main ThemeToggle (renders the button + floating picker panel) ─────────────

export default function ThemeToggle() {
  const { themeId, setTheme, themeMeta } = useTheme();
  const [open, setOpen]   = useState(false);
  const wrapRef           = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Trigger */}
      <button
        className="theme-toggle"
        onClick={() => setOpen(o => !o)}
        title={`Theme: ${themeMeta.name} — click to change`}
        aria-label="Change theme"
        aria-expanded={open}
        style={{ fontSize: '1.05rem' }}
      >
        {themeMeta.icon}
      </button>

      {/* Picker panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 10px)',
          right: 0,
          width: 340,
          background: 'rgba(6,10,20,0.97)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 20,
          padding: '1rem',
          zIndex: 9999,
          boxShadow: '0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04)',
          backdropFilter: 'blur(28px)',
          animation: 'slide-up 0.18s ease both',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.88rem' }}>
                🎨 Choose Theme
              </div>
              <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 1 }}>
                Active: {themeMeta.icon} {themeMeta.name}
              </div>
            </div>
            <button onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 4 }}>
              ✕
            </button>
          </div>

          {/* Theme grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {THEMES.map(t => (
              <PickerCard
                key={t.id}
                theme={t}
                active={themeId === t.id}
                onClick={() => { setTheme(t.id); setOpen(false); }}
              />
            ))}
          </div>

          {/* Footer hint */}
          <div style={{ marginTop: '0.75rem', padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, fontSize: '0.65rem', color: '#475569', lineHeight: 1.5 }}>
            💡 Themes apply instantly and are saved to your session. Full theme controls in{' '}
            <a href="/profile" onClick={() => setOpen(false)} style={{ color: '#00D4FF', textDecoration: 'none' }}>Settings</a>.
          </div>
        </div>
      )}
    </div>
  );
}

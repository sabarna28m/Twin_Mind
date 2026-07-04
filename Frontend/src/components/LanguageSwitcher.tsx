import { useEffect, useRef, useState } from 'react';
import { Globe } from 'lucide-react';
import { LANGUAGES, useLanguage } from '../contexts/LanguageContext';
import type { LangCode } from '../contexts/LanguageContext';

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(code: LangCode) {
    setLang(code);
    setOpen(false);
  }

  const currentLang = LANGUAGES.find(l => l.code === lang);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          ...s.trigger,
          background: open ? 'rgba(99,102,241,0.12)' : 'transparent',
          borderColor: open ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.12)',
        }}
        title="Switch language"
        aria-label="Language selector"
        aria-expanded={open}
      >
        <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em' }}>{currentLang?.flag ?? <Globe size={14} />}</span>
        <span style={s.langCode}>{lang.toUpperCase()}</span>
        <span style={{ ...s.chevron, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>

      {open && (
        <div style={s.dropdown}>
          <div style={s.dropHeader}>
            <span style={{ ...s.dropTitle, display:'flex', alignItems:'center', gap:4 }}><Globe size={12} /> Language</span>
          </div>
          <div style={s.dropdownInner}>
            {LANGUAGES.map(l => {
              const isActive = lang === l.code;
              const isHovered = hovered === l.code;
              return (
                <button
                  key={l.code}
                  onClick={() => pick(l.code)}
                  onMouseEnter={() => setHovered(l.code)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    ...s.item,
                    background: isActive
                      ? 'rgba(99,102,241,0.18)'
                      : isHovered
                      ? 'rgba(255,255,255,0.07)'
                      : 'transparent',
                    borderColor: isActive
                      ? 'rgba(99,102,241,0.45)'
                      : isHovered
                      ? 'rgba(255,255,255,0.1)'
                      : 'transparent',
                  }}
                >
                  <span style={{ ...s.flag, fontSize: '0.65rem', fontWeight: 700 }}>{l.flag}</span>
                  <span style={{ ...s.native, color: isActive ? '#a5b4fc' : 'var(--text-h)' }}>{l.native}</span>
                  <span style={s.label}>{l.label}</span>
                  {isActive && <span style={s.check}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  trigger: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.35rem 0.7rem',
    border: '1px solid',
    borderRadius: '9px', cursor: 'pointer', color: 'var(--text)',
    fontFamily: 'inherit',
    transition: 'background 0.15s, border-color 0.15s',
  },
  langCode: {
    fontSize: '0.72rem', fontWeight: 700,
    letterSpacing: '0.05em', color: 'var(--text-h)',
  },
  chevron: {
    fontSize: '0.6rem', color: 'rgba(148,163,184,0.6)',
    transition: 'transform 0.2s',
    display: 'inline-block',
    lineHeight: 1,
  },
  dropdown: {
    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
    zIndex: 400, minWidth: '230px',
    background: 'rgba(10, 18, 40, 0.96)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.08)',
    overflow: 'hidden',
    animation: 'fadeSlideDown 0.18s cubic-bezier(0.16,1,0.3,1)',
  },
  dropHeader: {
    padding: '0.65rem 0.9rem 0.4rem',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  dropTitle: {
    fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em',
    textTransform: 'uppercase' as const, color: 'rgba(148,163,184,0.5)',
  },
  dropdownInner: {
    maxHeight: '300px', overflowY: 'auto',
    padding: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.15rem',
  },
  item: {
    display: 'flex', alignItems: 'center', gap: '0.7rem',
    padding: '0.52rem 0.75rem', borderRadius: '10px',
    border: '1px solid',
    cursor: 'pointer', fontFamily: 'inherit',
    textAlign: 'left' as const, width: '100%',
    transition: 'background 0.12s, border-color 0.12s',
  },
  flag:   { fontSize: '1.2rem', lineHeight: 1, flexShrink: 0 },
  native: { fontSize: '0.84rem', fontWeight: 600, flex: 1, transition: 'color 0.12s' },
  label:  { fontSize: '0.68rem', color: 'rgba(148,163,184,0.55)', flexShrink: 0 },
  check:  { color: '#818cf8', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 },
};

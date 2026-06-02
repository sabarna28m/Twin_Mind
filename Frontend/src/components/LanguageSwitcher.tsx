import { useEffect, useRef, useState } from 'react';
import { LANGUAGES, useLanguage } from '../contexts/LanguageContext';
import type { LangCode } from '../contexts/LanguageContext';

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={s.trigger}
        title="Switch language"
        aria-label="Language selector"
      >
        <span style={{ fontSize: '1rem', lineHeight: 1 }}>🌐</span>
        <span style={s.langCode}>{lang.toUpperCase()}</span>
      </button>

      {open && (
        <div style={s.dropdown}>
          <div style={s.dropdownInner}>
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => pick(l.code)}
                style={{ ...s.item, ...(lang === l.code ? s.itemActive : {}) }}
              >
                <span style={s.flag}>{l.flag}</span>
                <span style={s.native}>{l.native}</span>
                <span style={s.label}>{l.label}</span>
                {lang === l.code && <span style={s.check}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  trigger: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.35rem 0.65rem',
    background: 'transparent', border: '1px solid var(--border)',
    borderRadius: '8px', cursor: 'pointer', color: 'var(--text)',
    fontFamily: 'inherit', transition: 'background 0.15s, border-color 0.15s',
  },
  langCode: {
    fontSize: '0.72rem', fontWeight: 700,
    letterSpacing: '0.05em', color: 'var(--text-h)',
  },
  dropdown: {
    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
    zIndex: 200, minWidth: '220px',
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: '14px', boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  dropdownInner: {
    maxHeight: '320px', overflowY: 'auto',
    padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem',
  },
  item: {
    display: 'flex', alignItems: 'center', gap: '0.7rem',
    padding: '0.55rem 0.8rem', borderRadius: '10px',
    background: 'transparent', border: '1.5px solid transparent',
    cursor: 'pointer', fontFamily: 'inherit',
    textAlign: 'left' as const, width: '100%',
    transition: 'background 0.12s',
  },
  itemActive: {
    background: 'rgba(99,102,241,0.12)',
    border: '1.5px solid rgba(99,102,241,0.35)',
  },
  flag:  { fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 },
  native: { fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-h)', flex: 1 },
  label: { fontSize: '0.7rem', color: 'var(--text)', flexShrink: 0 },
  check: { color: '#818cf8', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 },
};

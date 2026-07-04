import { useEffect } from 'react';
import { Globe } from 'lucide-react';
import { LANGUAGES, useLanguage } from '../contexts/LanguageContext';
import type { LangCode } from '../contexts/LanguageContext';

interface Props {
  onClose: () => void;
}

export default function LanguageModal({ onClose }: Props) {
  const { lang, setLang, t } = useLanguage();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function pick(code: LangCode) {
    setLang(code);
    onClose();
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>

        <div style={s.header}>
          <div>
            <p style={{ ...s.title, display:'flex', alignItems:'center', gap:6 }}><Globe size={16} style={{ flexShrink:0 }} />{t('language_title')}</p>
            <p style={s.sub}>{t('language_select')}</p>
          </div>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <div style={s.grid}>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => pick(l.code)}
              style={{
                ...s.langBtn,
                ...(lang === l.code ? s.langBtnActive : {}),
              }}
            >
              <span style={{ ...s.flag, fontSize: '0.65rem', fontWeight: 700 }}>{l.flag}</span>
              <div style={s.langText}>
                <span style={{ ...s.native, color: lang === l.code ? '#818cf8' : 'var(--text-h)' }}>
                  {l.native}
                </span>
                <span style={s.label}>{l.label}</span>
              </div>
              {lang === l.code && <span style={s.check}>✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(4px)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 200, padding: '1rem',
  },
  modal: {
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: '18px', width: '100%', maxWidth: '420px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)',
  },
  title: { margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-h)' },
  sub: { margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text)' },
  closeBtn: {
    background: 'transparent', border: 'none', color: 'var(--text)',
    fontSize: '1.1rem', cursor: 'pointer', padding: '0.2rem 0.4rem',
    borderRadius: '6px', lineHeight: 1,
  },
  grid: {
    display: 'flex', flexDirection: 'column', gap: '0.35rem',
    padding: '1rem 1.25rem 1.25rem',
  },
  langBtn: {
    display: 'flex', alignItems: 'center', gap: '0.85rem',
    padding: '0.75rem 1rem', borderRadius: '12px',
    background: 'var(--bg-surface)', border: '1.5px solid var(--border)',
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.15s', textAlign: 'left' as const, width: '100%',
  },
  langBtnActive: {
    background: 'rgba(99,102,241,0.1)', border: '1.5px solid rgba(99,102,241,0.5)',
  },
  flag: { fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 },
  langText: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.1rem' },
  native: { fontSize: '0.9rem', fontWeight: 600 },
  label: { fontSize: '0.72rem', color: 'var(--text)', fontWeight: 400 },
  check: { color: '#818cf8', fontWeight: 700, fontSize: '1rem', flexShrink: 0 },
};

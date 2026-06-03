import { useState, useEffect, useCallback } from 'react';

// Unambiguous characters only (no 0/O, 1/I/l)
const POOL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const COLORS = [
  '#00D4FF', '#FF6B6B', '#FFD93D', '#6BCB77',
  '#FF9F43', '#a78bfa', '#f472b6', '#34d399',
];
const LEN = 6;

function rnd(min: number, max: number) {
  return min + Math.random() * (max - min);
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface CharMeta { color: string; rot: number; y: number; scale: number }
interface NoiseLine { x1: number; y1: number; x2: number; y2: number; color: string; opacity: number; width: number }

function makeCode(): string {
  return Array.from({ length: LEN }, () => POOL[Math.floor(Math.random() * POOL.length)]).join('');
}

function makeState(code: string) {
  const chars: CharMeta[] = code.split('').map(() => ({
    color: pick(COLORS),
    rot:   rnd(-14, 14),
    y:     rnd(-6, 6),
    scale: rnd(0.88, 1.14),
  }));
  const lines: NoiseLine[] = Array.from({ length: 7 }, () => ({
    x1: rnd(0, 100), y1: rnd(0, 100),
    x2: rnd(0, 100), y2: rnd(0, 100),
    color: pick(COLORS),
    opacity: rnd(0.18, 0.42),
    width: rnd(1, 2),
  }));
  return { code, chars, lines };
}

function fresh() {
  const code = makeCode();
  return makeState(code);
}

interface Props {
  onValid: (valid: boolean) => void;
  resetKey?: number;
}

export default function CustomCaptcha({ onValid, resetKey }: Props) {
  const [st, setSt]     = useState(fresh);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    setSt(fresh());
    setInput('');
    setError('');
    onValid(false);
  }, [onValid]);

  // Parent can force a reset by incrementing resetKey
  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) refresh();
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleInput(raw: string) {
    const val = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LEN);
    setInput(val);
    setError('');

    if (val === st.code) {
      onValid(true);
    } else {
      onValid(false);
      if (val.length === LEN) {
        // Full wrong attempt — show error and regenerate
        setError('Incorrect CAPTCHA, please try again');
        setTimeout(() => {
          setSt(fresh());
          setInput('');
          setError('');
          onValid(false);
        }, 1000);
      }
    }
  }

  const isMatch = input === st.code;

  return (
    <div style={c.wrap}>
      <div style={c.labelRow}>
        <span style={c.label}>Security Check</span>
        <button type="button" onClick={refresh} style={c.refreshBtn} title="Generate new code">
          ↺ New code
        </button>
      </div>

      {/* ── CAPTCHA display box ── */}
      <div style={c.box}>
        {/* SVG noise overlay */}
        <svg
          viewBox="0 0 260 68"
          preserveAspectRatio="none"
          style={c.svg}
        >
          {/* dot grid texture */}
          {Array.from({ length: 12 }, (_, xi) =>
            Array.from({ length: 4 }, (_, yi) => (
              <circle
                key={`${xi}-${yi}`}
                cx={xi * 22 + 8}
                cy={yi * 18 + 7}
                r={1}
                fill="rgba(255,255,255,0.06)"
              />
            ))
          )}
          {/* random stroke lines */}
          {st.lines.map((l, i) => (
            <line
              key={i}
              x1={`${l.x1}%`} y1={`${l.y1}%`}
              x2={`${l.x2}%`} y2={`${l.y2}%`}
              stroke={l.color}
              strokeWidth={l.width}
              opacity={l.opacity}
              strokeLinecap="round"
            />
          ))}
        </svg>

        {/* Characters */}
        {st.code.split('').map((ch, i) => (
          <span
            key={i}
            style={{
              ...c.char,
              color: st.chars[i].color,
              textShadow: `0 0 14px ${st.chars[i].color}99, 0 0 4px ${st.chars[i].color}66`,
              transform: `rotate(${st.chars[i].rot}deg) translateY(${st.chars[i].y}px) scale(${st.chars[i].scale})`,
            }}
          >
            {ch}
          </span>
        ))}
      </div>

      {/* ── Input ── */}
      <input
        className="dark-input"
        type="text"
        value={input}
        onChange={e => handleInput(e.target.value)}
        placeholder="Type the code above"
        maxLength={LEN}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        style={{
          ...c.input,
          borderColor: isMatch
            ? 'rgba(16,185,129,0.6)'
            : error
              ? 'rgba(239,68,68,0.5)'
              : undefined,
          boxShadow: isMatch
            ? '0 0 0 3px rgba(16,185,129,0.12)'
            : error
              ? '0 0 0 3px rgba(239,68,68,0.1)'
              : undefined,
        }}
      />

      {/* ── Error ── */}
      {error && <p style={c.error}>{error}</p>}
      {isMatch && <p style={c.success}>✓ CAPTCHA verified</p>}
    </div>
  );
}

const c: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0' },

  labelRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '0.45rem',
  },
  label: {
    fontSize: '0.75rem', fontWeight: 600, color: '#64748b',
    letterSpacing: '0.06em', textTransform: 'uppercase',
  },
  refreshBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#00D4FF', fontSize: '0.72rem', fontWeight: 700,
    fontFamily: 'inherit', padding: '0.1rem 0.3rem',
    borderRadius: '6px', opacity: 0.8,
    transition: 'opacity 0.15s',
  },

  box: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    height: '72px',
    background: 'linear-gradient(135deg, #090e1f 0%, #0d1428 60%, #080c1c 100%)',
    border: '1px solid rgba(0,212,255,0.2)',
    borderRadius: '10px',
    overflow: 'hidden',
    padding: '0 1rem',
    boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.4)',
    userSelect: 'none',
  },

  svg: {
    position: 'absolute', inset: 0,
    width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: 1,
  },

  char: {
    display: 'inline-block',
    position: 'relative', zIndex: 2,
    fontSize: '1.85rem',
    fontWeight: 900,
    fontFamily: '"Courier New", "Courier", monospace',
    lineHeight: 1,
    letterSpacing: 0,
  },

  input: {
    marginTop: '0.5rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    fontFamily: '"Courier New", monospace',
    fontWeight: 700,
    fontSize: '1.05rem',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },

  error: {
    margin: '0.4rem 0 0',
    fontSize: '0.78rem',
    color: '#f87171',
    fontWeight: 500,
  },
  success: {
    margin: '0.4rem 0 0',
    fontSize: '0.78rem',
    color: '#34d399',
    fontWeight: 600,
  },
};

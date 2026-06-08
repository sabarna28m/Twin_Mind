/** Requirements checked in real time */
export interface PasswordReqs {
  length:  boolean; // >= 8 chars
  upper:   boolean; // at least one A-Z
  lower:   boolean; // at least one a-z
  number:  boolean; // at least one 0-9
  special: boolean; // at least one non-alphanumeric
}

export function checkPasswordReqs(pw: string): PasswordReqs {
  return {
    length:  pw.length >= 8,
    upper:   /[A-Z]/.test(pw),
    lower:   /[a-z]/.test(pw),
    number:  /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
}

type StrengthLevel = 'weak' | 'medium' | 'strong';

export function getStrengthLevel(reqs: PasswordReqs): StrengthLevel {
  const met = Object.values(reqs).filter(Boolean).length;
  if (met <= 2) return 'weak';
  if (met <= 4) return 'medium';
  return 'strong';
}

const LEVEL_CFG: Record<StrengthLevel, { label: string; color: string; pct: string }> = {
  weak:   { label: 'Weak',   color: '#ef4444', pct: '33%'  },
  medium: { label: 'Medium', color: '#f59e0b', pct: '66%'  },
  strong: { label: 'Strong', color: '#10b981', pct: '100%' },
};

const RULES: Array<{ key: keyof PasswordReqs; text: string }> = [
  { key: 'length',  text: 'At least 8 characters'  },
  { key: 'upper',   text: 'One uppercase letter'    },
  { key: 'lower',   text: 'One lowercase letter'    },
  { key: 'number',  text: 'One number'              },
  { key: 'special', text: 'One special character'   },
];

/**
 * Shows a colour-coded strength bar and a ✓/○ requirements checklist.
 * Renders nothing when password is empty.
 */
export default function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const reqs  = checkPasswordReqs(password);
  const level = getStrengthLevel(reqs);
  const { label, color, pct } = LEVEL_CFG[level];

  return (
    <div style={{ marginTop: '0.55rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

      {/* Animated strength bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div style={{
          flex: 1, height: '4px',
          background: 'rgba(255,255,255,0.07)',
          borderRadius: '99px', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: pct,
            background: color,
            borderRadius: '99px',
            transition: 'width 0.35s ease, background 0.35s ease',
          }} />
        </div>
        <span style={{
          fontSize: '0.68rem', fontWeight: 700,
          color, minWidth: '44px', textAlign: 'right' as const,
        }}>
          {label}
        </span>
      </div>

      {/* Requirements checklist — two columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.2rem 0.4rem',
      }}>
        {RULES.map(({ key, text }) => (
          <span key={key} style={{
            display: 'flex', alignItems: 'center',
            gap: '0.3rem', fontSize: '0.69rem',
            color: reqs[key] ? '#94a3b8' : '#475569',
          }}>
            <span style={{
              color: reqs[key] ? '#10b981' : '#334155',
              fontWeight: 700, fontSize: '0.72rem',
            }}>
              {reqs[key] ? '✓' : '○'}
            </span>
            {text}
          </span>
        ))}
      </div>

    </div>
  );
}

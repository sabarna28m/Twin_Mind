import { useEffect, useState } from 'react';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

interface Props {
  badges: Badge[];
  onDone: () => void;
}

export default function BadgeNotification({ badges, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (badges.length === 0) return;
    setIndex(0);
    setVisible(true);
  }, [badges]);

  useEffect(() => {
    if (badges.length === 0) return;
    const showDuration = 3600;
    const fadeDuration = 350;

    const fadeTimer = setTimeout(() => {
      setVisible(false);
    }, showDuration);

    const nextTimer = setTimeout(() => {
      if (index < badges.length - 1) {
        setIndex(i => i + 1);
        setVisible(true);
      } else {
        onDone();
      }
    }, showDuration + fadeDuration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(nextTimer);
    };
  }, [index, badges.length, onDone]);

  if (badges.length === 0 || index >= badges.length) return null;

  const badge = badges[index];

  return (
    <div
      style={{
        ...n.toast,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(-12px) scale(0.97)',
        borderColor: badge.color + '80',
        boxShadow: `0 8px 32px ${badge.color}33, 0 0 0 1px ${badge.color}25, 0 2px 8px rgba(0,0,0,0.3)`,
      }}
    >
      <div style={{ ...n.glow, background: badge.color + '18' }} />
      <span style={n.icon}>{badge.icon}</span>
      <div style={n.body}>
        <p style={n.unlocked}>Badge Unlocked!</p>
        <p style={{ ...n.name, color: badge.color }}>{badge.name}</p>
        <p style={n.desc}>{badge.description}</p>
      </div>
      {badges.length > 1 && (
        <span style={n.counter}>{index + 1}/{badges.length}</span>
      )}
      <button
        onClick={() => { setVisible(false); setTimeout(onDone, 350); }}
        style={n.close}
        aria-label="Dismiss"
      >×</button>
    </div>
  );
}

const n: Record<string, React.CSSProperties> = {
  toast: {
    position: 'fixed',
    top: '1.25rem',
    right: '1.25rem',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    padding: '1rem 1.25rem',
    background: 'var(--bg)',
    border: '1px solid',
    borderRadius: '16px',
    minWidth: '280px',
    maxWidth: '340px',
    transition: 'opacity 0.35s ease, transform 0.35s ease',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    inset: 0,
    borderRadius: '16px',
    pointerEvents: 'none',
  },
  icon: {
    fontSize: '2rem',
    flexShrink: 0,
    position: 'relative',
    zIndex: 1,
    filter: 'drop-shadow(0 0 8px currentColor)',
  },
  body: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    zIndex: 1,
  },
  unlocked: {
    margin: '0 0 0.1rem',
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--text)',
  },
  name: {
    margin: '0 0 0.15rem',
    fontSize: '0.95rem',
    fontWeight: 700,
  },
  desc: {
    margin: 0,
    fontSize: '0.75rem',
    color: 'var(--text)',
    lineHeight: '1.4',
  },
  counter: {
    position: 'absolute' as const,
    top: '0.6rem',
    right: '2.25rem',
    fontSize: '0.65rem',
    color: 'var(--text)',
    fontWeight: 600,
  },
  close: {
    position: 'absolute' as const,
    top: '0.5rem',
    right: '0.75rem',
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    fontSize: '1.1rem',
    cursor: 'pointer',
    lineHeight: 1,
    padding: '0.1rem 0.2rem',
    borderRadius: '4px',
    zIndex: 1,
  },
};

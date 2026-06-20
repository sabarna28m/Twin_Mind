import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import type { StreakShieldStatus } from '../utils/gamification';
import { MAX_SHIELDS, RECOVERY_COST, STREAK_MILESTONES } from '../utils/gamification';

interface Props {
  onRecoverySuccess?: (streak: number) => void;
}

export default function StreakShieldCard({ onRecoverySuccess }: Props) {
  const [status, setStatus]     = useState<StreakShieldStatus | null>(null);
  const [recovering, setRecov]  = useState(false);
  const [msg, setMsg]           = useState<string | null>(null);

  useEffect(() => {
    api.get<StreakShieldStatus>('/streak-protection/status')
      .then(r => setStatus(r.data))
      .catch(() => {});
  }, []);

  if (!status) return null;

  const nextMilestone = status.next_milestone
    ?? STREAK_MILESTONES.find(m => m > status.streak_days)
    ?? null;
  const daysToMilestone = nextMilestone ? nextMilestone - status.streak_days : null;
  const recoveryMins    = status.recovery_deadline
    ? Math.max(0, Math.floor((new Date(status.recovery_deadline).getTime() - Date.now()) / 60000))
    : null;

  async function handleRecover() {
    setRecov(true); setMsg(null);
    try {
      const { data } = await api.post('/streak-protection/recover-streak');
      setMsg('Streak recovered!');
      setStatus(prev => prev ? { ...prev, streak_days: data.streak_days, can_recover: false, available_xp: data.available_xp } : prev);
      onRecoverySuccess?.(data.streak_days);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMsg(detail ?? 'Recovery failed.');
    } finally {
      setRecov(false);
    }
  }

  const shieldBarW = `${(status.shield_count / MAX_SHIELDS) * 100}%`;
  const streakColor = status.streak_days >= 30 ? '#f59e0b' : status.streak_days >= 7 ? '#f97316' : '#00D4FF';

  return (
    <div style={s.card} className="glass-panel">
      {/* Header */}
      <div style={s.header}>
        <span style={s.title}>Streak Protection</span>
        <Link to="/shop" style={s.shopLink}>🛒 XP Shop</Link>
      </div>

      {/* Main stats row */}
      <div style={s.statsRow}>
        {/* Streak */}
        <div style={s.stat}>
          <span style={s.statIcon}>🔥</span>
          <div>
            <p style={s.statLabel}>Current Streak</p>
            <p style={{ ...s.statValue, color: streakColor }}>{status.streak_days} days</p>
          </div>
        </div>

        {/* Shields */}
        <div style={s.stat}>
          <span style={s.statIcon}>🛡️</span>
          <div>
            <p style={s.statLabel}>Shields</p>
            <p style={{ ...s.statValue, color: '#a78bfa' }}>
              {status.shield_count} / {MAX_SHIELDS}
            </p>
          </div>
        </div>

        {/* Last check-in */}
        <div style={s.stat}>
          <span style={s.statIcon}>📅</span>
          <div>
            <p style={s.statLabel}>Last Check-in</p>
            <p style={{ ...s.statValue, color: '#94a3b8', fontSize: '0.82rem' }}>
              {status.last_checkin
                ? new Date(status.last_checkin + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })
                : 'Never'}
            </p>
          </div>
        </div>

        {/* Recovery */}
        <div style={s.stat}>
          <span style={s.statIcon}>⚡</span>
          <div>
            <p style={s.statLabel}>Recovery</p>
            <p style={{ ...s.statValue, color: status.can_recover ? '#10b981' : '#64748b', fontSize: '0.82rem' }}>
              {status.can_recover ? 'Available' : status.recovery_used_this_month ? 'Used' : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Shield progress bar */}
      <div style={s.barWrap}>
        <div style={s.barTrack}>
          <div style={{ ...s.barFill, width: shieldBarW }} />
          {Array.from({ length: MAX_SHIELDS - 1 }).map((_, i) => (
            <div key={i} style={{ ...s.barTick, left: `${((i + 1) / MAX_SHIELDS) * 100}%` }} />
          ))}
        </div>
        <span style={s.barLabel}>{status.shield_count}/{MAX_SHIELDS} shields</span>
      </div>

      {/* Next milestone */}
      {nextMilestone && (
        <div style={s.milestone}>
          <span style={s.milestoneIcon}>🎯</span>
          <span style={s.milestoneText}>
            <strong>{daysToMilestone} day{daysToMilestone !== 1 ? 's' : ''}</strong> to {nextMilestone}-day streak
            {nextMilestone === 7 && ' → +1 Shield'}
            {nextMilestone === 30 && ' → +2 Shields'}
            {nextMilestone === 100 && ' → +3 Shields'}
          </span>
        </div>
      )}

      {/* Recovery prompt */}
      {status.can_recover && (
        <div style={s.recoveryBox}>
          <div style={s.recoveryInfo}>
            <p style={s.recoveryTitle}>⚡ Streak Recovery Available</p>
            <p style={s.recoverySub}>
              Recover your streak for {RECOVERY_COST} XP
              {recoveryMins !== null && ` · ${recoveryMins}m remaining`}
            </p>
          </div>
          <button
            style={s.recoverBtn}
            onClick={handleRecover}
            disabled={recovering}
          >
            {recovering ? '...' : `Recover (${RECOVERY_COST} XP)`}
          </button>
        </div>
      )}

      {msg && <p style={{ ...s.msg, color: msg.includes('!') ? '#10b981' : '#ef4444' }}>{msg}</p>}

      {/* Footer links */}
      <div style={s.footer}>
        <Link to="/shop" style={s.footerLink}>🛡️ Buy Shield ({100} XP)</Link>
        <Link to="/checkin" style={s.footerLink}>📋 Log Check-in</Link>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(var(--primary-rgb),0.18)',
    borderRadius: 'var(--card-radius,18px)',
    padding: '1.25rem 1.4rem',
    display: 'flex', flexDirection: 'column', gap: '0.85rem',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  title: {
    fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'var(--text-h)',
  },
  shopLink: {
    fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)',
    textDecoration: 'none', opacity: 0.85,
  },
  statsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem',
  },
  stat: {
    display: 'flex', alignItems: 'center', gap: '0.45rem',
    background: 'rgba(255,255,255,0.04)', borderRadius: '10px',
    padding: '0.55rem 0.6rem',
  },
  statIcon: { fontSize: '1.1rem', flexShrink: 0 },
  statLabel: {
    margin: 0, fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: 'rgba(148,163,184,0.5)',
  },
  statValue: { margin: 0, fontSize: '0.9rem', fontWeight: 800, lineHeight: 1.2 },

  barWrap: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  barTrack: {
    flex: 1, height: '6px', borderRadius: '3px',
    background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'visible',
  },
  barFill: {
    height: '100%', borderRadius: '3px',
    background: 'linear-gradient(90deg,#6366f1,#a78bfa)',
    transition: 'width 0.4s ease',
    boxShadow: '0 0 8px rgba(99,102,241,0.5)',
  },
  barTick: {
    position: 'absolute', top: '-2px', width: '1px', height: '10px',
    background: 'rgba(255,255,255,0.15)', transform: 'translateX(-50%)',
  },
  barLabel: { fontSize: '0.68rem', color: 'rgba(148,163,184,0.5)', whiteSpace: 'nowrap', fontWeight: 600 },

  milestone: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'rgba(var(--primary-rgb),0.07)',
    border: '1px solid rgba(var(--primary-rgb),0.14)',
    borderRadius: '10px', padding: '0.5rem 0.75rem',
  },
  milestoneIcon: { fontSize: '0.9rem' },
  milestoneText: { fontSize: '0.76rem', color: 'var(--text)', lineHeight: 1.4 },

  recoveryBox: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    background: 'rgba(16,185,129,0.07)',
    border: '1px solid rgba(16,185,129,0.2)',
    borderRadius: '12px', padding: '0.65rem 0.85rem',
  },
  recoveryInfo: { flex: 1 },
  recoveryTitle: { margin: 0, fontSize: '0.78rem', fontWeight: 800, color: '#10b981' },
  recoverySub: { margin: 0, fontSize: '0.68rem', color: 'rgba(148,163,184,0.6)' },
  recoverBtn: {
    padding: '0.42rem 0.85rem', borderRadius: '9px', fontFamily: 'inherit',
    background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)',
    color: '#10b981', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
    whiteSpace: 'nowrap', transition: 'background 0.18s',
  },

  msg: { margin: 0, fontSize: '0.75rem', fontWeight: 600 },

  footer: { display: 'flex', gap: '0.75rem' },
  footerLink: {
    fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)',
    textDecoration: 'none', opacity: 0.75,
    padding: '0.3rem 0.65rem',
    background: 'rgba(var(--primary-rgb),0.07)',
    border: '1px solid rgba(var(--primary-rgb),0.15)',
    borderRadius: '8px',
  },
};

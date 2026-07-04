import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Flame, Calendar, RefreshCw } from 'lucide-react';
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
  const streakColor = status.streak_days >= 30 ? '#d97706' : status.streak_days >= 7 ? '#ea580c' : '#0052cc';

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.title}>Streak Protection</span>
        <Link to="/shield" style={s.shopLink}> XP Shop</Link>
      </div>

      {/* Main stats row */}
      <div style={s.statsRow}>
        {/* Streak */}
        <div style={s.stat}>
          <span style={s.statIcon}><Flame size={20} style={{ color: '#f97316' }} /></span>
          <div>
            <p style={s.statLabel}>Current Streak</p>
            <p style={{ ...s.statValue, color: streakColor }}>{status.streak_days} days</p>
          </div>
        </div>

        {/* Shields */}
        <div style={s.stat}>
          <span style={s.statIcon}><Shield size={20} style={{ color: '#7c3aed' }} /></span>
          <div>
            <p style={s.statLabel}>Shields</p>
            <p style={{ ...s.statValue, color: '#7c3aed' }}>
              {status.shield_count} / {MAX_SHIELDS}
            </p>
          </div>
        </div>

        {/* Last check-in */}
        <div style={s.stat}>
          <span style={s.statIcon}><Calendar size={20} style={{ color: '#64748b' }} /></span>
          <div>
            <p style={s.statLabel}>Last Check-in</p>
            <p style={{ ...s.statValue, color: '#64748b', fontSize: '0.85rem' }}>
              {status.last_checkin
                ? new Date(status.last_checkin + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })
                : 'Never'}
            </p>
          </div>
        </div>

        {/* Recovery */}
        <div style={s.stat}>
          <span style={s.statIcon}><RefreshCw size={20} style={{ color: '#059669' }} /></span>
          <div>
            <p style={s.statLabel}>Recovery</p>
            <p style={{ ...s.statValue, color: status.can_recover ? '#059669' : '#64748b', fontSize: '0.85rem' }}>
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
          <span style={s.milestoneIcon}></span>
          <span style={s.milestoneText}>
            <strong style={{color: '#0f172a'}}>{daysToMilestone} day{daysToMilestone !== 1 ? 's' : ''}</strong> to {nextMilestone}-day streak
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
            <p style={s.recoveryTitle}> Streak Recovery Available</p>
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

      {msg && <p style={{ ...s.msg, color: msg.includes('!') ? '#059669' : '#b91c1c' }}>{msg}</p>}

      {/* Footer links */}
      <div style={s.footer}>
        <Link to="/shield" style={{ ...s.footerLink, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Shield size={12} /> Buy Shield ({100} XP)</Link>
        <Link to="/checkin" style={s.footerLink}>Log Check-in</Link>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '24px',
    padding: '2rem',
    display: 'flex', flexDirection: 'column', gap: '1rem',
    boxShadow: '0 8px 32px rgba(0,0,0,0.03)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: '#0f172a',
  },
  shopLink: {
    fontSize: '0.8rem', fontWeight: 700, color: '#0052cc',
    textDecoration: 'none',
  },
  statsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem',
  },
  stat: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: '#f8f9fa', borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '0.75rem',
  },
  statIcon: { fontSize: '1.25rem', flexShrink: 0 },
  statLabel: {
    margin: 0, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: '#64748b',
  },
  statValue: { margin: 0, fontSize: '1rem', fontWeight: 800, lineHeight: 1.2 },

  barWrap: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' },
  barTrack: {
    flex: 1, height: '8px', borderRadius: '4px',
    background: '#e2e8f0', position: 'relative', overflow: 'visible',
  },
  barFill: {
    height: '100%', borderRadius: '4px',
    background: 'linear-gradient(90deg, #0052cc, #6366f1)',
    transition: 'width 0.4s ease',
  },
  barTick: {
    position: 'absolute', top: '-2px', width: '2px', height: '12px',
    background: '#ffffff', transform: 'translateX(-50%)', borderRadius: '1px'
  },
  barLabel: { fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', fontWeight: 700 },

  milestone: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    background: '#f8f9fa',
    border: '1px solid #e2e8f0',
    borderRadius: '12px', padding: '0.75rem 1rem',
  },
  milestoneIcon: { fontSize: '1.1rem' },
  milestoneText: { fontSize: '0.85rem', color: '#475569', lineHeight: 1.4 },

  recoveryBox: {
    display: 'flex', alignItems: 'center', gap: '1rem',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: '16px', padding: '1rem 1.25rem',
  },
  recoveryInfo: { flex: 1 },
  recoveryTitle: { margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#059669' },
  recoverySub: { margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#047857' },
  recoverBtn: {
    padding: '0.6rem 1.2rem', borderRadius: '99px', fontFamily: 'inherit',
    background: '#10b981', border: 'none',
    color: '#ffffff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
    whiteSpace: 'nowrap', transition: 'background 0.18s, transform 0.18s',
  },

  msg: { margin: 0, fontSize: '0.85rem', fontWeight: 600 },

  footer: { display: 'flex', gap: '0.75rem', marginTop: '0.5rem' },
  footerLink: {
    fontSize: '0.8rem', fontWeight: 700, color: '#0f172a',
    textDecoration: 'none',
    padding: '0.5rem 1rem',
    background: '#f8f9fa',
    border: '1px solid #e2e8f0',
    borderRadius: '99px',
    transition: 'background 0.2s',
  },
};

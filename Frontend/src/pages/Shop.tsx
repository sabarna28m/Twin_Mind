import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import api from '../services/api';
import type { GamificationProgress, StreakShieldStatus } from '../utils/gamification';
import { MAX_SHIELDS, RECOVERY_COST, SHIELD_COST } from '../utils/gamification';

interface Purchase { ok: boolean; shield_count: number; available_xp: number }

export default function Shop() {
  const [prog,   setProg]   = useState<GamificationProgress | null>(null);
  const [shield, setShield] = useState<StreakShieldStatus | null>(null);
  const [buying, setBuying] = useState(false);
  const [msg,    setMsg]    = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.get<GamificationProgress>('/gamification/progress').then(r => setProg(r.data)).catch(() => {});
    api.get<StreakShieldStatus>('/streak-protection/status').then(r => setShield(r.data)).catch(() => {});
  }, []);

  const availableXp   = shield?.available_xp ?? (prog ? prog.xp : 0);
  const shieldCount   = shield?.shield_count ?? 0;
  const canBuy        = availableXp >= SHIELD_COST && shieldCount < MAX_SHIELDS;
  const atMaxShields  = shieldCount >= MAX_SHIELDS;

  async function handleBuy() {
    setBuying(true); setMsg(null);
    try {
      const { data } = await api.post<Purchase>('/streak-protection/buy-shield');
      setShield(prev => prev ? { ...prev, shield_count: data.shield_count, available_xp: data.available_xp } : prev);
      setMsg({ ok: true, text: `Shield purchased! You now have ${data.shield_count} shield${data.shield_count !== 1 ? 's' : ''}.` });
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMsg({ ok: false, text: detail ?? 'Purchase failed.' });
    } finally {
      setBuying(false);
    }
  }

  return (
    <div style={p.shell}>
      <header style={p.nav}>
        <div style={p.navLeft}>
          <BackButton />
          <Link to="/" style={p.navLogo}>TwinMind</Link>
        </div>
      </header>

      <main style={p.main}>
        <div style={p.hero}>
          <h1 style={p.heading}>🎁 XP Shop</h1>
          <p style={p.sub}>Spend earned XP to protect your streaks and unlock rewards.</p>
        </div>

        {/* XP balance card */}
        <div style={p.balanceCard}>
          <div style={p.balanceOrb} />
          <div style={p.balanceRow}>
            <div>
              <p style={p.balanceLabel}>Available XP</p>
              <p style={p.balanceValue}>{availableXp.toLocaleString()} <span style={{ fontSize: '1.1rem', opacity: 0.5 }}>XP</span></p>
            </div>
            <div style={{ textAlign: 'right' as const }}>
              <p style={p.balanceLabel}>Total Earned</p>
              <p style={{ ...p.balanceValue, color: '#94a3b8', fontSize: '1.1rem' }}>
                {(prog?.xp ?? 0).toLocaleString()} XP
              </p>
            </div>
          </div>
          <div style={p.xpBreakdownRow}>
            {prog && Object.entries(prog.breakdown).map(([k, v]) => (
              <div key={k} style={p.xpChip}>
                <span style={{ fontWeight: 700 }}>{v}</span>
                <span style={{ opacity: 0.55, fontSize: '0.6rem' }}>{k.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Shop items */}
        <div style={p.sectionTitle}>Items</div>
        <div style={p.grid}>

          {/* Shield item */}
          <div style={{ ...p.item, borderColor: atMaxShields ? 'rgba(148,163,184,0.1)' : 'rgba(99,102,241,0.25)' }}>
            <div style={p.itemGlow} />
            <div style={p.itemIcon}>🛡️</div>
            <h3 style={p.itemName}>Streak Shield</h3>
            <p style={p.itemDesc}>
              Automatically protects your streak if you miss a single day.
              Maximum {MAX_SHIELDS} shields in inventory.
            </p>

            {/* Inventory bar */}
            <div style={p.invRow}>
              <span style={p.invLabel}>Inventory: {shieldCount} / {MAX_SHIELDS}</span>
              <div style={p.invTrack}>
                {Array.from({ length: MAX_SHIELDS }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      ...p.invDot,
                      background: i < shieldCount ? '#a78bfa' : 'rgba(255,255,255,0.1)',
                      boxShadow: i < shieldCount ? '0 0 6px rgba(167,139,250,0.5)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={p.itemFooter}>
              <span style={p.itemPrice}>
                {SHIELD_COST} XP
                {!canBuy && !atMaxShields && (
                  <span style={{ fontSize: '0.65rem', color: '#ef4444', marginLeft: '0.4rem' }}>
                    Need {SHIELD_COST - availableXp} more XP
                  </span>
                )}
              </span>
              <button
                style={{
                  ...p.buyBtn,
                  opacity: canBuy ? 1 : 0.4,
                  cursor: canBuy ? 'pointer' : 'not-allowed',
                }}
                onClick={handleBuy}
                disabled={!canBuy || buying}
              >
                {buying ? '...' : atMaxShields ? 'Full' : 'Buy'}
              </button>
            </div>
          </div>

          {/* Streak Recovery info card (not purchasable directly — triggered automatically) */}
          <div style={{ ...p.item, borderColor: 'rgba(16,185,129,0.2)', opacity: 0.8 }}>
            <div style={{ ...p.itemGlow, background: 'radial-gradient(circle,rgba(16,185,129,0.08) 0%,transparent 70%)' }} />
            <div style={p.itemIcon}>⚡</div>
            <h3 style={p.itemName}>Streak Recovery</h3>
            <p style={p.itemDesc}>
              Miss a day with no shield? Recover your streak within 24 hours.
              Limit: once per month. Activated automatically when needed.
            </p>
            <div style={p.itemFooter}>
              <span style={{ ...p.itemPrice, color: '#10b981' }}>{RECOVERY_COST} XP</span>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>
                {shield?.can_recover ? '✅ Recovery Active' : 'Auto-triggered'}
              </span>
            </div>
          </div>
        </div>

        {msg && (
          <div style={{ ...p.msgBar, borderColor: msg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)', color: msg.ok ? '#10b981' : '#ef4444' }}>
            {msg.ok ? '✅' : '❌'} {msg.text}
          </div>
        )}

        {/* How to earn XP */}
        <div style={p.sectionTitle}>How to Earn XP</div>
        <div style={p.earnGrid}>
          {[
            { icon: '📋', label: 'Daily Check-in', xp: '10 XP' },
            { icon: '📝', label: 'Quiz Session', xp: '20 XP' },
            { icon: '⭐', label: 'Score 80%+', xp: '30 XP' },
            { icon: '🔥', label: 'Streak Day', xp: '5 XP/day' },
            { icon: '🏆', label: 'Achievement', xp: '50 XP' },
            { icon: '✅', label: '7-Day Streak', xp: '+50 XP bonus' },
            { icon: '👑', label: '30-Day Streak', xp: '+150 XP bonus' },
            { icon: '🚀', label: '100-Day Streak', xp: '+500 XP bonus' },
          ].map(({ icon, label, xp }) => (
            <div key={label} style={p.earnItem}>
              <span style={{ fontSize: '1.2rem' }}>{icon}</span>
              <div>
                <p style={p.earnLabel}>{label}</p>
                <p style={p.earnXp}>{xp}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Free shields */}
        <div style={p.sectionTitle}>Earn Free Shields</div>
        <div style={p.freeGrid}>
          {[
            { badge: 'Week Warrior', icon: '⚔️', streak: 7,  shields: 1 },
            { badge: 'Month Master', icon: '👑', streak: 30, shields: 2 },
            { badge: 'Unstoppable',  icon: '🚀', streak: 100, shields: 3 },
          ].map(({ badge, icon, streak, shields }) => (
            <div key={badge} style={p.freeItem}>
              <span style={{ fontSize: '1.5rem' }}>{icon}</span>
              <div style={{ flex: 1 }}>
                <p style={p.freeName}>{badge}</p>
                <p style={p.freeSub}>{streak}-day streak → +{shields} Shield{shields > 1 ? 's' : ''}</p>
              </div>
              <Link to="/achievements" style={p.freeLink}>View →</Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

const p: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100svh', background: 'var(--bg)', color: 'var(--text)' },
  nav: {
    position: 'sticky', top: 0, zIndex: 50,
    display: 'flex', alignItems: 'center', padding: '0.75rem 1.5rem',
    background: 'rgba(var(--bg-rgb,4,8,22),0.92)',
    backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  navLeft:  { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  navLogo:  { fontWeight: 900, fontSize: '1rem', color: 'var(--primary)', textDecoration: 'none', letterSpacing: '-0.5px' },
  main:     { maxWidth: '820px', margin: '0 auto', padding: '2rem 1.25rem 4rem' },
  hero:     { marginBottom: '1.75rem' },
  heading:  { margin: '0 0 0.4rem', fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-h)' },
  sub:      { margin: 0, fontSize: '0.9rem', color: 'var(--text)', opacity: 0.7 },

  balanceCard: {
    position: 'relative', overflow: 'hidden',
    background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(0,212,255,0.06))',
    border: '1px solid rgba(99,102,241,0.22)',
    borderRadius: '20px', padding: '1.5rem 1.75rem',
    marginBottom: '2rem',
  },
  balanceOrb: {
    position: 'absolute', width: '280px', height: '280px', borderRadius: '50%',
    background: 'radial-gradient(circle,rgba(99,102,241,0.12) 0%,transparent 70%)',
    top: '-100px', right: '-60px', pointerEvents: 'none',
  },
  balanceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 },
  balanceLabel: { margin: '0 0 0.2rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.55)' },
  balanceValue: { margin: 0, fontSize: '1.8rem', fontWeight: 900, color: 'var(--primary)' },
  xpBreakdownRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.9rem', position: 'relative', zIndex: 1 },
  xpChip: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '0.3rem 0.6rem', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
    fontSize: '0.72rem', color: 'var(--text)', minWidth: '60px',
  },

  sectionTitle: {
    fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'rgba(148,163,184,0.45)',
    marginBottom: '0.85rem', marginTop: '0.25rem',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '1rem', marginBottom: '2rem' },
  item: {
    position: 'relative', overflow: 'hidden',
    background: 'rgba(255,255,255,0.04)', border: '1px solid',
    borderRadius: '18px', padding: '1.4rem',
    display: 'flex', flexDirection: 'column', gap: '0.65rem',
  },
  itemGlow: {
    position: 'absolute', top: '-40%', right: '-20%',
    width: '200px', height: '200px', borderRadius: '50%',
    background: 'radial-gradient(circle,rgba(99,102,241,0.08) 0%,transparent 70%)',
    pointerEvents: 'none',
  },
  itemIcon: { fontSize: '2rem', lineHeight: 1 },
  itemName: { margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-h)', position: 'relative', zIndex: 1 },
  itemDesc: { margin: 0, fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.55, flex: 1, position: 'relative', zIndex: 1 },
  invRow:  { display: 'flex', alignItems: 'center', gap: '0.6rem', position: 'relative', zIndex: 1 },
  invLabel: { fontSize: '0.68rem', fontWeight: 600, color: 'rgba(148,163,184,0.5)', whiteSpace: 'nowrap' },
  invTrack: { display: 'flex', gap: '4px' },
  invDot:   { width: '12px', height: '12px', borderRadius: '50%', transition: 'background 0.25s, box-shadow 0.25s' },
  itemFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 },
  itemPrice:  { fontSize: '1rem', fontWeight: 900, color: '#a78bfa' },
  buyBtn: {
    padding: '0.42rem 1.1rem', borderRadius: '10px', fontFamily: 'inherit',
    background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
    color: '#a78bfa', fontSize: '0.82rem', fontWeight: 800,
    transition: 'background 0.18s, opacity 0.18s',
  },

  msgBar: {
    padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid',
    background: 'rgba(255,255,255,0.03)', fontSize: '0.82rem', fontWeight: 600,
    marginBottom: '1.5rem',
  },

  earnGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.65rem',
    marginBottom: '2rem',
  },
  earnItem: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px', padding: '0.65rem 0.75rem',
  },
  earnLabel: { margin: '0 0 0.1rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text)' },
  earnXp:   { margin: 0, fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 700 },

  freeGrid: { display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1rem' },
  freeItem: {
    display: 'flex', alignItems: 'center', gap: '0.85rem',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,165,0,0.12)',
    borderRadius: '14px', padding: '0.9rem 1rem',
  },
  freeName: { margin: '0 0 0.15rem', fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-h)' },
  freeSub:  { margin: 0, fontSize: '0.72rem', color: 'var(--text)', opacity: 0.7 },
  freeLink: { fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', opacity: 0.8 },
};

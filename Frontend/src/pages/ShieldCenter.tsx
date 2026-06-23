import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import BackButton from '../components/BackButton';
import { BrainIcon } from '../components/TwinMindLogo';
import StreakShieldCard from '../components/StreakShieldCard';
import { XPStoreProvider, useXPStore } from '../contexts/XPStoreContext';
import type { ShopItem } from '../contexts/XPStoreContext';
import { useLanguage } from '../contexts/LanguageContext';

interface ItemDef {
  key:       ShopItem;
  icon:      string;
  nameKey:   string;
  tagKey:    string;
  desc:      string[];
  priceKey:  'shield' | 'premium_shield' | 'streak_freeze' | 'double_xp';
  accent:    string;
  badge?:    string;
}

const SHOP_ITEMS: ItemDef[] = [
  {
    key: 'shield', icon: '🛡️', nameKey: 'shop_shield_name', tagKey: 'shop_shield_tag',
    desc: [
      'Auto-activates silently when you miss a single check-in.',
      'Keeps your streak alive without any action from you.',
      'Maximum 5 in inventory.',
    ],
    priceKey: 'shield', accent: '#6366f1',
  },
  {
    key: 'premium_shield', icon: '🛡️', nameKey: 'shop_premium_name', tagKey: 'shop_premium_tag',
    desc: [
      'Covers up to 3 consecutive missed check-in days.',
      'Perfect for travel, weekends, or exam cram weeks.',
      'Maximum 5 in inventory.',
    ],
    priceKey: 'premium_shield', accent: '#a78bfa', badge: 'PREMIUM',
  },
  {
    key: 'streak_freeze', icon: '🔥', nameKey: 'shop_freeze_name', tagKey: 'shop_freeze_tag',
    desc: [
      'Activate when you know you\'ll miss a day in advance.',
      'Freezes your streak for the rest of today (UTC).',
      'One freeze per purchase.',
    ],
    priceKey: 'streak_freeze', accent: '#f97316',
  },
  {
    key: 'double_xp', icon: '⭐', nameKey: 'shop_double_name', tagKey: 'shop_double_tag',
    desc: [
      'Every activity awards double XP for 24 hours.',
      'Stack with a quiz marathon for maximum gains.',
      'Cannot stack multiple boosts.',
    ],
    priceKey: 'double_xp', accent: '#f59e0b', badge: 'HOT',
  },
];

function ShieldCenterContent() {
  const { status, buying, lastMsg, buy, clearMsg, refresh } = useXPStore();
  const { t } = useLanguage();

  useEffect(() => { refresh(); }, []);

  const pricing  = status?.pricing;
  const availXp  = status?.available_xp ?? 0;
  const totalXp  = availXp + (status?.xp_spent ?? 0);

  function canAfford(priceKey: string) {
    if (!pricing) return false;
    return availXp >= (pricing as Record<string, number>)[priceKey];
  }

  function isActive(key: ShopItem) {
    if (!status) return false;
    if (key === 'streak_freeze') return status.streak_freeze_active;
    if (key === 'double_xp')     return status.double_xp_active;
    return false;
  }

  function isFull(key: ShopItem) {
    if (!status) return false;
    if (key === 'shield')         return status.shield_count >= 5;
    if (key === 'premium_shield') return status.premium_shield_count >= 5;
    return false;
  }

  function inventoryText(key: ShopItem) {
    if (!status) return '';
    if (key === 'shield')         return `${status.shield_count}/5 owned`;
    if (key === 'premium_shield') return `${status.premium_shield_count}/5 owned`;
    if (key === 'streak_freeze')  return status.streak_freeze_active ? '🟢 Active today' : 'Not active';
    if (key === 'double_xp') {
      if (status.double_xp_active && status.double_xp_expires) {
        const mins = Math.max(0, Math.floor((new Date(status.double_xp_expires).getTime() - Date.now()) / 60000));
        return `🟢 Active · ${mins}m left`;
      }
      return 'Not active';
    }
    return '';
  }

  return (
    <div style={p.shell}>
      {/* Navbar */}
      <header style={p.nav}>
        <div style={p.navLeft}>
          <BackButton />
          <BrainIcon size={24} />
          <Link to="/" style={p.navLogo}>TwinMind</Link>
        </div>
        <div style={p.xpBadge}>
          <span>⚡</span>
          <span style={p.xpAmt}>{availXp.toLocaleString()} XP</span>
        </div>
      </header>

      <main style={p.main}>
        {/* Page header */}
        <div style={p.pageHeader}>
          <div style={p.pageHeaderOrb} />
          <div style={p.pageHeaderIcon}>
            <Shield size={28} color="#6366f1" />
          </div>
          <div>
            <h1 style={p.pageTitle}>Shield Center</h1>
            <p style={p.pageSub}>Protect your streak and spend XP on power-ups</p>
          </div>
        </div>

        {/* ── SECTION 1: Streak Protection ── */}
        <div style={p.sectionHead}>
          <span style={p.sectionBadge}>STREAK PROTECTION</span>
          <span style={p.sectionTitle}>Streak Shield System</span>
        </div>
        <StreakShieldCard />

        {/* ── SECTION 2: XP Shop ── */}
        <div style={{ ...p.sectionHead, marginTop: '0.5rem' }}>
          <span style={p.sectionBadge}>XP SHOP</span>
          <span style={p.sectionTitle}>Power-Up Store</span>
        </div>

        {/* XP Balance card */}
        <div style={p.balanceCard}>
          <div style={p.balanceInner}>
            <div>
              <p style={p.balLabel}>{t('shop_avail_xp')}</p>
              <p style={p.balValue}>{availXp.toLocaleString()} <span style={p.balUnit}>XP</span></p>
            </div>
            <div style={{ textAlign: 'right' as const }}>
              <p style={p.balLabel}>{t('shop_total_earned')}</p>
              <p style={{ ...p.balValue, color: '#64748b', fontSize: '1.2rem' }}>
                {totalXp.toLocaleString()} XP
              </p>
            </div>
            <div style={{ textAlign: 'right' as const }}>
              <p style={p.balLabel}>🔥 {t('shop_streak')}</p>
              <p style={{ ...p.balValue, color: '#f97316', fontSize: '1.2rem' }}>
                {status?.streak_days ?? 0} {t('shop_days')}
              </p>
            </div>
          </div>
          <div style={p.balShields}>
            <span style={p.shieldChip}>🛡️ ×{status?.shield_count ?? 0}</span>
            <span style={p.shieldChip}>🛡️✨ ×{status?.premium_shield_count ?? 0}</span>
            {status?.streak_freeze_active && <span style={{ ...p.shieldChip, borderColor: 'rgba(249,115,22,0.3)', color: '#f97316' }}>🔥 Freeze Active</span>}
            {status?.double_xp_active     && <span style={{ ...p.shieldChip, borderColor: 'rgba(245,158,11,0.3)', color: '#f59e0b' }}>⭐ 2× XP Active</span>}
          </div>
        </div>

        {/* Message bar */}
        {lastMsg && (
          <div style={{ ...p.msg, borderColor: lastMsg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)', color: lastMsg.ok ? '#10b981' : '#ef4444' }}>
            {lastMsg.text}
            <button onClick={clearMsg} style={p.msgX}>✕</button>
          </div>
        )}

        {/* Shop items grid */}
        <div style={p.grid}>
          {SHOP_ITEMS.map(item => {
            const price    = pricing ? (pricing as Record<string, number>)[item.priceKey] : null;
            const afford   = canAfford(item.priceKey);
            const active   = isActive(item.key);
            const full     = isFull(item.key);
            const isBuying = buying === item.key;
            const disabled = isBuying || full || active;

            return (
              <div key={item.key} style={{ ...p.item, '--accent': item.accent } as React.CSSProperties}>
                <div style={{ ...p.itemGlow, background: `radial-gradient(circle,${item.accent}14 0%,transparent 70%)` }} />

                <div style={p.itemTop}>
                  <span style={p.itemEmoji}>{item.icon}</span>
                  <div style={p.itemChips}>
                    {item.badge && <span style={{ ...p.chip, background: `${item.accent}20`, color: item.accent }}>{item.badge}</span>}
                    {active     && <span style={p.activeChip}>ACTIVE</span>}
                    {full       && <span style={p.fullChip}>FULL</span>}
                  </div>
                </div>

                <h3 style={p.itemName}>{t(item.nameKey)}</h3>
                <p style={{ ...p.itemTagline, color: item.accent }}>{t(item.tagKey)}</p>
                <ul style={p.descList}>
                  {item.desc.map(d => <li key={d} style={p.descItem}>• {d}</li>)}
                </ul>
                <p style={p.invLabel}>{inventoryText(item.key)}</p>

                <div style={p.itemFoot}>
                  <span style={{ ...p.price, color: item.accent }}>
                    {price !== null ? `${price.toLocaleString()} XP` : '…'}
                  </span>
                  {!afford && !full && !active && price !== null && (
                    <span style={p.needMore}>Need {(price - availXp).toLocaleString()} more</span>
                  )}
                  <button
                    style={{
                      ...p.buyBtn,
                      background: `${item.accent}1a`,
                      borderColor: `${item.accent}40`,
                      color: item.accent,
                      opacity: disabled ? 0.4 : afford ? 1 : 0.5,
                      cursor: disabled || !afford ? 'not-allowed' : 'pointer',
                    }}
                    disabled={disabled || !afford}
                    onClick={() => !disabled && afford && buy(item.key)}
                  >
                    {isBuying ? '…' : full ? t('shop_full') : active ? t('shop_active') : !afford ? t('shop_need_xp') : t('shop_buy')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Earn XP guide */}
        <div style={p.earnLabel}>{t('shop_earn_guide')}</div>
        <div style={p.earnGrid}>
          {[
            { icon: '📋', act: 'Daily Check-in',   xp: '10 XP each'        },
            { icon: '📝', act: 'Quiz Session',      xp: '20 XP each'        },
            { icon: '⭐', act: 'Score 80%+',       xp: '+30 XP bonus'      },
            { icon: '🔥', act: 'Streak Day',       xp: '+5 XP/day'         },
            { icon: '🏆', act: 'Achievement',      xp: '+50 XP each'       },
            { icon: '✅', act: '7-Day Streak',     xp: '+50 XP milestone'  },
            { icon: '👑', act: '30-Day Streak',    xp: '+150 XP milestone' },
            { icon: '🚀', act: '100-Day Streak',   xp: '+500 XP milestone' },
          ].map(({ icon, act, xp }) => (
            <div key={act} style={p.earnItem}>
              <span style={{ fontSize: '1.1rem' }}>{icon}</span>
              <div>
                <p style={p.earnAct}>{act}</p>
                <p style={p.earnXp}>{xp}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Free shields milestones */}
        <div style={p.earnLabel}>{t('shop_free_shields')}</div>
        <div style={p.freeList}>
          {[
            { icon: '⚔️', name: 'Week Warrior',  streak: 7,   reward: '+1 Shield' },
            { icon: '👑', name: 'Month Master',  streak: 30,  reward: '+2 Shields' },
            { icon: '🚀', name: 'Unstoppable',   streak: 100, reward: '+3 Shields' },
          ].map(row => (
            <div key={row.name} style={p.freeRow}>
              <span style={{ fontSize: '1.5rem' }}>{row.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={p.freeName}>{row.name}</p>
                <p style={p.freeSub}>{row.streak}-day streak → {row.reward}</p>
              </div>
              <span style={p.freeReward}>{row.reward}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function ShieldCenter() {
  return (
    <XPStoreProvider>
      <ShieldCenterContent />
    </XPStoreProvider>
  );
}

const p: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100svh',
    background: 'var(--bg, #060b18)',
    color: 'var(--text, #f1f5f9)',
    fontFamily: 'inherit',
  },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.85rem 2rem',
    background: 'rgba(6,11,24,0.92)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    position: 'sticky', top: 0, zIndex: 100,
  },
  navLeft:  { display: 'flex', alignItems: 'center', gap: '0.85rem' },
  navLogo:  { fontSize: '1rem', fontWeight: 900, color: 'var(--primary,#00D4FF)', textDecoration: 'none', letterSpacing: '-0.01em' },
  xpBadge: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.3rem 0.8rem',
    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: '99px',
  },
  xpAmt: { fontSize: '0.85rem', fontWeight: 800, color: '#a78bfa' },
  main: {
    maxWidth: '820px', margin: '0 auto',
    padding: '2rem 1.5rem 5rem',
    display: 'flex', flexDirection: 'column', gap: '1.25rem',
  },
  pageHeader: {
    position: 'relative', overflow: 'hidden',
    display: 'flex', alignItems: 'center', gap: '1rem',
    padding: '1.5rem 1.75rem',
    background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(0,212,255,0.04) 100%)',
    border: '1px solid rgba(99,102,241,0.18)',
    borderRadius: '20px',
  },
  pageHeaderOrb: {
    position: 'absolute', width: '350px', height: '350px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 65%)',
    top: '-150px', right: '-80px', pointerEvents: 'none',
  },
  pageHeaderIcon: {
    width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  pageTitle: { margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.02em' },
  pageSub:   { margin: 0, fontSize: '0.8rem', color: 'rgba(148,163,184,0.6)', marginTop: '0.2rem' },

  sectionHead: { display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.25rem' },
  sectionBadge: {
    fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.1em',
    color: '#6366f1', background: 'rgba(99,102,241,0.12)',
    border: '1px solid rgba(99,102,241,0.22)',
    padding: '0.2rem 0.6rem', borderRadius: '99px',
  },
  sectionTitle: { fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-h, #f1f5f9)' },

  balanceCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '18px', padding: '1.25rem 1.4rem',
    display: 'flex', flexDirection: 'column', gap: '0.85rem',
  },
  balanceInner: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' },
  balLabel: { margin: 0, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.45)' },
  balValue: { margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#a78bfa', letterSpacing: '-0.02em' },
  balUnit:  { fontSize: '0.9rem', fontWeight: 700, color: 'rgba(167,139,250,0.6)' },
  balShields: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  shieldChip: {
    padding: '0.22rem 0.65rem', borderRadius: '8px',
    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
    fontSize: '0.72rem', fontWeight: 700, color: '#a78bfa',
  },

  msg: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
    padding: '0.6rem 0.9rem', borderRadius: '10px',
    border: '1px solid', background: 'rgba(255,255,255,0.03)',
    fontSize: '0.78rem', fontWeight: 600,
  },
  msgX: { background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontFamily: 'inherit', opacity: 0.6 },

  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' },

  item: {
    position: 'relative', overflow: 'hidden',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '18px', padding: '1.2rem',
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
  },
  itemGlow: {
    position: 'absolute', top: '-50%', right: '-25%',
    width: '180px', height: '180px', borderRadius: '50%', pointerEvents: 'none',
  },
  itemTop:   { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 1 },
  itemEmoji: { fontSize: '1.7rem', lineHeight: 1 },
  itemChips: { display: 'flex', gap: '0.35rem' },
  chip: { fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.07em', padding: '0.15rem 0.45rem', borderRadius: '6px' },
  activeChip: { fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.07em', padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(16,185,129,0.15)', color: '#10b981' },
  fullChip:   { fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.07em', padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(99,102,241,0.15)', color: '#818cf8' },

  itemName:    { margin: 0, fontSize: '0.97rem', fontWeight: 900, color: '#f1f5f9', position: 'relative', zIndex: 1 },
  itemTagline: { margin: 0, fontSize: '0.7rem', fontWeight: 700, position: 'relative', zIndex: 1 },
  descList: { margin: '0.15rem 0 0', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, position: 'relative', zIndex: 1 },
  descItem: { fontSize: '0.72rem', color: 'rgba(148,163,184,0.7)', lineHeight: 1.5 },
  invLabel: { margin: 0, fontSize: '0.65rem', color: 'rgba(148,163,184,0.4)', fontWeight: 600, position: 'relative', zIndex: 1 },

  itemFoot: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    marginTop: '0.35rem', position: 'relative', zIndex: 1,
    flexWrap: 'wrap',
  },
  price:    { fontSize: '0.95rem', fontWeight: 900 },
  needMore: { fontSize: '0.62rem', color: 'rgba(148,163,184,0.4)', fontWeight: 600, flex: 1 },
  buyBtn: {
    marginLeft: 'auto',
    padding: '0.38rem 0.9rem', borderRadius: '9px', border: '1px solid',
    fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 800,
    transition: 'opacity 0.15s, background 0.15s',
  },

  earnLabel: {
    fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(148,163,184,0.45)',
    marginTop: '0.5rem',
  },
  earnGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' },
  earnItem: {
    display: 'flex', alignItems: 'center', gap: '0.55rem',
    padding: '0.65rem 0.8rem',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
  },
  earnAct: { margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#e2e8f0' },
  earnXp:  { margin: 0, fontSize: '0.65rem', color: '#f59e0b', fontWeight: 700 },

  freeList: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  freeRow: {
    display: 'flex', alignItems: 'center', gap: '1rem',
    padding: '0.85rem 1.1rem',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px',
  },
  freeName:   { margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#f1f5f9' },
  freeSub:    { margin: 0, fontSize: '0.72rem', color: 'rgba(148,163,184,0.55)' },
  freeReward: { fontSize: '0.8rem', fontWeight: 800, color: '#a78bfa', whiteSpace: 'nowrap' },
};

import { useEffect } from 'react';
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

function ShopContent() {
  const { status, loading, buying, lastMsg, buy, clearMsg, refresh } = useXPStore();
  const { t } = useLanguage();

  useEffect(() => { refresh(); }, []);

  const pricing    = status?.pricing;
  const availXp    = status?.available_xp ?? 0;
  const totalXp    = availXp + (status?.xp_spent ?? 0);

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

      <main style={p.main}>
        {/* Hero */}
        <div style={p.hero}>
          <div style={p.heroOrb} />
          <h1 style={p.heading}>🛒 {t('shop_title')}</h1>
          <p style={p.heroSub}>{t('shop_subtitle')}</p>
        </div>

        {/* XP Balance */}
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

        {/* Msg */}
        {lastMsg && (
          <div style={{ ...p.msg, borderColor: lastMsg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)', color: lastMsg.ok ? '#10b981' : '#ef4444' }}>
            {lastMsg.text}
            <button onClick={clearMsg} style={p.msgX}>✕</button>
          </div>
        )}

        {/* Items */}
        <div style={p.sectionHead}>{t('shop_items')}</div>
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
        <div style={p.sectionHead}>{t('shop_earn_guide')}</div>
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

        {/* Free shields */}
        <div style={p.sectionHead}>{t('shop_free_shields')}</div>
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
              <Link to="/achievements" style={p.freeLink}>View →</Link>
            </div>
          ))}
        </div>

        {loading && (
          <p style={{ textAlign: 'center', color: 'rgba(148,163,184,0.4)', fontSize: '0.8rem', margin: '2rem 0' }}>Loading…</p>
        )}
      </main>
    </div>
  );
}

export default function Shop() {
  return (
    <XPStoreProvider>
      <ShopContent />
    </XPStoreProvider>
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
  main:     { maxWidth: '860px', margin: '0 auto', padding: '2rem 1.25rem 5rem' },

  hero: {
    position: 'relative', overflow: 'hidden',
    marginBottom: '1.75rem',
  },
  heroOrb: {
    position: 'absolute', width: '400px', height: '400px', borderRadius: '50%',
    background: 'radial-gradient(circle,rgba(99,102,241,0.08) 0%,transparent 70%)',
    top: '-180px', right: '-100px', pointerEvents: 'none',
  },
  heading: { margin: '0 0 0.4rem', fontSize: '2rem', fontWeight: 900, color: 'var(--text-h)', position: 'relative' },
  heroSub: { margin: 0, fontSize: '0.9rem', color: 'var(--text)', opacity: 0.65, position: 'relative' },

  balanceCard: {
    position: 'relative', overflow: 'hidden',
    background: 'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(0,212,255,0.05))',
    border: '1px solid rgba(99,102,241,0.2)', borderRadius: '20px',
    padding: '1.5rem 1.75rem', marginBottom: '1.5rem',
  },
  balanceInner: { display: 'flex', gap: '2rem', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' },
  balLabel: { margin: '0 0 0.2rem', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.5)' },
  balValue: { margin: 0, fontSize: '1.75rem', fontWeight: 900, color: 'var(--primary)' },
  balUnit:  { fontSize: '1rem', opacity: 0.4 },
  balShields: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' },
  shieldChip: {
    padding: '0.25rem 0.65rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700,
    border: '1px solid rgba(99,102,241,0.25)', color: '#a78bfa',
    background: 'rgba(99,102,241,0.1)',
  },

  msg: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
    padding: '0.65rem 0.9rem', borderRadius: '12px', border: '1px solid',
    background: 'rgba(255,255,255,0.02)', fontSize: '0.8rem', fontWeight: 600,
    marginBottom: '1rem',
  },
  msgX: { background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, fontFamily: 'inherit' },

  sectionHead: {
    fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'rgba(148,163,184,0.4)',
    marginBottom: '0.85rem', marginTop: '0.25rem',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '1rem', marginBottom: '2.5rem' },

  item: {
    position: 'relative', overflow: 'hidden',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px', padding: '1.4rem',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    transition: 'border-color 0.2s',
  },
  itemGlow: {
    position: 'absolute', top: '-60%', right: '-20%',
    width: '220px', height: '220px', borderRadius: '50%', pointerEvents: 'none',
  },
  itemTop: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    position: 'relative', zIndex: 1,
  },
  itemEmoji:   { fontSize: '2rem', lineHeight: 1 },
  itemChips:   { display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' },
  chip: {
    fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.07em',
    padding: '0.15rem 0.5rem', borderRadius: '6px',
  },
  activeChip: {
    fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.07em',
    padding: '0.15rem 0.5rem', borderRadius: '6px',
    background: 'rgba(16,185,129,0.15)', color: '#10b981',
  },
  fullChip: {
    fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.07em',
    padding: '0.15rem 0.5rem', borderRadius: '6px',
    background: 'rgba(148,163,184,0.1)', color: '#94a3b8',
  },
  itemName:    { margin: 0, fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-h)', position: 'relative', zIndex: 1 },
  itemTagline: { margin: 0, fontSize: '0.72rem', fontWeight: 700, position: 'relative', zIndex: 1 },
  descList:    { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, position: 'relative', zIndex: 1 },
  descItem:    { margin: 0, fontSize: '0.72rem', color: 'rgba(148,163,184,0.65)', lineHeight: 1.5 },
  invLabel:    { margin: 0, fontSize: '0.65rem', color: 'rgba(148,163,184,0.35)', fontWeight: 600, position: 'relative', zIndex: 1 },
  itemFoot:    { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', position: 'relative', zIndex: 1, marginTop: '0.15rem' },
  price:       { fontSize: '1.05rem', fontWeight: 900 },
  needMore:    { fontSize: '0.62rem', color: '#ef4444', fontWeight: 600 },
  buyBtn: {
    marginLeft: 'auto', padding: '0.38rem 1rem', borderRadius: '10px',
    border: '1px solid', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 800,
    transition: 'opacity 0.15s, background 0.15s',
  },

  earnGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.65rem', marginBottom: '2.5rem' },
  earnItem: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px', padding: '0.65rem',
  },
  earnAct: { margin: '0 0 0.1rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text)' },
  earnXp:  { margin: 0, fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 700 },

  freeList: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  freeRow: {
    display: 'flex', alignItems: 'center', gap: '0.85rem',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,158,11,0.12)',
    borderRadius: '14px', padding: '0.9rem 1rem',
  },
  freeName: { margin: '0 0 0.15rem', fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-h)' },
  freeSub:  { margin: 0, fontSize: '0.72rem', color: 'var(--text)', opacity: 0.65 },
  freeLink: { fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', opacity: 0.8 },
};

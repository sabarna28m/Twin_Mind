import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import BackButton from '../components/BackButton';
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
      'Auto-activates silently on miss',
      'Keeps your streak alive',
      'Maximum 5 in inventory',
    ],
    priceKey: 'shield', accent: '#0052cc',
  },
  {
    key: 'premium_shield', icon: '🛡️', nameKey: 'shop_premium_name', tagKey: 'shop_premium_tag',
    desc: [
      'Covers up to 3 missed days',
      'Perfect for travel or exams',
      'Maximum 5 in inventory',
    ],
    priceKey: 'premium_shield', accent: '#0052cc', badge: 'PREMIUM',
  },
  {
    key: 'streak_freeze', icon: '🔥', nameKey: 'shop_freeze_name', tagKey: 'shop_freeze_tag',
    desc: [
      'Activate in advance',
      'Freezes streak for the day (UTC)',
      'One freeze per purchase',
    ],
    priceKey: 'streak_freeze', accent: '#f97316',
  },
  {
    key: 'double_xp', icon: '⭐', nameKey: 'shop_double_name', tagKey: 'shop_double_tag',
    desc: [
      'Double XP for 24 hours',
      'Stack with a quiz marathon',
      'Cannot stack multiple boosts',
    ],
    priceKey: 'double_xp', accent: '#f59e0b', badge: 'HOT',
  },
];

function ShieldCenterContent() {
  const { status, buying, lastMsg, buy, clearMsg, refresh } = useXPStore();
  const { t } = useLanguage();
  const [hoveredBtn, setHoveredBtn] = useState<ShopItem | null>(null);

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
    if (key === 'streak_freeze')  return status.streak_freeze_active ? 'Active today' : 'Not active';
    if (key === 'double_xp') {
      if (status.double_xp_active && status.double_xp_expires) {
        const mins = Math.max(0, Math.floor((new Date(status.double_xp_expires).getTime() - Date.now()) / 60000));
        return `Active · ${mins}m left`;
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
          <div style={{ width: 28, height: 20, overflow: 'hidden', flexShrink: 0 }}>
            <img src="/assets/twinmind-logo.png" alt="" style={{ width: 28, height: 'auto', display: 'block' }} />
          </div>
          <Link to="/" style={p.navLogo}>TwinMind</Link>
        </div>
        <div style={p.xpBadge}>
          <span style={{color: '#4338ca'}}>⚡</span>
          <span style={p.xpAmt}>{availXp.toLocaleString()} XP</span>
        </div>
      </header>

      {/* Hero Blob Background */}
      <div style={p.heroBlob} />

      <main style={p.main}>
        {/* Page header (SaaSable style) */}
        <div style={p.pageHeader}>
          <h1 style={p.pageTitle}>Shield Center</h1>
          <p style={p.pageSub}>Protect your streak and spend XP on power-ups.</p>
        </div>

        {/* ── SECTION 1: Streak Protection ── */}
        <div style={p.sectionWrapper}>
          <StreakShieldCard />
        </div>

        {/* Message bar */}
        {lastMsg && (
          <div style={{ ...p.msg, borderColor: lastMsg.ok ? '#10b981' : '#ef4444', color: lastMsg.ok ? '#047857' : '#b91c1c', background: lastMsg.ok ? '#ecfdf5' : '#fef2f2' }}>
            {lastMsg.text}
            <button onClick={clearMsg} style={p.msgX}>✕</button>
          </div>
        )}

        {/* ── SECTION 2: XP Shop (Pricing Cards) ── */}
        <div style={p.grid}>
          {SHOP_ITEMS.map(item => {
            const price    = pricing ? (pricing as Record<string, number>)[item.priceKey] : null;
            const afford   = canAfford(item.priceKey);
            const active   = isActive(item.key);
            const full     = isFull(item.key);
            const isBuying = buying === item.key;
            const disabled = isBuying || full || active;
            
            const btnHovered = hoveredBtn === item.key;
            const btnStyle = {
              ...p.buyBtn,
              color: btnHovered && !disabled && afford ? '#fff' : item.accent,
              background: btnHovered && !disabled && afford ? item.accent : 'transparent',
              borderColor: disabled ? 'var(--border)' : item.accent,
              opacity: disabled ? 0.5 : 1,
              cursor: disabled || !afford ? 'not-allowed' : 'pointer',
            };

            return (
              <div key={item.key} style={p.item}>
                <div style={p.itemTop}>
                  <h3 style={p.itemName}>{t(item.nameKey)}</h3>
                  {item.badge && <span style={{ ...p.chip, background: `${item.accent}15`, color: item.accent }}>{item.badge}</span>}
                </div>

                <div style={p.priceBox}>
                  <span style={p.priceAmt}>{price !== null ? price.toLocaleString() : '…'}</span>
                  <span style={p.priceUnit}>XP</span>
                </div>
                
                <p style={p.invLabel}>{inventoryText(item.key)}</p>

                <div style={p.dividerWrapper}>
                  <div style={p.dividerLine} />
                  <span style={p.dividerText}>Features</span>
                  <div style={p.dividerLine} />
                </div>

                <ul style={p.descList}>
                  {item.desc.map(d => (
                    <li key={d} style={p.descItem}>
                      <span style={p.checkMark}>✓</span> {d}
                    </li>
                  ))}
                  {/* Mock excluded feature for SaaSable aesthetic */}
                  <li style={{...p.descItem, color: '#94a3b8'}}>
                    <span style={p.crossMark}>✕</span> Unlimited uses
                  </li>
                </ul>

                <div style={p.itemFoot}>
                  {!afford && !full && !active && price !== null && (
                    <p style={p.needMore}>Need {(price - availXp).toLocaleString()} more XP</p>
                  )}
                  <button
                    style={btnStyle}
                    disabled={disabled || !afford}
                    onClick={() => !disabled && afford && buy(item.key)}
                    onMouseEnter={() => setHoveredBtn(item.key)}
                    onMouseLeave={() => setHoveredBtn(null)}
                  >
                    {isBuying ? '…' : full ? t('shop_full') : active ? t('shop_active') : !afford ? t('shop_need_xp') : 'Buy ' + t(item.nameKey)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Free shields milestones */}
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
    background: 'var(--bg-surface)',
    color: 'var(--text-h)',
    fontFamily: 'var(--sans)',
    position: 'relative',
    overflowX: 'hidden',
  },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.85rem 2rem',
    background: 'rgba(255,255,255,0.85)',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    position: 'sticky', top: 0, zIndex: 100,
  },
  navLeft:  { display: 'flex', alignItems: 'center', gap: '0.85rem' },
  navLogo:  { fontSize: '1rem', fontWeight: 900, color: '#0052cc', textDecoration: 'none', letterSpacing: '-0.01em' },
  xpBadge: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.3rem 0.8rem',
    background: '#eef2ff', border: '1px solid #c7d2fe',
    borderRadius: '99px',
  },
  xpAmt: { fontSize: '0.85rem', fontWeight: 800, color: '#4338ca' },
  
  heroBlob: {
    position: 'absolute',
    top: '-20%', left: '50%', transform: 'translateX(-50%)',
    width: '120vw', height: '60vh',
    background: 'radial-gradient(ellipse at center, rgba(0,82,204,0.05) 0%, rgba(248,249,250,0) 70%)',
    pointerEvents: 'none', zIndex: 0,
  },

  main: {
    maxWidth: '960px', margin: '0 auto',
    padding: '4rem 1.5rem 5rem',
    display: 'flex', flexDirection: 'column', gap: '2.5rem',
    position: 'relative', zIndex: 1,
  },
  pageHeader: {
    textAlign: 'center',
    marginBottom: '1rem',
  },
  pageTitle: { margin: 0, fontSize: '2.75rem', fontWeight: 800, color: 'var(--text-h)', letterSpacing: '-0.03em', lineHeight: 1.2 },
  pageSub:   { margin: '1rem auto 0', fontSize: '1.1rem', color: 'var(--text-m)', maxWidth: '600px' },

  sectionWrapper: {
    maxWidth: '600px',
    margin: '0 auto',
    width: '100%',
  },

  msg: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
    padding: '0.8rem 1.2rem', borderRadius: '12px',
    border: '1px solid',
    fontSize: '0.85rem', fontWeight: 600,
    maxWidth: '600px', margin: '0 auto', width: '100%'
  },
  msgX: { background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontFamily: 'inherit', opacity: 0.6 },

  grid: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
    gap: '2rem',
    alignItems: 'stretch'
  },

  item: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '24px',
    padding: '2.5rem',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.03)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  itemTop: { 
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
    marginBottom: '1rem' 
  },
  itemName: { margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-h)' },
  chip: { fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.07em', padding: '0.2rem 0.6rem', borderRadius: '99px' },
  
  priceBox: { textAlign: 'center', marginBottom: '0.5rem' },
  priceAmt: { fontSize: '3.5rem', fontWeight: 800, color: 'var(--text-h)', letterSpacing: '-0.04em', lineHeight: 1 },
  priceUnit: { fontSize: '1.2rem', fontWeight: 600, color: 'var(--text)', marginLeft: '0.2rem' },
  
  invLabel: { margin: '0 0 1.5rem', fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600, textAlign: 'center' },

  dividerWrapper: {
    display: 'flex', alignItems: 'center', gap: '1rem',
    margin: '1.5rem 0'
  },
  dividerLine: {
    flex: 1, height: '1px', background: 'var(--border)'
  },
  dividerText: {
    fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em'
  },

  descList: { 
    margin: '0', padding: 0, listStyle: 'none', 
    display: 'flex', flexDirection: 'column', gap: '1rem', 
    flex: 1 
  },
  descItem: { 
    fontSize: '0.9rem', color: '#475569', 
    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
    lineHeight: 1.4
  },
  checkMark: { color: 'var(--text-h)', fontWeight: 900, marginTop: '2px' },
  crossMark: { color: 'var(--border)', fontWeight: 900, marginTop: '2px' },

  itemFoot: {
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
    marginTop: '2.5rem',
  },
  needMore: { 
    margin: 0, fontSize: '0.75rem', color: '#ef4444', 
    fontWeight: 600, textAlign: 'center' 
  },
  buyBtn: {
    width: '100%',
    padding: '0.8rem 1.5rem', 
    borderRadius: '99px', 
    border: '1px solid',
    fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 700,
    transition: 'all 0.2s ease',
  },

  freeList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' },
  freeRow: {
    display: 'flex', alignItems: 'center', gap: '1rem',
    padding: '1.25rem',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: '16px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.02)',
  },
  freeName:   { margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-h)' },
  freeSub:    { margin: 0, fontSize: '0.8rem', color: 'var(--text)' },
  freeReward: { fontSize: '0.85rem', fontWeight: 800, color: '#0052cc', whiteSpace: 'nowrap' },
};

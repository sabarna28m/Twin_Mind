import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useXPStore } from '../contexts/XPStoreContext';
import type { ShopItem } from '../contexts/XPStoreContext';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  isOpen:  boolean;
  onClose: () => void;
}

interface ShopItemDef {
  key:       ShopItem;
  icon:      string;
  nameKey:   string;
  tagKey:    string;
  desc:      string;
  priceKey:  keyof NonNullable<ReturnType<typeof useXPStore>['status']>['pricing'];
  accentHex: string;
  badge?:    string;
}

const ITEMS: ShopItemDef[] = [
  {
    key: 'shield', icon: '', nameKey: 'shop_shield_name', tagKey: 'shop_shield_tag',
    desc: 'Auto-activates when you miss a single check-in. Keeps your streak alive silently.',
    priceKey: 'shield', accentHex: '#6366f1',
  },
  {
    key: 'premium_shield', icon: '', nameKey: 'shop_premium_name', tagKey: 'shop_premium_tag',
    desc: 'Covers up to 3 consecutive missed days. Perfect for weekends and travel.',
    priceKey: 'premium_shield', accentHex: '#a78bfa', badge: 'PREMIUM',
  },
  {
    key: 'streak_freeze', icon: '', nameKey: 'shop_freeze_name', tagKey: 'shop_freeze_tag',
    desc: 'Manually freeze your streak for today. Use it when you know you\'ll miss a day.',
    priceKey: 'streak_freeze', accentHex: '#f97316',
  },
  {
    key: 'double_xp', icon: '2x', nameKey: 'shop_double_name', tagKey: 'shop_double_tag',
    desc: 'Every activity awards double XP for the next 24 hours. Stack it with a quiz marathon.',
    priceKey: 'double_xp', accentHex: '#f59e0b', badge: 'HOT',
  },
];

export default function XPShopModal({ isOpen, onClose }: Props) {
  const { status, buying, lastMsg, buy, clearMsg } = useXPStore();
  const { t } = useLanguage();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const pricing  = status?.pricing;
  const avail    = status?.available_xp ?? 0;

  function canAfford(key: ShopItem) {
    if (!pricing) return false;
    return avail >= pricing[ITEMS.find(i => i.key === key)!.priceKey];
  }

  function isActive(key: ShopItem) {
    if (!status) return false;
    if (key === 'streak_freeze') return status.streak_freeze_active;
    if (key === 'double_xp')     return status.double_xp_active;
    return false;
  }

  function inventoryLabel(key: ShopItem) {
    if (!status) return '';
    if (key === 'shield')         return `${status.shield_count}/5 in stock`;
    if (key === 'premium_shield') return `${status.premium_shield_count}/5 in stock`;
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

  function isFull(key: ShopItem) {
    if (!status) return false;
    if (key === 'shield')         return status.shield_count >= 5;
    if (key === 'premium_shield') return status.premium_shield_count >= 5;
    return false;
  }

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        style={m.overlay}
        onClick={e => { if (e.target === overlayRef.current) onClose(); }}
        aria-modal="true"
        role="dialog"
        aria-label="XP Shop"
      >
        <div style={m.panel}>
          {/* Header */}
          <div style={m.header}>
            <div style={m.headerLeft}>
              <span style={m.shopIcon}></span>
              <div>
                <h2 style={m.title}>{t('shop_modal_title')}</h2>
                <p style={m.subtitle}>{t('shop_modal_sub')}</p>
              </div>
            </div>
            <div style={m.headerRight}>
              <div style={m.xpBadge}>
                <span style={m.xpIcon}></span>
                <span style={m.xpAmount}>{avail.toLocaleString()} XP</span>
              </div>
              <button style={m.closeBtn} onClick={onClose} aria-label="Close"></button>
            </div>
          </div>

          {/* Message bar */}
          {lastMsg && (
            <div style={{ ...m.msgBar, borderColor: lastMsg.ok ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)', color: lastMsg.ok ? '#10b981' : '#ef4444' }}>
              {lastMsg.text}
              <button onClick={clearMsg} style={m.msgClose}></button>
            </div>
          )}

          {/* Items grid */}
          <div style={m.grid}>
            {ITEMS.map(item => {
              const price   = pricing ? pricing[item.priceKey] : '…';
              const afford  = canAfford(item.key);
              const active  = isActive(item.key);
              const full    = isFull(item.key);
              const isBuying = buying === item.key;
              const disabled = isBuying || full || active;

              return (
                <div key={item.key} style={{ ...m.item, borderColor: `${item.accentHex}28` }}>
                  <div style={{ ...m.itemGlow, background: `radial-gradient(circle,${item.accentHex}12 0%,transparent 70%)` }} />

                  {/* Badges */}
                  <div style={m.itemTopRow}>
                    <span style={m.itemEmoji}>{item.icon}</span>
                    <div style={m.itemBadges}>
                      {item.badge && <span style={{ ...m.badge, background: `${item.accentHex}22`, color: item.accentHex }}>{item.badge}</span>}
                      {active && <span style={m.activeBadge}>ACTIVE</span>}
                    </div>
                  </div>

                  <h3 style={m.itemName}>{t(item.nameKey)}</h3>
                  <p style={{ ...m.itemTagline, color: item.accentHex }}>{t(item.tagKey)}</p>
                  <p style={m.itemDesc}>{item.desc}</p>
                  <p style={m.inventory}>{inventoryLabel(item.key)}</p>

                  <div style={m.itemFooter}>
                    <span style={{ ...m.price, color: item.accentHex }}>{typeof price === 'number' ? `${price} XP` : price}</span>
                    <button
                      style={{
                        ...m.buyBtn,
                        background: `${item.accentHex}20`,
                        borderColor: `${item.accentHex}45`,
                        color: item.accentHex,
                        opacity: disabled ? 0.45 : afford ? 1 : 0.55,
                        cursor: disabled ? 'not-allowed' : afford ? 'pointer' : 'not-allowed',
                      }}
                      onClick={() => !disabled && afford && buy(item.key)}
                      disabled={disabled}
                      title={!afford ? `Need ${price} XP` : full ? 'Inventory full' : active ? 'Already active' : ''}
                    >
                      {isBuying ? '…' : full ? t('shop_full') : active ? t('shop_active') : !afford ? t('shop_need_xp') : t('shop_buy')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={m.footer}>
            <p style={m.footerNote}>
               Earn XP by checking in daily, completing quizzes, and hitting streak milestones.
            </p>
            <Link to="/shop" style={m.fullPageLink} onClick={onClose}>
              {t('shop_view_full')}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

const m: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 500,
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem',
  },
  panel: {
    width: '100%', maxWidth: '640px', maxHeight: '90svh',
    background: 'linear-gradient(135deg,rgba(6,10,28,0.99),rgba(14,8,36,0.99))',
    border: '1px solid rgba(99,102,241,0.22)',
    borderRadius: '24px', padding: '1.5rem',
    display: 'flex', flexDirection: 'column', gap: '1rem',
    overflowY: 'auto',
    boxShadow: '0 20px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.06)',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '0.85rem' },
  shopIcon:   { fontSize: '1.8rem', lineHeight: 1 },
  title:      { margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.3px' },
  subtitle:   { margin: 0, fontSize: '0.72rem', color: 'rgba(148,163,184,0.55)' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 },
  xpBadge: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.3rem 0.8rem',
    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: '99px',
  },
  xpIcon:   { fontSize: '0.85rem' },
  xpAmount: { fontSize: '0.85rem', fontWeight: 800, color: '#a78bfa' },
  closeBtn: {
    width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(148,163,184,0.7)', cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem',
  },

  msgBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
    padding: '0.6rem 0.9rem', borderRadius: '10px',
    border: '1px solid', background: 'rgba(255,255,255,0.03)',
    fontSize: '0.78rem', fontWeight: 600,
  },
  msgClose: { background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontFamily: 'inherit', opacity: 0.6 },

  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' },

  item: {
    position: 'relative', overflow: 'hidden',
    background: 'rgba(255,255,255,0.04)', border: '1px solid',
    borderRadius: '18px', padding: '1.1rem',
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
  },
  itemGlow: {
    position: 'absolute', top: '-50%', right: '-25%',
    width: '180px', height: '180px', borderRadius: '50%', pointerEvents: 'none',
  },
  itemTopRow:  { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 1 },
  itemEmoji:   { fontSize: '1.6rem', lineHeight: 1 },
  itemBadges:  { display: 'flex', gap: '0.35rem' },
  badge: {
    fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.07em',
    padding: '0.15rem 0.45rem', borderRadius: '6px',
  },
  activeBadge: {
    fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.07em',
    padding: '0.15rem 0.45rem', borderRadius: '6px',
    background: 'rgba(16,185,129,0.15)', color: '#10b981',
  },
  itemName:    { margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#f1f5f9', position: 'relative', zIndex: 1 },
  itemTagline: { margin: 0, fontSize: '0.7rem', fontWeight: 700, position: 'relative', zIndex: 1 },
  itemDesc:    { margin: 0, fontSize: '0.72rem', color: 'rgba(148,163,184,0.7)', lineHeight: 1.5, flex: 1, position: 'relative', zIndex: 1 },
  inventory:   { margin: 0, fontSize: '0.65rem', color: 'rgba(148,163,184,0.4)', fontWeight: 600, position: 'relative', zIndex: 1 },
  itemFooter:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.2rem', position: 'relative', zIndex: 1 },
  price:       { fontSize: '0.95rem', fontWeight: 900 },
  buyBtn: {
    padding: '0.35rem 0.85rem', borderRadius: '9px', border: '1px solid',
    fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 800,
    transition: 'opacity 0.15s, background 0.15s',
  },

  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
    paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  footerNote:    { margin: 0, fontSize: '0.68rem', color: 'rgba(148,163,184,0.4)', flex: 1 },
  fullPageLink:  { fontSize: '0.72rem', fontWeight: 700, color: '#6366f1', textDecoration: 'none', opacity: 0.8, whiteSpace: 'nowrap' },
};

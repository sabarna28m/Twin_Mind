import { useEffect, useState, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  xp_reward: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  progress_target: number;
  progress_current: number;
  hidden: boolean;
  earned: boolean;
  earned_at: string | null;
}

const RARITY_META: Record<string, { label: string; color: string; glow: string }> = {
  common:    { label: 'Common',    color: '#94a3b8', glow: 'rgba(148,163,184,0.18)' },
  rare:      { label: 'Rare',      color: '#3b82f6', glow: 'rgba(59,130,246,0.18)' },
  epic:      { label: 'Epic',      color: '#a855f7', glow: 'rgba(168,85,247,0.18)' },
  legendary: { label: 'Legendary', color: '#eab308', glow: 'rgba(234,179,8,0.18)' },
};
const RARITY_ORDER: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 };

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  onboarding: { label: 'Onboarding', icon: '🌱', color: '#10b981' },
  sessions:   { label: 'Sessions',   icon: '⏱️',  color: '#00D4FF' },
  quiz:       { label: 'Quiz',       icon: '📝',  color: '#7C3AED' },
  streaks:    { label: 'Streaks',    icon: '🔥',  color: '#f59e0b' },
  materials:  { label: 'Materials',  icon: '📚',  color: '#34d399' },
  ai:         { label: 'AI',         icon: '🤖',  color: '#6366f1' },
  progress:   { label: 'Progress',   icon: '📊',  color: '#3b82f6' },
  social:     { label: 'Social',     icon: '⚔️',  color: '#f43f5e' },
  mastery:    { label: 'Mastery',    icon: '🏆',  color: '#eab308' },
  hidden:     { label: 'Secrets',    icon: '🔮',  color: '#8b5cf6' },
};

const CATEGORY_TABS = ['all', 'onboarding', 'sessions', 'quiz', 'streaks', 'materials', 'ai', 'progress', 'social', 'mastery', 'hidden'];

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── New Badge Banner ────────────────────────────────────────────────────────────
function NewBadgeBanner({ badges, onDismiss }: { badges: Achievement[]; onDismiss: () => void }) {
  const isLegendary = badges.some(b => b.rarity === 'legendary' || b.rarity === 'epic');
  return (
    <div style={{
      ...nb.wrap,
      borderColor: isLegendary ? 'rgba(234,179,8,0.5)' : 'rgba(16,185,129,0.4)',
      background: isLegendary
        ? 'linear-gradient(135deg, rgba(234,179,8,0.12), rgba(168,85,247,0.08))'
        : 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(0,212,255,0.06))',
    }} className="animate-fade-in">
      <div style={nb.left}>
        <span style={{ fontSize: '1.5rem' }}>{isLegendary ? '🎊' : '🎉'}</span>
        <div>
          <p style={nb.title}>
            {badges.length === 1
              ? `${badges[0].icon} ${badges[0].name} unlocked!`
              : `${badges.length} new achievements unlocked!`}
          </p>
          {badges.length > 1 && (
            <p style={nb.sub}>{badges.map(b => b.name).join(' · ')}</p>
          )}
        </div>
      </div>
      <button onClick={onDismiss} style={nb.dismiss}>✕</button>
    </div>
  );
}
const nb: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.85rem 1.25rem', marginBottom: '1.25rem',
    border: '1px solid', borderRadius: '14px',
    gap: '0.75rem',
  },
  left:    { display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 },
  title:   { margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-h)' },
  sub:     { margin: '0.1rem 0 0', fontSize: '0.72rem', color: 'var(--text)', opacity: 0.7 },
  dismiss: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text)', fontSize: '0.8rem', padding: '0.2rem 0.4rem',
    borderRadius: '6px', fontFamily: 'inherit', flexShrink: 0,
  },
};

// ── Next Goal Panel ─────────────────────────────────────────────────────────────
function NextGoalPanel({ badges }: { badges: Achievement[] }) {
  const candidates = useMemo(() =>
    badges
      .filter(b => !b.earned && !b.hidden && b.progress_target > 1 && b.progress_current > 0)
      .map(b => ({ ...b, pct: Math.round((b.progress_current / b.progress_target) * 100) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3),
  [badges]);

  if (!candidates.length) return null;

  return (
    <div style={ng.wrap}>
      <p style={ng.title}>🎯 Next Goals</p>
      <div style={ng.list}>
        {candidates.map(b => {
          const rm = RARITY_META[b.rarity];
          return (
            <div key={b.id} style={ng.row}>
              <span style={ng.icon}>{b.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={ng.name}>{b.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ ...ng.xp, color: rm.color }}>+{b.xp_reward} XP</span>
                    <span style={{ ...ng.pct, color: rm.color }}>{b.pct}%</span>
                  </div>
                </div>
                <div style={ng.track}>
                  <div style={{ ...ng.fill, width: `${b.pct}%`, background: rm.color, boxShadow: `0 0 8px ${rm.glow}` }} />
                </div>
                <p style={ng.sub}>{b.progress_current} / {b.progress_target}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
const ng: Record<string, React.CSSProperties> = {
  wrap: {
    padding: '1.1rem 1.25rem', marginBottom: '1.25rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)', borderRadius: '14px',
  },
  title: { margin: '0 0 0.85rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.07em' },
  list:  { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  row:   { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  icon:  { fontSize: '1.4rem', flexShrink: 0 },
  name:  { fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-h)' },
  xp:    { fontSize: '0.65rem', fontWeight: 700 },
  pct:   { fontSize: '0.72rem', fontWeight: 800 },
  track: { height: '5px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: '99px', transition: 'width 0.6s ease' },
  sub:   { margin: '0.2rem 0 0', fontSize: '0.62rem', color: 'var(--text)', opacity: 0.5 },
};

// ── Badge Card ──────────────────────────────────────────────────────────────────
function BadgeCard({ badge, isNew }: { badge: Achievement; isNew: boolean }) {
  const rm  = RARITY_META[badge.rarity] ?? RARITY_META.common;
  const cm  = CATEGORY_META[badge.category] ?? CATEGORY_META.onboarding;
  const isSecret = badge.hidden && !badge.earned;
  const progPct = badge.progress_target > 0
    ? Math.min(100, Math.round((badge.progress_current / badge.progress_target) * 100))
    : 0;

  const cardClass = [
    isNew ? 'badge-unlock' : '',
    badge.earned && badge.rarity === 'legendary' ? 'legendary-earned' : '',
    badge.earned && badge.rarity === 'epic' ? 'epic-earned' : '',
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div
      className={cardClass}
      style={{
        ...bc.card,
        ...(badge.earned ? {
          borderColor: rm.color + '55',
          background: `linear-gradient(145deg, ${rm.color}12 0%, ${rm.color}05 100%)`,
        } : isSecret ? bc.secret : bc.locked),
      }}
    >
      {/* Glow ring for earned */}
      {badge.earned && (
        <div style={{ ...bc.glowRing, borderColor: rm.color + '35', boxShadow: `0 0 14px ${rm.glow}` }} />
      )}

      {/* Rarity & category row */}
      <div style={bc.metaTop}>
        <span style={{ ...bc.catChip, color: cm.color, background: cm.color + '18', borderColor: cm.color + '30' }}>
          {cm.icon} {cm.label}
        </span>
        <span style={{ ...bc.rarChip, color: rm.color, background: rm.color + '15', borderColor: rm.color + '30' }}>
          {rm.label}
        </span>
      </div>

      {/* Icon */}
      <div style={{
        ...bc.iconWrap,
        filter: !badge.earned ? 'grayscale(0.7)' : 'none',
        opacity: !badge.earned ? (isSecret ? 0.35 : 0.5) : 1,
      }}>
        <span style={bc.icon}>{isSecret ? '❓' : badge.icon}</span>
        {!badge.earned && !isSecret && <span style={bc.lockOverlay}>🔒</span>}
      </div>

      {/* Name */}
      <p style={{
        ...bc.name,
        color: badge.earned ? rm.color : isSecret ? 'rgba(148,163,184,0.35)' : 'var(--text-h)',
      }}>
        {isSecret ? '???' : badge.name}
      </p>

      {/* Description */}
      <p style={{ ...bc.desc, opacity: badge.earned ? 0.82 : isSecret ? 0.28 : 0.45 }}>
        {isSecret ? 'Complete a hidden challenge to reveal this secret achievement.' : badge.description}
      </p>

      {/* Progress bar (locked non-secret with quantitative progress) */}
      {!badge.earned && !isSecret && badge.progress_target > 1 && (
        <div style={{ width: '100%', marginTop: '0.1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <span style={bc.progLabel}>{badge.progress_current} / {badge.progress_target}</span>
            <span style={{ ...bc.progLabel, color: cm.color }}>{progPct}%</span>
          </div>
          <div style={bc.progTrack}>
            <div style={{ ...bc.progFill, width: `${progPct}%`, background: `linear-gradient(90deg, ${cm.color}aa, ${cm.color})` }} />
          </div>
        </div>
      )}

      {/* Status chip */}
      {badge.earned ? (
        <div style={{ ...bc.earnedChip, borderColor: rm.color + '55', color: rm.color, background: rm.color + '14' }}>
          ✓ Earned{badge.earned_at ? ` · ${formatDate(badge.earned_at)}` : ''}
        </div>
      ) : isSecret ? (
        <div style={bc.secretChip}>🔮 Secret Achievement</div>
      ) : (
        <div style={bc.lockedChip}>
          <span style={{ color: rm.color, fontWeight: 800 }}>+{badge.xp_reward} XP</span>
          &nbsp;· Locked
        </div>
      )}
    </div>
  );
}
const bc: Record<string, React.CSSProperties> = {
  card: {
    position: 'relative',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center',
    padding: '1.1rem 1rem 1rem',
    border: '1px solid var(--border)',
    borderRadius: '16px', gap: '0.4rem',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    overflow: 'hidden',
  },
  locked: { background: 'var(--bg)', borderColor: 'var(--border)', opacity: 0.75 },
  secret: { background: 'rgba(139,92,246,0.04)', borderColor: 'rgba(139,92,246,0.18)', opacity: 0.6 },
  glowRing: {
    position: 'absolute', inset: '-1px', borderRadius: '16px',
    border: '1px solid', pointerEvents: 'none',
  },
  metaTop: {
    display: 'flex', gap: '0.3rem', justifyContent: 'center',
    flexWrap: 'wrap', width: '100%', marginBottom: '0.3rem',
  },
  catChip: {
    padding: '0.12rem 0.45rem', borderRadius: '99px',
    fontSize: '0.58rem', fontWeight: 700, border: '1px solid',
    letterSpacing: '0.03em',
  },
  rarChip: {
    padding: '0.12rem 0.45rem', borderRadius: '99px',
    fontSize: '0.58rem', fontWeight: 800, border: '1px solid',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  iconWrap: {
    position: 'relative', width: '58px', height: '58px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: '0.1rem',
    transition: 'filter 0.3s, opacity 0.3s',
  },
  icon:        { fontSize: '2.2rem', lineHeight: 1 },
  lockOverlay: { position: 'absolute', bottom: '-2px', right: '-2px', fontSize: '0.85rem' },
  name: {
    margin: 0, fontSize: '0.88rem', fontWeight: 800, lineHeight: 1.25,
    transition: 'color 0.3s',
  },
  desc: {
    margin: 0, fontSize: '0.72rem', color: 'var(--text)',
    lineHeight: 1.45, transition: 'opacity 0.3s',
  },
  progLabel: { fontSize: '0.6rem', color: 'var(--text)', fontWeight: 600, opacity: 0.6 },
  progTrack:  { height: '4px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' },
  progFill:   { height: '100%', borderRadius: '99px', transition: 'width 0.6s ease' },
  earnedChip: {
    marginTop: '0.3rem', padding: '0.22rem 0.65rem', borderRadius: '99px',
    fontSize: '0.68rem', fontWeight: 700, border: '1px solid',
  },
  lockedChip: {
    marginTop: '0.3rem', padding: '0.22rem 0.65rem', borderRadius: '99px',
    fontSize: '0.68rem', fontWeight: 600, border: '1px solid var(--border)',
    color: 'var(--text)', background: 'transparent',
  },
  secretChip: {
    marginTop: '0.3rem', padding: '0.22rem 0.65rem', borderRadius: '99px',
    fontSize: '0.68rem', fontWeight: 700,
    border: '1px solid rgba(139,92,246,0.3)',
    color: '#a78bfa', background: 'rgba(139,92,246,0.08)',
  },
};

// ── Main Page ───────────────────────────────────────────────────────────────────
export default function Achievements() {
  const { token } = useAuth();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const { t } = useLanguage();
  const [badges,    setBadges]    = useState<Achievement[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [newBadges, setNewBadges] = useState<Achievement[]>([]);
  const [category,  setCategory]  = useState('all');
  const [search,    setSearch]    = useState('');
  const [sort,      setSort]      = useState<'default' | 'rarity' | 'earned' | 'locked'>('default');

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    api.post('/achievements/check', {}, { headers })
      .then(r => { if (r.data?.new_badges?.length) setNewBadges(r.data.new_badges); })
      .catch(() => {});

    api.get<Achievement[]>('/achievements', { headers })
      .then(r => setBadges(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // ── Derived stats ────────────────────────────────────────────────────────
  const earnedCount = badges.filter(b => b.earned).length;
  const totalCount  = badges.length;
  const xpFromBadges = badges.filter(b => b.earned).reduce((s, b) => s + b.xp_reward, 0);
  const pct = totalCount ? Math.round((earnedCount / totalCount) * 100) : 0;

  const rarityDist = useMemo(() => {
    const dist: Record<string, { total: number; earned: number }> = {
      common: { total: 0, earned: 0 }, rare: { total: 0, earned: 0 },
      epic:   { total: 0, earned: 0 }, legendary: { total: 0, earned: 0 },
    };
    badges.forEach(b => {
      dist[b.rarity].total++;
      if (b.earned) dist[b.earned ? b.rarity : b.rarity].earned++;
    });
    return dist;
  }, [badges]);

  // ── Filtered + sorted list ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...badges];

    if (category === 'all') {
      list = list.filter(b => !b.hidden || b.earned);
    } else if (category === 'hidden') {
      list = list.filter(b => b.hidden);
    } else {
      list = list.filter(b => b.category === category && !b.hidden);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        (!b.hidden || b.earned) && (
          b.name.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q)
        )
      );
    }

    if (sort === 'rarity') {
      list.sort((a, b) => (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0));
    } else if (sort === 'earned') {
      list.sort((a, b) => (b.earned ? 1 : 0) - (a.earned ? 1 : 0));
    } else if (sort === 'locked') {
      list.sort((a, b) => (a.earned ? 1 : 0) - (b.earned ? 1 : 0));
    } else {
      list.sort((a, b) => {
        if (a.earned !== b.earned) return a.earned ? -1 : 1;
        return (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0);
      });
    }

    return list;
  }, [badges, category, search, sort]);

  // Secret achievements shown at bottom of 'all' view
  const unearnedSecrets = category === 'all'
    ? badges.filter(b => b.hidden && !b.earned)
    : [];

  const newIds = new Set(newBadges.map(b => b.id));

  return (
    <div className={isDark ? 'assessment-dark' : 'assessment-light'} style={s.shell}>
      <main style={s.main}>

        {/* ── New badge banner ── */}
        {newBadges.length > 0 && (
          <NewBadgeBanner badges={newBadges} onDismiss={() => setNewBadges([])} />
        )}

        {/* ── Page header ── */}
        <div style={s.titleRow}>
          <div>
            <h1 style={s.pageTitle}>{t('achievements_title')}</h1>
            <p style={s.pageSub}>Track your progress and unlock badges</p>
          </div>

          {/* ── Completion chip ── */}
          {!loading && (
            <div style={s.completionCard}>
              <div style={s.completionMain}>
                <span style={s.completionNum}>{earnedCount}</span>
                <span style={s.completionOf}>/ {totalCount}</span>
              </div>
              <p style={s.completionLabel}>{pct}% complete</p>
              <div style={s.barTrack}>
                <div style={{ ...s.barFill, width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* ── Rarity breakdown ── */}
        {!loading && (
          <div style={s.rarityRow}>
            {(['legendary', 'epic', 'rare', 'common'] as const).map(r => {
              const rm = RARITY_META[r];
              const d  = rarityDist[r];
              return (
                <div key={r} style={{ ...s.rarCell, borderColor: rm.color + '30', background: rm.color + '0a' }}>
                  <span style={{ ...s.rarLabel, color: rm.color }}>{rm.label}</span>
                  <span style={{ ...s.rarCount, color: rm.color }}>{d.earned}<span style={s.rarTotal}>/{d.total}</span></span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Next goals ── */}
        {!loading && <NextGoalPanel badges={badges} />}

        {/* ── Category tabs ── */}
        <div className="ach-tabs" style={s.tabs}>
          {CATEGORY_TABS.map(cat => {
            const meta = cat === 'all'
              ? { label: 'All', icon: '✨' }
              : CATEGORY_META[cat];
            const active = category === cat;
            const catCount = cat === 'all'
              ? badges.filter(b => b.earned).length
              : badges.filter(b => b.category === cat && b.earned).length;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  ...s.tab,
                  background:   active ? 'rgba(0,212,255,0.15)' : 'transparent',
                  borderColor:  active ? 'rgba(0,212,255,0.4)'  : 'var(--border)',
                  color:        active ? '#00D4FF'               : 'var(--text)',
                  fontWeight:   active ? 800 : 600,
                }}
              >
                {meta.icon} {meta.label}
                {catCount > 0 && (
                  <span style={{ ...s.tabBadge, background: active ? '#00D4FF20' : 'var(--border)' }}>
                    {catCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Search + Sort ── */}
        <div style={s.controlRow}>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search achievements…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={s.searchInput}
            />
            {search && (
              <button onClick={() => setSearch('')} style={s.searchClear}>✕</button>
            )}
          </div>

          <select
            value={sort}
            onChange={e => setSort(e.target.value as typeof sort)}
            style={s.sortSelect}
          >
            <option value="default">Sort: Default</option>
            <option value="rarity">Sort: Rarity</option>
            <option value="earned">Sort: Earned first</option>
            <option value="locked">Sort: Locked first</option>
          </select>
        </div>

        {/* ── Badge count ── */}
        {!loading && (
          <p style={s.countLabel}>
            Showing {filtered.length + unearnedSecrets.length} achievement{filtered.length + unearnedSecrets.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* ── Grid ── */}
        {loading ? (
          <div style={s.grid}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ ...s.skeleton, animationDelay: `${i * 0.04}s` }} />
            ))}
          </div>
        ) : filtered.length === 0 && unearnedSecrets.length === 0 ? (
          <div style={s.empty}>
            <p style={s.emptyIcon}>🔍</p>
            <p style={s.emptyText}>No achievements match your search.</p>
          </div>
        ) : (
          <>
            <div style={s.grid}>
              {filtered.map((badge, i) => (
                <div key={badge.id} style={{ animationDelay: isNew(badge.id, newIds) ? `${i * 0.08}s` : undefined }}>
                  <BadgeCard badge={badge} isNew={newIds.has(badge.id)} />
                </div>
              ))}
            </div>

            {/* ── Secret achievements section (only in 'all' view) ── */}
            {unearnedSecrets.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <div style={s.sectionHeader}>
                  <span>🔮</span>
                  <p style={s.sectionTitle}>Secret Achievements</p>
                  <span style={s.sectionBadge}>{unearnedSecrets.length} hidden</span>
                </div>
                <p style={s.sectionSub}>These achievements are revealed only after they are unlocked.</p>
                <div style={s.grid}>
                  {unearnedSecrets.map(badge => (
                    <BadgeCard key={badge.id} badge={badge} isNew={false} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function isNew(id: string, newIds: Set<string>): boolean {
  return newIds.has(id);
}

// ── Styles ──────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },

  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 2rem', height: '60px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '0.65rem' },
  navLogo: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px', textDecoration: 'none' },
  xpBadge: {
    fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b',
    padding: '0.2rem 0.65rem', borderRadius: '99px',
    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
  },

  main: { flex: 1, padding: '2rem', maxWidth: '1050px', width: '100%', margin: '0 auto', boxSizing: 'border-box' },

  titleRow: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem',
  },
  pageTitle: { margin: '0 0 0.25rem', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-h)' },
  pageSub:   { margin: 0, fontSize: '0.85rem', color: 'var(--text)', opacity: 0.6 },

  completionCard: {
    padding: '0.85rem 1.25rem', border: '1px solid var(--border)',
    borderRadius: '14px', background: 'var(--bg-elevated)',
    minWidth: '130px', textAlign: 'center',
  },
  completionMain: { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.2rem' },
  completionNum:  { fontSize: '2rem', fontWeight: 900, color: 'var(--accent)', lineHeight: 1 },
  completionOf:   { fontSize: '0.9rem', color: 'var(--text)', fontWeight: 600 },
  completionLabel:{ margin: '0.1rem 0 0.4rem', fontSize: '0.65rem', color: 'var(--text)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' },
  barTrack:       { width: '100%', height: '4px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' },
  barFill:        { height: '100%', background: 'var(--accent)', borderRadius: '99px', transition: 'width 0.7s ease' },

  rarityRow: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem',
    marginBottom: '1.25rem',
  },
  rarCell: {
    padding: '0.55rem 0.75rem', borderRadius: '10px', border: '1px solid',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem',
  },
  rarLabel: { fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' },
  rarCount: { fontSize: '1.05rem', fontWeight: 900 },
  rarTotal: { fontSize: '0.72rem', fontWeight: 600, opacity: 0.5 },

  tabs: {
    display: 'flex', gap: '0.4rem', flexWrap: 'wrap',
    marginBottom: '0.9rem',
  },
  tab: {
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.32rem 0.7rem', borderRadius: '8px',
    border: '1px solid', fontSize: '0.72rem',
    cursor: 'pointer', fontFamily: 'inherit',
    whiteSpace: 'nowrap', transition: 'background 0.18s, color 0.18s, border-color 0.18s',
    flexShrink: 0,
  },
  tabBadge: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: '16px', height: '16px', borderRadius: '99px',
    fontSize: '0.58rem', fontWeight: 800, padding: '0 4px',
    color: 'var(--text)',
  },

  controlRow: {
    display: 'flex', gap: '0.75rem', marginBottom: '0.75rem',
    alignItems: 'center', flexWrap: 'wrap',
  },
  searchWrap: {
    flex: 1, minWidth: '180px',
    position: 'relative', display: 'flex', alignItems: 'center',
  },
  searchIcon:  { position: 'absolute', left: '0.7rem', fontSize: '0.8rem', pointerEvents: 'none' },
  searchInput: {
    width: '100%', padding: '0.45rem 2rem 0.45rem 2.1rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)', borderRadius: '9px',
    color: 'var(--text-h)', fontSize: '0.8rem', fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  },
  searchClear: {
    position: 'absolute', right: '0.5rem',
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text)', fontSize: '0.75rem', padding: '0.2rem',
    fontFamily: 'inherit',
  },
  sortSelect: {
    padding: '0.45rem 0.75rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)', borderRadius: '9px',
    color: 'var(--text)', fontSize: '0.78rem', fontFamily: 'inherit',
    cursor: 'pointer', outline: 'none',
  },

  countLabel: { margin: '0 0 0.9rem', fontSize: '0.68rem', color: 'var(--text)', opacity: 0.45, fontWeight: 600 },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
    gap: '0.85rem',
  },
  skeleton: {
    height: '240px', borderRadius: '16px',
    background: 'var(--border)',
    animation: 'fade-in 1.2s ease infinite alternate',
  },

  empty: { textAlign: 'center', padding: '3rem 1rem' },
  emptyIcon: { margin: '0 0 0.5rem', fontSize: '2.5rem' },
  emptyText: { margin: 0, color: 'var(--text)', opacity: 0.5, fontSize: '0.88rem' },

  sectionHeader: {
    display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem',
  },
  sectionTitle: { margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-h)' },
  sectionBadge: {
    padding: '0.15rem 0.5rem', borderRadius: '99px',
    background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.28)',
    fontSize: '0.65rem', fontWeight: 700, color: '#a78bfa',
  },
  sectionSub: {
    margin: '0 0 1rem', fontSize: '0.75rem', color: 'var(--text)', opacity: 0.5,
  },
};

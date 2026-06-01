import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import BackButton from '../components/BackButton';

interface AchievementItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earned: boolean;
  earned_at: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function BadgeCard({ badge }: { badge: AchievementItem }) {
  return (
    <div
      style={{
        ...bc.card,
        ...(badge.earned ? {
          borderColor: badge.color + '70',
          background: `linear-gradient(145deg, ${badge.color}12, ${badge.color}06)`,
          boxShadow: `0 0 24px ${badge.color}28, 0 0 48px ${badge.color}10, inset 0 1px 0 ${badge.color}20`,
        } : bc.locked),
      }}
    >
      {badge.earned && (
        <div style={{ ...bc.glowRing, borderColor: badge.color + '40', boxShadow: `0 0 16px ${badge.color}30` }} />
      )}

      <div style={{ ...bc.iconWrap, ...(badge.earned ? {} : bc.iconLocked) }}>
        <span style={bc.icon}>{badge.icon}</span>
        {!badge.earned && <span style={bc.lockOverlay}>🔒</span>}
      </div>

      <p style={{ ...bc.name, color: badge.earned ? badge.color : 'var(--text)' }}>
        {badge.name}
      </p>

      <p style={{ ...bc.desc, opacity: badge.earned ? 0.85 : 0.45 }}>
        {badge.description}
      </p>

      {badge.earned ? (
        <div style={{ ...bc.earnedChip, borderColor: badge.color + '60', color: badge.color, background: badge.color + '15' }}>
          ✓ Earned {badge.earned_at ? `· ${formatDate(badge.earned_at)}` : ''}
        </div>
      ) : (
        <div style={bc.lockedChip}>Locked</div>
      )}
    </div>
  );
}

export default function Achievements() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [badges, setBadges] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AchievementItem[]>('/achievements', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => setBadges(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const earned = badges.filter(b => b.earned).length;
  const total  = badges.length;

  return (
    <div style={s.shell}>
      <header style={s.nav}>
        <div style={s.navLeft}>
          <BackButton />
          <Link to="/" style={s.navLogo}>TwinMind</Link>
        </div>
      </header>

      <main style={s.main}>
        <div style={s.titleRow}>
          <div>
            <h1 style={s.pageTitle}>{t('achievements_title')}</h1>
            <p style={s.pageSubtitle}>Earn badges by building great study habits</p>
          </div>
          {!loading && (
            <div style={s.progressChip}>
              <span style={s.progressNum}>{earned}</span>
              <span style={s.progressOf}>/ {total}</span>
              <span style={s.progressLabel}>earned</span>
              <div style={s.progressBarTrack}>
                <div style={{ ...s.progressBarFill, width: `${total ? (earned / total) * 100 : 0}%` }} />
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div style={s.loading}>{t('loading')}</div>
        ) : (
          <div style={s.grid}>
            {badges.map(badge => (
              <BadgeCard key={badge.id} badge={badge} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 2rem', height: '60px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '0.65rem' },
  navLogo: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px', textDecoration: 'none' },
  main: { flex: 1, padding: '2rem', maxWidth: '960px', width: '100%', margin: '0 auto', boxSizing: 'border-box' as const },
  titleRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap' as const, gap: '1rem' },
  pageTitle: { margin: '0 0 0.25rem', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-h)' },
  pageSubtitle: { margin: 0, fontSize: '0.875rem', color: 'var(--text)' },
  progressChip: {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.75rem 1.25rem',
    border: '1px solid var(--border)', borderRadius: '12px',
    background: 'var(--bg)',
    flexDirection: 'column' as const,
    minWidth: '120px',
  },
  progressNum: { fontSize: '2rem', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 },
  progressOf: { fontSize: '0.85rem', color: 'var(--text)', marginLeft: '0.15rem' },
  progressLabel: { fontSize: '0.7rem', color: 'var(--text)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 600 },
  progressBarTrack: { width: '80px', height: '4px', background: 'var(--border)', borderRadius: '99px', marginTop: '0.35rem', overflow: 'hidden' },
  progressBarFill: { height: '100%', background: 'var(--accent)', borderRadius: '99px', transition: 'width 0.6s ease' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '1rem',
  },
  loading: { color: 'var(--text)', fontSize: '0.875rem', padding: '2rem 0' },
};

const bc: Record<string, React.CSSProperties> = {
  card: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center' as const,
    padding: '1.75rem 1.25rem 1.25rem',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    gap: '0.5rem',
    transition: 'box-shadow 0.3s ease, transform 0.2s ease',
    overflow: 'hidden',
  },
  locked: {
    background: 'var(--bg)',
    borderColor: 'var(--border)',
    opacity: 0.7,
  },
  glowRing: {
    position: 'absolute',
    inset: '-1px',
    borderRadius: '16px',
    border: '1px solid',
    pointerEvents: 'none',
  },
  iconWrap: {
    position: 'relative',
    width: '64px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.25rem',
  },
  iconLocked: {
    filter: 'grayscale(1)',
    opacity: 0.35,
  },
  icon: {
    fontSize: '2.5rem',
    lineHeight: 1,
  },
  lockOverlay: {
    position: 'absolute',
    bottom: '-4px',
    right: '-4px',
    fontSize: '0.9rem',
  },
  name: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 700,
  },
  desc: {
    margin: 0,
    fontSize: '0.78rem',
    color: 'var(--text)',
    lineHeight: '1.45',
  },
  earnedChip: {
    marginTop: '0.5rem',
    padding: '0.25rem 0.65rem',
    borderRadius: '99px',
    fontSize: '0.72rem',
    fontWeight: 600,
    border: '1px solid',
  },
  lockedChip: {
    marginTop: '0.5rem',
    padding: '0.25rem 0.65rem',
    borderRadius: '99px',
    fontSize: '0.72rem',
    fontWeight: 600,
    border: '1px solid var(--border)',
    color: 'var(--text)',
    background: 'transparent',
  },
};

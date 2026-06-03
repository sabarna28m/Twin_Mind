import { useState, useRef, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Video, Search, ExternalLink, Play, X, Clock, Eye,
  Calendar, Sparkles, BookOpen, ChevronRight, Star,
  ShieldCheck, AlertCircle, Wifi,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveBadge from '../components/LiveBadge';
import BackButton from '../components/BackButton';
import api from '../services/api';

/* ─── Types ─── */
interface VideoResult {
  video_id:             string;
  title:                string;
  channel:              string;
  duration:             string;
  view_count:           number;
  view_count_formatted: string;
  published_at:         string;
  thumbnail:            string;
  youtube_url:          string;
  ai_reason:            string;
  difficulty:           'Beginner' | 'Intermediate' | 'Advanced';
  estimated_time:       string;
  is_top:               boolean;
  is_trusted:           boolean;
  rank:                 number;
}

interface SearchResponse {
  topic:                string;
  videos:               VideoResult[];
  learning_path:        string;
  prerequisites:        string[];
  difficulty_overview:  string;
  cached:               boolean;
}

/* ─── Preset topics ─── */
const QUICK_TOPICS = [
  'Data Structures', 'Machine Learning', 'DBMS', 'Operating Systems',
  'Calculus', 'Neural Networks', 'Java Programming', 'Linear Algebra',
  'Algorithms', 'Computer Networks', 'Deep Learning', 'Statistics',
];

/* ─── Difficulty config ─── */
const DIFF_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  Beginner:     { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)'  },
  Intermediate: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)'  },
  Advanced:     { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)'   },
};

/* ─── Skeleton card ─── */
function SkeletonCard() {
  return (
    <div style={sk.card} className="sv-skeleton-card">
      <div style={sk.thumb} className="sv-pulse" />
      <div style={sk.body}>
        <div style={{ ...sk.line, width: '90%', height: '18px' }} className="sv-pulse" />
        <div style={{ ...sk.line, width: '55%', height: '14px' }} className="sv-pulse" />
        <div style={{ ...sk.line, width: '75%', height: '13px' }} className="sv-pulse" />
        <div style={{ ...sk.line, width: '100%', height: '36px' }} className="sv-pulse" />
      </div>
    </div>
  );
}
const sk: Record<string, React.CSSProperties> = {
  card: {
    borderRadius: '18px',
    background: 'rgba(10,16,32,0.75)',
    border: '1px solid rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  thumb: { width: '100%', aspectRatio: '16/9', background: 'rgba(255,255,255,0.06)' },
  body: { padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  line: { borderRadius: '6px', background: 'rgba(255,255,255,0.06)' },
};

/* ─── Video card ─── */
interface VideoCardProps { video: VideoResult; }
function VideoCard({ video }: VideoCardProps) {
  const [showEmbed, setShowEmbed] = useState(false);
  const diff = DIFF_STYLE[video.difficulty] ?? DIFF_STYLE.Intermediate;

  return (
    <div
      style={{
        ...vc.card,
        border: video.is_top
          ? '1px solid rgba(0,212,255,0.45)'
          : '1px solid rgba(255,255,255,0.07)',
        boxShadow: video.is_top
          ? '0 0 30px rgba(0,212,255,0.1), 0 8px 40px rgba(0,0,0,0.5)'
          : '0 4px 30px rgba(0,0,0,0.4)',
      }}
      className="sv-card"
    >
      {/* Top badge row */}
      {(video.is_top || video.is_trusted) && (
        <div style={vc.badgeRow}>
          {video.is_top && (
            <div style={vc.topBadge}>
              <Star size={12} fill="#F59E0B" color="#F59E0B" />
              Top Recommendation
            </div>
          )}
          {video.is_trusted && (
            <div style={vc.trustedBadge}>
              <ShieldCheck size={12} color="#10B981" />
              Trusted Channel
            </div>
          )}
        </div>
      )}

      {/* Thumbnail / embed */}
      <div style={vc.thumbWrap} className="sv-thumb-wrap">
        {showEmbed ? (
          <div style={vc.embedWrap}>
            <iframe
              src={`https://www.youtube.com/embed/${video.video_id}?autoplay=1&rel=0`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={vc.iframe}
            />
          </div>
        ) : (
          <>
            <img
              src={video.thumbnail}
              alt={video.title}
              style={vc.thumb}
              loading="lazy"
            />
            <button
              style={vc.playOverlay}
              onClick={() => setShowEmbed(true)}
              aria-label="Preview video"
              className="sv-play-overlay"
            >
              <div style={vc.playCircle}>
                <Play size={22} fill="white" color="white" />
              </div>
            </button>
          </>
        )}
        {showEmbed && (
          <button
            style={vc.closeEmbed}
            onClick={() => setShowEmbed(false)}
            aria-label="Close preview"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Card body */}
      <div style={vc.body}>
        {/* Rank + difficulty */}
        <div style={vc.topRow}>
          <span style={vc.rankNum}>#{video.rank}</span>
          <span style={{
            ...vc.diffBadge,
            color: diff.color,
            background: diff.bg,
            borderColor: diff.border,
          }}>
            {video.difficulty}
          </span>
        </div>

        {/* Title */}
        <h3 style={vc.title}>{video.title}</h3>

        {/* Channel */}
        <p style={vc.channel}>{video.channel}</p>

        {/* Meta row */}
        <div style={vc.metaRow}>
          <span style={vc.meta}><Clock size={12} />{video.duration}</span>
          <span style={vc.meta}><Eye size={12} />{video.view_count_formatted}</span>
          <span style={vc.meta}><Calendar size={12} />{video.published_at}</span>
        </div>

        {/* Estimated time */}
        <div style={vc.estRow}>
          <BookOpen size={13} color="#00D4FF" />
          <span style={vc.estText}>{video.estimated_time}</span>
        </div>

        {/* AI reason */}
        <div style={vc.reasonBox}>
          <Sparkles size={13} color="#7C3AED" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={vc.reasonText}>{video.ai_reason}</p>
        </div>

        {/* Buttons */}
        <div style={vc.btnRow}>
          <a
            href={video.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            style={vc.watchBtn}
            className="sv-watch-btn"
          >
            <ExternalLink size={14} />
            Watch on YouTube
          </a>
          <button
            style={{ ...vc.previewBtn, background: showEmbed ? 'rgba(0,212,255,0.15)' : undefined }}
            onClick={() => setShowEmbed(v => !v)}
            className="sv-preview-btn"
          >
            {showEmbed ? <X size={14} /> : <Play size={14} />}
            {showEmbed ? 'Close' : 'Preview'}
          </button>
        </div>
      </div>
    </div>
  );
}

const vc: Record<string, React.CSSProperties> = {
  card: {
    borderRadius: '18px',
    background: 'rgba(10,16,32,0.82)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease',
  },
  badgeRow: {
    display: 'flex',
    gap: '0.45rem',
    padding: '0.55rem 0.85rem 0',
    flexWrap: 'wrap' as const,
  },
  topBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.22rem 0.65rem',
    borderRadius: '999px',
    background: 'rgba(245,158,11,0.14)',
    border: '1px solid rgba(245,158,11,0.4)',
    color: '#F59E0B',
    fontSize: '0.7rem',
    fontWeight: 700,
  },
  trustedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.22rem 0.65rem',
    borderRadius: '999px',
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.3)',
    color: '#10B981',
    fontSize: '0.7rem',
    fontWeight: 700,
  },
  thumbWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    background: 'rgba(0,0,0,0.3)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    transition: 'transform 0.4s ease',
  },
  playOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0)',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  playCircle: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: 'rgba(0,212,255,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 24px rgba(0,212,255,0.5)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  embedWrap: {
    position: 'absolute',
    inset: 0,
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    display: 'block',
  },
  closeEmbed: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.6)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    fontFamily: 'inherit',
  },
  body: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    flex: 1,
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rankNum: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--text)',
    fontFamily: 'ui-monospace, monospace',
  },
  diffBadge: {
    padding: '0.18rem 0.55rem',
    borderRadius: '999px',
    border: '1px solid',
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
  },
  title: {
    margin: 0,
    fontSize: '0.92rem',
    fontWeight: 700,
    color: 'var(--text-h)',
    lineHeight: 1.35,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  },
  channel: {
    margin: 0,
    fontSize: '0.78rem',
    color: '#00D4FF',
    fontWeight: 600,
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.55rem',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.72rem',
    color: 'var(--text)',
  },
  estRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.4rem',
    padding: '0.45rem 0.6rem',
    borderRadius: '8px',
    background: 'rgba(0,212,255,0.06)',
    border: '1px solid rgba(0,212,255,0.12)',
  },
  estText: {
    fontSize: '0.75rem',
    color: '#00D4FF',
    fontWeight: 500,
    lineHeight: 1.4,
  },
  reasonBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.45rem',
    padding: '0.5rem 0.65rem',
    borderRadius: '8px',
    background: 'rgba(124,58,237,0.07)',
    border: '1px solid rgba(124,58,237,0.15)',
    flex: 1,
  },
  reasonText: {
    margin: 0,
    fontSize: '0.75rem',
    color: 'var(--text-m)',
    lineHeight: 1.5,
  },
  btnRow: {
    display: 'flex',
    gap: '0.55rem',
    marginTop: 'auto',
    flexWrap: 'wrap' as const,
  },
  watchBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.55rem 0.75rem',
    borderRadius: '10px',
    background: 'linear-gradient(135deg,#00D4FF,#7C3AED)',
    color: '#fff',
    fontSize: '0.8rem',
    fontWeight: 700,
    textDecoration: 'none',
    transition: 'opacity 0.2s, transform 0.15s',
    minWidth: '120px',
  },
  previewBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.55rem 0.85rem',
    borderRadius: '10px',
    background: 'rgba(0,212,255,0.08)',
    border: '1px solid rgba(0,212,255,0.2)',
    color: '#00D4FF',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.2s, transform 0.15s',
    whiteSpace: 'nowrap' as const,
  },
};


/* ═══════════════════════════════════════ */
export default function StudyVideos() {
  const { user, token } = useAuth();
  const wsConnected = useWebSocket(user?.id, token, () => {});

  const [query,   setQuery]   = useState('');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<SearchResponse | null>(null);
  const [error,   setError]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch(topic?: string) {
    const q = (topic ?? query).trim();
    if (!q) { inputRef.current?.focus(); return; }
    setQuery(q);
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const { data } = await api.post<SearchResponse>(
        '/videos/search',
        { topic: q, max_results: 8 },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setResult(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Search failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    handleSearch();
  }

  /* ── Render ── */
  return (
    <div style={s.shell}>

      {/* Navbar */}
      <header style={s.nav} className="nav-premium">
        <div style={s.navLeft}>
          <BackButton />
          <Link to="/" style={s.navLogo}>TwinMind</Link>
          {wsConnected && <LiveBadge />}
        </div>
      </header>

      <main style={s.main}>
        <div style={s.content} className="animate-slide-up">

          {/* Page header */}
          <div style={s.pageHeader}>
            <div style={s.pageIconWrap}>
              <Video size={24} color="#00D4FF" />
            </div>
            <div>
              <h1 style={s.pageTitle} className="grad-text-cyan">AI Study Videos</h1>
              <p style={s.pageSub}>AI-ranked educational YouTube videos for any topic</p>
            </div>
          </div>

          {/* Search card */}
          <div style={s.searchCard} className="glass-panel">
            {/* Ambient orbs */}
            <div style={s.orb1} />
            <div style={s.orb2} />

            <form onSubmit={onSubmit} style={s.searchForm}>
              <div style={s.searchInputWrap}>
                <Search size={18} color="rgba(148,163,184,0.5)" style={s.searchIcon} />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Enter a study topic… e.g. Machine Learning, DBMS, Calculus"
                  style={s.searchInput}
                  className="dark-input sv-search-input"
                  autoFocus
                  disabled={loading}
                />
                {query && (
                  <button
                    type="button"
                    style={s.clearBtn}
                    onClick={() => { setQuery(''); setResult(null); setError(''); }}
                    aria-label="Clear"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !query.trim()}
                style={s.searchBtn}
                className="grad-btn sv-search-btn"
              >
                {loading ? (
                  <span style={s.spinnerWrap}>
                    <span className="sv-spinner" />
                    Searching…
                  </span>
                ) : (
                  <>
                    <Search size={16} />
                    Search
                  </>
                )}
              </button>
            </form>

            {/* Quick topics */}
            <div style={s.quickRow}>
              <span style={s.quickLabel}>Quick topics:</span>
              <div style={s.quickChips}>
                {QUICK_TOPICS.map(t => (
                  <button
                    key={t}
                    style={s.chip}
                    className="sv-chip"
                    onClick={() => handleSearch(t)}
                    disabled={loading}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error state */}
          {error && !loading && (
            <div style={s.errorBox} className="animate-fade-in">
              <AlertCircle size={20} color="#EF4444" />
              <div>
                <p style={s.errorTitle}>Search failed</p>
                <p style={s.errorMsg}>{error}</p>
                {error.includes('YOUTUBE_API_KEY') && (
                  <p style={s.errorHint}>
                    Get a free YouTube Data API v3 key at{' '}
                    <a
                      href="https://console.cloud.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#00D4FF' }}
                    >
                      console.cloud.google.com
                    </a>
                    {' '}and add it to Backend/.env as YOUTUBE_API_KEY=…
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Skeleton loading */}
          {loading && (
            <div className="animate-fade-in">
              <p style={s.loadingHint}>
                <Wifi size={14} color="#00D4FF" />
                Searching YouTube and ranking with AI…
              </p>
              <div style={s.grid}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div className="animate-fade-in">

              {/* Results header */}
              <div style={s.resultsHeader}>
                <div style={s.resultsMeta}>
                  <span style={s.resultsCount}>{result.videos.length} videos</span>
                  <span style={s.resultsTopic}>for "{result.topic}"</span>
                  {result.cached && (
                    <span style={s.cachedBadge}>cached</span>
                  )}
                </div>
                {result.difficulty_overview && (
                  <p style={s.diffOverview}>{result.difficulty_overview}</p>
                )}
              </div>

              {/* Prerequisites */}
              {result.prerequisites.length > 0 && (
                <div style={s.prereqCard} className="animate-fade-in">
                  <div style={s.prereqHeader}>
                    <ChevronRight size={16} color="#F59E0B" />
                    <span style={s.prereqTitle}>Recommended Prerequisites</span>
                  </div>
                  <div style={s.prereqChips}>
                    {result.prerequisites.map(p => (
                      <button
                        key={p}
                        style={s.prereqChip}
                        onClick={() => handleSearch(p)}
                        className="sv-prereq-chip"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Video grid */}
              <div style={s.grid}>
                {result.videos.map(v => (
                  <VideoCard key={v.video_id} video={v} />
                ))}
              </div>

              {/* Learning path */}
              {result.learning_path && (
                <div style={s.pathCard} className="animate-fade-in">
                  <div style={s.pathHeader}>
                    <div style={s.pathIconWrap}>
                      <Sparkles size={18} color="#7C3AED" />
                    </div>
                    <div>
                      <h3 style={s.pathTitle}>AI Learning Path</h3>
                      <p style={s.pathSub}>Suggested viewing sequence for mastering {result.topic}</p>
                    </div>
                  </div>
                  <p style={s.pathBody}>{result.learning_path}</p>
                </div>
              )}
            </div>
          )}

          {/* Empty initial state */}
          {!result && !loading && !error && (
            <div style={s.emptyState} className="animate-fade-in">
              <div style={s.emptyIcon}>🎓</div>
              <p style={s.emptyTitle}>Find the best educational videos</p>
              <p style={s.emptyHint}>
                Type any study topic above or click a quick topic to get AI-ranked YouTube recommendations.
              </p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}


/* ── Page styles ─────────────────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100svh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
    fontFamily: 'var(--sans)',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 2rem',
    height: '60px',
    position: 'sticky',
    top: 0,
    zIndex: 20,
    flexShrink: 0,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  navLogo: {
    fontSize: '1.18rem',
    fontWeight: 700,
    color: 'var(--primary)',
    letterSpacing: '-0.5px',
    textDecoration: 'none',
  },
  main: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    padding: '2rem 1.25rem 4rem',
    boxSizing: 'border-box' as const,
  },
  content: {
    width: '100%',
    maxWidth: '1080px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.6rem',
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.9rem',
  },
  pageIconWrap: {
    width: '50px',
    height: '50px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, rgba(0,212,255,0.18), rgba(124,58,237,0.18))',
    border: '1px solid rgba(0,212,255,0.22)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pageTitle: {
    fontSize: '1.75rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    margin: 0,
  },
  pageSub: {
    margin: '0.1rem 0 0',
    fontSize: '0.84rem',
    color: 'var(--text)',
  },

  /* Search card */
  searchCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: '1.75rem',
    borderRadius: '22px',
    background: 'rgba(10,16,32,0.82)',
    border: '1px solid rgba(0,212,255,0.12)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    boxShadow: '0 8px 50px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
  },
  orb1: {
    position: 'absolute',
    top: '-60px',
    right: '-60px',
    width: '200px',
    height: '200px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,212,255,0.1) 0%, transparent 70%)',
    pointerEvents: 'none',
    animation: 'orb-drift-1 14s ease-in-out infinite',
  },
  orb2: {
    position: 'absolute',
    bottom: '-40px',
    left: '-40px',
    width: '160px',
    height: '160px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)',
    pointerEvents: 'none',
    animation: 'orb-drift-2 18s ease-in-out infinite',
  },
  searchForm: {
    display: 'flex',
    gap: '0.75rem',
    position: 'relative',
    zIndex: 1,
    flexWrap: 'wrap' as const,
  },
  searchInputWrap: {
    flex: 1,
    minWidth: '200px',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '1rem',
    pointerEvents: 'none',
    flexShrink: 0,
  },
  searchInput: {
    width: '100%',
    paddingLeft: '2.75rem',
    paddingRight: '2.5rem',
    height: '48px',
    fontSize: '0.95rem',
    borderRadius: '12px',
    boxSizing: 'border-box' as const,
  },
  clearBtn: {
    position: 'absolute',
    right: '0.75rem',
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '0.2rem',
    fontFamily: 'inherit',
    opacity: 0.6,
  },
  searchBtn: {
    height: '48px',
    padding: '0 1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '0.92rem',
    fontWeight: 700,
    borderRadius: '12px',
    width: 'auto',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  spinnerWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  quickRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    position: 'relative',
    zIndex: 1,
    flexWrap: 'wrap' as const,
  },
  quickLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text)',
    whiteSpace: 'nowrap' as const,
    marginTop: '0.3rem',
    flexShrink: 0,
  },
  quickChips: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.45rem',
  },
  chip: {
    padding: '0.28rem 0.75rem',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.09)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-m)',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.18s, border-color 0.18s, color 0.18s, transform 0.14s',
  },

  /* Loading hint */
  loadingHint: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#00D4FF',
    fontSize: '0.85rem',
    fontWeight: 600,
    marginBottom: '1rem',
  },

  /* Video grid */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1.25rem',
  },

  /* Results header */
  resultsHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    marginBottom: '0.25rem',
  },
  resultsMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap' as const,
  },
  resultsCount: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'var(--text-h)',
  },
  resultsTopic: {
    fontSize: '0.88rem',
    color: 'var(--text)',
  },
  cachedBadge: {
    padding: '0.12rem 0.55rem',
    borderRadius: '999px',
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.25)',
    color: '#10B981',
    fontSize: '0.68rem',
    fontWeight: 700,
  },
  diffOverview: {
    margin: 0,
    fontSize: '0.82rem',
    color: 'var(--text)',
    fontStyle: 'italic' as const,
  },

  /* Prerequisites */
  prereqCard: {
    padding: '1rem 1.25rem',
    borderRadius: '14px',
    background: 'rgba(245,158,11,0.06)',
    border: '1px solid rgba(245,158,11,0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.7rem',
    marginBottom: '0.25rem',
  },
  prereqHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  prereqTitle: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#F59E0B',
  },
  prereqChips: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
  },
  prereqChip: {
    padding: '0.3rem 0.8rem',
    borderRadius: '999px',
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.3)',
    color: '#F59E0B',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.18s, transform 0.14s',
  },

  /* Learning path card */
  pathCard: {
    marginTop: '0.5rem',
    padding: '1.35rem 1.5rem',
    borderRadius: '18px',
    background: 'rgba(124,58,237,0.07)',
    border: '1px solid rgba(124,58,237,0.2)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  pathHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  pathIconWrap: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    background: 'rgba(124,58,237,0.15)',
    border: '1px solid rgba(124,58,237,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pathTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-h)',
  },
  pathSub: {
    margin: '0.15rem 0 0',
    fontSize: '0.78rem',
    color: 'var(--text)',
  },
  pathBody: {
    margin: 0,
    fontSize: '0.88rem',
    color: 'var(--text-m)',
    lineHeight: 1.65,
  },

  /* Error box */
  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '1.1rem 1.25rem',
    borderRadius: '14px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.25)',
  },
  errorTitle: {
    margin: '0 0 0.2rem',
    fontWeight: 700,
    color: '#fca5a5',
    fontSize: '0.9rem',
  },
  errorMsg: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '0.83rem',
    lineHeight: 1.5,
  },
  errorHint: {
    margin: '0.4rem 0 0',
    color: 'var(--text)',
    fontSize: '0.8rem',
    lineHeight: 1.5,
  },

  /* Empty state */
  emptyState: {
    textAlign: 'center' as const,
    padding: '4rem 1rem',
  },
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: '0.75rem',
  },
  emptyTitle: {
    margin: '0 0 0.45rem',
    fontWeight: 700,
    color: 'var(--text-h)',
    fontSize: '1.05rem',
  },
  emptyHint: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '0.85rem',
    lineHeight: 1.6,
    maxWidth: '480px',
    marginInline: 'auto',
  },
};

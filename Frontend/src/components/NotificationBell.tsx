/*
 * NotificationBell.tsx — AI-powered notification centre for TwinMind
 * Renders a bell icon in the navbar; clicking opens a slide-in drawer with
 * priority-sorted, AI-generated personalised notifications and a daily summary.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, BellRing, X, Sparkles, RefreshCw,
  CheckCheck, Trash2, ChevronRight, Brain,
} from 'lucide-react';
import api from '../services/api';

/* ── Types ────────────────────────────────────────────────────────────── */

interface AINotification {
  id: number;
  notification_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
  reference_key?: string;
  priority?: string;   // critical | important | informational
  category?: string;   // study_reminder | weak_subject | burnout_alert | …
  emoji?: string;
  title?: string;
  action_url?: string;
}

interface DailySummary {
  headline: string;
  bullets: string[];
  mood_emoji: string;
  recommendation: string;
  study_hours: number;
  focus_score?: number;
  streak: number;
  burnout_risk: string;
  best_subject?: string;
  weakest_subject?: string;
  xp_earned: number;
}

/* ── Constants ────────────────────────────────────────────────────────── */

const PRIORITY_ORDER: Record<string, number> = { critical: 0, important: 1, informational: 2 };
const PRIORITY_COLOR: Record<string, string> = {
  critical:      '#EF4444',
  important:     '#F59E0B',
  informational: '#6366F1',
};
const PRIORITY_LABEL: Record<string, string> = {
  critical:      'Critical',
  important:     'Important',
  informational: 'Info',
};

const CATEGORY_TABS = [
  { key: 'all',             label: 'All' },
  { key: 'weak_subject',    label: '⚠️ Subjects' },
  { key: 'burnout_alert',   label: '🚨 Burnout' },
  { key: 'motivation',      label: '🔥 Motivation' },
  { key: 'focus_alert',     label: '🎯 Focus' },
  { key: 'study_reminder',  label: '📚 Study' },
  { key: 'achievement',     label: '🏆 Achievements' },
  { key: 'prediction',      label: '🔮 Predictions' },
];

const DEFAULT_EMOJI: Record<string, string> = {
  study_reminder: '📚',
  weak_subject:   '⚠️',
  burnout_alert:  '🚨',
  focus_alert:    '🎯',
  motivation:     '🔥',
  achievement:    '🏆',
  prediction:     '🔮',
  badge_earned:   '🏆',
  streak_milestone: '🔥',
  low_checkin_reminder: '📅',
  weekly_summary: '📊',
};

const ANALYTICS_KEY = 'twinmind_notif_analytics';

/* ── Analytics helpers ────────────────────────────────────────────────── */

function trackClick(notifId: number, category?: string) {
  try {
    const raw = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]') as {
      id: number; category?: string; ts: number;
    }[];
    raw.push({ id: notifId, category, ts: Date.now() });
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(raw.slice(-200)));
  } catch { /* ignore */ }
}

/* ── Time helpers ─────────────────────────────────────────────────────── */

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── Sort notifications ───────────────────────────────────────────────── */

function sortNotifs(notifs: AINotification[]): AINotification[] {
  return [...notifs].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority ?? 'informational'] ?? 2;
    const pb = PRIORITY_ORDER[b.priority ?? 'informational'] ?? 2;
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/* ── NotificationCard ─────────────────────────────────────────────────── */

function NotificationCard({
  notif, onRead, onDelete, onAction,
}: {
  notif: AINotification;
  onRead: (id: number) => void;
  onDelete: (id: number) => void;
  onAction: (url: string, id: number, category?: string) => void;
}) {
  const pColor = PRIORITY_COLOR[notif.priority ?? 'informational'] ?? '#6366F1';
  const emoji  = notif.emoji ?? DEFAULT_EMOJI[notif.category ?? notif.notification_type] ?? '🔔';
  const title  = notif.title ?? notif.notification_type.replace(/_/g, ' ');

  return (
    <div
      onClick={() => !notif.is_read && onRead(notif.id)}
      style={{
        ...nc.card,
        borderLeft: `3px solid ${pColor}`,
        background: notif.is_read ? 'transparent' : `${pColor}09`,
        cursor: notif.is_read ? 'default' : 'pointer',
      }}
    >
      {/* Priority label */}
      <div style={nc.topRow}>
        <span style={{ ...nc.priorityPill, background: pColor + '22', color: pColor, borderColor: pColor + '44' }}>
          {PRIORITY_LABEL[notif.priority ?? 'informational']}
        </span>
        <span style={nc.timeAgo}>{timeAgo(notif.created_at)}</span>
        {!notif.is_read && <div style={{ ...nc.unreadDot, background: pColor }} />}
        <button
          onClick={e => { e.stopPropagation(); onDelete(notif.id); }}
          style={nc.deleteBtn}
          title="Dismiss"
        >
          <X size={12} />
        </button>
      </div>

      {/* Content */}
      <div style={nc.body}>
        <span style={nc.emoji}>{emoji}</span>
        <div style={nc.content}>
          <p style={{ ...nc.title, fontWeight: notif.is_read ? 600 : 700, color: notif.is_read ? 'var(--text)' : 'var(--text-h)' }}>
            {title}
          </p>
          <p style={nc.message}>{notif.message}</p>
          {notif.action_url && (
            <button
              onClick={e => { e.stopPropagation(); onAction(notif.action_url!, notif.id, notif.category); }}
              style={nc.actionBtn}
            >
              View <ChevronRight size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const nc: Record<string, React.CSSProperties> = {
  card: {
    padding: '0.85rem 1rem',
    borderBottom: '1px solid var(--border)',
    transition: 'background 0.14s',
    borderRadius: 0,
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    marginBottom: '0.45rem',
  },
  priorityPill: {
    fontSize: '0.6rem',
    fontWeight: 700,
    padding: '0.1rem 0.45rem',
    borderRadius: '999px',
    border: '1px solid',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  timeAgo: {
    flex: 1,
    fontSize: '0.65rem',
    color: 'var(--text)',
  },
  unreadDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    padding: '0.1rem',
    display: 'flex',
    alignItems: 'center',
    opacity: 0.5,
    borderRadius: '4px',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
  },
  body: {
    display: 'flex',
    gap: '0.6rem',
    alignItems: 'flex-start',
  },
  emoji: {
    fontSize: '1.2rem',
    flexShrink: 0,
    lineHeight: 1.3,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: '0.82rem',
    margin: '0 0 0.22rem',
    lineHeight: 1.35,
  },
  message: {
    fontSize: '0.77rem',
    color: 'var(--text)',
    margin: '0 0 0.4rem',
    lineHeight: 1.5,
  },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.2rem',
    padding: '0.22rem 0.6rem',
    borderRadius: '6px',
    border: '1px solid rgba(99,102,241,0.35)',
    background: 'rgba(99,102,241,0.1)',
    color: '#818cf8',
    fontSize: '0.72rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

/* ── DailySummaryCard ─────────────────────────────────────────────────── */

function DailySummaryCard({
  summary, loading, onRefresh,
}: {
  summary: DailySummary | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div style={ds.wrap}>
      <div style={ds.header} onClick={() => setOpen(o => !o)}>
        <Brain size={14} color="#00D4FF" />
        <span style={ds.headerLabel}>Daily AI Summary</span>
        <button onClick={e => { e.stopPropagation(); onRefresh(); }} style={ds.refreshBtn} title="Refresh" disabled={loading}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 0.9s linear infinite' : 'none' }} />
        </button>
        <span style={{ ...ds.chevron, transform: open ? 'rotate(90deg)' : 'none' }}>▸</span>
      </div>

      {open && (
        loading ? (
          <div style={ds.loading}>
            <div style={ds.spinner} />
            <span style={ds.loadingText}>Generating summary…</span>
          </div>
        ) : summary ? (
          <div style={ds.body}>
            <p style={ds.headline}>
              <span style={ds.moodEmoji}>{summary.mood_emoji}</span>
              {summary.headline}
            </p>
            <div style={ds.statsRow}>
              {[
                { label: 'Study', value: `${summary.study_hours}h` },
                { label: 'Streak', value: `${summary.streak}d` },
                { label: 'Burnout', value: summary.burnout_risk },
                ...(summary.focus_score != null ? [{ label: 'Focus', value: `${Math.round(summary.focus_score)}%` }] : []),
              ].map(item => (
                <div key={item.label} style={ds.stat}>
                  <span style={ds.statVal}>{item.value}</span>
                  <span style={ds.statLabel}>{item.label}</span>
                </div>
              ))}
            </div>
            <ul style={ds.bullets}>
              {summary.bullets.map((b, i) => (
                <li key={i} style={ds.bullet}>
                  <span style={ds.bulletDot}>•</span>
                  {b}
                </li>
              ))}
            </ul>
            <div style={ds.recommendation}>
              <Brain size={12} color="#00D4FF" style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={ds.recText}>{summary.recommendation}</span>
            </div>
          </div>
        ) : (
          <div style={ds.empty}>
            <p style={ds.emptyText}>Click refresh to generate your daily summary.</p>
          </div>
        )
      )}
    </div>
  );
}

const ds: Record<string, React.CSSProperties> = {
  wrap: {
    margin: '0.75rem 0.75rem 0',
    borderRadius: '12px',
    background: 'rgba(0,212,255,0.06)',
    border: '1px solid rgba(0,212,255,0.18)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.65rem 0.85rem',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(0,212,255,0.1)',
  },
  headerLabel: {
    flex: 1,
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#00D4FF',
  },
  refreshBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(0,212,255,0.6)',
    cursor: 'pointer',
    padding: '0.1rem',
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'inherit',
  },
  chevron: {
    fontSize: '0.7rem',
    color: 'var(--text)',
    transition: 'transform 0.2s',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '1rem 0.85rem',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(0,212,255,0.2)',
    borderTop: '2px solid #00D4FF',
    borderRadius: '50%',
    animation: 'spin 0.9s linear infinite',
    flexShrink: 0,
  },
  loadingText: {
    fontSize: '0.78rem',
    color: 'var(--text)',
  },
  body: {
    padding: '0.75rem 0.85rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  headline: {
    fontSize: '0.83rem',
    fontWeight: 700,
    color: 'var(--text-h)',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  moodEmoji: { fontSize: '1.1rem', flexShrink: 0 },
  statsRow: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap' as const,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0.3rem 0.5rem',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    minWidth: '44px',
  },
  statVal: { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-h)' },
  statLabel: { fontSize: '0.58rem', color: 'var(--text)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  bullets: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.28rem',
  },
  bullet: {
    fontSize: '0.76rem',
    color: 'var(--text)',
    display: 'flex',
    gap: '0.35rem',
    lineHeight: 1.45,
  },
  bulletDot: { color: '#00D4FF', flexShrink: 0 },
  recommendation: {
    display: 'flex',
    gap: '0.4rem',
    padding: '0.5rem 0.65rem',
    borderRadius: '8px',
    background: 'rgba(0,212,255,0.06)',
    border: '1px solid rgba(0,212,255,0.12)',
    alignItems: 'flex-start',
  },
  recText: { fontSize: '0.75rem', color: 'var(--text-h)', lineHeight: 1.5 },
  empty: { padding: '0.75rem 0.85rem' },
  emptyText: { fontSize: '0.76rem', color: 'var(--text)', margin: 0 },
};

/* ══════════════════════════════════════════════════════════════════════
   Main NotificationBell component
══════════════════════════════════════════════════════════════════════ */

export default function NotificationBell() {
  const navigate = useNavigate();

  const [open,         setOpen]         = useState(false);
  const [notifications, setNotifications] = useState<AINotification[]>([]);
  const [activeTab,    setActiveTab]    = useState('all');
  const [generating,   setGenerating]   = useState(false);
  const [summary,      setSummary]      = useState<DailySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [shake,        setShake]        = useState(false);
  const prevUnreadRef  = useRef(0);
  const drawerRef      = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  /* ── Fetch notifications ────────────────────────────────────────── */
  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get<AINotification[]>('/notifications');
      setNotifications(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 90_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  /* ── Shake bell when new unread arrives ─────────────────────────── */
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setShake(true);
      setTimeout(() => setShake(false), 800);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  /* ── Close on outside click ─────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /* ── Generate AI notifications ──────────────────────────────────── */
  async function generateAI() {
    if (generating) return;
    setGenerating(true);
    try {
      // Pass focus score from localStorage if available
      const focusSessions = JSON.parse(
        localStorage.getItem('twinmind_ai_focus_sessions') || '[]',
      ) as { avgScore?: number }[];
      const focusScore = focusSessions.length
        ? focusSessions.slice(0, 3).reduce((s, r) => s + (r.avgScore ?? 0), 0) / Math.min(focusSessions.length, 3)
        : undefined;

      const { data } = await api.post<AINotification[]>('/notifications/generate-ai', {
        focus_score: focusScore ?? null,
        focus_sessions_count: focusSessions.length,
      });
      setNotifications(data);
    } catch {
      // silently ignore — server may not have Groq configured
    } finally {
      setGenerating(false);
    }
  }

  /* ── Fetch daily summary ─────────────────────────────────────────── */
  async function fetchSummary() {
    setSummaryLoading(true);
    try {
      const focusSessions = JSON.parse(
        localStorage.getItem('twinmind_ai_focus_sessions') || '[]',
      ) as { avgScore?: number }[];
      const focusScore = focusSessions.length
        ? focusSessions.slice(0, 3).reduce((s, r) => s + (r.avgScore ?? 0), 0) / Math.min(focusSessions.length, 3)
        : undefined;

      const params = focusScore != null ? `?focus_score=${Math.round(focusScore)}` : '';
      const { data } = await api.get<DailySummary>(`/notifications/daily-summary${params}`);
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }

  /* ── Actions ─────────────────────────────────────────────────────── */
  async function markRead(id: number) {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch { /* ignore */ }
  }

  async function markAllRead() {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  }

  async function deleteNotif(id: number) {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { /* ignore */ }
  }

  function handleAction(url: string, id: number, category?: string) {
    trackClick(id, category);
    markRead(id);
    setOpen(false);
    navigate(url);
  }

  /* ── Auto-fetch summary when drawer opens ───────────────────────── */
  useEffect(() => {
    if (open && !summary && !summaryLoading) {
      fetchSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ── Filtered + sorted list ─────────────────────────────────────── */
  const sorted = sortNotifs(notifications);
  const filtered = activeTab === 'all'
    ? sorted
    : sorted.filter(n => (n.category ?? n.notification_type) === activeTab);

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <>
      {/* Inject keyframe animations once */}
      <style>{`
        @keyframes bellShake {
          0%,100% { transform: rotate(0deg); }
          15%      { transform: rotate(14deg); }
          30%      { transform: rotate(-12deg); }
          45%      { transform: rotate(10deg); }
          60%      { transform: rotate(-8deg); }
          75%      { transform: rotate(5deg); }
          90%      { transform: rotate(-3deg); }
        }
        @keyframes drawerIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 998,
            animation: 'fadeIn 0.18s ease',
          }}
        />
      )}

      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
        style={{
          ...b.bell,
          animation: shake ? 'bellShake 0.75s ease' : 'none',
        }}
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        {unreadCount > 0 ? <BellRing size={16} /> : <Bell size={16} />}
        {unreadCount > 0 && (
          <span style={b.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {/* Drawer */}
      {open && (
        <div ref={drawerRef} style={b.drawer}>

          {/* Drawer header */}
          <div style={b.drawerHeader}>
            <div style={b.drawerTitle}>
              <BellRing size={16} color="#00D4FF" />
              <span style={b.drawerTitleText}>AI Notifications</span>
              {unreadCount > 0 && (
                <span style={b.unreadPill}>{unreadCount} unread</span>
              )}
            </div>
            <div style={b.drawerActions}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={b.actionLink} title="Mark all read">
                  <CheckCheck size={13} /> All read
                </button>
              )}
              <button
                onClick={generateAI}
                disabled={generating}
                style={{ ...b.generateBtn, opacity: generating ? 0.65 : 1 }}
                title="Generate AI notifications"
              >
                {generating
                  ? <RefreshCw size={12} style={{ animation: 'spin 0.9s linear infinite' }} />
                  : <Sparkles size={12} />}
                {generating ? 'Generating…' : 'Generate AI'}
              </button>
              <button onClick={() => setOpen(false)} style={b.closeBtn}>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Daily summary */}
          <DailySummaryCard
            summary={summary}
            loading={summaryLoading}
            onRefresh={fetchSummary}
          />

          {/* Category tabs */}
          <div style={b.tabsWrap}>
            {CATEGORY_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  ...b.tab,
                  background:   activeTab === tab.key ? 'rgba(99,102,241,0.2)' : 'transparent',
                  borderColor:  activeTab === tab.key ? 'rgba(99,102,241,0.5)' : 'transparent',
                  color:        activeTab === tab.key ? '#818cf8' : 'var(--text)',
                  fontWeight:   activeTab === tab.key ? 700 : 400,
                }}
              >
                {tab.label}
                {tab.key === 'all' && notifications.length > 0 && (
                  <span style={b.tabCount}>{notifications.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Notification list */}
          <div style={b.list}>
            {filtered.length === 0 ? (
              <div style={b.empty}>
                <Bell size={28} color="rgba(255,255,255,0.15)" />
                <p style={b.emptyTitle}>
                  {activeTab === 'all' ? 'No notifications yet' : `No ${activeTab.replace('_', ' ')} alerts`}
                </p>
                <p style={b.emptyHint}>
                  {activeTab === 'all'
                    ? 'Click "Generate AI" to analyse your data and create personalised alerts.'
                    : 'Switch to "All" or generate new notifications.'}
                </p>
                {activeTab === 'all' && (
                  <button onClick={generateAI} disabled={generating} style={{ ...b.generateBtn, marginTop: '0.5rem' }}>
                    <Sparkles size={12} />
                    {generating ? 'Generating…' : 'Generate AI Notifications'}
                  </button>
                )}
              </div>
            ) : (
              filtered.map(n => (
                <NotificationCard
                  key={n.id}
                  notif={n}
                  onRead={markRead}
                  onDelete={deleteNotif}
                  onAction={handleAction}
                />
              ))
            )}
          </div>

          {/* Footer analytics hint */}
          {notifications.length > 0 && (
            <div style={b.footer}>
              <Trash2 size={11} />
              <span>{notifications.length} total · Swipe cards to dismiss</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ── Drawer + bell styles ─────────────────────────────────────────── */

const b: Record<string, React.CSSProperties> = {
  bell: {
    position: 'relative',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '0.32rem 0.5rem',
    cursor: 'pointer',
    color: 'var(--text-h)',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    transition: 'border-color 0.18s, background 0.18s',
  },
  badge: {
    position: 'absolute',
    top: '-7px',
    right: '-7px',
    minWidth: '17px',
    height: '17px',
    background: '#ef4444',
    color: '#fff',
    borderRadius: '99px',
    fontSize: '0.55rem',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 3px',
    lineHeight: 1,
    boxShadow: '0 0 0 2px var(--bg), 0 0 8px rgba(239,68,68,0.5)',
  },

  /* Drawer */
  drawer: {
    position: 'fixed',
    top: 0,
    right: 0,
    width: '400px',
    maxWidth: '95vw',
    height: '100dvh',
    background: 'var(--bg-surface)',
    borderLeft: '1px solid var(--border)',
    zIndex: 999,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-8px 0 40px rgba(0,0,0,0.45)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    animation: 'drawerIn 0.22s ease',
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '1rem 1rem 0.75rem',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    gap: '0.5rem',
    flexWrap: 'wrap' as const,
  },
  drawerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  drawerTitleText: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'var(--text-h)',
  },
  unreadPill: {
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '0.12rem 0.45rem',
    borderRadius: '999px',
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#fca5a5',
  },
  drawerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  actionLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    background: 'none',
    border: 'none',
    color: '#818cf8',
    fontSize: '0.72rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0.2rem 0',
    fontFamily: 'inherit',
  },
  generateBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.28rem',
    padding: '0.3rem 0.7rem',
    borderRadius: '8px',
    border: '1px solid rgba(0,212,255,0.35)',
    background: 'rgba(0,212,255,0.1)',
    color: '#00D4FF',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    padding: '0.2rem',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '6px',
    fontFamily: 'inherit',
  },

  /* Category tabs */
  tabsWrap: {
    display: 'flex',
    gap: '0.3rem',
    padding: '0.6rem 0.75rem 0.5rem',
    overflowX: 'auto',
    flexShrink: 0,
    scrollbarWidth: 'none' as const,
    borderBottom: '1px solid var(--border)',
  },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.25rem 0.6rem',
    borderRadius: '999px',
    border: '1px solid',
    fontSize: '0.71rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    flexShrink: 0,
  },
  tabCount: {
    fontSize: '0.6rem',
    fontWeight: 700,
    padding: '0 0.25rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.12)',
    lineHeight: 1.4,
  },

  /* Notification list */
  list: {
    flex: 1,
    overflowY: 'auto',
    scrollbarWidth: 'thin' as const,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.6rem',
    padding: '3rem 2rem',
    textAlign: 'center' as const,
  },
  emptyTitle: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--text-h)',
    margin: 0,
  },
  emptyHint: {
    fontSize: '0.78rem',
    color: 'var(--text)',
    margin: 0,
    lineHeight: 1.5,
  },

  /* Footer */
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.6rem 1rem',
    borderTop: '1px solid var(--border)',
    fontSize: '0.66rem',
    color: 'var(--text)',
    flexShrink: 0,
  },
};

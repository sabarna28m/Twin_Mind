import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';

interface Notification {
  id: number;
  notification_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const TYPE_ICON: Record<string, string> = {
  badge_earned: '🏆',
  streak_milestone: '🔥',
  low_checkin_reminder: '📅',
  weekly_summary: '📊',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get<Notification[]>('/notifications');
      setNotifications(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function markAllRead() {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  }

  async function markOneRead(id: number) {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch { /* ignore */ }
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => {
          setOpen(o => !o);
          if (!open) fetchNotifications();
        }}
        style={s.bell}
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        🔔
        {unreadCount > 0 && (
          <span style={s.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={s.dropdown}>
          <div style={s.dropHeader}>
            <span style={s.dropTitle}>Notifications</span>
            {unreadCount > 0 && (
              <button style={s.markAllBtn} onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div style={s.list}>
            {notifications.length === 0 ? (
              <p style={s.empty}>No notifications yet.</p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  style={{
                    ...s.item,
                    background: n.is_read ? 'transparent' : 'rgba(99,102,241,0.07)',
                    cursor: n.is_read ? 'default' : 'pointer',
                  }}
                  onClick={() => !n.is_read && markOneRead(n.id)}
                >
                  <span style={s.typeIcon}>{TYPE_ICON[n.notification_type] ?? '🔔'}</span>
                  <div style={s.itemContent}>
                    <p style={{
                      ...s.itemMsg,
                      fontWeight: n.is_read ? 400 : 600,
                      color: n.is_read ? 'var(--text)' : 'var(--text-h)',
                    }}>
                      {n.message}
                    </p>
                    <p style={s.itemTime}>{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && <div style={s.unreadDot} />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  bell: {
    position: 'relative',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '0.32rem 0.5rem',
    cursor: 'pointer',
    fontSize: '1rem',
    lineHeight: 1,
    color: 'var(--text-h)',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
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
    fontSize: '0.58rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 3px',
    lineHeight: 1,
    boxShadow: '0 0 0 2px var(--bg)',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '340px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
    zIndex: 200,
    overflow: 'hidden',
  },
  dropHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.8rem 1rem 0.65rem',
    borderBottom: '1px solid var(--border)',
  },
  dropTitle: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--text-h)',
  },
  markAllBtn: {
    background: 'none',
    border: 'none',
    color: '#818cf8',
    fontSize: '0.72rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
  },
  list: {
    maxHeight: '380px',
    overflowY: 'auto',
  },
  empty: {
    padding: '1.5rem',
    textAlign: 'center',
    color: 'var(--text)',
    fontSize: '0.85rem',
    margin: 0,
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.65rem',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid var(--border)',
    transition: 'background 0.12s',
  },
  typeIcon: {
    fontSize: '1.1rem',
    flexShrink: 0,
    marginTop: '1px',
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemMsg: {
    fontSize: '0.8rem',
    lineHeight: 1.45,
    margin: '0 0 0.2rem',
    wordBreak: 'break-word' as const,
  },
  itemTime: {
    fontSize: '0.67rem',
    color: 'var(--text)',
    margin: 0,
  },
  unreadDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#6366f1',
    flexShrink: 0,
    marginTop: '5px',
  },
};

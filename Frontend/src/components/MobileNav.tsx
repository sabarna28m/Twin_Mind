import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  X, BookOpen, FileText, Upload, BarChart2,
  CheckSquare, Trophy, Brain, Zap, MessageCircle,
  Layers, Sword, Timer, Video, User, LogOut,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const NAV_ITEMS = [
  { key: 'nav_sessions',     to: '/sessions',     Icon: BookOpen,      label: 'Sessions'     },
  { key: 'nav_notes',        to: '/notes',         Icon: FileText,      label: 'Notes'        },
  { key: 'nav_materials',    to: '/materials',     Icon: Upload,        label: 'Materials'    },
  { key: 'nav_progress',     to: '/progress',      Icon: BarChart2,     label: 'Progress'     },
  { key: 'nav_checkin',      to: '/checkin',       Icon: CheckSquare,   label: 'Check-in'     },
  { key: 'nav_achievements', to: '/achievements',  Icon: Trophy,        label: 'Achievements' },
  { key: 'nav_quiz',         to: '/quiz',          Icon: Brain,         label: 'Quiz'         },
  { key: 'nav_simulate',     to: '/simulate',      Icon: Zap,           label: 'Simulate'     },
  { key: 'nav_mentor',       to: '/mentor',        Icon: MessageCircle, label: 'Mentor'       },
  { key: 'nav_twin',         to: '/twin',          Icon: Layers,        label: 'Twin'         },
  { key: 'nav_battles',      to: '/battles',       Icon: Sword,         label: 'Battles'      },
  { key: 'qa_focus',         to: '/focus',         Icon: Timer,         label: 'Focus'        },
  { key: 'qa_videos',        to: '/videos',        Icon: Video,         label: 'AI Videos'    },
] as const;

interface Props {
  isOpen:     boolean;
  onClose:    () => void;
  userName?:  string;
  avatarSrc?: string;
  onLogout:   () => void;
}

export default function MobileNav({ isOpen, onClose, userName, avatarSrc, onLogout }: Props) {
  const { t } = useLanguage();
  const location = useLocation();

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on route change
  useEffect(() => { onClose(); }, [location.pathname]);

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          ...styles.overlay,
          opacity:        isOpen ? 1 : 0,
          pointerEvents:  isOpen ? 'auto' : 'none',
        }}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        style={{
          ...styles.drawer,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
        aria-label="Navigation menu"
      >
        {/* Drawer header */}
        <div style={styles.drawerHeader}>
          <div style={styles.drawerLogo}>
            <span style={styles.logoIcon}>◈</span>
            <span style={styles.logoText}>TwinMind</span>
          </div>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        {/* User info */}
        {userName && (
          <div style={styles.userRow}>
            {avatarSrc
              ? <img src={avatarSrc} alt="" style={styles.avatar} />
              : <div style={styles.initials}>{userName[0]?.toUpperCase()}</div>
            }
            <div>
              <p style={styles.userName}>{userName}</p>
              <Link to="/profile" style={styles.profileLink} onClick={onClose}>
                View Profile
              </Link>
            </div>
          </div>
        )}

        {/* Nav links */}
        <nav style={styles.navList}>
          {NAV_ITEMS.map(({ key, to, Icon: NavIcon, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                style={{
                  ...styles.navItem,
                  background: active ? 'rgba(0,212,255,0.1)' : 'transparent',
                  borderColor: active ? 'rgba(0,212,255,0.25)' : 'transparent',
                  color:       active ? '#00D4FF' : 'var(--text-m)',
                }}
                onClick={onClose}
              >
                <NavIcon size={18} style={{ flexShrink: 0, opacity: active ? 1 : 0.65 }} />
                <span style={styles.navLabel}>{t(key) || label}</span>
                {active && <div style={styles.activeDot} />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: logout */}
        <div style={styles.drawerFooter}>
          <button style={styles.logoutBtn} onClick={() => { onLogout(); onClose(); }}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 299,
    transition: 'opacity 0.25s ease',
  },
  drawer: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: '280px',
    maxWidth: '85vw',
    background: 'rgba(6,11,24,0.98)',
    borderRight: '1px solid rgba(0,212,255,0.15)',
    zIndex: 300,
    display: 'flex',
    flexDirection: 'column',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    transition: 'transform 0.28s cubic-bezier(0.16,1,0.3,1)',
    overflowY: 'auto',
    boxShadow: '4px 0 40px rgba(0,0,0,0.6)',
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.1rem 1.1rem 0.85rem',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
  },
  drawerLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  logoIcon: {
    fontSize: '1.2rem',
    color: '#00D4FF',
    filter: 'drop-shadow(0 0 6px rgba(0,212,255,0.7))',
  },
  logoText: {
    fontSize: '1.05rem',
    fontWeight: 900,
    letterSpacing: '-0.5px',
    background: 'linear-gradient(135deg,#00D4FF,#a78bfa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    width: '34px',
    height: '34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--text)',
    flexShrink: 0,
    fontFamily: 'inherit',
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.9rem 1.1rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  avatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid rgba(0,212,255,0.35)',
    flexShrink: 0,
  },
  initials: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: 'rgba(0,212,255,0.12)',
    border: '2px solid rgba(0,212,255,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 800,
    color: '#00D4FF',
    flexShrink: 0,
  },
  userName: {
    margin: 0,
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-h)',
    lineHeight: 1.2,
  },
  profileLink: {
    fontSize: '0.72rem',
    color: '#00D4FF',
    textDecoration: 'none',
    opacity: 0.8,
  },
  navList: {
    flex: 1,
    padding: '0.6rem 0.65rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 0.85rem',
    borderRadius: '10px',
    border: '1px solid',
    textDecoration: 'none',
    fontSize: '0.9rem',
    fontWeight: 600,
    transition: 'background 0.18s, color 0.18s',
    position: 'relative',
  },
  navLabel: {
    flex: 1,
  },
  activeDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#00D4FF',
    boxShadow: '0 0 8px rgba(0,212,255,0.7)',
    flexShrink: 0,
  },
  drawerFooter: {
    padding: '0.85rem 0.65rem',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
  },
  logoutBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.7rem 0.85rem',
    borderRadius: '10px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    color: '#fca5a5',
    fontSize: '0.88rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.18s',
  },
};

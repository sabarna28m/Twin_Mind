import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  X, BookOpen, FileText, BarChart2, CheckSquare, Trophy, Brain,
  Zap, MessageCircle, Layers, Sword, Video, User, LogOut,
  Rocket, Mic2, Shield, TrendingUp, ShoppingBag,
} from 'lucide-react';

interface NavItem {
  to:    string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon:  React.ComponentType<any>;
  label: string;
}

interface NavGroup {
  id:    string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'learning', label: 'Learning',
    items: [
      { to: '/sessions',     Icon: BookOpen,    label: 'Sessions'      },
      { to: '/notes',        Icon: FileText,    label: 'Smart Notes'   },
      { to: '/quiz',         Icon: Brain,       label: 'Quiz Practice' },
      { to: '/videos',       Icon: Video,       label: 'AI Videos'     },
    ],
  },
  {
    id: 'performance', label: 'Performance',
    items: [
      { to: '/progress',     Icon: BarChart2,   label: 'Progress'      },
      { to: '/achievements', Icon: Trophy,      label: 'Achievements'  },
      { to: '/predict',      Icon: TrendingUp,  label: 'AI Predict'    },
      { to: '/burnout',      Icon: Shield,        label: 'Burnout Guard' },
    ],
  },
  {
    id: 'checkin', label: 'Check-in',
    items: [
      { to: '/checkin',      Icon: CheckSquare, label: 'Daily Check-in' },
    ],
  },
  {
    id: 'shop', label: 'XP Shop',
    items: [
      { to: '/shop',         Icon: ShoppingBag, label: 'XP Shop'        },
    ],
  },
  {
    id: 'ai', label: 'AI Tools',
    items: [
      { to: '/twin',         Icon: Layers,        label: 'Twin AI'      },
      { to: '/career',       Icon: Rocket,        label: 'Career AI'    },
      { to: '/comm-twin',    Icon: Mic2,          label: 'Comm Twin'    },
      { to: '/mentor',       Icon: MessageCircle, label: 'Mentor AI'    },
      { to: '/simulate',     Icon: Zap,           label: 'Simulate'     },
      { to: '/battles',      Icon: Sword,         label: 'Battles'      },
    ],
  },
];

interface Props {
  isOpen:     boolean;
  onClose:    () => void;
  userName?:  string;
  avatarSrc?: string;
  onLogout:   () => void;
}

export default function MobileNav({ isOpen, onClose, userName, avatarSrc, onLogout }: Props) {
  const location = useLocation();

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => { onClose(); }, [location.pathname]);

  const isActive = (to: string) => location.pathname === to;

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          ...st.overlay,
          opacity:       isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        style={{
          ...st.drawer,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
        aria-label="Navigation menu"
      >
        {/* Header */}
        <div style={st.drawerHeader}>
          <div style={st.drawerLogo}>
            {/* Logo PNG clipped to symbol only */}
            <div style={{ width: 30, height: 22, overflow: 'hidden', flexShrink: 0 }}>
              <img
                src="/assets/twinmind-logo.png"
                alt="TwinMind logo"
                style={{ width: 30, height: 'auto', display: 'block' }}
              />
            </div>
            <span style={st.logoText}>TwinMind</span>
          </div>
          <button style={st.closeBtn} onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* User info */}
        {userName && (
          <div style={st.userRow}>
            {avatarSrc
              ? <img src={avatarSrc} alt="" style={st.avatar} />
              : <div style={st.initials}>{userName[0]?.toUpperCase()}</div>
            }
            <div>
              <p style={st.userName}>{userName}</p>
              <Link to="/profile" style={st.profileLink} onClick={onClose}>
                <User size={11} style={{ display: 'inline', marginRight: '0.25rem' }} />
                View Profile
              </Link>
            </div>
          </div>
        )}

        {/* Nav groups */}
        <nav style={st.navScroll}>
          {NAV_GROUPS.map(group => (
            <div key={group.id} style={st.group}>
              <div style={st.groupHeader}>
                <span style={st.groupLabel}>{group.label}</span>
              </div>
              <div style={st.groupItems}>
                {group.items.map(({ to, Icon, label }) => {
                  const active = isActive(to);
                  return (
                    <Link
                      key={`${group.id}-${to}-${label}`}
                      to={to}
                      style={{
                        ...st.navItem,
                        background:  active ? 'rgba(var(--primary-rgb), 0.12)' : 'transparent',
                        borderColor: active ? 'rgba(var(--primary-rgb), 0.28)' : 'transparent',
                        color:       active ? 'var(--primary)' : 'var(--text-m)',
                      }}
                      onClick={onClose}
                    >
                      <Icon
                        size={16}
                        style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }}
                      />
                      <span style={st.navLabel}>{label}</span>
                      {active && <div style={st.activeDot} />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={st.drawerFooter}>
          <Link to="/about" style={st.aboutLink} onClick={onClose}>
            About TwinMind
          </Link>
          <button style={st.logoutBtn} onClick={() => { onLogout(); onClose(); }}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

const st: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 299, transition: 'opacity 0.25s ease',
  },
  drawer: {
    position: 'fixed', top: 0, left: 0, bottom: 0,
    width: '290px', maxWidth: '88vw',
    background: 'rgba(4,8,22,0.99)',
    borderRight: '1px solid rgba(0,212,255,0.14)',
    zIndex: 300, display: 'flex', flexDirection: 'column',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    transition: 'transform 0.28s cubic-bezier(0.16,1,0.3,1)',
    overflowY: 'hidden',
    boxShadow: '6px 0 48px rgba(0,0,0,0.7)',
  },
  drawerHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1.1rem 1.1rem 0.9rem',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
  },
  drawerLogo: { display: 'flex', alignItems: 'center', gap: '0.45rem' },
  logoIcon: { fontSize: '1.2rem', color: '#00D4FF', filter: 'drop-shadow(0 0 6px rgba(0,212,255,0.7))' },
  logoText: {
    fontSize: '1.05rem', fontWeight: 900, letterSpacing: '-0.5px',
    background: 'linear-gradient(135deg,#00D4FF,#a78bfa)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', width: '34px', height: '34px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: 'var(--text)', flexShrink: 0, fontFamily: 'inherit',
  },
  userRow: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.9rem 1.1rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  avatar: {
    width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' as const,
    border: '2px solid rgba(0,212,255,0.35)', flexShrink: 0,
  },
  initials: {
    width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
    background: 'rgba(0,212,255,0.12)', border: '2px solid rgba(0,212,255,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.78rem', fontWeight: 800, color: '#00D4FF',
  },
  userName:    { margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 },
  profileLink: { fontSize: '0.7rem', color: '#00D4FF', textDecoration: 'none', opacity: 0.8, display: 'flex', alignItems: 'center' },

  /* Scrollable nav area */
  navScroll: { flex: 1, overflowY: 'auto' as const, padding: '0.5rem 0.7rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' },

  /* Group */
  group:      { marginBottom: '0.2rem' },
  groupHeader: {
    display: 'flex', alignItems: 'center', gap: '0.45rem',
    padding: '0.55rem 0.7rem 0.3rem',
  },
  groupLabel: {
    fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em',
    textTransform: 'uppercase' as const, color: 'rgba(148,163,184,0.5)',
  },
  groupItems: { display: 'flex', flexDirection: 'column', gap: '0.1rem' },

  navItem: {
    display: 'flex', alignItems: 'center', gap: '0.7rem',
    padding: '0.62rem 0.8rem', borderRadius: '9px',
    border: '1px solid', textDecoration: 'none',
    fontSize: '0.87rem', fontWeight: 600,
    transition: 'background 0.15s, color 0.15s',
    position: 'relative',
  },
  navLabel:  { flex: 1 },
  activeDot: {
    width: '6px', height: '6px', borderRadius: '50%',
    background: '#00D4FF', boxShadow: '0 0 8px rgba(0,212,255,0.7)',
    flexShrink: 0,
  },

  /* Footer */
  drawerFooter: {
    padding: '0.85rem 0.7rem',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
  },
  logoutBtn: {
    width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
    padding: '0.7rem 0.85rem', borderRadius: '10px',
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
    color: '#fca5a5', fontSize: '0.87rem', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.18s',
  },
  aboutLink: {
    display: 'block', textAlign: 'center' as const,
    padding: '0.45rem', marginBottom: '0.5rem',
    fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em',
    color: 'rgba(59,130,246,0.7)', textDecoration: 'none',
  },
};

import { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  BookOpen, FileText, BarChart2, Trophy, Brain, Zap,
  MessageCircle, Layers, Menu, Rocket, Mic2, ChevronRight,
  Shield, TrendingUp, Dumbbell, Video, Calendar, ClipboardCheck,
  LayoutDashboard, User, Award, LogOut, ChevronLeft, Sun, Moon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import { useTheme } from '../contexts/ThemeContext';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationBell from './NotificationBell';
import MobileNav from './MobileNav';
import WeeklyChallengesModal from './WeeklyChallengesModal';
import GlobalNotificationListener from './GlobalNotificationListener';
import { BACKEND_URL } from '../lib/config';

const BACKEND = BACKEND_URL;

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/sessions': 'Focus Sessions',
  '/notes': 'Smart Notes',
  '/progress': 'Progress Analytics',
  '/predict': 'Performance Trends',
  '/mentor': 'AI Mentor',
  '/twin': 'Digital Twin',
  '/twin-profile': 'Digital Twin',
  '/twin-legacy': 'Digital Twin',
  '/checkin': 'Daily Check-in',
  '/burnout': 'Burnout Analysis',
  '/achievements': 'Achievements',

  '/quiz': 'Assessment Hub',
  '/videos': 'Video Recommender',
  '/subjects': 'Subject Analysis',
  '/career': 'Career Twin',
  '/comm-twin': 'Communication Twin',
  '/simulate': 'What-if Simulator',
  '/study-planner': 'Study Planner',
  '/shield': 'Shield Center',
  '/profile': 'Profile & Settings',
  '/shop': 'XP Shop',
  '/battles': 'Battles',
  '/skill-tree': 'Skill Tree',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SidebarNavItem({ icon: Icon, label, to, active }: { icon: React.ComponentType<any>; label: string; to: string; active: boolean }) {
  return (
    <Link to={to} style={{ textDecoration: 'none', outline: 'none' }}>
      <div className={`nav-pill ${active ? 'active-pill' : ''}`}>
        <Icon size={18} className="nav-icon" style={{ opacity: 0.65, flexShrink: 0, transition: 'all 0.3s' }} />
        <span>{label}</span>
      </div>
    </Link>
  );
}

function SidebarAccordion({ icon: Icon, label, children, defaultOpen = false }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>; label: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div className="nav-pill" onClick={() => setOpen(!open)}>
        <Icon size={18} className="nav-icon" style={{ opacity: 0.6, flexShrink: 0, transition: 'all 0.3s' }} />
        <span style={{ flex: 1 }}>{label}</span>
        <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight size={14} style={{ opacity: 0.5 }} />
        </motion.div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden', paddingLeft: '16px' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div >
  );
}

const secLabel: React.CSSProperties = {
  padding: '20px 24px 8px', fontSize: '0.68rem', fontWeight: 700,
  color: 'rgba(148, 163, 184, 0.6)', textTransform: 'uppercase', letterSpacing: '0.12em',
};

const NAV = {
  learning: [
    { icon: Zap, label: 'Focus Sessions', to: '/sessions' },
    { icon: FileText, label: 'Notes', to: '/notes' },
    { icon: Brain, label: 'Assessment Hub', to: '/quiz' },
    { icon: Video, label: 'Video Recommender', to: '/videos' },
  ],
  performance: [
    { icon: BarChart2, label: 'Progress Analytics', to: '/progress' },
    { icon: Trophy, label: 'Progress Report', to: '/achievements' },
    { icon: Layers, label: 'Subject Analysis', to: '/subjects' },
    { icon: TrendingUp, label: 'Performance Trends', to: '/predict' },
  ],
  aiTools: [
    { icon: MessageCircle, label: 'AI Mentor', to: '/mentor' },
    { icon: Brain, label: 'Digital Twin', to: '/twin' },
    { icon: Rocket, label: 'Career Twin', to: '/career' },
    { icon: Mic2, label: 'Communication Twin', to: '/comm-twin' },
    { icon: Shield, label: 'Burnout Analysis', to: '/burnout' },
    { icon: Zap, label: 'What-if Simulator', to: '/simulate' },
  ],
  account: [
    { icon: User, label: 'Profile & Settings', to: '/profile' },
    { icon: Award, label: 'Achievements', to: '/achievements' },
  ],
};

function ThemeToggle({ colorScheme, onToggle }: { colorScheme: 'light' | 'dark'; onToggle: () => void }) {
  const isDark = colorScheme === 'dark';
  return (
    <button
      onClick={onToggle}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center',
        width: 52, height: 28, borderRadius: 14,
        background: isDark ? '#1E293B' : '#F1F5F9',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#D1D5DB'}`,
        cursor: 'pointer', padding: 0, flexShrink: 0,
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}
    >
      <Sun size={12} style={{
        position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)',
        color: isDark ? '#475569' : '#F59E0B',
        opacity: isDark ? 0.5 : 1,
        transition: 'color 0.3s, opacity 0.3s',
      }} />
      <Moon size={12} style={{
        position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
        color: isDark ? '#00D4FF' : '#94A3B8',
        opacity: isDark ? 1 : 0.5,
        transition: 'color 0.3s, opacity 0.3s',
      }} />
      <motion.div
        animate={{ x: isDark ? 26 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        style={{
          position: 'absolute', left: 0,
          width: 22, height: 22, borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const { collapsed, toggleCollapsed, drawerOpen, setDrawerOpen } = useSidebar();
  const { colorScheme, toggleColorScheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [challengeOpen, setChallengeOpen] = useState(false);

  const avatarSrc = user?.avatar_url ? BACKEND + user.avatar_url : null;
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'TwinMind';
  const isDashboard = location.pathname === '/dashboard';
  const isActive = (path: string) => location.pathname === path;
  const isDark = colorScheme === 'dark';

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      fontFamily: "var(--sans)",
      background: 'var(--ui-header-bg)',
    }}>
      <WeeklyChallengesModal isOpen={challengeOpen} onClose={() => setChallengeOpen(false)} />
      <GlobalNotificationListener />
      <MobileNav
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userName={user?.full_name ?? undefined}
        avatarSrc={avatarSrc ?? undefined}
        onLogout={logout}
      />

      {/* ═══ FIXED LEFT SIDEBAR (always dark) ═══ */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 0 : 280, opacity: collapsed ? 0 : 1 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="app-shell-sidebar"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(124, 58, 237, 0.05) 100%), rgba(11, 18, 32, 0.75)'
            : 'linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(124, 58, 237, 0.04) 100%), rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(24px) saturate(150%)',
          WebkitBackdropFilter: 'blur(24px) saturate(150%)',
          color: '#fff', flexShrink: 0, overflow: 'hidden',
          display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0,
          height: '100vh', zIndex: 100, borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Brand */}
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit', outline: 'none' }}>
          <div className="sidebar-logo-container">
            <div style={{ width: 34, height: 26, overflow: 'hidden', flexShrink: 0, filter: 'drop-shadow(0 0 6px rgba(0,212,255,0.5))' }}>
              <img src="/assets/twinmind-logo.png" alt="TwinMind logo" style={{ width: 34, height: 'auto', display: 'block' }} />
            </div>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #fff, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TwinMind</span>
          </div>
        </Link>

        {/* Nav */}
        <nav className="app-shell-sidebar-nav" style={{ flex: 1, overflowY: 'auto', padding: '16px 0 24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <SidebarNavItem icon={LayoutDashboard} label="Dashboard" to="/dashboard" active={isActive('/dashboard')} />

          <div style={secLabel}>Learning</div>
          <SidebarAccordion icon={BookOpen} label="Learning" defaultOpen>
            {NAV.learning.map(item => (
              <SidebarNavItem key={item.to} icon={item.icon} label={item.label} to={item.to} active={isActive(item.to)} />
            ))}
          </SidebarAccordion>

          <div style={secLabel}>Performance</div>
          <SidebarAccordion icon={BarChart2} label="Performance">
            {NAV.performance.map(item => (
              <SidebarNavItem key={item.to} icon={item.icon} label={item.label} to={item.to} active={isActive(item.to)} />
            ))}
          </SidebarAccordion>

          <div style={secLabel}>AI Tools</div>
          <SidebarAccordion icon={Brain} label="AI Tools">
            {NAV.aiTools.map(item => (
              <SidebarNavItem key={item.to} icon={item.icon} label={item.label} to={item.to} active={isActive(item.to)} />
            ))}
          </SidebarAccordion>

          <div style={secLabel}>Study Planner</div>
          <SidebarNavItem icon={Calendar} label="Study Planner" to="/study-planner" active={isActive('/study-planner')} />
          <SidebarNavItem icon={ClipboardCheck} label="Check-in" to="/checkin" active={isActive('/checkin')} />

          <div style={secLabel}>Account</div>
          <SidebarAccordion icon={User} label="Account">
            {NAV.account.map(item => (
              <SidebarNavItem key={item.to} icon={item.icon} label={item.label} to={item.to} active={isActive(item.to)} />
            ))}
            <div
              onClick={logout}
              className="nav-pill"
            >
              <LogOut size={18} className="nav-icon" style={{ opacity: 0.6, flexShrink: 0, transition: 'all 0.3s' }} />
              <span>Logout</span>
            </div>
          </SidebarAccordion>
        </nav>
      </motion.aside>

      {/* ═══ RIGHT PANEL ═══ */}
      <div style={{
        flex: 1,
        marginLeft: collapsed ? 0 : 280,
        transition: 'margin-left 0.3s ease',
        display: 'flex', flexDirection: 'column',
        height: '100vh', overflow: 'hidden',
        background: 'var(--ui-header-bg)',
      }}>

        {/* ═══ GLOBAL HEADER ═══ */}
        <header style={{
          height: '64px',
          background: 'var(--ui-header-bg)',
          borderBottom: '1px solid var(--ui-header-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 32px', flexShrink: 0, zIndex: 50,
          boxShadow: isDark ? '0 1px 0 rgba(255,255,255,0.05)' : '0 1px 3px rgba(0,0,0,0.04)',
          transition: 'background 0.3s ease, border-color 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Desktop: collapse sidebar */}
            <button
              className="shell-ham-desk"
              onClick={toggleCollapsed}
              style={{
                background: 'none', border: 'none', color: 'var(--ui-text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', padding: '6px',
              }}
            >
              <Menu size={22} />
            </button>
            {/* Mobile: open drawer */}
            <button
              className="shell-ham-mob"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              style={{
                background: 'none', border: 'none', color: 'var(--ui-text-muted)', cursor: 'pointer',
                display: 'none', alignItems: 'center', padding: '6px',
              }}
            >
              <Menu size={22} />
            </button>
            {/* Back arrow on inner pages */}
            {!isDashboard && (
              <button
                onClick={() => navigate(-1)}
                style={{
                  background: 'none', border: 'none', color: 'var(--ui-text-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '6px',
                }}
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--ui-text-h)', transition: 'color 0.3s ease' }}>
              {pageTitle}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LanguageSwitcher />

            {/* Light / Dark theme toggle */}
            <ThemeToggle colorScheme={colorScheme} onToggle={toggleColorScheme} />

            <button
              onClick={() => setChallengeOpen(true)} title="Weekly Challenges"
              className="shell-hide-mobile"
              style={{
                width: '36px', height: '36px', borderRadius: '10px',
                border: '1px solid var(--ui-border)',
                background: 'var(--ui-surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--ui-text-muted)', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <Dumbbell size={18} />
            </button>
            <Link
              to="/shield" title="Shield Center"
              className="shell-hide-mobile"
              style={{
                width: '36px', height: '36px', borderRadius: '10px',
                border: '1px solid var(--ui-border)',
                background: 'var(--ui-surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--ui-text-muted)', textDecoration: 'none', transition: 'all 0.2s',
              }}
            >
              <Shield size={18} />
            </Link>
            <NotificationBell />
            <Link
              to="/profile"
              style={{
                width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden',
                border: '2px solid var(--ui-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDark ? '#1E3A5F' : '#DBEAFE',
                textDecoration: 'none', flexShrink: 0,
                transition: 'border-color 0.3s ease, background 0.3s ease',
              }}
            >
              {avatarSrc
                ? <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6' }}>
                  {user?.full_name?.split(' ')?.map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'TM'}
                </span>
              }
            </Link>
          </div>
        </header>

        {/* ═══ PAGE CONTENT ═══ */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--ui-header-bg)', transition: 'background 0.3s ease' }}>
          <Outlet />
        </div>
      </div>

      <style>{`
        .shell-ham-mob { display: none; }
        @media (max-width: 1024px) {
          .app-shell-sidebar  { display: none !important; }
          .shell-ham-desk     { display: none !important; }
          .shell-ham-mob      { display: flex !important; }
          .shell-hide-mobile  { display: none !important; }
        }
        .brand-link { cursor: pointer; transition: opacity 0.18s ease, transform 0.18s ease; }
        .brand-link:hover { opacity: 0.82; transform: scale(1.02); }

        /* Premium Glass Sidebar Styles */
        .app-shell-sidebar-nav::-webkit-scrollbar { width: 4px; }
        .app-shell-sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .app-shell-sidebar-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
        .app-shell-sidebar-nav::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }

        .nav-pill {
          display: flex; align-items: center; gap: 14px;
          padding: 10px 16px; margin: 2px 14px; border-radius: 16px;
          color: rgba(255,255,255,0.65);
          font-size: 0.85rem; font-weight: 500;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); cursor: pointer;
          border: 1px solid transparent;
          position: relative;
        }
        .nav-pill:hover {
          background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%);
          transform: translateY(-2px);
          color: #fff;
          border-color: rgba(255,255,255,0.08);
          box-shadow: 0 8px 24px rgba(0,0,0,0.15), 0 0 16px rgba(0,212,255,0.04);
        }
        .nav-pill:hover .nav-icon {
          transform: scale(1.1);
          color: #00D4FF;
          filter: drop-shadow(0 0 6px rgba(0,212,255,0.5));
          opacity: 1 !important;
        }

        .active-pill {
          color: #ffffff;
          background: linear-gradient(135deg, rgba(0, 212, 255, 0.12) 0%, rgba(124, 58, 237, 0.08) 100%);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 8px 32px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(255,255,255,0.04);
          font-weight: 600;
        }
        .active-pill::before {
          content: ''; position: absolute; left: -1px; top: 25%; height: 50%; width: 3px;
          border-radius: 0 4px 4px 0; background: #00D4FF;
          box-shadow: 0 0 10px #00D4FF;
        }
        .active-pill .nav-icon {
          opacity: 1 !important;
          color: #00D4FF;
          filter: drop-shadow(0 0 6px rgba(0,212,255,0.4));
        }

        .sidebar-logo-container {
          padding: 14px; margin: 24px 20px 10px;
          background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15), inset 0 0 0 1px rgba(255,255,255,0.03);
          display: flex; align-items: center; justify-content: center; gap: 12px;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .sidebar-logo-container:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.2), 0 0 20px rgba(0,212,255,0.1), inset 0 0 0 1px rgba(255,255,255,0.08);
        }
      `}</style>
    </div>
  );
}

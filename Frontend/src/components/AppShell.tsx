import { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  BookOpen, FileText, BarChart2, Trophy, Brain, Zap,
  MessageCircle, Layers, Menu, Rocket, Mic2, ChevronRight,
  Shield, TrendingUp, Dumbbell, Video, Calendar, ClipboardCheck,
  LayoutDashboard, User, Award, LogOut, ChevronLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainIcon } from './TwinMindLogo';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationBell from './NotificationBell';
import MobileNav from './MobileNav';
import WeeklyChallengesModal from './WeeklyChallengesModal';
import { BACKEND_URL } from '../lib/config';

const BACKEND = BACKEND_URL;

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/sessions':     'Focus Sessions',
  '/notes':        'Smart Notes',
  '/progress':     'Progress Analytics',
  '/predict':      'Performance Trends',
  '/mentor':       'AI Mentor',
  '/twin':         'Digital Twin',
  '/twin-profile': 'Digital Twin',
  '/twin-legacy':  'Digital Twin',
  '/checkin':      'Daily Check-in',
  '/burnout':      'Burnout Analysis',
  '/achievements': 'Achievements',
  '/quiz':         'Assessment Hub',
  '/videos':       'Video Recommender',
  '/subjects':     'Subject Analysis',
  '/career':       'Career Twin',
  '/comm-twin':    'Communication Twin',
  '/simulate':     'What-if Simulator',
  '/study-planner':'Study Planner',
  '/shield':       'Shield Center',
  '/profile':      'Profile & Settings',
  '/shop':         'XP Shop',
  '/battles':      'Battles',
  '/skill-tree':   'Skill Tree',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SidebarNavItem({ icon: Icon, label, to, active }: { icon: React.ComponentType<any>; label: string; to: string; active: boolean }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <motion.div
        whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.06)' }}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '10px 20px', margin: '2px 12px', borderRadius: '10px',
          color: active ? '#00D4FF' : 'rgba(255,255,255,0.65)',
          background: active ? 'rgba(0,212,255,0.1)' : 'transparent',
          fontSize: '0.875rem', fontWeight: active ? 600 : 400,
          transition: 'all 0.2s ease', cursor: 'pointer',
        }}
      >
        <Icon size={18} style={{ opacity: active ? 1 : 0.6, flexShrink: 0 }} />
        <span>{label}</span>
      </motion.div>
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
      <motion.div
        onClick={() => setOpen(!open)}
        whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '10px 20px', margin: '2px 12px', borderRadius: '10px',
          color: 'rgba(255,255,255,0.75)', fontSize: '0.875rem', fontWeight: 500,
          cursor: 'pointer', transition: 'all 0.2s ease', userSelect: 'none',
        }}
      >
        <Icon size={18} style={{ opacity: 0.6, flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{label}</span>
        <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight size={14} style={{ opacity: 0.5 }} />
        </motion.div>
      </motion.div>
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
    </div>
  );
}

const secLabel: React.CSSProperties = {
  padding: '16px 20px 6px', fontSize: '0.7rem', fontWeight: 600,
  color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em',
};

const NAV = {
  learning: [
    { icon: Zap,           label: 'Focus Sessions',     to: '/sessions' },
    { icon: FileText,      label: 'Notes',              to: '/notes' },
    { icon: Brain,         label: 'Assessment Hub',     to: '/quiz' },
    { icon: Video,         label: 'Video Recommender',  to: '/videos' },
  ],
  performance: [
    { icon: BarChart2,     label: 'Progress Analytics', to: '/progress' },
    { icon: Trophy,        label: 'Progress Report',    to: '/achievements' },
    { icon: Layers,        label: 'Subject Analysis',   to: '/subjects' },
    { icon: TrendingUp,    label: 'Performance Trends', to: '/predict' },
  ],
  aiTools: [
    { icon: MessageCircle, label: 'AI Mentor',          to: '/mentor' },
    { icon: Brain,         label: 'Digital Twin',       to: '/twin' },
    { icon: Rocket,        label: 'Career Twin',        to: '/career' },
    { icon: Mic2,          label: 'Communication Twin', to: '/comm-twin' },
    { icon: Shield,        label: 'Burnout Analysis',   to: '/burnout' },
    { icon: Zap,           label: 'What-if Simulator',  to: '/simulate' },
  ],
  account: [
    { icon: User,          label: 'Profile & Settings', to: '/profile' },
    { icon: Award,         label: 'Achievements',       to: '/achievements' },
  ],
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const { collapsed, toggleCollapsed, drawerOpen, setDrawerOpen } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [challengeOpen, setChallengeOpen] = useState(false);

  const avatarSrc   = user?.avatar_url ? BACKEND + user.avatar_url : null;
  const pageTitle   = PAGE_TITLES[location.pathname] ?? 'TwinMind';
  const isDashboard = location.pathname === '/dashboard';
  const isActive    = (path: string) => location.pathname === path;

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <WeeklyChallengesModal isOpen={challengeOpen} onClose={() => setChallengeOpen(false)} />
      <MobileNav
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userName={user?.full_name ?? undefined}
        avatarSrc={avatarSrc ?? undefined}
        onLogout={logout}
      />

      {/* ═══ FIXED LEFT SIDEBAR ═══ */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 0 : 280, opacity: collapsed ? 0 : 1 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="app-shell-sidebar"
        style={{
          background: '#0F172A', color: '#fff', flexShrink: 0, overflow: 'hidden',
          display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0,
          height: '100vh', zIndex: 100, borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Brand */}
        <div style={{
          padding: '24px 24px 20px', display: 'flex', alignItems: 'center', gap: '12px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <BrainIcon size={28} />
          <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>TwinMind</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
          <SidebarNavItem icon={Calendar}      label="Study Planner" to="/study-planner" active={isActive('/study-planner')} />
          <SidebarNavItem icon={ClipboardCheck} label="Check-in"     to="/checkin"       active={isActive('/checkin')} />

          <div style={secLabel}>Account</div>
          <SidebarAccordion icon={User} label="Account">
            {NAV.account.map(item => (
              <SidebarNavItem key={item.to} icon={item.icon} label={item.label} to={item.to} active={isActive(item.to)} />
            ))}
            <motion.div
              onClick={logout}
              whileHover={{ x: 4, backgroundColor: 'rgba(239,68,68,0.1)' }}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 20px', margin: '2px 12px', borderRadius: '10px',
                color: 'rgba(255,255,255,0.65)', fontSize: '0.875rem',
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}
            >
              <LogOut size={18} style={{ opacity: 0.6 }} />
              <span>Logout</span>
            </motion.div>
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
      }}>

        {/* ═══ GLOBAL HEADER ═══ */}
        <header style={{
          height: '64px', background: '#ffffff', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 32px', flexShrink: 0, zIndex: 50,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Desktop: collapse sidebar */}
            <button
              className="shell-ham-desk"
              onClick={toggleCollapsed}
              style={{
                background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
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
                background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
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
                  background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '6px',
                }}
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#0f172a' }}>
              {pageTitle}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <LanguageSwitcher />
            <button
              onClick={() => setChallengeOpen(true)} title="Weekly Challenges"
              className="shell-hide-mobile"
              style={{
                width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #e2e8f0',
                background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#64748b', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <Dumbbell size={18} />
            </button>
            <Link
              to="/shield" title="Shield Center"
              className="shell-hide-mobile"
              style={{
                width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #e2e8f0',
                background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#64748b', textDecoration: 'none', transition: 'all 0.2s',
              }}
            >
              <Shield size={18} />
            </Link>
            <NotificationBell />
            <Link
              to="/profile"
              style={{
                width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden',
                border: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#dbeafe', textDecoration: 'none', flexShrink: 0,
              }}
            >
              {avatarSrc
                ? <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6' }}>
                    {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'TM'}
                  </span>
              }
            </Link>
          </div>
        </header>

        {/* ═══ PAGE CONTENT ═══ */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
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
      `}</style>
    </div>
  );
}

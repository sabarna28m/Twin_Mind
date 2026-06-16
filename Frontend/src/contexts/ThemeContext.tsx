import { createContext, useContext, useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type ThemeId =
  | 'galaxy-nexus'
  | 'sakura-dream'
  | 'inferno'
  | 'arctic-aurora'
  | 'nature-pulse'
  | 'cyberpunk-neo'
  | 'ocean-intelligence'
  | 'neural-brain';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  isDark: boolean;
  swatches: [string, string, string, string];
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'galaxy-nexus',
    name: 'Galaxy Nexus',
    icon: '🌌',
    tagline: 'Futuristic AI OS',
    description: 'Deep space nebula, moving stars, neon holographics',
    isDark: true,
    swatches: ['#000510', '#00D4FF', '#7C3AED', '#4F46E5'],
  },
  {
    id: 'sakura-dream',
    name: 'Sakura Dream',
    icon: '🌸',
    tagline: 'Calm & focused',
    description: 'Cherry blossoms, rose-gold glow, soft petals',
    isDark: true,
    swatches: ['#12020a', '#FF6B9D', '#FF9EC6', '#9333ea'],
  },
  {
    id: 'inferno',
    name: 'Inferno',
    icon: '🔥',
    tagline: 'High-performance mode',
    description: 'Fire particles, energy sparks, amber glow',
    isDark: true,
    swatches: ['#060100', '#FF4500', '#FF8C00', '#FFD700'],
  },
  {
    id: 'arctic-aurora',
    name: 'Arctic Aurora',
    icon: '❄️',
    tagline: 'Clean & intelligent',
    description: 'Northern lights, frost glass, snow particles',
    isDark: true,
    swatches: ['#00060e', '#00FFCC', '#0ea5e9', '#7C3AED'],
  },
  {
    id: 'nature-pulse',
    name: 'Nature Pulse',
    icon: '🌲',
    tagline: 'Growth & development',
    description: 'Forest canopy, floating leaves, organic flow',
    isDark: true,
    swatches: ['#010802', '#10b981', '#22c55e', '#86efac'],
  },
  {
    id: 'cyberpunk-neo',
    name: 'Cyberpunk Neo',
    icon: '🤖',
    tagline: 'Next-gen AI lab',
    description: 'Digital rain, cyber grid, neon holographic panels',
    isDark: true,
    swatches: ['#000000', '#00FF41', '#00FFFF', '#FF00FF'],
  },
  {
    id: 'ocean-intelligence',
    name: 'Ocean Intelligence',
    icon: '🌊',
    tagline: 'Deep thinking & reflection',
    description: 'Rising bubbles, bioluminescence, ocean depth glow',
    isDark: true,
    swatches: ['#000814', '#006994', '#00CED1', '#40E0D0'],
  },
  {
    id: 'neural-brain',
    name: 'Neural Brain',
    icon: '🧠',
    tagline: 'Inside your Digital Twin',
    description: 'Live neural network, synapse pulses, knowledge flow',
    isDark: true,
    swatches: ['#020205', '#7C3AED', '#00D4FF', '#10B981'],
  },
];

// ── Migration map from old theme IDs ─────────────────────────────────────────

const MIGRATE: Record<string, ThemeId> = {
  cosmos:           'galaxy-nexus',
  sakura:           'sakura-dream',
  ember:            'inferno',
  arctic:           'arctic-aurora',
  forest:           'nature-pulse',
  'neon-cyberpunk': 'cyberpunk-neo',
  dark:             'galaxy-nexus',
  light:            'arctic-aurora',
};

// ── Context ───────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
  themeMeta: ThemeMeta;
  // Legacy API kept so existing callers still compile
  theme: 'dark' | 'light';
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId:   'galaxy-nexus',
  setTheme:  () => {},
  themeMeta: THEMES[0],
  theme:     'dark',
  toggle:    () => {},
});

function getInitialTheme(): ThemeId {
  const saved = localStorage.getItem('twinmind-theme');
  if (saved) {
    if (THEMES.some(t => t.id === saved)) return saved as ThemeId;
    if (MIGRATE[saved]) return MIGRATE[saved];
  }
  const legacy = localStorage.getItem('theme');
  if (legacy && MIGRATE[legacy]) return MIGRATE[legacy];
  return 'galaxy-nexus';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(getInitialTheme);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('twinmind-theme', themeId);
    const meta = THEMES.find(t => t.id === themeId)!;
    localStorage.setItem('theme', meta.isDark ? 'dark' : 'light');
  }, [themeId]);

  const themeMeta = THEMES.find(t => t.id === themeId) ?? THEMES[0];

  function setTheme(id: ThemeId) { setThemeId(id); }

  function toggle() {
    setThemeId(prev => {
      const meta = THEMES.find(t => t.id === prev)!;
      return meta.isDark ? 'arctic-aurora' : 'galaxy-nexus';
    });
  }

  return (
    <ThemeContext.Provider value={{
      themeId,
      setTheme,
      themeMeta,
      theme: themeMeta.isDark ? 'dark' : 'light',
      toggle,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

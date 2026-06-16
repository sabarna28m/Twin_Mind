import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type ThemeId =
  | 'cosmos'
  | 'forest'
  | 'sakura'
  | 'ember'
  | 'arctic'
  | 'neon-cyberpunk';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  icon: string;
  description: string;
  isDark: boolean;
  /** 4 hex swatches shown in the picker card */
  swatches: [string, string, string, string];
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'cosmos',
    name: 'Cosmos',
    icon: '🌌',
    description: 'Deep space — the default TwinMind experience',
    isDark: true,
    swatches: ['#060b18', '#00D4FF', '#6366f1', '#8b5cf6'],
  },
  {
    id: 'forest',
    name: 'Forest',
    icon: '🌲',
    description: 'Dark emerald — focused and grounded',
    isDark: true,
    swatches: ['#030a06', '#10b981', '#059669', '#34d399'],
  },
  {
    id: 'sakura',
    name: 'Sakura',
    icon: '🌸',
    description: 'Cherry blossom — elegant and creative',
    isDark: true,
    swatches: ['#0f050a', '#ec4899', '#db2777', '#9333ea'],
  },
  {
    id: 'ember',
    name: 'Ember',
    icon: '🔥',
    description: 'Burning fire — intense and energetic',
    isDark: true,
    swatches: ['#0a0300', '#f97316', '#ea580c', '#dc2626'],
  },
  {
    id: 'arctic',
    name: 'Arctic',
    icon: '❄️',
    description: 'Ice blue — clean light interface',
    isDark: false,
    swatches: ['#f0f8ff', '#0ea5e9', '#38bdf8', '#6366f1'],
  },
  {
    id: 'neon-cyberpunk',
    name: 'Neon Cyberpunk',
    icon: '🤖',
    description: 'Pure black — maximum contrast and neon glow',
    isDark: true,
    swatches: ['#000000', '#00ff41', '#00ffff', '#ff00ff'],
  },
];

interface ThemeContextValue {
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
  themeMeta: ThemeMeta;
  // Legacy shape kept so existing callers still compile
  theme: 'dark' | 'light';
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId: 'cosmos',
  setTheme: () => {},
  themeMeta: THEMES[0],
  theme: 'dark',
  toggle: () => {},
});

function getInitialTheme(): ThemeId {
  const saved = localStorage.getItem('twinmind-theme') as ThemeId | null;
  if (saved && THEMES.some(t => t.id === saved)) return saved;
  // migrate legacy dark/light key
  const legacy = localStorage.getItem('theme');
  if (legacy === 'light') return 'arctic';
  return 'cosmos';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('twinmind-theme', themeId);
    const meta = THEMES.find(t => t.id === themeId)!;
    // keep legacy key in sync so old code that reads 'theme' still works
    localStorage.setItem('theme', meta.isDark ? 'dark' : 'light');
  }, [themeId]);

  const themeMeta = THEMES.find(t => t.id === themeId) ?? THEMES[0];

  function setTheme(id: ThemeId) { setThemeId(id); }

  function toggle() {
    setThemeId(prev => {
      const meta = THEMES.find(t => t.id === prev)!;
      return meta.isDark ? 'arctic' : 'cosmos';
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

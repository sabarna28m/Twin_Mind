import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { useTheme, type ThemeId } from './ThemeContext';

export type ParticleStyle =
  | 'neural-network'
  | 'constellation'
  | 'data-streams'
  | 'floating-orbs'
  | 'cyber-grid';

export interface ParticleStyleMeta {
  id: ParticleStyle;
  name: string;
  icon: string;
  description: string;
}

export const PARTICLE_STYLES: ParticleStyleMeta[] = [
  { id: 'neural-network', name: 'Neural Net',    icon: '🧠', description: 'Connected brain nodes with synaptic pulses' },
  { id: 'constellation',  name: 'Constellation', icon: '✨', description: 'Moving star clusters with light connections' },
  { id: 'data-streams',   name: 'Data Streams',  icon: '⚡', description: 'Flowing data particles with directional trails' },
  { id: 'floating-orbs',  name: 'Floating Orbs', icon: '🫧', description: 'Glowing spheres drifting through space' },
  { id: 'cyber-grid',     name: 'Cyber Grid',    icon: '🔲', description: 'Grid-based energy network with disruption fields' },
];

// Default particle style per theme
export const THEME_DEFAULT_PARTICLE: Record<ThemeId, ParticleStyle> = {
  'galaxy-nexus':       'neural-network',
  'sakura-dream':       'constellation',
  'inferno':            'floating-orbs',
  'arctic-aurora':      'constellation',
  'nature-pulse':       'floating-orbs',
  'cyberpunk-neo':      'cyber-grid',
  'ocean-intelligence': 'data-streams',
  'neural-brain':       'neural-network',
};

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

// Theme-adaptive particle color palettes
export const THEME_PARTICLE_COLORS: Record<ThemeId, ThemeColors> = {
  'galaxy-nexus':       { primary: '#00D4FF', secondary: '#7C3AED', accent: '#4F46E5' },
  'sakura-dream':       { primary: '#FF6B9D', secondary: '#FF9EC6', accent: '#c084fc' },
  'inferno':            { primary: '#FF6B2B', secondary: '#FF8C00', accent: '#FFD700' },
  'arctic-aurora':      { primary: '#00FFCC', secondary: '#0ea5e9', accent: '#7C3AED' },
  'nature-pulse':       { primary: '#10b981', secondary: '#22c55e', accent: '#86efac' },
  'cyberpunk-neo':      { primary: '#FF00FF', secondary: '#00FFFF', accent: '#00FF41' },
  'ocean-intelligence': { primary: '#00CED1', secondary: '#0083B0', accent: '#40E0D0' },
  'neural-brain':       { primary: '#7C3AED', secondary: '#00D4FF', accent: '#10B981' },
};

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'twinmind-particles';

type ParticlePrefs = Partial<Record<ThemeId, ParticleStyle>>;

function loadPrefs(): ParticlePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ParticlePrefs;
  } catch { /* ignore */ }
  return {};
}

// ── Context ───────────────────────────────────────────────────────────────────

interface ParticleContextValue {
  particleStyle: ParticleStyle;
  setParticleStyle: (style: ParticleStyle) => void;
}

const ParticleContext = createContext<ParticleContextValue>({
  particleStyle: 'neural-network',
  setParticleStyle: () => {},
});

export function ParticleProvider({ children }: { children: ReactNode }) {
  const { themeId } = useTheme();
  const [prefs, setPrefs] = useState<ParticlePrefs>(loadPrefs);

  const particleStyle: ParticleStyle = prefs[themeId] ?? THEME_DEFAULT_PARTICLE[themeId];

  function setParticleStyle(style: ParticleStyle) {
    setPrefs(prev => {
      const next = { ...prev, [themeId]: style };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <ParticleContext.Provider value={{ particleStyle, setParticleStyle }}>
      {children}
    </ParticleContext.Provider>
  );
}

export function useParticles() {
  return useContext(ParticleContext);
}

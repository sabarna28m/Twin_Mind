/**
 * ThemeToggle — Simple light/dark mode toggle button.
 *
 * Replaced the previous elaborate 8-theme picker + particle style selector
 * with a clean, minimal toggle that switches between light and dark modes.
 */

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  return (
    <button
      className="theme-toggle"
      onClick={toggleColorScheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB'}`,
        background: isDark ? 'rgba(255,255,255,0.06)' : '#F9FAFB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        fontSize: '1.05rem',
        color: isDark ? '#F1F5F9' : '#374151',
        flexShrink: 0,
        padding: 0,
      }}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

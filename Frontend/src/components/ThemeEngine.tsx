/**
 * ThemeEngine — Minimal background layer.
 *
 * Renders as position:fixed / z-index:-1 / pointer-events:none so it
 * sits behind ALL app content. Provides a clean gradient for dark mode
 * and a subtle micro-dot pattern on white for light mode.
 *
 * All particle effects, aurora overlays, and canvas animations have been
 * removed in favour of a clean, professional SaaS aesthetic.
 */

import { useTheme } from '../contexts/ThemeContext';

export default function ThemeEngine() {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        background: isDark
          ? 'linear-gradient(180deg, #0A0F1E 0%, #111827 100%)'
          : '#FFFFFF',
        transition: 'background 0.4s ease',
      }}
    >
      {/* Light mode: subtle micro-dot grid pattern */}
      {!isDark && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle, #D1D5DB 0.5px, transparent 0.5px)',
            backgroundSize: '24px 24px',
            opacity: 0.03,
          }}
        />
      )}
    </div>
  );
}

/**
 * Central place for all environment-derived URLs.
 * Import from here instead of using import.meta.env directly.
 *
 * Local:      VITE_API_URL=http://localhost:8000/api/v1
 * Production: VITE_API_URL=https://twinmind-api.onrender.com/api/v1
 */

export const API_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

/** Backend root without /api/v1 — used for static asset URLs (avatars, uploads) */
export const BACKEND_URL: string = API_URL.replace(/\/api\/v1\/?$/, '');

/** WebSocket base — converts http(s) scheme to ws(s) and strips /api/v1 */
export const WS_URL: string = BACKEND_URL
  .replace(/^https:\/\//, 'wss://')
  .replace(/^http:\/\//, 'ws://');

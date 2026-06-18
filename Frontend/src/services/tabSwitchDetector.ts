export function createTabSwitchDetector(onSwitch: () => void): () => void {
  const handler = () => { if (document.hidden) onSwitch(); };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}

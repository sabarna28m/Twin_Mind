import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import streakProtectionService from '../services/streakProtectionService';
import type { ShopStatus } from '../services/streakProtectionService';
import { useAuth } from './AuthContext';

interface XPStoreState {
  status:        ShopStatus | null;
  loading:       boolean;
  buying:        string | null;        // item key being purchased
  lastMsg:       { ok: boolean; text: string } | null;
  refresh:       () => Promise<void>;
  buy:           (item: ShopItem) => Promise<void>;
  clearMsg:      () => void;
}

export type ShopItem = 'shield' | 'premium_shield' | 'streak_freeze' | 'double_xp';

const XPStoreContext = createContext<XPStoreState | null>(null);

export function XPStoreProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [status,  setStatus]  = useState<ShopStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [buying,  setBuying]  = useState<string | null>(null);
  const [lastMsg, setLastMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await streakProtectionService.getStatus();
      setStatus(data);
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  const buy = useCallback(async (item: ShopItem) => {
    setBuying(item); setLastMsg(null);
    try {
      let result: { available_xp: number; [k: string]: unknown };
      if (item === 'shield')         result = await streakProtectionService.buyShield();
      else if (item === 'premium_shield') result = await streakProtectionService.buyPremiumShield();
      else if (item === 'streak_freeze')  result = await streakProtectionService.buyStreakFreeze();
      else                                result = await streakProtectionService.buyDoubleXp();

      setLastMsg({ ok: true, text: purchaseSuccessMsg(item) });
      // Update available_xp optimistically then refresh
      setStatus(prev => prev ? { ...prev, available_xp: result.available_xp } : prev);
      await refresh();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setLastMsg({ ok: false, text: detail ?? 'Purchase failed.' });
    } finally {
      setBuying(null);
    }
  }, [refresh]);

  return (
    <XPStoreContext.Provider value={{ status, loading, buying, lastMsg, refresh, buy, clearMsg: () => setLastMsg(null) }}>
      {children}
    </XPStoreContext.Provider>
  );
}

export function useXPStore(): XPStoreState {
  const ctx = useContext(XPStoreContext);
  if (!ctx) throw new Error('useXPStore must be used within XPStoreProvider');
  return ctx;
}

function purchaseSuccessMsg(item: ShopItem): string {
  switch (item) {
    case 'shield':         return '🛡️ Streak Shield purchased! It will auto-activate if you miss a day.';
    case 'premium_shield': return '🛡️ Premium Shield purchased! Covers up to 3 missed days.';
    case 'streak_freeze':  return '🔥 Streak Freeze activated for today!';
    case 'double_xp':      return '⭐ Double XP Boost active for 24 hours!';
  }
}

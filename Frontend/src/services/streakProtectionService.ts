import api from './api';

export interface ShopStatus {
  shield_count:             number;
  premium_shield_count:     number;
  auto_use_shield:          boolean;
  streak_freeze_active:     boolean;
  streak_freeze_expires:    string | null;
  double_xp_active:         boolean;
  double_xp_expires:        string | null;
  streak_days:              number;
  last_checkin:             string | null;
  can_recover:              boolean;
  recovery_deadline:        string | null;
  recovery_used_this_month: boolean;
  next_milestone:           number | null;
  xp_spent:                 number;
  available_xp:             number;
  pricing: {
    shield:         number;
    premium_shield: number;
    streak_freeze:  number;
    double_xp:      number;
    recovery:       number;
  };
}

export interface ShieldCheckResult {
  shield_used:  boolean;
  item_used:    string | null;
  recovery_set: boolean;
  shield_count: number;
  streak_days:  number;
}

export interface PurchaseResult {
  ok:           boolean;
  available_xp: number;
  [key: string]: unknown;
}

const BASE = '/streak-protection';

const streakProtectionService = {
  getStatus: ()                      => api.get<ShopStatus>(`${BASE}/status`).then(r => r.data),
  checkTrigger: ()                   => api.post<ShieldCheckResult>(`${BASE}/check`).then(r => r.data),
  buyShield: ()                      => api.post<PurchaseResult>(`${BASE}/buy-shield`).then(r => r.data),
  buyPremiumShield: ()               => api.post<PurchaseResult>(`${BASE}/buy-premium-shield`).then(r => r.data),
  buyStreakFreeze: ()                 => api.post<PurchaseResult>(`${BASE}/buy-streak-freeze`).then(r => r.data),
  buyDoubleXp: ()                    => api.post<PurchaseResult>(`${BASE}/buy-double-xp`).then(r => r.data),
  recoverStreak: ()                  => api.post<PurchaseResult>(`${BASE}/recover-streak`).then(r => r.data),
  updateSettings: (auto_use: boolean) => api.put(`${BASE}/settings`, { auto_use }).then(r => r.data),
};

export default streakProtectionService;

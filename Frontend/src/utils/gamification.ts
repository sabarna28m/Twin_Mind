export const LEVEL_NAMES = [
  '', 'Beginner', 'Learner', 'Explorer', 'Achiever',
  'Scholar', 'Expert', 'Master', 'Champion', 'Legend', 'Genius',
];

// One color per level (index 1–10)
export const LEVEL_COLORS = [
  '',
  '#3b82f6',  // 1 Beginner   — Blue
  '#06b6d4',  // 2 Learner    — Cyan
  '#10b981',  // 3 Explorer   — Green
  '#14b8a6',  // 4 Achiever   — Teal
  '#eab308',  // 5 Scholar    — Yellow
  '#f97316',  // 6 Expert     — Orange
  '#ec4899',  // 7 Master     — Pink
  '#8b5cf6',  // 8 Champion   — Purple
  '#6366f1',  // 9 Legend     — Indigo
  '#fbbf24',  // 10 Genius    — Gold
];

export const LEVEL_GRADIENTS = [
  '',
  'linear-gradient(135deg,#3b82f6,#06b6d4)',
  'linear-gradient(135deg,#06b6d4,#0ea5e9)',
  'linear-gradient(135deg,#10b981,#06b6d4)',
  'linear-gradient(135deg,#14b8a6,#10b981)',
  'linear-gradient(135deg,#eab308,#f59e0b)',
  'linear-gradient(135deg,#f97316,#ef4444)',
  'linear-gradient(135deg,#ec4899,#f97316)',
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#fbbf24,#f59e0b)',
];

export const STREAK_MILESTONES = [7, 14, 21, 30, 50, 100];

export interface GamificationProgress {
  xp: number;
  level: number;
  level_name: string;
  xp_in_level: number;
  xp_for_level: number;
  xp_to_next: number;
  progress_pct: number;
  streak_days: number;
  breakdown: {
    checkins: number;
    quizzes: number;
    high_scores: number;
    streak: number;
    achievements: number;
  };
}

export interface WeeklyChallengeData {
  has_challenge: boolean;
  week_start: string;
  targets: { study_hours: number | null; quiz_count: number | null; checkin_days: number | null } | null;
  progress: { study_hours: number; quiz_count: number; checkin_days: number };
  completion_pct: number;
}

export function getLevelColor(level: number): string {
  return LEVEL_COLORS[Math.max(1, Math.min(10, level))];
}

export function getLevelGradient(level: number): string {
  return LEVEL_GRADIENTS[Math.max(1, Math.min(10, level))];
}

export function levelStorageKey(userId: string | number) {
  return `tm_lv_${userId}`;
}

export const SHIELD_COST   = 100;
export const RECOVERY_COST = 200;
export const MAX_SHIELDS   = 5;

export interface StreakShieldStatus {
  shield_count:              number;
  auto_use_shield:           boolean;
  streak_days:               number;
  last_checkin:              string | null;
  can_recover:               boolean;
  recovery_deadline:         string | null;
  recovery_used_this_month:  boolean;
  next_milestone:            number | null;
  xp_spent:                  number;
  available_xp:              number;
}

export interface ShieldCheckResult {
  shield_used:  boolean;
  recovery_set: boolean;
  shield_count: number;
  streak_days:  number;
}

export const STREAK_SHIELD_REWARDS: Record<string, number> = {
  week_warrior: 1,
  month_master: 2,
  unstoppable:  3,
}

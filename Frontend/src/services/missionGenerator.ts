/* ─────────────────────────────────────────────────────────────
   Smart Daily Mission Generator
   Produces 3 primary + 1 bonus mission per calendar day.
   Output is deterministic for a given day + user context,
   so re-renders never shuffle missions mid-session.
   ───────────────────────────────────────────────────────────── */

export type MissionCategory  = 'study' | 'quiz' | 'content' | 'progress' | 'ai';
export type MissionDifficulty = 'easy' | 'medium' | 'hard';

export interface DailyMission {
  id:              string;
  title:           string;
  description:     string;
  category:        MissionCategory;
  xpReward:        number;
  difficulty:      MissionDifficulty;
  targetValue?:    number;
  completed:       boolean;
  sourceModule:    string;
  icon:            string;
  route:           string;
  generatedAt:     string;
  expiresAt:       string;
  bonus:           boolean;
}

export interface UserContext {
  subject?:          string;  // focus/weakest subject
  subjectMinutes?:   number;  // recommended daily minutes for that subject
  weakSubjectScore?: number;  // avg score of weakest subject (0–100)
  sessionCount?:     number;  // total sessions ever completed
  quizAvgScore?:     number;  // average quiz score (0–100)
  burnoutRisk?:      'low' | 'medium' | 'high';
}

/* ── Seeded LCG so the same day always yields the same picks ── */
function seededRng(seed: number) {
  let s = ((seed * 1664525 + 1013904223) | 0) >>> 0;
  return function rng() {
    s = ((s * 1664525 + 1013904223) | 0) >>> 0;
    return s / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function tomorrowMidnight(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/* ─────────────────────────────────────────────────────────────
   Main generator
   ───────────────────────────────────────────────────────────── */
export function generateDailyMissions(ctx: UserContext): DailyMission[] {
  const daySeed = Math.floor(Date.now() / 86_400_000);
  const rng      = seededRng(daySeed);
  const now      = new Date().toISOString();
  const expires  = tomorrowMidnight();

  /* Derive difficulty tier from available signals */
  const count = ctx.sessionCount ?? 0;
  const tier: 'beginner' | 'intermediate' | 'advanced' =
    count < 5  ? 'beginner'     :
    count < 25 ? 'intermediate' : 'advanced';

  const sub     = ctx.subject ?? 'your priority subject';
  const mins    = ctx.subjectMinutes ?? (tier === 'beginner' ? 25 : tier === 'intermediate' ? 35 : 45);
  const target  = Math.min(90, Math.round((ctx.quizAvgScore ?? 65) + 5));

  /* ── Study mission pool ─────────────────────────── */
  const studyPool = [
    {
      title: `Study ${sub} for ${mins} minutes`,
      description: `Open a focus session and work through ${sub}. Use the Sessions timer to stay on track.`,
      icon: '📚', xp: tier === 'beginner' ? 40 : tier === 'intermediate' ? 55 : 80,
      difficulty: (tier === 'beginner' ? 'easy' : 'medium') as MissionDifficulty, tv: mins,
    },
    {
      title: `Complete 2 study sessions today`,
      description: `Log two separate focus sessions — at least 20 minutes each.`,
      icon: '⏱', xp: tier === 'beginner' ? 50 : 70,
      difficulty: (tier === 'beginner' ? 'medium' : 'hard') as MissionDifficulty, tv: 2,
    },
    {
      title: `Reach ${tier === 'beginner' ? 30 : tier === 'intermediate' ? 45 : 60} minutes of total focus time`,
      description: `Accumulate focus time across all sessions today.`,
      icon: '🎯', xp: tier === 'beginner' ? 45 : tier === 'intermediate' ? 65 : 90,
      difficulty: (tier === 'beginner' ? 'easy' : 'medium') as MissionDifficulty,
      tv: tier === 'beginner' ? 30 : tier === 'intermediate' ? 45 : 60,
    },
    {
      title: `${mins}-minute deep focus session`,
      description: `Set a ${mins}-minute timer and study without interruptions. No multitasking.`,
      icon: '🔥', xp: 55, difficulty: 'medium' as MissionDifficulty, tv: mins,
    },
    {
      title: `Review notes from your last session`,
      description: `Spend ${tier === 'beginner' ? 20 : 30} minutes reviewing material from your previous session.`,
      icon: '🔄', xp: 35, difficulty: 'easy' as MissionDifficulty,
      tv: tier === 'beginner' ? 20 : 30,
    },
  ];

  /* ── Quiz mission pool ──────────────────────────── */
  const quizPool = [
    {
      title: `Complete 1 practice quiz`,
      description: `Take a practice quiz on any subject. Review your wrong answers afterward.`,
      icon: '🧠', xp: 30, difficulty: 'easy' as MissionDifficulty, tv: 1,
    },
    {
      title: `Score above ${target}% in a quiz`,
      description: `Attempt a quiz and aim to beat ${target}%. Preparation is key!`,
      icon: '🎯', xp: 45, difficulty: 'medium' as MissionDifficulty, tv: target,
    },
    {
      title: `Complete a quiz with focus score above 75%`,
      description: `Take a Focus Mode quiz. Maintain your attention score above 75% from start to finish.`,
      icon: '👁', xp: 55, difficulty: 'medium' as MissionDifficulty, tv: 75,
    },
    {
      title: `Answer 10 questions correctly`,
      description: `Complete at least one quiz and rack up 10 correct answers total.`,
      icon: '✅', xp: 35, difficulty: 'easy' as MissionDifficulty, tv: 10,
    },
    {
      title: `Maintain focus above 80% during a quiz`,
      description: `Run a Focus Mode quiz and keep your attention score above 80% throughout.`,
      icon: '🔮', xp: 65, difficulty: 'hard' as MissionDifficulty, tv: 80,
    },
    {
      title: `Study ${sub}, then take a quiz`,
      description: `Study ${sub} for 20+ minutes, then immediately test yourself with a practice quiz.`,
      icon: '📖', xp: tier === 'intermediate' ? 70 : 80,
      difficulty: 'hard' as MissionDifficulty, tv: 80,
    },
    {
      title: `Complete 10 quiz questions with high attention`,
      description: `Take a Focus Mode quiz. Get through 10 questions while keeping focus metrics strong.`,
      icon: '🎓', xp: 50, difficulty: 'medium' as MissionDifficulty, tv: 10,
    },
    {
      title: `Finish a ${mins}-minute study session without interruptions`,
      description: `Use Focus Mode quiz monitoring to verify you stayed on task the whole session.`,
      icon: '⚡', xp: 60, difficulty: 'medium' as MissionDifficulty, tv: mins,
    },
  ];

  /* ── Engagement mission pool ────────────────────── */
  const engagementPool = [
    {
      title: `Log today's wellness check-in`,
      description: `Record your mood, energy, and stress level. Your AI Twin uses this to adapt your plan.`,
      icon: '🧘', xp: 20, difficulty: 'easy' as MissionDifficulty,
      route: '/checkin', sourceModule: 'progress', category: 'progress' as MissionCategory,
    },
    {
      title: `Create 3 smart notes`,
      description: `Use Smart Notes to capture key concepts from today's study session.`,
      icon: '📝', xp: 30, difficulty: 'easy' as MissionDifficulty,
      route: '/notes', sourceModule: 'materials', category: 'content' as MissionCategory,
    },
    {
      title: `Upload a study material`,
      description: `Upload lecture slides, textbook pages, or any study resource to your library.`,
      icon: '📤', xp: 25, difficulty: 'easy' as MissionDifficulty,
      route: '/materials', sourceModule: 'materials', category: 'content' as MissionCategory,
    },
    {
      title: `Ask your AI Mentor for a study plan`,
      description: `Chat with your AI Mentor to get a personalized, week-by-week study roadmap.`,
      icon: '🤖', xp: 30, difficulty: 'easy' as MissionDifficulty,
      route: '/mentor', sourceModule: 'mentor', category: 'ai' as MissionCategory,
    },
    {
      title: `Review your progress dashboard`,
      description: `Check your weekly stats, streak, and XP growth. Spot trends to improve.`,
      icon: '📊', xp: 20, difficulty: 'easy' as MissionDifficulty,
      route: '/progress', sourceModule: 'progress', category: 'progress' as MissionCategory,
    },
    {
      title: `Run a simulation session`,
      description: `Use the AI Simulator to practice scenarios and sharpen decision-making.`,
      icon: '⚡', xp: 40, difficulty: 'medium' as MissionDifficulty,
      route: '/simulate', sourceModule: 'mentor', category: 'ai' as MissionCategory,
    },
    {
      title: `Review your achievement badges`,
      description: `Check your Achievements page — one of your next badges may be just hours away.`,
      icon: '🏆', xp: 15, difficulty: 'easy' as MissionDifficulty,
      route: '/achievements', sourceModule: 'progress', category: 'progress' as MissionCategory,
    },
    {
      title: `Update your Digital Twin profile`,
      description: `Sync with your Digital Twin for smarter, more personalized recommendations.`,
      icon: '🔮', xp: 25, difficulty: 'easy' as MissionDifficulty,
      route: '/twin', sourceModule: 'mentor', category: 'ai' as MissionCategory,
    },
    ...(ctx.burnoutRisk === 'high' || ctx.burnoutRisk === 'medium' ? [
      {
        title: `Take a mindful 10-minute break`,
        description: `Log a wellness check-in and note that you took a recovery break today.`,
        icon: '🌿', xp: 15, difficulty: 'easy' as MissionDifficulty,
        route: '/checkin', sourceModule: 'progress', category: 'progress' as MissionCategory,
      },
    ] : []),
  ];

  /* ── Bonus mission pool ─────────────────────────── */
  const bonusPool = [
    {
      title: `Explore your career roadmap`,
      description: `Spend 5 minutes in Career Development reviewing your pathway and milestones.`,
      icon: '🚀', xp: 25, route: '/career', sourceModule: 'career',
    },
    {
      title: `Chat with your Digital Twin`,
      description: `Ask your Twin for feedback on this week's learning performance.`,
      icon: '🔮', xp: 20, route: '/twin', sourceModule: 'mentor',
    },
    {
      title: `Review your subject analysis`,
      description: `Identify your weakest area and plan targeted study for tomorrow.`,
      icon: '📈', xp: 20, route: '/subjects', sourceModule: 'progress',
    },
    {
      title: `Quick 5-question warmup quiz`,
      description: `Get your brain going — just 5 questions before your main study block.`,
      icon: '⚡', xp: 20, route: '/quiz', sourceModule: 'quiz',
    },
    {
      title: `Unlock your streak bonus`,
      description: `Log any study activity today to keep your streak alive and earn bonus XP.`,
      icon: '🔥', xp: 30, route: '/sessions', sourceModule: 'sessions',
    },
    {
      title: `Ask Mentor for weak-subject tips`,
      description: `Open the AI Mentor and ask specifically about ${sub} improvement strategies.`,
      icon: '💡', xp: 25, route: '/mentor', sourceModule: 'mentor',
    },
    {
      title: `Watch a study video`,
      description: `Browse Study Videos for a short clip on today's focus topic.`,
      icon: '▶', xp: 20, route: '/videos', sourceModule: 'materials',
    },
  ];

  /* ── Pick one from each pool ─────────────────────── */
  const sp  = pick(studyPool, rng);
  const qp  = pick(quizPool, rng);
  const ep  = pick(engagementPool, rng);
  const bp  = pick(bonusPool, rng);

  return [
    {
      id: `study-${daySeed}`,
      title: sp.title, description: sp.description,
      category: 'study', xpReward: sp.xp, difficulty: sp.difficulty,
      targetValue: sp.tv, completed: false,
      sourceModule: 'sessions', icon: sp.icon, route: '/sessions',
      generatedAt: now, expiresAt: expires, bonus: false,
    },
    {
      id: `quiz-${daySeed}`,
      title: qp.title, description: qp.description,
      category: 'quiz', xpReward: qp.xp, difficulty: qp.difficulty,
      targetValue: qp.tv, completed: false,
      sourceModule: 'quiz', icon: qp.icon, route: '/quiz',
      generatedAt: now, expiresAt: expires, bonus: false,
    },
    {
      id: `engage-${daySeed}`,
      title: ep.title, description: ep.description,
      category: ep.category, xpReward: ep.xp, difficulty: ep.difficulty,
      completed: false, sourceModule: ep.sourceModule,
      icon: ep.icon, route: ep.route,
      generatedAt: now, expiresAt: expires, bonus: false,
    },
    {
      id: `bonus-${daySeed}`,
      title: bp.title, description: bp.description,
      category: 'progress', xpReward: bp.xp, difficulty: 'easy',
      completed: false, sourceModule: bp.sourceModule,
      icon: bp.icon, route: bp.route,
      generatedAt: now, expiresAt: expires, bonus: true,
    },
  ];
}

/* ── Helpers for UI ─── */
export const CATEGORY_META: Record<string, { label: string; color: string }> = {
  study:    { label: 'Study',    color: '#00D4FF' },
  quiz:     { label: 'Quiz',     color: '#a78bfa' },
  content:  { label: 'Content',  color: '#34d399' },
  progress: { label: 'Progress', color: '#f59e0b' },
  ai:       { label: 'AI',       color: '#818cf8' },
};

export const DIFFICULTY_META: Record<string, { label: string; icon: string }> = {
  easy:   { label: 'Easy',   icon: '' },
  medium: { label: 'Medium', icon: '⚡' },
  hard:   { label: 'Hard',   icon: '🔥' },
};

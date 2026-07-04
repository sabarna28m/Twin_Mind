/* ─────────────────────────────────────────────────────────────────────────────
   Smart Daily Mission Generator — event-driven edition
   ─────────────────────────────────────────────────────────────────────────────
   • 3 primary + 1 bonus mission per calendar day (stable per day via LCG)
   • All missions backed by verifiable server-side metrics (GET /missions/progress)
   • No manual completion — progress is computed from real DB activity
   ─────────────────────────────────────────────────────────────────────────────*/

export type MissionCategory  = 'study' | 'quiz' | 'content' | 'progress' | 'ai';
export type MissionDifficulty = 'easy' | 'medium' | 'hard';

export type TrackingKey =
  | 'sessions_completed'
  | 'total_study_minutes'
  | 'max_session_minutes'
  | 'subject_minutes'        // per-subject, uses trackingSubKey
  | 'quizzes_completed'
  | 'quiz_correct_answers'
  | 'quiz_total_questions'
  | 'quiz_max_pct'
  | 'checkin_today'          // boolean: 1 when done, target always 1
  | 'notes_created_today'
  | 'materials_uploaded_today'
  | 'mentor_messages_today';

export interface MissionMetrics {
  date:                    string;
  sessions_completed:      number;
  total_study_minutes:     number;
  max_session_minutes:     number;
  subject_minutes:         Record<string, number>;
  quizzes_completed:       number;
  quiz_correct_answers:    number;
  quiz_total_questions:    number;
  quiz_max_pct:            number;
  checkin_today:           boolean;
  notes_created_today:     number;
  materials_uploaded_today:number;
  mentor_messages_today:   number;
}

export const EMPTY_METRICS: MissionMetrics = {
  date: '', sessions_completed: 0, total_study_minutes: 0,
  max_session_minutes: 0, subject_minutes: {},
  quizzes_completed: 0, quiz_correct_answers: 0,
  quiz_total_questions: 0, quiz_max_pct: 0,
  checkin_today: false, notes_created_today: 0,
  materials_uploaded_today: 0, mentor_messages_today: 0,
};

export interface DailyMission {
  id:             string;
  title:          string;
  description:    string;
  category:       MissionCategory;
  xpReward:       number;
  difficulty:     MissionDifficulty;
  targetValue:    number;
  progressUnit:   string;
  actionLabel:    string;
  actionRoute:    string;
  trackingKey:    TrackingKey;
  trackingSubKey?: string;
  sourceModule:   string;
  icon:           string;
  generatedAt:    string;
  expiresAt:      string;
  bonus:          boolean;
}

export interface EvaluatedMission extends DailyMission {
  currentProgress: number;
  completed:       boolean;
}

/* ── Seeded LCG — same day always yields same mission picks ── */
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

/* ─────────────────────────────────────────────────────────────────────────────
   Context from backend APIs (same shape as before)
   ─────────────────────────────────────────────────────────────────────────────*/
export interface UserContext {
  subject?:          string;
  subjectMinutes?:   number;
  weakSubjectScore?: number;
  sessionCount?:     number;
  quizAvgScore?:     number;
  burnoutRisk?:      'low' | 'medium' | 'high';
}

/* ─────────────────────────────────────────────────────────────────────────────
   Mission pools — every template has trackingKey, actionLabel, actionRoute
   ─────────────────────────────────────────────────────────────────────────────*/
export function generateDailyMissions(ctx: UserContext): DailyMission[] {
  const daySeed = Math.floor(Date.now() / 86_400_000);
  const rng     = seededRng(daySeed);
  const now     = new Date().toISOString();
  const expires = tomorrowMidnight();

  const count = ctx.sessionCount ?? 0;
  const tier: 'beginner' | 'intermediate' | 'advanced' =
    count < 5 ? 'beginner' : count < 25 ? 'intermediate' : 'advanced';

  const sub   = ctx.subject ?? 'your priority subject';
  const mins  = ctx.subjectMinutes ?? (tier === 'beginner' ? 25 : tier === 'intermediate' ? 35 : 45);
  const target = Math.min(90, Math.round((ctx.quizAvgScore ?? 65) + 5));
  const focusMins = tier === 'beginner' ? 30 : tier === 'intermediate' ? 45 : 60;

  /* ── Study pool ─────────────────────────────────────────────────────── */
  type StudyTemplate = {
    title: string; description: string; icon: string;
    xp: number; difficulty: MissionDifficulty; tv: number;
    unit: string; actionLabel: string;
    trackingKey: TrackingKey; trackingSubKey?: string;
  };

  const studyPool: StudyTemplate[] = [
    {
      title: `Study ${sub} for ${mins} minutes`,
      description: `Open a focus session and work through ${sub}. The timer tracks your active study time.`,
      icon: '', xp: tier === 'beginner' ? 40 : tier === 'intermediate' ? 55 : 80,
      difficulty: (tier === 'beginner' ? 'easy' : 'medium'),
      tv: mins, unit: 'min', actionLabel: 'Start Session',
      trackingKey: 'subject_minutes', trackingSubKey: sub.toLowerCase().trim(),
    },
    {
      title: `Complete 2 study sessions today`,
      description: `Log two separate focus sessions — at least 20 minutes each.`,
      icon: 'TM', xp: tier === 'beginner' ? 50 : 70,
      difficulty: (tier === 'beginner' ? 'medium' : 'hard'),
      tv: 2, unit: 'session', actionLabel: 'Start Session',
      trackingKey: 'sessions_completed',
    },
    {
      title: `Reach ${focusMins} minutes of total focus time`,
      description: `Accumulate focus time across all study sessions today.`,
      icon: '', xp: tier === 'beginner' ? 45 : tier === 'intermediate' ? 65 : 90,
      difficulty: (tier === 'beginner' ? 'easy' : 'medium'),
      tv: focusMins, unit: 'min', actionLabel: 'Start Session',
      trackingKey: 'total_study_minutes',
    },
    {
      title: `${mins}-minute deep focus session`,
      description: `Set a ${mins}-minute timer and study without interruptions.`,
      icon: '', xp: 55, difficulty: 'medium',
      tv: mins, unit: 'min', actionLabel: 'Start Session',
      trackingKey: 'max_session_minutes',
    },
    {
      title: `Write notes during your session`,
      description: `Create at least 1 smart note to capture key ideas from today's study block.`,
      icon: '', xp: 35, difficulty: 'easy',
      tv: 1, unit: 'note', actionLabel: 'Open Notes',
      trackingKey: 'notes_created_today',
    },
  ];

  /* ── Quiz pool ──────────────────────────────────────────────────────── */
  type QuizTemplate = {
    title: string; description: string; icon: string;
    xp: number; difficulty: MissionDifficulty; tv: number;
    unit: string; actionLabel: string;
    trackingKey: TrackingKey;
  };

  const quizPool: QuizTemplate[] = [
    {
      title: `Complete 1 practice quiz`,
      description: `Take a practice quiz on any subject. Review your wrong answers afterward.`,
      icon: '', xp: 30, difficulty: 'easy',
      tv: 1, unit: 'quiz', actionLabel: 'Start Quiz',
      trackingKey: 'quizzes_completed',
    },
    {
      title: `Score above ${target}% in a quiz`,
      description: `Attempt a quiz and aim to beat ${target}%. Preparation is key!`,
      icon: '', xp: 45, difficulty: 'medium',
      tv: target, unit: '%', actionLabel: 'Start Quiz',
      trackingKey: 'quiz_max_pct',
    },
    {
      title: `Score 80% or higher in any quiz`,
      description: `Take a quiz and achieve at least 80% accuracy. Quality over quantity.`,
      icon: 'QZ', xp: 55, difficulty: 'medium',
      tv: 80, unit: '%', actionLabel: 'Start Quiz',
      trackingKey: 'quiz_max_pct',
    },
    {
      title: `Answer 10 questions correctly`,
      description: `Complete at least one quiz and rack up 10 correct answers total today.`,
      icon: '', xp: 35, difficulty: 'easy',
      tv: 10, unit: 'correct', actionLabel: 'Start Quiz',
      trackingKey: 'quiz_correct_answers',
    },
    {
      title: `Score 75% or higher in a quiz`,
      description: `Take a quiz and hit at least 75%. A great warm-up challenge.`,
      icon: '', xp: 40, difficulty: 'medium',
      tv: 75, unit: '%', actionLabel: 'Start Quiz',
      trackingKey: 'quiz_max_pct',
    },
    {
      title: `Complete 10 quiz questions today`,
      description: `Power through 10 questions across any number of quizzes.`,
      icon: '', xp: 50, difficulty: 'medium',
      tv: 10, unit: 'question', actionLabel: 'Start Quiz',
      trackingKey: 'quiz_total_questions',
    },
    {
      title: `Complete 2 practice quizzes`,
      description: `Do two separate quiz sessions today to reinforce learning across topics.`,
      icon: '', xp: 65, difficulty: 'hard',
      tv: 2, unit: 'quiz', actionLabel: 'Start Quiz',
      trackingKey: 'quizzes_completed',
    },
    {
      title: `Answer 5 questions correctly`,
      description: `Score 5 correct answers across any quiz today.`,
      icon: '', xp: 30, difficulty: 'easy',
      tv: 5, unit: 'correct', actionLabel: 'Start Quiz',
      trackingKey: 'quiz_correct_answers',
    },
  ];

  /* ── Engagement pool — all trackable ───────────────────────────────── */
  type EngageTemplate = {
    title: string; description: string; icon: string;
    xp: number; difficulty: MissionDifficulty;
    route: string; sourceModule: string; category: MissionCategory;
    tv: number; unit: string; actionLabel: string;
    trackingKey: TrackingKey;
  };

  const baseEngagementPool: EngageTemplate[] = [
    {
      title: `Log today's wellness check-in`,
      description: `Record your mood, energy, and stress level. Your AI Twin uses this to adapt your plan.`,
      icon: '', xp: 20, difficulty: 'easy',
      route: '/checkin', sourceModule: 'progress', category: 'progress',
      tv: 1, unit: 'check-in', actionLabel: 'Check In Now',
      trackingKey: 'checkin_today',
    },
    {
      title: `Create 3 smart notes`,
      description: `Use Smart Notes to capture key concepts from today's study session.`,
      icon: '', xp: 30, difficulty: 'easy',
      route: '/notes', sourceModule: 'materials', category: 'content',
      tv: 3, unit: 'note', actionLabel: 'Open Notes',
      trackingKey: 'notes_created_today',
    },
    {
      title: `Upload a study material`,
      description: `Upload lecture slides, textbook pages, or any study resource to your library.`,
      icon: '', xp: 25, difficulty: 'easy',
      route: '/materials', sourceModule: 'materials', category: 'content',
      tv: 1, unit: 'material', actionLabel: 'Upload Material',
      trackingKey: 'materials_uploaded_today',
    },
    {
      title: `Ask your AI Mentor 3 questions`,
      description: `Chat with your AI Mentor and get personalised answers to 3 study questions.`,
      icon: '', xp: 30, difficulty: 'easy',
      route: '/mentor', sourceModule: 'mentor', category: 'ai',
      tv: 3, unit: 'message', actionLabel: 'Open Mentor',
      trackingKey: 'mentor_messages_today',
    },
    {
      title: `Create 5 smart notes`,
      description: `Capture 5 key concepts in Smart Notes — a proven retention strategy.`,
      icon: '', xp: 45, difficulty: 'medium',
      route: '/notes', sourceModule: 'materials', category: 'content',
      tv: 5, unit: 'note', actionLabel: 'Open Notes',
      trackingKey: 'notes_created_today',
    },
    {
      title: `Upload 2 study materials`,
      description: `Build your material library — upload two files to have reference docs ready.`,
      icon: '', xp: 40, difficulty: 'medium',
      route: '/materials', sourceModule: 'materials', category: 'content',
      tv: 2, unit: 'material', actionLabel: 'Upload Material',
      trackingKey: 'materials_uploaded_today',
    },
    {
      title: `Send 5 messages to AI Mentor`,
      description: `Engage deeply with your AI Mentor. Ask about weak subjects, strategies, and tips.`,
      icon: '', xp: 40, difficulty: 'medium',
      route: '/mentor', sourceModule: 'mentor', category: 'ai',
      tv: 5, unit: 'message', actionLabel: 'Open Mentor',
      trackingKey: 'mentor_messages_today',
    },
  ];

  const engagementPool: EngageTemplate[] = [
    ...baseEngagementPool,
    ...(ctx.burnoutRisk === 'high' || ctx.burnoutRisk === 'medium'
      ? [{
          title: `Log a mindful wellness check-in`,
          description: `High burnout detected. Take a moment to log your wellness data — recovery starts here.`,
          icon: '', xp: 15, difficulty: 'easy' as MissionDifficulty,
          route: '/checkin', sourceModule: 'progress', category: 'progress' as MissionCategory,
          tv: 1, unit: 'check-in', actionLabel: 'Check In Now',
          trackingKey: 'checkin_today' as TrackingKey,
        }]
      : []),
  ];

  /* ── Bonus pool — all trackable ─────────────────────────────────────── */
  type BonusTemplate = {
    title: string; description: string; icon: string; xp: number;
    route: string; sourceModule: string;
    tv: number; unit: string; actionLabel: string;
    trackingKey: TrackingKey;
  };

  const bonusPool: BonusTemplate[] = [
    {
      title: `Quick 5-question warmup quiz`,
      description: `Get your brain going — power through 5 quiz questions before your main study block.`,
      icon: '', xp: 20, route: '/quiz', sourceModule: 'quiz',
      tv: 5, unit: 'question', actionLabel: 'Start Quiz',
      trackingKey: 'quiz_total_questions',
    },
    {
      title: `Ask Mentor for weak-subject tips`,
      description: `Open the AI Mentor and ask about ${sub} improvement strategies.`,
      icon: '', xp: 25, route: '/mentor', sourceModule: 'mentor',
      tv: 1, unit: 'message', actionLabel: 'Open Mentor',
      trackingKey: 'mentor_messages_today',
    },
    {
      title: `Keep your streak alive`,
      description: `Log any study session today to keep your streak alive and earn bonus XP.`,
      icon: '', xp: 30, route: '/sessions', sourceModule: 'sessions',
      tv: 1, unit: 'session', actionLabel: 'Start Session',
      trackingKey: 'sessions_completed',
    },
    {
      title: `Create a note after studying`,
      description: `Write at least 1 smart note to solidify what you learned in today's session.`,
      icon: '', xp: 20, route: '/notes', sourceModule: 'materials',
      tv: 1, unit: 'note', actionLabel: 'Open Notes',
      trackingKey: 'notes_created_today',
    },
    {
      title: `Score 70%+ in a quiz`,
      description: `Aim for a score of 70% or higher in any practice quiz today.`,
      icon: '', xp: 20, route: '/quiz', sourceModule: 'quiz',
      tv: 70, unit: '%', actionLabel: 'Start Quiz',
      trackingKey: 'quiz_max_pct',
    },
    {
      title: `Upload any study material`,
      description: `Add a resource to your library — slides, PDFs, notes — anything counts.`,
      icon: '', xp: 20, route: '/materials', sourceModule: 'materials',
      tv: 1, unit: 'material', actionLabel: 'Upload',
      trackingKey: 'materials_uploaded_today',
    },
    {
      title: `Send a message to AI Mentor`,
      description: `Ask your AI Mentor anything. Even a quick question can change your study direction.`,
      icon: '', xp: 20, route: '/mentor', sourceModule: 'mentor',
      tv: 1, unit: 'message', actionLabel: 'Open Mentor',
      trackingKey: 'mentor_messages_today',
    },
  ];

  /* ── Pick one from each pool ─────────────────────────────────────────── */
  const sp = pick(studyPool, rng);
  const qp = pick(quizPool, rng);
  const ep = pick(engagementPool, rng);
  const bp = pick(bonusPool, rng);

  return [
    {
      id: `study-${daySeed}`,
      title: sp.title, description: sp.description,
      category: 'study', xpReward: sp.xp, difficulty: sp.difficulty,
      targetValue: sp.tv, progressUnit: sp.unit,
      actionLabel: sp.actionLabel, actionRoute: '/sessions',
      trackingKey: sp.trackingKey,
      ...(sp.trackingSubKey ? { trackingSubKey: sp.trackingSubKey } : {}),
      sourceModule: 'sessions', icon: sp.icon,
      generatedAt: now, expiresAt: expires, bonus: false,
    },
    {
      id: `quiz-${daySeed}`,
      title: qp.title, description: qp.description,
      category: 'quiz', xpReward: qp.xp, difficulty: qp.difficulty,
      targetValue: qp.tv, progressUnit: qp.unit,
      actionLabel: qp.actionLabel, actionRoute: '/quiz',
      trackingKey: qp.trackingKey,
      sourceModule: 'quiz', icon: qp.icon,
      generatedAt: now, expiresAt: expires, bonus: false,
    },
    {
      id: `engage-${daySeed}`,
      title: ep.title, description: ep.description,
      category: ep.category, xpReward: ep.xp, difficulty: ep.difficulty,
      targetValue: ep.tv, progressUnit: ep.unit,
      actionLabel: ep.actionLabel, actionRoute: ep.route,
      trackingKey: ep.trackingKey,
      sourceModule: ep.sourceModule, icon: ep.icon,
      generatedAt: now, expiresAt: expires, bonus: false,
    },
    {
      id: `bonus-${daySeed}`,
      title: bp.title, description: bp.description,
      category: 'progress', xpReward: bp.xp, difficulty: 'easy',
      targetValue: bp.tv, progressUnit: bp.unit,
      actionLabel: bp.actionLabel, actionRoute: bp.route,
      trackingKey: bp.trackingKey,
      sourceModule: bp.sourceModule, icon: bp.icon,
      generatedAt: now, expiresAt: expires, bonus: true,
    },
  ];
}

/* ── Evaluate a mission against today's metrics ─────────────────────────── */
export function evaluateMissionProgress(
  mission: DailyMission,
  metrics: MissionMetrics,
): EvaluatedMission {
  let current = 0;

  switch (mission.trackingKey) {
    case 'sessions_completed':
      current = metrics.sessions_completed; break;
    case 'total_study_minutes':
      current = metrics.total_study_minutes; break;
    case 'max_session_minutes':
      current = metrics.max_session_minutes; break;
    case 'subject_minutes': {
      const subKey = (mission.trackingSubKey ?? '').toLowerCase();
      current = metrics.subject_minutes[subKey] ?? 0;
      if (!current && subKey) {
        const match = Object.entries(metrics.subject_minutes).find(
          ([k]) => k.includes(subKey) || subKey.includes(k),
        );
        if (match) current = match[1];
      }
      break;
    }
    case 'quizzes_completed':
      current = metrics.quizzes_completed; break;
    case 'quiz_correct_answers':
      current = metrics.quiz_correct_answers; break;
    case 'quiz_total_questions':
      current = metrics.quiz_total_questions; break;
    case 'quiz_max_pct':
      current = metrics.quiz_max_pct; break;
    case 'checkin_today':
      current = metrics.checkin_today ? 1 : 0; break;
    case 'notes_created_today':
      current = metrics.notes_created_today; break;
    case 'materials_uploaded_today':
      current = metrics.materials_uploaded_today; break;
    case 'mentor_messages_today':
      current = metrics.mentor_messages_today; break;
  }

  return {
    ...mission,
    currentProgress: current,
    completed: current >= mission.targetValue,
  };
}

/* ── UI helpers ─────────────────────────────────────────────────────────── */
export const CATEGORY_META: Record<string, { label: string; color: string }> = {
  study:    { label: 'Study',    color: '#00D4FF' },
  quiz:     { label: 'Quiz',     color: '#a78bfa' },
  content:  { label: 'Content',  color: '#34d399' },
  progress: { label: 'Progress', color: '#f59e0b' },
  ai:       { label: 'AI',       color: '#818cf8' },
};

export const DIFFICULTY_META: Record<string, { label: string; icon: string }> = {
  easy:   { label: 'Easy',   icon: '' },
  medium: { label: 'Medium', icon: '' },
  hard:   { label: 'Hard',   icon: '' },
};

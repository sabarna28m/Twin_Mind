-- TwinMind — Supabase PostgreSQL Schema
-- Paste this into: Supabase Dashboard → SQL Editor → New Query → Run
-- The backend's Base.metadata.create_all() will also create all tables on first startup,
-- but this file gives you a clean baseline and lets you add RLS policies afterwards.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    full_name       VARCHAR(255) NOT NULL DEFAULT '',
    hashed_password TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    avatar_url      TEXT,
    oauth_provider  VARCHAR(50),
    oauth_id        VARCHAR(255),
    supabase_uid    UUID UNIQUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_users_email        ON users(email);
CREATE INDEX IF NOT EXISTS ix_users_supabase_uid ON users(supabase_uid);

-- ============================================================
-- STUDENT PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS student_profiles (
    id                   SERIAL PRIMARY KEY,
    user_id              INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    institution          VARCHAR(255) NOT NULL DEFAULT '',
    course               VARCHAR(255) NOT NULL DEFAULT '',
    semester             VARCHAR(50)  NOT NULL DEFAULT '',
    academic_goals       TEXT,
    learning_preferences VARCHAR(255),
    subjects             TEXT DEFAULT '',
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_student_profiles_user_id ON student_profiles(user_id);

-- ============================================================
-- SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title            VARCHAR(255) NOT NULL DEFAULT '',
    subject          VARCHAR(255),
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    status           VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_sessions_user_id ON sessions(user_id);

-- ============================================================
-- NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(255) NOT NULL DEFAULT '',
    content    TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_notes_user_id ON notes(user_id);

-- ============================================================
-- MATERIALS
-- ============================================================
CREATE TABLE IF NOT EXISTS materials (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    stored_name   VARCHAR(255) NOT NULL,
    mime_type     VARCHAR(100) NOT NULL,
    file_size     INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_materials_user_id ON materials(user_id);

-- ============================================================
-- LEARNING DATA
-- ============================================================
CREATE TABLE IF NOT EXISTS learning_data (
    id                         SERIAL PRIMARY KEY,
    user_id                    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date                       DATE NOT NULL,
    study_hours                FLOAT NOT NULL DEFAULT 0,
    attendance_percentage      FLOAT NOT NULL DEFAULT 0,
    assignment_completion_rate FLOAT NOT NULL DEFAULT 0,
    quiz_scores                FLOAT,
    exam_scores                FLOAT,
    sleep_duration             FLOAT NOT NULL DEFAULT 7,
    stress_level               INTEGER NOT NULL DEFAULT 5,
    notes                      TEXT,
    created_at                 TIMESTAMPTZ DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS ix_learning_data_user_id ON learning_data(user_id);

-- ============================================================
-- PASSWORD RESET TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- ============================================================
-- MENTOR CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS mentor_conversations (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL,
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_mentor_conversations_user_id ON mentor_conversations(user_id);

-- ============================================================
-- USER ACHIEVEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_achievements (
    id        SERIAL PRIMARY KEY,
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id  VARCHAR(50) NOT NULL,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);
CREATE INDEX IF NOT EXISTS ix_user_achievements_user_id ON user_achievements(user_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    message           VARCHAR(500) NOT NULL,
    is_read           BOOLEAN NOT NULL DEFAULT FALSE,
    reference_key     VARCHAR(100),
    priority          VARCHAR(20),
    category          VARCHAR(50),
    emoji             VARCHAR(10),
    title             VARCHAR(200),
    action_url        VARCHAR(300),
    created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id);

-- ============================================================
-- STUDY PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS study_plans (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_text  TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_study_plans_user_id ON study_plans(user_id);

-- ============================================================
-- CHAT SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title         VARCHAR(200) NOT NULL DEFAULT '',
    messages_json TEXT NOT NULL DEFAULT '[]',
    message_count INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_chat_sessions_user_id ON chat_sessions(user_id);

-- ============================================================
-- QUIZ SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_sessions (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject          VARCHAR(200) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    difficulty       VARCHAR(20) NOT NULL,
    questions        TEXT NOT NULL,
    answers          TEXT,
    score            INTEGER,
    total            INTEGER,
    time_taken       INTEGER,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_quiz_sessions_user_id ON quiz_sessions(user_id);

-- ============================================================
-- WEEKLY CHALLENGES
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_challenges (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start          DATE NOT NULL,
    target_study_hours  FLOAT,
    target_quiz_count   INTEGER,
    target_checkin_days INTEGER,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_weekly_challenges_user_id ON weekly_challenges(user_id);

-- ============================================================
-- BATTLES
-- ============================================================
CREATE TABLE IF NOT EXISTS battles (
    id            SERIAL PRIMARY KEY,
    challenger_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opponent_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    battle_type   VARCHAR(20) NOT NULL,
    target_value  FLOAT NOT NULL,
    duration      VARCHAR(10) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    winner_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    invite_code   VARCHAR(20) UNIQUE NOT NULL,
    is_random     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    expires_at    TIMESTAMPTZ,
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_battles_challenger_id ON battles(challenger_id);
CREATE INDEX IF NOT EXISTS ix_battles_opponent_id   ON battles(opponent_id);

-- ============================================================
-- GOOGLE TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS google_tokens (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token  TEXT NOT NULL,
    refresh_token TEXT,
    token_expiry  TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_google_tokens_user_id ON google_tokens(user_id);

-- ============================================================
-- BURNOUT ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS burnout_entries (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date              DATE NOT NULL,
    study_hours       FLOAT NOT NULL,
    sleep_hours       FLOAT NOT NULL,
    breaks_taken      INTEGER NOT NULL,
    study_streak_days INTEGER NOT NULL DEFAULT 0,
    mood_rating       INTEGER NOT NULL,
    energy_level      INTEGER NOT NULL,
    burnout_score     INTEGER NOT NULL,
    risk_level        VARCHAR(10) NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS ix_burnout_entries_user_id ON burnout_entries(user_id);

-- ============================================================
-- SUBJECT RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS subject_records (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject     VARCHAR(100) NOT NULL,
    date        DATE NOT NULL,
    score       FLOAT NOT NULL,
    study_hours FLOAT NOT NULL DEFAULT 0.0,
    confidence  INTEGER NOT NULL DEFAULT 3,
    source      VARCHAR(20) NOT NULL DEFAULT 'manual',
    topics_json TEXT NOT NULL DEFAULT '[]',
    notes       TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_subject_records_user_id ON subject_records(user_id);
CREATE INDEX IF NOT EXISTS ix_subject_records_subject  ON subject_records(subject);

-- ============================================================
-- SMART PLAN RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS smart_plan_records (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_content TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active    BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS ix_smart_plan_records_user_id ON smart_plan_records(user_id);

-- ============================================================
-- CAREER TWIN STATE
-- ============================================================
CREATE TABLE IF NOT EXISTS career_twin_state (
    id                         SERIAL PRIMARY KEY,
    user_id                    INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_score               FLOAT NOT NULL DEFAULT 0.0,
    linkedin_score             FLOAT NOT NULL DEFAULT 0.0,
    interview_score            FLOAT NOT NULL DEFAULT 0.0,
    coding_score               FLOAT NOT NULL DEFAULT 0.0,
    employability_score        FLOAT NOT NULL DEFAULT 0.0,
    skills_json                TEXT NOT NULL DEFAULT '[]',
    certifications_json        TEXT NOT NULL DEFAULT '[]',
    last_resume_text           TEXT NOT NULL DEFAULT '',
    linkedin_profile_json      TEXT NOT NULL DEFAULT '{}',
    linkedin_achievements_json TEXT NOT NULL DEFAULT '[]',
    score_history_json         TEXT NOT NULL DEFAULT '[]',
    created_at                 TIMESTAMPTZ DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_career_twin_state_user_id ON career_twin_state(user_id);

-- ============================================================
-- COMM TWIN STATE
-- ============================================================
CREATE TABLE IF NOT EXISTS comm_twin_state (
    id                   SERIAL PRIMARY KEY,
    user_id              INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fluency_score        FLOAT NOT NULL DEFAULT 0.0,
    pronunciation_score  FLOAT NOT NULL DEFAULT 0.0,
    vocabulary_score     FLOAT NOT NULL DEFAULT 0.0,
    grammar_score        FLOAT NOT NULL DEFAULT 0.0,
    confidence_score     FLOAT NOT NULL DEFAULT 0.0,
    interview_comm_score FLOAT NOT NULL DEFAULT 0.0,
    overall_score        FLOAT NOT NULL DEFAULT 0.0,
    sessions_count       INTEGER NOT NULL DEFAULT 0,
    words_reviewed       INTEGER NOT NULL DEFAULT 0,
    grammar_errors_fixed INTEGER NOT NULL DEFAULT 0,
    score_history_json   TEXT NOT NULL DEFAULT '[]',
    vocabulary_log_json  TEXT NOT NULL DEFAULT '[]',
    activity_log_json    TEXT NOT NULL DEFAULT '[]',
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_comm_twin_state_user_id ON comm_twin_state(user_id);

-- ============================================================
-- SMART NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS smart_notes (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title          VARCHAR(500) NOT NULL DEFAULT 'Untitled Note',
    content        TEXT NOT NULL DEFAULT '',
    subject        VARCHAR(200) NOT NULL DEFAULT '',
    tags           TEXT NOT NULL DEFAULT '[]',
    is_pinned      BOOLEAN NOT NULL DEFAULT FALSE,
    version_number INTEGER NOT NULL DEFAULT 1,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_smart_notes_user_id ON smart_notes(user_id);

-- ============================================================
-- NOTE HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS note_history (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_note_id    INTEGER NOT NULL,
    title               VARCHAR(500) NOT NULL DEFAULT '',
    content             TEXT NOT NULL DEFAULT '',
    subject             VARCHAR(200) NOT NULL DEFAULT '',
    tags                TEXT NOT NULL DEFAULT '[]',
    version_number      INTEGER NOT NULL DEFAULT 1,
    original_created_at TIMESTAMPTZ,
    deleted_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_note_history_user_id ON note_history(user_id);

-- ============================================================
-- NOTE VERSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS note_versions (
    id             SERIAL PRIMARY KEY,
    note_id        INTEGER NOT NULL REFERENCES smart_notes(id) ON DELETE CASCADE,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title          VARCHAR(500) NOT NULL DEFAULT '',
    content        TEXT NOT NULL DEFAULT '',
    subject        VARCHAR(200) NOT NULL DEFAULT '',
    saved_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_note_versions_note_id ON note_versions(note_id);
CREATE INDEX IF NOT EXISTS ix_note_versions_user_id ON note_versions(user_id);

-- ============================================================
-- SKILL NODE PROGRESS
-- ============================================================
CREATE TABLE IF NOT EXISTS skill_node_progress (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id           VARCHAR(80) NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'locked',
    completion_pct    FLOAT NOT NULL DEFAULT 0.0,
    xp_earned         INTEGER NOT NULL DEFAULT 0,
    lessons_completed INTEGER NOT NULL DEFAULT 0,
    quizzes_completed INTEGER NOT NULL DEFAULT 0,
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, node_id)
);
CREATE INDEX IF NOT EXISTS ix_snp_user ON skill_node_progress(user_id);

-- ============================================================
-- XP TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS xp_transactions (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id       VARCHAR(80),
    activity_type VARCHAR(30) NOT NULL,
    xp_amount     INTEGER NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_xpt_user ON xp_transactions(user_id);

-- ============================================================
-- SKILL TREE ACHIEVEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS skill_tree_achievements (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id VARCHAR(60) NOT NULL,
    earned_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS ix_sta_user ON skill_tree_achievements(user_id);

-- ============================================================
-- STREAK SHIELDS
-- ============================================================
CREATE TABLE IF NOT EXISTS streak_shields (
    id                       SERIAL PRIMARY KEY,
    user_id                  INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shield_count             INTEGER NOT NULL DEFAULT 0,
    auto_use_shield          BOOLEAN NOT NULL DEFAULT TRUE,
    premium_shield_count     INTEGER NOT NULL DEFAULT 0,
    streak_freeze_expires    TIMESTAMPTZ,
    double_xp_expires        TIMESTAMPTZ,
    recovery_used_month      INTEGER,
    recovery_used_year       INTEGER,
    streak_recovery_deadline TIMESTAMPTZ,
    shield_protected_dates   TEXT NOT NULL DEFAULT '[]',
    xp_spent                 INTEGER NOT NULL DEFAULT 0,
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_streak_shields_user_id ON streak_shields(user_id);

#!/usr/bin/env python3
"""
migrate_to_supabase.py — Copy SQLite data to Supabase PostgreSQL.

Usage:
  1. Set SUPABASE_DB_URL in .env  (direct connection string, not the pooler one)
     Example: postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
  2. Make sure supabase_schema.sql has already been run in the Supabase SQL editor
     (or let the FastAPI backend start once to auto-create tables via create_all).
  3. Run from the Backend directory:
       python migrate_to_supabase.py
"""

import os
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text

load_dotenv()

SQLITE_URL   = os.environ.get("SQLITE_URL", "sqlite:///./twinmind.db")
POSTGRES_URL = os.environ.get("SUPABASE_DB_URL", "")

# Tables in FK-safe insertion order
TABLES = [
    "users",
    "student_profiles",
    "sessions",
    "notes",
    "materials",
    "learning_data",
    "password_reset_tokens",
    "mentor_conversations",
    "user_achievements",
    "notifications",
    "study_plans",
    "chat_sessions",
    "quiz_sessions",
    "weekly_challenges",
    "battles",
    "google_tokens",
    "burnout_entries",
    "subject_records",
    "smart_plan_records",
    "career_twin_state",
    "comm_twin_state",
    "smart_notes",
    "note_history",
    "note_versions",
    "skill_node_progress",
    "xp_transactions",
    "skill_tree_achievements",
    "streak_shields",
]


def main() -> None:
    if not POSTGRES_URL:
        print(
            "ERROR: SUPABASE_DB_URL is not set.\n"
            "Add it to Backend/.env:\n"
            "  SUPABASE_DB_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
        )
        sys.exit(1)

    pg_url = POSTGRES_URL.replace("postgres://", "postgresql://", 1)

    print(f"Source : {SQLITE_URL}")
    print(f"Target : {pg_url[:60]}...")

    sqlite_engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})
    pg_engine     = create_engine(pg_url, pool_pre_ping=True)

    sqlite_tables = set(inspect(sqlite_engine).get_table_names())
    total_migrated = 0

    with sqlite_engine.connect() as src, pg_engine.connect() as dst:
        for table in TABLES:
            if table not in sqlite_tables:
                print(f"  SKIP  {table}  (not in SQLite)")
                continue

            rows = src.execute(text(f"SELECT * FROM \"{table}\"")).fetchall()
            if not rows:
                print(f"  EMPTY {table}")
                continue

            # Fetch column names from SQLite PRAGMA
            col_info  = src.execute(text(f"PRAGMA table_info(\"{table}\")")).fetchall()
            col_names = [c[1] for c in col_info]

            placeholders = ", ".join(f":{c}" for c in col_names)
            col_list     = ", ".join(f'"{c}"' for c in col_names)
            insert_sql   = (
                f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders}) '
                f"ON CONFLICT DO NOTHING"
            )

            ok = 0
            for row in rows:
                row_dict = dict(zip(col_names, row))
                try:
                    dst.execute(text(insert_sql), row_dict)
                    ok += 1
                except Exception as exc:
                    print(f"    ROW ERROR in {table}: {exc}")

            dst.commit()
            print(f"  OK    {table}  ({ok}/{len(rows)} rows)")
            total_migrated += ok

    print(f"\nTotal rows migrated: {total_migrated}")

    # Reset auto-increment sequences so new rows don't collide with migrated IDs
    print("\nResetting PostgreSQL sequences...")
    with pg_engine.connect() as dst:
        for table in TABLES:
            try:
                dst.execute(text(
                    f"SELECT setval("
                    f"  pg_get_serial_sequence('{table}', 'id'),"
                    f"  COALESCE((SELECT MAX(id) FROM \"{table}\"), 1)"
                    f")"
                ))
                dst.commit()
            except Exception:
                pass  # table may not have an 'id' serial column
    print("Sequences reset — migration complete.")


if __name__ == "__main__":
    main()

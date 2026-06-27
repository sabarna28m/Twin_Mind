"""
One-time migration: add 2FA columns to the users table.

Run once after deploying the 2FA feature:
    python migrate_2fa.py

Safe to run multiple times — uses IF NOT EXISTS for each column.
"""

import sys
from pathlib import Path

# Allow imports from the app package
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text
from app.core.database import engine


def run():
    print("Running 2FA migration…")
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE users
                ADD COLUMN IF NOT EXISTS twofa_secret       TEXT,
                ADD COLUMN IF NOT EXISTS twofa_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS twofa_backup_codes JSONB,
                ADD COLUMN IF NOT EXISTS twofa_setup_at     TIMESTAMPTZ;
        """))
        conn.commit()
    print("Migration complete — 2FA columns added (or already existed).")


if __name__ == "__main__":
    run()

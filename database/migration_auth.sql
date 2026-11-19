-- Run once: psql -U postgres -d iso_audit -f database/migration_auth.sql
-- Safe to run again (IF NOT EXISTS).
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens(user_id, used);

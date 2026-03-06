-- Add search_text column for full-text search on audit log events.
-- Populated at write time with searchable content extracted from the change event
-- (user name, entity FQN, entity type, service name, field change names and values).
-- This avoids scanning the event_json TEXT column at query time.
ALTER TABLE audit_log_event ADD COLUMN IF NOT EXISTS search_text TEXT DEFAULT NULL;

-- PostgreSQL built-in GIN index on tsvector expression — no extensions required.
-- Supports to_tsvector() @@ plainto_tsquery() queries for full-text search.
CREATE INDEX IF NOT EXISTS idx_audit_log_search_text ON audit_log_event USING GIN (to_tsvector('english', coalesce(search_text, '')));

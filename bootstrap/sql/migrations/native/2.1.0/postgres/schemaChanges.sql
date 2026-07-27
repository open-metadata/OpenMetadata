-- Perf: UsageDAO.computePercentile runs four correlated COUNT(*) subqueries that each
-- filter entity_usage on (entityType, usageDate). The only existing index is
-- UNIQUE (id, usageDate), which is unusable for that predicate, so every run sequential-scans
-- the table once per subquery. A composite (entityType, usageDate) index turns the
-- percentile subqueries into range scans.
CREATE INDEX IF NOT EXISTS idx_entity_usage_entitytype_usagedate
    ON entity_usage (entityType, usageDate);

-- Correctness: migration 1.6.3 defined the Postgres isBot generated column as
-- (json ->> 'deleted')::boolean instead of (json ->> 'isBot'), so on Postgres isBot has
-- always mirrored `deleted` rather than the real bot flag. countDailyActiveUsers (and any
-- isBot column filter) was therefore wrong on Postgres. Postgres cannot alter a generated
-- column's expression in place, so backfill any rows missing $.isBot, drop the column
-- (this also drops idx_isBot) and recreate it reading the correct path.
-- Operational note: ADD COLUMN ... STORED rewrites the whole user_entity table and holds an
-- ACCESS EXCLUSIVE lock for its duration, and the backfill UPDATE below also scans the full
-- table. On deployments with a very large user_entity, run this migration in a maintenance
-- window; runtime scales with row count (typically seconds, but minutes for millions of users).
-- The change is one-time, idempotent, and Postgres-only (MySQL 1.6.3 was already correct).
UPDATE user_entity SET json = jsonb_set(json, '{isBot}', 'false'::jsonb, true)
    WHERE (json ->> 'isBot') IS NULL;
ALTER TABLE user_entity DROP COLUMN IF EXISTS isBot;
ALTER TABLE user_entity
    ADD COLUMN isBot BOOLEAN GENERATED ALWAYS AS ((json ->> 'isBot')::boolean) STORED NOT NULL;
CREATE INDEX IF NOT EXISTS idx_isBot ON user_entity (isBot);

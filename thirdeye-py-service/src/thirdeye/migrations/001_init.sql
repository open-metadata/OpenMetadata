-- ThirdEye Schema Initialization
-- Phase 1: Placeholder migration
-- Phase 2: Full schema with action_items, campaigns, zi_scores, etc.

-- Create thirdeye schema if it doesn't exist
-- Note: MySQL schema is equivalent to database
-- This migration will be replaced with Alembic in Phase 2

-- Placeholder table for testing database connectivity
CREATE TABLE IF NOT EXISTS thirdeye.migration_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_migration_name (migration_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Record this migration
INSERT INTO thirdeye.migration_history (migration_name)
VALUES ('001_init')
ON DUPLICATE KEY UPDATE migration_name = migration_name;

-- Future migrations will add:
-- - action_items table
-- - campaigns table
-- - zi_scores table
-- - insights table
-- - techniques catalog
-- - cost_history table
-- etc.

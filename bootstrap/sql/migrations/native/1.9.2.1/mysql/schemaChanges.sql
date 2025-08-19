-- Performance optimization for tag_usage prefix queries
-- This addresses the 2-second latency issue in getTagsInternalByPrefix

-- Add FQN column to tag_usage for easier reverse lookups
-- This is needed for hybrid storage to update entity JSONs when tags are deleted/renamed
-- Note: We only add targetFQN since tagFQN already exists in the table
ALTER TABLE tag_usage ADD COLUMN targetFQN VARCHAR(768) COLLATE utf8mb4_bin;

-- Add targetFQNPrefix column for prefix-based queries
ALTER TABLE tag_usage ADD COLUMN targetFQNPrefix VARCHAR(16) GENERATED ALWAYS AS (LEFT(targetFQNHash, 16)) STORED;

-- Create covering index for prefix queries that includes all needed columns
-- This eliminates the need for table lookups during prefix queries
CREATE INDEX idx_tag_usage_prefix_covering ON tag_usage(targetFQNPrefix, targetFQNHash, source, tagFQN, labelType, state, tagFQNHash);

-- Create index on the new FQN column for performance
CREATE INDEX idx_tag_usage_target_fqn ON tag_usage(targetFQN);

-- Migrate existing data: We need to populate the FQN columns from existing entities
-- This is a one-time migration to backfill the FQN values
-- Note: This requires a separate migration script to populate from entity data
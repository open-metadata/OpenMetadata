-- Performance optimization for tag_usage queries
-- This addresses the 2-second latency issue in getTagsInternalByPrefix

-- Add FQN column to tag_usage for easier reverse lookups
-- This is needed for hybrid storage to update entity JSONs when tags are deleted/renamed
-- Note: We only add targetFQN since tagFQN already exists in the table
ALTER TABLE tag_usage ADD COLUMN IF NOT EXISTS targetFQN VARCHAR(768);

-- Add targetFQNPrefix column for prefix-based queries
ALTER TABLE tag_usage ADD COLUMN IF NOT EXISTS targetFQNPrefix VARCHAR(16) GENERATED ALWAYS AS (LEFT(targetFQNHash, 16)) STORED;

-- Create covering index for prefix queries that includes all needed columns
-- This eliminates the need for table lookups during prefix queries
CREATE INDEX IF NOT EXISTS idx_tag_usage_prefix_covering ON tag_usage(targetFQNPrefix, targetFQNHash, source, tagFQN, labelType, state, tagFQNHash);

-- Create index on the new FQN column for performance
CREATE INDEX IF NOT EXISTS idx_tag_usage_target_fqn ON tag_usage(targetFQN);

-- Create indexes for prefix queries
CREATE INDEX IF NOT EXISTS idx_tag_usage_target_fqn_hash ON tag_usage(targetFQNHash);
CREATE INDEX IF NOT EXISTS idx_tag_usage_tag_fqn_hash ON tag_usage(tagFQNHash);
CREATE INDEX IF NOT EXISTS idx_tag_usage_source_target ON tag_usage(source, targetFQNHash);
CREATE INDEX IF NOT EXISTS idx_tag_usage_target_source ON tag_usage(targetFQNHash, source, tagFQN);

-- Analyze table to update statistics
ANALYZE tag_usage;
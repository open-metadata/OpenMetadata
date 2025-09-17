-- Performance optimization for tag_usage prefix queries
ADD COLUMN IF NOT EXISTS targetfqnhash_lower text
GENERATED ALWAYS AS (lower(targetFQNHash)) STORED;

ALTER TABLE tag_usage
ADD COLUMN IF NOT EXISTS tagfqn_lower text
GENERATED ALWAYS AS (lower(tagFQN)) STORED;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tag_usage_target_prefix_covering
ON tag_usage (source, targetfqnhash_lower text_pattern_ops)
INCLUDE (tagFQN, labelType, state)
WHERE state = 1;  -- Only active tags

-- For exact match queries on targetFQNHash
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tag_usage_target_exact
ON tag_usage (source, targetFQNHash, state)
INCLUDE (tagFQN, labelType);

-- For tagFQN prefix searches if needed
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tag_usage_tagfqn_prefix_covering
ON tag_usage (source, tagfqn_lower text_pattern_ops)
INCLUDE (targetFQNHash, labelType, state)
WHERE state = 1;

-- For JOIN operations with classification and tag tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tag_usage_join_source
ON tag_usage (tagFQNHash, source)
INCLUDE (targetFQNHash, tagFQN, labelType, state)
WHERE state = 1;

-- Only create if you need %contains% searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index for substring matches (LIKE '%foo%')
CREATE INDEX CONCURRENTLY IF NOT EXISTS gin_tag_usage_targetfqn_trgm
ON tag_usage USING GIN (targetFQNHash gin_trgm_ops)
WHERE state = 1;

-- Optimize autovacuum for tag_usage (high update frequency)
ALTER TABLE tag_usage SET (
  autovacuum_vacuum_scale_factor = 0.05,    -- Vacuum at 5% dead rows (default 20%)
  autovacuum_analyze_scale_factor = 0.02,   -- Analyze at 2% changed rows (default 10%)
  autovacuum_vacuum_threshold = 50,         -- Minimum rows before vacuum
  autovacuum_analyze_threshold = 50,        -- Minimum rows before analyze
  fillfactor = 90                           -- Leave 10% free space for HOT updates
);

-- Increase statistics target for frequently queried columns
ALTER TABLE tag_usage ALTER COLUMN targetFQNHash SET STATISTICS 1000;
ALTER TABLE tag_usage ALTER COLUMN targetfqnhash_lower SET STATISTICS 1000;
ALTER TABLE tag_usage ALTER COLUMN tagFQN SET STATISTICS 500;
ALTER TABLE tag_usage ALTER COLUMN tagfqn_lower SET STATISTICS 500;
ALTER TABLE tag_usage ALTER COLUMN source SET STATISTICS 100;

-- Add index for efficient bulk term count queries
-- The bulkGetTermCounts query uses: WHERE classificationHash IN (...) AND deleted = FALSE
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tag_classification_deleted
ON tag (classificationHash, deleted);

-- Create new indexes with deleted column for efficient filtering
-- Using partial indexes (WHERE deleted = FALSE) for even better performance
CREATE INDEX IF NOT EXISTS idx_entity_relationship_from_deleted
ON entity_relationship(fromId, fromEntity, relation)
INCLUDE (toId, toEntity, relation)
WHERE deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_entity_relationship_to_deleted
ON entity_relationship(toId, toEntity, relation)
INCLUDE (fromId, fromEntity, relation)
WHERE deleted = FALSE;

-- Also add indexes for the specific queries that include fromEntity/toEntity filters
CREATE INDEX IF NOT EXISTS idx_entity_relationship_from_typed
ON entity_relationship(toId, toEntity, relation, fromEntity)
INCLUDE (fromEntity, toEntity)
WHERE deleted = FALSE;

-- Index for bidirectional lookups (used in UNION queries)
CREATE INDEX IF NOT EXISTS idx_entity_relationship_bidirectional
ON entity_relationship(fromId, toId, relation)
WHERE deleted = FALSE;

-- Add "Data Product Domain Validation" rule to existing entityRulesSettings configuration
UPDATE openmetadata_settings
SET json = jsonb_set(
    json,
    '{entitySemantics}',
    (json->'entitySemantics') || jsonb_build_object(
        'name', 'Data Product Domain Validation',
        'description', 'Validates that Data Products assigned to an entity match the entity''s domains.',
        'rule', '{"validateDataProductDomainMatch":[{"var":"dataProducts"},{"var":"domains"}]}',
        'enabled', true,
        'provider', 'system'
    )::jsonb,
    true
)
WHERE configtype = 'entityRulesSettings'
  AND json->'entitySemantics' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(json->'entitySemantics') AS rule
    WHERE rule->>'name' = 'Data Product Domain Validation'
  );

-- Add generated column for customUnitOfMeasurement
ALTER TABLE metric_entity
ADD COLUMN customUnitOfMeasurement VARCHAR(256)
GENERATED ALWAYS AS ((json->>'customUnitOfMeasurement')::VARCHAR(256)) STORED;
-- Add index on the column
CREATE INDEX idx_metric_custom_unit ON metric_entity(customUnitOfMeasurement);

-- Fetch updated searchSettings
DELETE FROM openmetadata_settings WHERE configType = 'searchSettings';

-- Create notification_template_entity table following OpenMetadata patterns
CREATE TABLE IF NOT EXISTS notification_template_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    provider VARCHAR(32) GENERATED ALWAYS AS (json ->> 'provider') STORED,

    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS idx_notification_template_name ON notification_template_entity(name);
CREATE INDEX IF NOT EXISTS idx_notification_template_provider ON notification_template_entity(provider);
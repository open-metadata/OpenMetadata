-- Test Case Dimension Results Time Series Table
CREATE TABLE IF NOT EXISTS test_case_dimension_results_time_series (
  entityFQNHash VARCHAR(768) COLLATE "C" NOT NULL,
  extension VARCHAR(256) NOT NULL DEFAULT 'testCase.dimensionResult',
  jsonSchema VARCHAR(256) NOT NULL,
  json JSONB NOT NULL,
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  testCaseResultId VARCHAR(36) GENERATED ALWAYS AS (json ->> 'testCaseResultId') STORED NOT NULL,
  dimensionKey VARCHAR(512) GENERATED ALWAYS AS (json ->> 'dimensionKey') STORED NOT NULL,
  dimensionName VARCHAR(256) GENERATED ALWAYS AS (SPLIT_PART(json ->> 'dimensionKey', '=', 1)) STORED,
  timestamp BIGINT GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL,
  testCaseStatus VARCHAR(36) GENERATED ALWAYS AS (json ->> 'testCaseStatus') STORED,
  CONSTRAINT test_case_dimension_results_unique_constraint UNIQUE (entityFQNHash, dimensionKey, timestamp)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS test_case_dimension_results_main ON test_case_dimension_results_time_series (entityFQNHash, timestamp, dimensionKey);
CREATE INDEX IF NOT EXISTS test_case_dimension_results_dimension_name ON test_case_dimension_results_time_series (entityFQNHash, dimensionName, timestamp);
CREATE INDEX IF NOT EXISTS test_case_dimension_results_result_id ON test_case_dimension_results_time_series (testCaseResultId);
CREATE INDEX IF NOT EXISTS test_case_dimension_results_ts ON test_case_dimension_results_time_series (timestamp);
-- Add impersonatedBy column to all entity tables for tracking bot impersonation
-- This column stores which bot performed an action on behalf of a user

ALTER TABLE api_collection_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE api_endpoint_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE api_service_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE bot_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE chart_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE dashboard_data_model_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE dashboard_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE dashboard_service_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE data_contract_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE data_product_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE database_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE database_schema_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE directory_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE domain_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE drive_service_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE event_subscription_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE file_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE glossary_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE glossary_term_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE ingestion_pipeline_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE kpi_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE messaging_service_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE metadata_service_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE metric_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE ml_model_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE mlmodel_service_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE notification_template_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE persona_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE pipeline_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE pipeline_service_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE policy_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE query_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE report_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE role_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE search_index_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE search_service_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE security_service_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE spreadsheet_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE storage_container_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE storage_service_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE stored_procedure_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE table_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE team_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE thread_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE topic_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE type_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE user_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE workflow_definition_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;
ALTER TABLE worksheet_entity ADD COLUMN IF NOT EXISTS impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'impersonatedBy') STORED;

UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{testPlatforms}',
    REPLACE(
        (json::jsonb -> 'testPlatforms')::text,
        '"DBT"',
        '"dbt"'
    )::jsonb
)::json
WHERE json::jsonb -> 'testPlatforms' @> '"DBT"'::jsonb;

-- Performance optimization for tag_usage prefix queries
ALTER TABLE tag_usage
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


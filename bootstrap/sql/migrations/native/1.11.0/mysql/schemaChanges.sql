-- Test Case Dimension Results Time Series Table
CREATE TABLE IF NOT EXISTS test_case_dimension_results_time_series (
  entityFQNHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  extension VARCHAR(256) NOT NULL DEFAULT 'testCase.dimensionResult',
  jsonSchema VARCHAR(256) NOT NULL,
  json JSON NOT NULL,
  id VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.id'))) STORED NOT NULL,
  testCaseResultId VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.testCaseResultId'))) STORED NOT NULL,
  dimensionKey VARCHAR(512) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.dimensionKey'))) STORED NOT NULL,
  dimensionName VARCHAR(256) GENERATED ALWAYS AS (SUBSTRING_INDEX(json_unquote(json_extract(json,'$.dimensionKey')), '=', 1)) STORED,
  timestamp BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.timestamp'))) STORED NOT NULL,
  testCaseStatus VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.testCaseStatus'))) STORED,
  UNIQUE KEY test_case_dimension_results_unique_constraint (entityFQNHash, dimensionKey, timestamp),
  INDEX test_case_dimension_results_main (entityFQNHash, timestamp, dimensionKey),
  INDEX test_case_dimension_results_dimension_name (entityFQNHash, dimensionName, timestamp),
  INDEX test_case_dimension_results_result_id (testCaseResultId),
  INDEX test_case_dimension_results_ts (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
-- Add impersonatedBy column to all entity tables for tracking bot impersonation
-- This column stores which bot performed an action on behalf of a user

ALTER TABLE api_collection_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE api_endpoint_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE api_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE bot_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE chart_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE dashboard_data_model_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE dashboard_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE dashboard_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE data_contract_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE data_product_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE database_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE database_schema_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE dbservice_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE directory_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE domain_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE drive_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE event_subscription_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE file_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE glossary_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE glossary_term_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE ingestion_pipeline_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE kpi_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE messaging_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE metadata_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE metric_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE ml_model_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE mlmodel_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE notification_template_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE persona_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE pipeline_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE pipeline_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE policy_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE query_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE report_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE role_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE search_index_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE search_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE security_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE spreadsheet_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE storage_container_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE storage_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE stored_procedure_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE table_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE team_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE thread_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE topic_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE type_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE user_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE workflow_definition_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE worksheet_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;

UPDATE test_definition
SET json = JSON_SET(
    json,
    '$.testPlatforms',
    CAST(REPLACE(
        JSON_EXTRACT(json, '$.testPlatforms'),
        '"DBT"',
        '"dbt"'
    ) AS JSON)
)
WHERE JSON_CONTAINS(json, '"DBT"', '$.testPlatforms');

-- Performance optimization for tag_usage prefix queries
ALTER TABLE tag_usage
ADD COLUMN targetfqnhash_lower VARCHAR(768) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
GENERATED ALWAYS AS (CONVERT(LOWER(targetFQNHash) USING utf8mb4) COLLATE utf8mb4_unicode_ci) STORED;

ALTER TABLE tag_usage
ADD COLUMN tagfqn_lower VARCHAR(768) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
GENERATED ALWAYS AS (CONVERT(LOWER(tagFQN) USING utf8mb4) COLLATE utf8mb4_unicode_ci) STORED;

-- Create indexes on the new columns
CREATE INDEX idx_targetfqnhash_lower ON tag_usage (targetfqnhash_lower(255));
CREATE INDEX idx_tagfqn_lower ON tag_usage (tagfqn_lower(255));

-- PRIMARY INDEX: For targetFQNHash prefix searches (LIKE 'prefix%')
-- Using prefix indexing for large VARCHAR columns to stay within MySQL's 3072 byte limit
CREATE INDEX idx_tag_usage_target_prefix_composite
ON tag_usage (source, targetfqnhash_lower(255), state, tagFQN(255), labelType);

-- For exact match queries
CREATE INDEX idx_tag_usage_target_exact_composite
ON tag_usage (source, targetFQNHash(255), state, tagFQN(255), labelType);

-- For tagFQN prefix searches
CREATE INDEX idx_tag_usage_tagfqn_prefix_composite
ON tag_usage (source, tagfqn_lower(255), state, targetFQNHash(255), labelType);

-- For JOIN operations
CREATE INDEX idx_tag_usage_join_composite
ON tag_usage (tagFQNHash(255), source, state, targetFQNHash(255), tagFQN(255), labelType);

CREATE FULLTEXT INDEX ft_tag_usage_targetfqn
ON tag_usage(targetFQNHash);

-- Add index for efficient bulk term count queries
-- The bulkGetTermCounts query uses: WHERE classificationHash IN (...) AND deleted = FALSE
CREATE INDEX idx_tag_classification_deleted
ON tag (classificationHash, deleted);

-- Create new composite indexes with deleted column
-- MySQL doesn't support INCLUDE clause, so we put all columns in the index
CREATE INDEX idx_entity_relationship_from_deleted
ON entity_relationship(fromId, fromEntity, relation, deleted, toId, toEntity);

CREATE INDEX idx_entity_relationship_to_deleted
ON entity_relationship(toId, toEntity, relation, deleted, fromId, fromEntity);

-- Index for queries that filter by fromEntity/toEntity
CREATE INDEX idx_entity_relationship_from_typed
ON entity_relationship(toId, toEntity, relation, fromEntity, deleted, fromId);

-- Index for bidirectional lookups
CREATE INDEX idx_entity_relationship_bidirectional
ON entity_relationship(fromId, toId, relation, deleted);




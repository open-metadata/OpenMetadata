-- Update ApplicationBotRole to include Trigger operation
UPDATE policy_entity
SET json = JSON_ARRAY_APPEND(json, '$.rules[0].operations', 'Trigger')
WHERE name = 'ApplicationBotPolicy'
  AND JSON_EXTRACT(json, '$.rules[0].operations') IS NOT NULL
  AND NOT JSON_CONTAINS(JSON_EXTRACT(json, '$.rules[0].operations'), '"Trigger"');

-- Create table for persisted audit log events
CREATE TABLE IF NOT EXISTS audit_log_event (
  id BIGINT NOT NULL AUTO_INCREMENT,
  change_event_id CHAR(36) NOT NULL,
  event_ts BIGINT NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  user_name VARCHAR(256) DEFAULT NULL,
  actor_type VARCHAR(32) DEFAULT 'USER',
  impersonated_by VARCHAR(256) DEFAULT NULL,
  service_name VARCHAR(256) DEFAULT NULL,
  entity_type VARCHAR(128) DEFAULT NULL,
  entity_id CHAR(36) DEFAULT NULL,
  entity_fqn VARCHAR(768) DEFAULT NULL,
  entity_fqn_hash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  event_json LONGTEXT NOT NULL,
  created_at BIGINT DEFAULT (UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000),
  PRIMARY KEY (id),
  UNIQUE KEY idx_audit_log_event_change_event_id (change_event_id),
  KEY idx_audit_log_event_ts (event_ts DESC),
  KEY idx_audit_log_event_user_ts (user_name, event_ts DESC),
  KEY idx_audit_log_event_entity_hash_ts (entity_fqn_hash, event_ts DESC),
  KEY idx_audit_log_actor_type_ts (actor_type, event_ts DESC),
  KEY idx_audit_log_service_name_ts (service_name, event_ts DESC),
  KEY idx_audit_log_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



-- Add enabled field to test_definition table for Rules Library feature
-- This allows administrators to enable/disable test definitions in the rules library

-- Add virtual column for enabled field
-- CAST is needed to convert JSON boolean (true/false) to TINYINT (1/0)
ALTER TABLE test_definition
  ADD COLUMN enabled TINYINT(1)
  GENERATED ALWAYS AS (COALESCE(CAST(json_extract(json, '$.enabled') AS UNSIGNED), 1))
  VIRTUAL;

-- Add index for filtering enabled/disabled test definitions
CREATE INDEX idx_test_definition_enabled ON test_definition(enabled);

-- Set all existing test definitions to enabled by default
UPDATE test_definition
  SET json = JSON_SET(json, '$.enabled', true)
  WHERE json_extract(json, '$.enabled') IS NULL;

<<<<<<< HEAD
-- Create Learning Resource Entity Table
CREATE TABLE IF NOT EXISTS learning_resource_entity (
  id varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.id'))) STORED NOT NULL,
  name varchar(3072) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.fullyQualifiedName'))) VIRTUAL,
  fqnHash varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  json json NOT NULL,
  updatedAt bigint UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.updatedAt'))) VIRTUAL NOT NULL,
  updatedBy varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.updatedBy'))) VIRTUAL NOT NULL,
  deleted TINYINT(1) GENERATED ALWAYS AS (IF(json_extract(json,'$.deleted') = TRUE, 1, 0)) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY fqnHash (fqnHash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
=======
-- Add updatedAt generated column to entity_extension table for efficient timestamp-based queries
-- This supports the listEntityHistoryByTimestamp API endpoint for retrieving entity versions within a time range
ALTER TABLE entity_extension
  ADD COLUMN updatedAt BIGINT UNSIGNED
  GENERATED ALWAYS AS (CAST(json_unquote(json_extract(json, '$.updatedAt')) AS UNSIGNED))
  STORED;

-- Create composite index for timestamp-based queries with cursor pagination
-- This index supports queries that filter by updatedAt range and order by (updatedAt DESC, id DESC)
CREATE INDEX idx_entity_extension_updated_at_id ON entity_extension(updatedAt DESC, id DESC);

-- Add composite indexes on entity tables for timestamp-based history queries with cursor pagination
CREATE INDEX idx_table_entity_updated_at_id ON table_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_database_entity_updated_at_id ON database_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_database_schema_entity_updated_at_id ON database_schema_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_dashboard_entity_updated_at_id ON dashboard_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_pipeline_entity_updated_at_id ON pipeline_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_topic_entity_updated_at_id ON topic_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_chart_entity_updated_at_id ON chart_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_ml_model_entity_updated_at_id ON ml_model_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_stored_procedure_entity_updated_at_id ON stored_procedure_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_dashboard_data_model_entity_updated_at_id ON dashboard_data_model_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_storage_container_entity_updated_at_id ON storage_container_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_search_index_entity_updated_at_id ON search_index_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_glossary_entity_updated_at_id ON glossary_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_glossary_term_entity_updated_at_id ON glossary_term_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_tag_updated_at_id ON tag(updatedAt DESC, id DESC);
CREATE INDEX idx_classification_updated_at_id ON classification(updatedAt DESC, id DESC);
CREATE INDEX idx_data_product_entity_updated_at_id ON data_product_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_domain_entity_updated_at_id ON domain_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_user_entity_updated_at_id ON user_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_team_entity_updated_at_id ON team_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_dbservice_entity_updated_at_id ON dbservice_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_messaging_service_entity_updated_at_id ON messaging_service_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_dashboard_service_entity_updated_at_id ON dashboard_service_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_pipeline_service_entity_updated_at_id ON pipeline_service_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_storage_service_entity_updated_at_id ON storage_service_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_mlmodel_service_entity_updated_at_id ON mlmodel_service_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_metadata_service_entity_updated_at_id ON metadata_service_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_search_service_entity_updated_at_id ON search_service_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_api_service_entity_updated_at_id ON api_service_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_ingestion_pipeline_entity_updated_at_id ON ingestion_pipeline_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_test_suite_updated_at_id ON test_suite(updatedAt DESC, id DESC);
CREATE INDEX idx_test_case_updated_at_id ON test_case(updatedAt DESC, id DESC);
CREATE INDEX idx_api_collection_entity_updated_at_id ON api_collection_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_api_endpoint_entity_updated_at_id ON api_endpoint_entity(updatedAt DESC, id DESC);
>>>>>>> upstream/main

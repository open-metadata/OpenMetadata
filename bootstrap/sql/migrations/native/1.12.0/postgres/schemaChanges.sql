-- Update ApplicationBotRole to include Trigger operation
UPDATE policy_entity
SET json = jsonb_set(json::jsonb, '{rules,0,operations}', (json->'rules'->0->'operations')::jsonb || '["Trigger"]'::jsonb)
WHERE name = 'ApplicationBotPolicy'
  AND json->'rules'->0->'operations' IS NOT NULL
  AND NOT (json->'rules'->0->'operations' @> '"Trigger"'::jsonb);

-- Create table for persisted audit log events
CREATE TABLE IF NOT EXISTS audit_log_event (
    id BIGSERIAL PRIMARY KEY,
    change_event_id UUID NOT NULL,
    event_ts BIGINT NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    user_name VARCHAR(256),
    actor_type VARCHAR(32) DEFAULT 'USER',
    impersonated_by VARCHAR(256) DEFAULT NULL,
    service_name VARCHAR(256) DEFAULT NULL,
    entity_type VARCHAR(128),
    entity_id UUID,
    entity_fqn VARCHAR(768),
    entity_fqn_hash VARCHAR(768),
    event_json TEXT NOT NULL,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_type_ts ON audit_log_event (actor_type, event_ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_service_name_ts ON audit_log_event (service_name, event_ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log_event (created_at);


-- Add enabled field to test_definition table for Rules Library feature
-- This allows administrators to enable/disable test definitions in the rules library

-- Add generated column for enabled field with default true for existing rows
ALTER TABLE test_definition
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN GENERATED ALWAYS AS (
    COALESCE((json ->> 'enabled')::boolean, true)
  ) STORED;

-- Add index for filtering enabled/disabled test definitions
CREATE INDEX IF NOT EXISTS idx_test_definition_enabled ON test_definition(enabled);

-- Set all existing test definitions to enabled by default
UPDATE test_definition
  SET json = jsonb_set(json::jsonb, '{enabled}', 'true'::jsonb, true)::json
  WHERE json ->> 'enabled' IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_log_event_change_event_id
ON audit_log_event (change_event_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_ts
ON audit_log_event (event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_user_ts
ON audit_log_event (user_name, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_entity_hash_ts
ON audit_log_event (entity_fqn_hash, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_type_ts
ON audit_log_event (actor_type, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_service_name_ts
ON audit_log_event (service_name, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
ON audit_log_event (created_at);



-- Create Learning Resource Entity Table
CREATE TABLE IF NOT EXISTS learning_resource_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(3072) GENERATED ALWAYS AS ((json ->> 'fullyQualifiedName'::text)) STORED,
    fqnhash character varying(256) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnhash)
);

-- Add updatedAt generated column to entity_extension table for efficient timestamp-based queries
-- This supports the listEntityHistoryByTimestamp API endpoint for retrieving entity versions within a time range
ALTER TABLE entity_extension
  ADD COLUMN IF NOT EXISTS updatedAt BIGINT GENERATED ALWAYS AS (
    (json ->> 'updatedAt')::BIGINT
  ) STORED;

-- Create composite index for timestamp-based queries with cursor pagination
-- This index supports queries that filter by updatedAt range and order by (updatedAt DESC, id DESC)
CREATE INDEX IF NOT EXISTS idx_entity_extension_updated_at_id ON entity_extension(updatedAt DESC, id DESC);

-- Add composite indexes on entity tables for timestamp-based history queries with cursor pagination
CREATE INDEX IF NOT EXISTS idx_table_entity_updated_at_id ON table_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_database_entity_updated_at_id ON database_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_database_schema_entity_updated_at_id ON database_schema_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_entity_updated_at_id ON dashboard_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_entity_updated_at_id ON pipeline_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_topic_entity_updated_at_id ON topic_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_chart_entity_updated_at_id ON chart_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ml_model_entity_updated_at_id ON ml_model_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_stored_procedure_entity_updated_at_id ON stored_procedure_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_data_model_entity_updated_at_id ON dashboard_data_model_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_storage_container_entity_updated_at_id ON storage_container_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_entity_updated_at_id ON search_index_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_glossary_entity_updated_at_id ON glossary_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_glossary_term_entity_updated_at_id ON glossary_term_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_tag_updated_at_id ON tag(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_classification_updated_at_id ON classification(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_data_product_entity_updated_at_id ON data_product_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_domain_entity_updated_at_id ON domain_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_user_entity_updated_at_id ON user_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_team_entity_updated_at_id ON team_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_dbservice_entity_updated_at_id ON dbservice_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_messaging_service_entity_updated_at_id ON messaging_service_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_service_entity_updated_at_id ON dashboard_service_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_service_entity_updated_at_id ON pipeline_service_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_storage_service_entity_updated_at_id ON storage_service_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_mlmodel_service_entity_updated_at_id ON mlmodel_service_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_metadata_service_entity_updated_at_id ON metadata_service_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_search_service_entity_updated_at_id ON search_service_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_api_service_entity_updated_at_id ON api_service_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_pipeline_entity_updated_at_id ON ingestion_pipeline_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_test_suite_updated_at_id ON test_suite(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_test_case_updated_at_id ON test_case(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_api_collection_entity_updated_at_id ON api_collection_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_api_endpoint_entity_updated_at_id ON api_endpoint_entity(updatedAt DESC, id DESC);
>>>>>>> upstream/main

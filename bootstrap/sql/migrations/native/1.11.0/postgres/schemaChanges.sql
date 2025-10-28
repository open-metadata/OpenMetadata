-- Test Case Dimension Results Time Series Table
CREATE TABLE IF NOT EXISTS test_case_dimension_results_time_series (
  entityFQNHash VARCHAR(768) COLLATE "C" NOT NULL,
  extension VARCHAR(256) NOT NULL DEFAULT 'testCase.dimensionResult',
  jsonSchema VARCHAR(256) NOT NULL,
  json JSONB NOT NULL,
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  testCaseResultId VARCHAR(36) GENERATED ALWAYS AS (json ->> 'testCaseResultId') STORED NOT NULL,
  dimensionKey VARCHAR(512) GENERATED ALWAYS AS (json ->> 'dimensionKey') STORED NOT NULL,
  timestamp BIGINT GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL,
  testCaseStatus VARCHAR(36) GENERATED ALWAYS AS (json ->> 'testCaseStatus') STORED,
  CONSTRAINT test_case_dimension_results_unique_constraint UNIQUE (entityFQNHash, dimensionKey, timestamp)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS test_case_dimension_results_main ON test_case_dimension_results_time_series (entityFQNHash, timestamp, dimensionKey);
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
-- AI Application and LLM Model entities for AI/LLM governance
-- Version 1.11.0

-- Create ai_application_entity table
CREATE TABLE IF NOT EXISTS ai_application_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json->>'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json->>'name') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json->>'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'updatedBy') STORED NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'impersonatedBy') STORED,
    deleted BOOLEAN GENERATED ALWAYS AS ((json->>'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS ai_application_name_index ON ai_application_entity(name);
CREATE INDEX IF NOT EXISTS ai_application_deleted_index ON ai_application_entity(deleted);

COMMENT ON TABLE ai_application_entity IS 'AI Application entities';

-- Create llm_model_entity table
CREATE TABLE IF NOT EXISTS llm_model_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json->>'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json->>'name') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json->>'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'updatedBy') STORED NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'impersonatedBy') STORED,
    deleted BOOLEAN GENERATED ALWAYS AS ((json->>'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS llm_model_name_index ON llm_model_entity(name);
CREATE INDEX IF NOT EXISTS llm_model_deleted_index ON llm_model_entity(deleted);

COMMENT ON TABLE llm_model_entity IS 'LLM Model entities';

-- Create prompt_template_entity table
CREATE TABLE IF NOT EXISTS prompt_template_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json->>'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json->>'name') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json->>'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'updatedBy') STORED NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'impersonatedBy') STORED,
    deleted BOOLEAN GENERATED ALWAYS AS ((json->>'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS prompt_template_name_index ON prompt_template_entity(name);
CREATE INDEX IF NOT EXISTS prompt_template_deleted_index ON prompt_template_entity(deleted);

COMMENT ON TABLE prompt_template_entity IS 'Prompt Template entities';

-- Create application_execution_entity table
CREATE TABLE IF NOT EXISTS application_execution_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json->>'id') STORED NOT NULL,
    applicationId VARCHAR(36) GENERATED ALWAYS AS (json->>'applicationId') STORED NOT NULL,
    json JSONB NOT NULL,
    timestamp BIGINT GENERATED ALWAYS AS ((json->>'timestamp')::bigint) STORED NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS application_execution_application_index ON application_execution_entity(applicationId);
CREATE INDEX IF NOT EXISTS application_execution_timestamp_index ON application_execution_entity(timestamp);

COMMENT ON TABLE application_execution_entity IS 'AI Application Execution logs';

-- Create ai_governance_policy_entity table
CREATE TABLE IF NOT EXISTS ai_governance_policy_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json->>'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json->>'name') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json->>'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'updatedBy') STORED NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'impersonatedBy') STORED,
    deleted BOOLEAN GENERATED ALWAYS AS ((json->>'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS ai_governance_policy_name_index ON ai_governance_policy_entity(name);
CREATE INDEX IF NOT EXISTS ai_governance_policy_deleted_index ON ai_governance_policy_entity(deleted);

COMMENT ON TABLE ai_governance_policy_entity IS 'AI Governance Policy entities';

-- Create llm_service_entity table
CREATE TABLE IF NOT EXISTS llm_service_entity (
    id VARCHAR(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    serviceType VARCHAR(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'impersonatedBy') STORED,
    deleted BOOLEAN GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    nameHash VARCHAR(256) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (nameHash)
);

CREATE INDEX IF NOT EXISTS llm_service_name_index ON llm_service_entity(name);
CREATE INDEX IF NOT EXISTS llm_service_type_index ON llm_service_entity(serviceType);
CREATE INDEX IF NOT EXISTS llm_service_deleted_index ON llm_service_entity(deleted);

COMMENT ON TABLE llm_service_entity IS 'LLM Service entities';

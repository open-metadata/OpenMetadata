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

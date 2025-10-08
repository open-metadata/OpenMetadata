-- Add impersonatedBy column to all entity tables for tracking bot impersonation
-- This column stores which bot performed an action on behalf of a user

-- Core tables (guaranteed to exist)
ALTER TABLE bot_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE chart_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE dashboard_data_model_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE dashboard_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE dashboard_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE data_product_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE database_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE database_schema_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE domain_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE event_subscription_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE glossary_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE glossary_term_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE ingestion_pipeline_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE kpi_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE messaging_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE metadata_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE metric_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE pipeline_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE pipeline_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE policy_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE query_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE report_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE role_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE search_index_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE search_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE storage_container_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE storage_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE table_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE team_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE thread_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE topic_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE type_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;
ALTER TABLE user_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.impersonatedBy'))) VIRTUAL;

-- Optional tables (may not exist in all installations)
-- Using SET @@SESSION.sql_notes = 0 to suppress warnings for tables that don't exist
SET @@SESSION.sql_notes = 0;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'api_collection_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE api_collection_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table api_collection_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'api_endpoint_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE api_endpoint_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table api_endpoint_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'api_service_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE api_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table api_service_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'app_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE app_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table app_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'app_market_place_definition_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE app_market_place_definition_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table app_market_place_definition_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'classification_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE classification_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table classification_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'container_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE container_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table container_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'data_contract_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE data_contract_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table data_contract_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'data_insight_chart_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE data_insight_chart_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table data_insight_chart_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'data_insight_system_chart_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE data_insight_system_chart_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table data_insight_system_chart_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'directory_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE directory_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table directory_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'doc_store_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE doc_store_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table doc_store_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'document_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE document_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table document_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'drive_service_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE drive_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table drive_service_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'file_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE file_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table file_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'mlmodel_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE mlmodel_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table mlmodel_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'mlmodel_service_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE mlmodel_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table mlmodel_service_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'notification_template_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE notification_template_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table notification_template_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'persona_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE persona_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table persona_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'security_service_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE security_service_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table security_service_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'spreadsheet_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE spreadsheet_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table spreadsheet_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'stored_procedure_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE stored_procedure_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table stored_procedure_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'suggestion_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE suggestion_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table suggestion_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'tag_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE tag_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table tag_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'test_case_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE test_case_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table test_case_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'test_connection_definition_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE test_connection_definition_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table test_connection_definition_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'test_definition_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE test_definition_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table test_definition_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'test_suite_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE test_suite_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table test_suite_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'web_analytic_event_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE web_analytic_event_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table web_analytic_event_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'webhook_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE webhook_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table webhook_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'workflow_definition_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE workflow_definition_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table workflow_definition_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'workflow_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE workflow_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table workflow_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'worksheet_entity');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE worksheet_entity ADD COLUMN impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, \'$.impersonatedBy\'))) VIRTUAL', 'SELECT \'Table worksheet_entity does not exist, skipping...\'');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @@SESSION.sql_notes = 1;

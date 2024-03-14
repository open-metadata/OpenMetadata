-- Add the supportsProfiler field to the MongoDB connection configuration
UPDATE dbservice_entity
SET json = JSON_INSERT(json, '$.connection.config.supportsProfiler', TRUE)
WHERE serviceType = 'MongoDB';

ALTER TABLE query_entity ADD COLUMN checksum VARCHAR(32) GENERATED ALWAYS AS (json ->> '$.checksum') NOT NULL UNIQUE;

UPDATE query_entity SET json = JSON_INSERT(json, '$.checksum', MD5(JSON_UNQUOTE(JSON_EXTRACT(json, '$.checksum'))));

ALTER TABLE chart_entity ADD INDEX index_chart_entity_deleted(fqnHash, deleted);
ALTER TABLE dashboard_data_model_entity ADD INDEX index_dashboard_data_model_entity_deleted(fqnHash, deleted);
ALTER TABLE dashboard_entity ADD INDEX index_dashboard_entity_deleted(fqnHash, deleted);
ALTER TABLE data_insight_chart ADD INDEX index_data_insight_chart_deleted(fqnHash, deleted);
ALTER TABLE database_entity ADD INDEX index_database_entity_deleted(fqnHash, deleted);
ALTER TABLE database_schema_entity ADD INDEX index_database_schema_entity_deleted(fqnHash, deleted);
ALTER TABLE glossary_term_entity ADD INDEX index_glossary_term_entity_deleted(fqnHash, deleted);
ALTER TABLE ingestion_pipeline_entity ADD INDEX index_ingestion_pipeline_entity_deleted(fqnHash, deleted);
ALTER TABLE metric_entity ADD INDEX index_metric_entity_deleted(fqnHash, deleted);
ALTER TABLE ml_model_entity ADD INDEX index_ml_model_entity_deleted(fqnHash, deleted);
ALTER TABLE pipeline_entity ADD INDEX index_pipeline_entity_deleted(fqnHash, deleted);
ALTER TABLE policy_entity ADD INDEX index_policy_entity_deleted(fqnHash, deleted);
ALTER TABLE report_entity ADD INDEX index_report_entity_deleted(fqnHash, deleted);
ALTER TABLE search_index_entity ADD INDEX index_search_index_entity_deleted(fqnHash, deleted);
ALTER TABLE storage_container_entity ADD INDEX index_storage_container_entity_deleted(fqnHash, deleted);
ALTER TABLE stored_procedure_entity ADD INDEX index_stored_procedure_entity_deleted(fqnHash, deleted);
ALTER TABLE table_entity ADD INDEX index_table_entity_deleted(fqnHash, deleted);
ALTER TABLE tag ADD INDEX index_tag_deleted(fqnHash, deleted);
ALTER TABLE test_case ADD INDEX index_test_case_deleted(fqnHash, deleted);
ALTER TABLE test_suite ADD INDEX index_test_suite_deleted(fqnHash, deleted);
ALTER TABLE topic_entity ADD INDEX index_topic_entity_deleted(fqnHash, deleted);
ALTER TABLE web_analytic_event ADD INDEX index_web_analytic_event_deleted(fqnHash, deleted);

ALTER TABLE apps_marketplace ADD INDEX index_apps_marketplace_deleted(nameHash, deleted);
ALTER TABLE bot_entity ADD INDEX index_bot_entity_deleted(nameHash, deleted);
ALTER TABLE classification ADD INDEX index_classification_deleted(nameHash, deleted);
ALTER TABLE dashboard_service_entity ADD INDEX index_dashboard_service_entity_deleted(nameHash, deleted);
ALTER TABLE dbservice_entity ADD INDEX index_dbservice_entity_deleted(nameHash, deleted);
ALTER TABLE glossary_entity ADD INDEX index_glossary_entity_deleted(nameHash, deleted);
ALTER TABLE installed_apps ADD INDEX index_installed_apps_deleted(nameHash, deleted);
ALTER TABLE knowledge_center ADD INDEX index_knowledge_center_deleted(nameHash, deleted);
ALTER TABLE kpi_entity ADD INDEX index_kpi_entity_deleted(nameHash, deleted);
ALTER TABLE messaging_service_entity ADD INDEX index_messaging_service_entity_deleted(nameHash, deleted);
ALTER TABLE metadata_service_entity ADD INDEX index_metadata_service_entity_deleted(nameHash, deleted);
ALTER TABLE mlmodel_service_entity ADD INDEX index_mlmodel_service_entity_deleted(nameHash, deleted);
ALTER TABLE pipeline_service_entity ADD INDEX index_pipeline_service_entity_deleted(nameHash, deleted);
ALTER TABLE role_entity ADD INDEX index_role_entity_deleted(nameHash, deleted);
ALTER TABLE search_service_entity ADD INDEX index_search_service_entity_deleted(nameHash, deleted);
ALTER TABLE storage_service_entity ADD INDEX index_storage_service_entity_deleted(nameHash, deleted);
ALTER TABLE team_entity ADD INDEX index_team_entity_deleted(nameHash, deleted);
ALTER TABLE user_entity ADD INDEX index_user_entity_deleted(nameHash, deleted);

ALTER TABLE apps_extension_time_series ADD INDEX apps_extension_time_series_index(appId);
ALTER TABLE suggestions ADD INDEX index_suggestions_type(suggestionType);
ALTER TABLE suggestions ADD INDEX index_suggestions_status(status);

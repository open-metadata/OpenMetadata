--
-- Add REPLICA IDENTITY to tables for PostgreSQL logical replication support
-- This allows UPDATE and DELETE operations to work when logical replication is enabled
-- Fix for: https://github.com/open-metadata/OpenMetadata/issues/[issue_number]
--

-- Set replica identity for all tables that have UPDATE statements in migrations
-- Using existing unique constraints as replica identity

ALTER TABLE IF EXISTS automations_workflow REPLICA IDENTITY USING INDEX automations_workflow_namehash_key;
ALTER TABLE IF EXISTS bot_entity REPLICA IDENTITY USING INDEX bot_entity_namehash_key;
ALTER TABLE IF EXISTS chart_entity REPLICA IDENTITY USING INDEX chart_entity_fqnhash_key;
ALTER TABLE IF EXISTS classification REPLICA IDENTITY USING INDEX classification_namehash_key;
ALTER TABLE IF EXISTS dashboard_data_model_entity REPLICA IDENTITY USING INDEX dashboard_data_model_entity_fqnhash_key;
ALTER TABLE IF EXISTS dashboard_entity REPLICA IDENTITY USING INDEX dashboard_entity_fqnhash_key;
ALTER TABLE IF EXISTS dashboard_service_entity REPLICA IDENTITY USING INDEX dashboard_service_entity_namehash_key;
ALTER TABLE IF EXISTS data_insight_chart REPLICA IDENTITY USING INDEX data_insight_chart_fqnhash_key;
ALTER TABLE IF EXISTS data_product_entity REPLICA IDENTITY USING INDEX data_product_entity_fqnhash_key;
ALTER TABLE IF EXISTS database_entity REPLICA IDENTITY USING INDEX database_entity_fqnhash_key;
ALTER TABLE IF EXISTS database_schema_entity REPLICA IDENTITY USING INDEX database_schema_entity_fqnhash_key;
ALTER TABLE IF EXISTS dbservice_entity REPLICA IDENTITY USING INDEX dbservice_entity_namehash_key;
ALTER TABLE IF EXISTS domain_entity REPLICA IDENTITY USING INDEX domain_entity_fqnhash_key;
ALTER TABLE IF EXISTS event_subscription_entity REPLICA IDENTITY USING INDEX event_subscription_entity_namehash_key;
ALTER TABLE IF EXISTS glossary_entity REPLICA IDENTITY USING INDEX glossary_entity_namehash_key;
ALTER TABLE IF EXISTS glossary_term_entity REPLICA IDENTITY USING INDEX glossary_term_entity_fqnhash_key;
ALTER TABLE IF EXISTS ingestion_pipeline_entity REPLICA IDENTITY USING INDEX ingestion_pipeline_entity_fqnhash_key;
ALTER TABLE IF EXISTS kpi_entity REPLICA IDENTITY USING INDEX kpi_entity_namehash_key;
ALTER TABLE IF EXISTS messaging_service_entity REPLICA IDENTITY USING INDEX messaging_service_entity_namehash_key;
ALTER TABLE IF EXISTS metadata_service_entity REPLICA IDENTITY USING INDEX metadata_service_entity_namehash_key;
ALTER TABLE IF EXISTS metric_entity REPLICA IDENTITY USING INDEX metric_entity_fqnhash_key;
ALTER TABLE IF EXISTS ml_model_entity REPLICA IDENTITY USING INDEX ml_model_entity_fqnhash_key;
ALTER TABLE IF EXISTS mlmodel_service_entity REPLICA IDENTITY USING INDEX mlmodel_service_entity_namehash_key;
ALTER TABLE IF EXISTS pipeline_entity REPLICA IDENTITY USING INDEX pipeline_entity_fqnhash_key;
ALTER TABLE IF EXISTS pipeline_service_entity REPLICA IDENTITY USING INDEX pipeline_service_entity_namehash_key;
ALTER TABLE IF EXISTS policy_entity REPLICA IDENTITY USING INDEX policy_entity_fqnhash_key;
ALTER TABLE IF EXISTS query_entity REPLICA IDENTITY USING INDEX query_entity_namehash_key;
ALTER TABLE IF EXISTS report_entity REPLICA IDENTITY USING INDEX report_entity_fqnhash_key;
ALTER TABLE IF EXISTS role_entity REPLICA IDENTITY USING INDEX role_entity_namehash_key;
ALTER TABLE IF EXISTS search_index_entity REPLICA IDENTITY USING INDEX search_index_entity_fqnhash_key;
ALTER TABLE IF EXISTS search_service_entity REPLICA IDENTITY USING INDEX search_service_entity_namehash_key;
ALTER TABLE IF EXISTS storage_container_entity REPLICA IDENTITY USING INDEX storage_container_entity_fqnhash_key;
ALTER TABLE IF EXISTS storage_service_entity REPLICA IDENTITY USING INDEX storage_service_entity_namehash_key;
ALTER TABLE IF EXISTS table_entity REPLICA IDENTITY USING INDEX table_entity_fqnhash_key;
ALTER TABLE IF EXISTS tag REPLICA IDENTITY USING INDEX tag_fqnhash_key;
-- tag_usage uses FULL because the unique constraint includes nullable columns (tagfqnhash, targetfqnhash)
-- This is required for DELETE operations to work with logical replication
ALTER TABLE IF EXISTS tag_usage REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS team_entity REPLICA IDENTITY USING INDEX team_entity_namehash_key;
ALTER TABLE IF EXISTS test_case REPLICA IDENTITY USING INDEX test_case_fqnhash_key;
ALTER TABLE IF EXISTS test_definition REPLICA IDENTITY USING INDEX test_definition_namehash_key;
ALTER TABLE IF EXISTS test_suite REPLICA IDENTITY USING INDEX test_suite_namehash_key;
ALTER TABLE IF EXISTS thread_entity REPLICA IDENTITY USING INDEX task_id_constraint;
ALTER TABLE IF EXISTS topic_entity REPLICA IDENTITY USING INDEX topic_entity_fqnhash_key;
ALTER TABLE IF EXISTS user_entity REPLICA IDENTITY USING INDEX user_entity_namehash_key;
ALTER TABLE IF EXISTS web_analytic_event REPLICA IDENTITY USING INDEX web_analytic_event_fqnhash_key;

-- For entity_extension_time_series, set replica identity using the constraint created in 1.1.5
ALTER TABLE IF EXISTS entity_extension_time_series REPLICA IDENTITY USING INDEX entity_extension_time_series_constraint;

-- For time series tables created in native migrations
ALTER TABLE IF EXISTS profiler_data_time_series REPLICA IDENTITY USING INDEX profiler_data_time_series_unique_hash_extension_ts;
ALTER TABLE IF EXISTS data_quality_data_time_series REPLICA IDENTITY USING INDEX data_quality_data_time_series_unique_hash_extension_ts;

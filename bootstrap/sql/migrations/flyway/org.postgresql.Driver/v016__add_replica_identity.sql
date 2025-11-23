--
-- Add REPLICA IDENTITY to tables created after v001 for PostgreSQL logical replication support
-- This allows UPDATE and DELETE operations to work when logical replication is enabled
-- Note: Tables created in v001 have REPLICA IDENTITY set at the end of v001
--

-- Set replica identity for tables created in v002-v015
-- Using existing unique constraints as replica identity

-- Tables from v002
ALTER TABLE IF EXISTS type_entity REPLICA IDENTITY USING INDEX type_entity_name_key;
ALTER TABLE IF EXISTS mlmodel_service_entity REPLICA IDENTITY USING INDEX mlmodel_service_entity_name_key;

-- Tables from v004
ALTER TABLE IF EXISTS test_definition REPLICA IDENTITY USING INDEX test_definition_name_key;
ALTER TABLE IF EXISTS test_suite REPLICA IDENTITY USING INDEX test_suite_name_key;
ALTER TABLE IF EXISTS test_case REPLICA IDENTITY USING INDEX test_case_fullyqualifiedname_key;
ALTER TABLE IF EXISTS openmetadata_settings REPLICA IDENTITY USING INDEX openmetadata_settings_configtype_key;

-- Tables from v006
ALTER TABLE IF EXISTS web_analytic_event REPLICA IDENTITY USING INDEX web_analytic_event_name_key;
ALTER TABLE IF EXISTS data_insight_chart REPLICA IDENTITY USING INDEX data_insight_chart_name_key;
ALTER TABLE IF EXISTS kpi_entity REPLICA IDENTITY USING INDEX kpi_entity_name_key;
ALTER TABLE IF EXISTS metadata_service_entity REPLICA IDENTITY USING INDEX metadata_service_entity_name_key;

-- Tables from v007 (alert tables renamed to event_subscription in later migrations)

-- Tables from v009
ALTER TABLE IF EXISTS storage_container_entity REPLICA IDENTITY USING INDEX storage_container_entity_fullyqualifiedname_key;
ALTER TABLE IF EXISTS test_connection_definition REPLICA IDENTITY USING INDEX test_connection_definition_name_key;
ALTER TABLE IF EXISTS automations_workflow REPLICA IDENTITY USING INDEX automations_workflow_name_key;
ALTER TABLE IF EXISTS query_entity REPLICA IDENTITY USING INDEX query_entity_name_key;

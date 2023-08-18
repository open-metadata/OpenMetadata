ALTER TABLE automations_workflow MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin,MODIFY COLUMN workflowType VARCHAR(256) COLLATE ascii_bin, MODIFY COLUMN status VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE entity_extension MODIFY COLUMN extension VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE entity_extension_time_series MODIFY COLUMN entityFQNHash VARCHAR(768) COLLATE ascii_bin, MODIFY COLUMN jsonSchema VARCHAR(50) COLLATE ascii_bin, MODIFY COLUMN extension VARCHAR(100) COLLATE ascii_bin,
    ADD CONSTRAINT entity_extension_time_series_constraint UNIQUE (entityFQNHash, extension, timestamp);
ALTER TABLE field_relationship MODIFY COLUMN fromFQNHash VARCHAR(768) COLLATE ascii_bin, MODIFY COLUMN toFQNHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE thread_entity MODIFY COLUMN entityLink VARCHAR(3072) GENERATED ALWAYS AS (json ->> '$.about') NOT NULL, MODIFY COLUMN createdBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.createdBy') STORED NOT NULL COLLATE ascii_bin;
ALTER TABLE event_subscription_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE ingestion_pipeline_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE bot_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE user_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE team_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE role_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE policy_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE classification MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE tag MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE tag_usage MODIFY COLUMN tagFQNHash VARCHAR(768) COLLATE ascii_bin, MODIFY COLUMN targetFQNHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE glossary_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE glossary_term_entity MODIFY fqnHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE type_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE web_analytic_event MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE data_insight_chart MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE kpi_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE test_definition MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE test_connection_definition MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE test_suite MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE test_case MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE dbservice_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE messaging_service_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE metadata_service_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE pipeline_service_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE dashboard_service_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE mlmodel_service_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE storage_service_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE database_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE database_schema_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE table_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE dashboard_data_model_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE dashboard_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE chart_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE pipeline_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE ml_model_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE metric_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE query_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE report_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE storage_container_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE topic_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;


UPDATE dbservice_entity
SET json = JSON_SET(
        JSON_REMOVE(json, '$.connection.config.connectionOptions'),
        '$.connection.config.connectionOptions',
        JSON_EXTRACT(json, '$.connection.config.params')
    )
WHERE serviceType = 'Trino';

UPDATE dbservice_entity
SET json = JSON_REMOVE(json, '$.connection.config.params')
WHERE serviceType = 'Trino';

-- Modify migrations for service connection of trino to move password under authType
UPDATE dbservice_entity
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.connection.config.password'),
        '$.connection.config.authType',
        JSON_OBJECT(),
        '$.connection.config.authType.password',
        JSON_EXTRACT(json, '$.connection.config.password'))
where serviceType = 'Trino'
  AND JSON_EXTRACT(json, '$.connection.config.password') IS NOT NULL;
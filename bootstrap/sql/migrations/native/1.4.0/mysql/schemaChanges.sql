-- Add the supportsProfiler field to the MongoDB connection configuration
UPDATE dbservice_entity
SET json = JSON_INSERT(json, '$.connection.config.supportsProfiler', TRUE)
WHERE serviceType = 'MongoDB';

-- Queries should be unique:
-- 1. Remove duplicate queries from entity_relationship
-- 2. Remove duplicate queries from query_entity
-- 3. Add checksum with unique constraint
ALTER TABLE query_entity ADD COLUMN checksum VARCHAR
(32) GENERATED ALWAYS AS
(json ->> '$.checksum') NOT NULL;

with duplicated as (
  select
    id,
    ROW_NUMBER() OVER (PARTITION BY checksum ORDER BY id) AS rn
  FROM query_entity
)
DELETE FROM entity_relationship
  where toEntity = 'query' and toId in (
  select id from duplicated where rn > 1
);

with duplicated as (
  select
    id,
    ROW_NUMBER() OVER (PARTITION BY checksum ORDER BY id) AS rn
  FROM query_entity
)
DELETE FROM query_entity where id in (
  select id from duplicated where rn > 1
);

ALTER TABLE query_entity ADD CONSTRAINT unique_query_checksum UNIQUE (checksum);

UPDATE query_entity SET json = JSON_INSERT(json, '$.checksum', MD5(JSON_UNQUOTE(checksum)));

-- Restructure dbServiceNames in ingestion_pipeline_entity
update ingestion_pipeline_entity set json = 
  JSON_INSERT(
    JSON_REMOVE(json, '$.sourceConfig.config.dbServiceNames'), 
    '$.sourceConfig.config.lineageInformation', 
    JSON_OBJECT(
      'dbServiceNames', 
      JSON_EXTRACT(json, '$.sourceConfig.config.dbServiceNames')
    )
  )
where 	
  JSON_EXTRACT(json, '$.sourceConfig.config.type') in ('DashboardMetadata', 'PipelineMetadata')
  AND JSON_EXTRACT(json, '$.sourceConfig.config.dbServiceNames') is not null;


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


-- Add the supportsProfiler field to the DynamoDB connection configuration
UPDATE dbservice_entity
SET json = JSON_INSERT(json, '$.connection.config.supportsProfiler', TRUE)
WHERE serviceType = 'DynamoDB';

-- Migrate 'QlikSenseDataModel' & 'QlikCloudDataModel' into single entity 'QlikDataModel'
UPDATE dashboard_data_model_entity
SET json = JSON_SET(json, '$.dataModelType', 'QlikDataModel')
WHERE JSON_EXTRACT(json, '$.dataModelType') in ('QlikSenseDataModel', 'QlikCloudDataModel');

-- clean ES pipelines
DELETE FROM ingestion_pipeline_entity
WHERE LOWER(JSON_EXTRACT(json, '$.pipelineType')) = 'elasticsearchreindex';


UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.sslCA'),
    '$.connection.config.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.sslConfig.caCertificate',
    JSON_EXTRACT(json, '$.connection.config.sslCA')), json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.sslKey'),
    '$.connection.config.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.sslConfig.sslKey',
    JSON_EXTRACT(json, '$.connection.config.sslKey')), json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.sslCert'),
    '$.connection.config.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.sslConfig.sslCertificate',
    JSON_EXTRACT(json, '$.connection.config.sslCert'))
where serviceType in ('Mysql', 'Doris') AND JSON_EXTRACT(json, '$.connection.config.sslCA') IS NOT NULL;

UPDATE dbservice_entity
SET json = JSON_INSERT(
JSON_REMOVE(json, '$.connection.config.sslConfig.certificatePath'), 
                           '$.connection.config.sslConfig.caCertificate', 
                           JSON_EXTRACT(json, '$.connection.config.sslConfig.certificatePath')
                          ) where serviceType in ('Redshift', 'Postgres', 'Greenplum') and JSON_EXTRACT(json, '$.connection.config.sslConfig.certificatePath') is not null;


UPDATE dbservice_entity 
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.metastoreConnection.sslCA'),
    '$.connection.config.metastoreConnection.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.metastoreConnection.sslConfig.caCertificate',
    JSON_EXTRACT(json, '$.connection.config.metastoreConnection.sslCA')), json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.metastoreConnection.sslKey'),
    '$.connection.config.metastoreConnection.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.metastoreConnection.sslConfig.sslKey',
    JSON_EXTRACT(json, '$.connection.config.metastoreConnection.sslKey')), json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.metastoreConnection.sslCert'),
    '$.connection.config.metastoreConnection.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.metastoreConnection.sslConfig.sslCertificate',
    JSON_EXTRACT(json, '$.connection.config.metastoreConnection.sslCert'))
    
where serviceType = 'Hive'
  AND JSON_EXTRACT(json, '$.connection.config.metastoreConnection.type') = 'Mysql'
  AND JSON_EXTRACT(json, '$.connection.config.metastoreConnection.sslCA') IS NOT NULL;

UPDATE dbservice_entity 
SET json = JSON_INSERT(
JSON_REMOVE(json, '$.connection.config.metastoreConnection.sslConfig.certificatePath'), 
                           '$.connection.config.metastoreConnection.sslConfig.caCertificate', 
                           JSON_EXTRACT(json, '$.connection.config.metastoreConnection.sslConfig.certificatePath'))
where serviceType = 'Hive'
  AND JSON_EXTRACT(json, '$.connection.config.metastoreConnection.type') = 'Postgres'
  AND JSON_EXTRACT(json, '$.connection.config.metastoreConnection.sslConfig.certificatePath') IS NOT NULL;

UPDATE dashboard_service_entity  
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.connection.sslCA'),
    '$.connection.config.connection.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.connection.sslConfig.caCertificate',
    JSON_EXTRACT(json, '$.connection.config.connection.sslCA')), json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.connection.sslKey'),
    '$.connection.config.connection.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.connection.sslConfig.sslKey',
    JSON_EXTRACT(json, '$.connection.config.connection.sslKey')), json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.connection.sslCert'),
    '$.connection.config.connection.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.connection.sslConfig.sslCertificate',
    JSON_EXTRACT(json, '$.connection.config.connection.sslCert'))
    
where serviceType = 'Superset'
  AND JSON_EXTRACT(json, '$.connection.config.connection.type') = 'Mysql'
  AND JSON_EXTRACT(json, '$.connection.config.connection.sslCA') IS NOT NULL;

UPDATE dashboard_service_entity 
SET json = JSON_INSERT(
JSON_REMOVE(json, '$.connection.config.connection.sslConfig.certificatePath'), 
                           '$.connection.config.connection.sslConfig.caCertificate', 
                           JSON_EXTRACT(json, '$.connection.config.connection.sslConfig.certificatePath'))
where serviceType = 'Superset'
  AND JSON_EXTRACT(json, '$.connection.config.connection.type') = 'Postgres'
  AND JSON_EXTRACT(json, '$.connection.config.connection.sslConfig.certificatePath') IS NOT NULL;


UPDATE metadata_service_entity  
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.connection.sslCA'),
    '$.connection.config.connection.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.connection.sslConfig.caCertificate',
    JSON_EXTRACT(json, '$.connection.config.connection.sslCA')), json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.connection.sslKey'),
    '$.connection.config.connection.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.connection.sslConfig.sslKey',
    JSON_EXTRACT(json, '$.connection.config.connection.sslKey')), json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.connection.sslCert'),
    '$.connection.config.connection.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.connection.sslConfig.sslCertificate',
    JSON_EXTRACT(json, '$.connection.config.connection.sslCert'))
    
where serviceType = 'Alation'
  AND JSON_EXTRACT(json, '$.connection.config.connection.type') = 'Mysql'
  AND JSON_EXTRACT(json, '$.connection.config.connection.sslCA') IS NOT NULL;


UPDATE metadata_service_entity  
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.connection.sslConfig.certificatePath'),
    '$.connection.config.connection.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.connection.sslConfig.caCertificate',
    JSON_EXTRACT(json, '$.connection.config.connection.sslConfig.certificatePath'))
where serviceType = 'Alation'
  AND JSON_EXTRACT(json, '$.connection.config.connection.type') = 'Postgres'
  AND JSON_EXTRACT(json, '$.connection.config.connection.sslConfig.certificatePath') IS NOT NULL;


UPDATE dashboard_service_entity
SET json = JSON_REMOVE(json,'$.connection.config.certificates.stagingDir'), json = JSON_INSERT(JSON_REMOVE(json,'$.connection.config.certificates.rootCertificateData'), '$.connection.config.certificates.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.certificates.sslConfig.caCertificate',
    JSON_EXTRACT(json, '$.connection.config.certificates.rootCertificateData')), json = JSON_INSERT(JSON_REMOVE(json,'$.connection.config.certificates.clientCertificateData'), '$.connection.config.certificates.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.certificates.sslConfig.sslCertificate',
    JSON_EXTRACT(json, '$.connection.config.certificates.clientCertificateData')),
    json = JSON_INSERT(JSON_REMOVE(json,'$.connection.config.certificates.clientKeyCertificateData'), '$.connection.config.certificates.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.certificates.sslConfig.sslKey',
    JSON_EXTRACT(json, '$.connection.config.certificates.clientKeyCertificateData'))  

where lower(serviceType) = 'qliksense'
  and JSON_EXTRACT(json, '$.connection.config.certificates.rootCertificateData') is not null;



UPDATE pipeline_service_entity  
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.connection.sslCA'),
    '$.connection.config.connection.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.connection.sslConfig.caCertificate',
    JSON_EXTRACT(json, '$.connection.config.connection.sslCA')), json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.connection.sslKey'),
    '$.connection.config.connection.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.connection.sslConfig.sslKey',
    JSON_EXTRACT(json, '$.connection.config.connection.sslKey')), json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.connection.sslCert'),
    '$.connection.config.connection.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.connection.sslConfig.sslCertificate',
    JSON_EXTRACT(json, '$.connection.config.connection.sslCert'))
    
where serviceType = 'Airflow'
  AND JSON_EXTRACT(json, '$.connection.config.connection.type') = 'Mysql'
  AND JSON_EXTRACT(json, '$.connection.config.connection.sslCA') IS NOT NULL;

UPDATE pipeline_service_entity
SET json = JSON_INSERT(
JSON_REMOVE(json, '$.connection.config.connection.sslConfig.certificatePath'), 
'$.connection.config.connection.sslConfig.caCertificate', 
JSON_EXTRACT(json, '$.connection.config.connection.sslConfig.certificatePath'))
where serviceType = 'Airflow'
  AND JSON_EXTRACT(json, '$.connection.config.connection.type') = 'Postgres'
  AND JSON_EXTRACT(json, '$.connection.config.connection.sslConfig.certificatePath') IS NOT NULL;

UPDATE pipeline_service_entity  
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.SSLCALocation'),
    '$.connection.config.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.sslConfig.caCertificate',
    JSON_EXTRACT(json, '$.connection.config.SSLCALocation')), json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.SSLKeyLocation'),
    '$.connection.config.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.sslConfig.sslKey',
    JSON_EXTRACT(json, '$.connection.config.SSLKeyLocation')), json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.SSLCertificateLocation'),
    '$.connection.config.sslConfig',
    JSON_OBJECT(),
    '$.connection.config.sslConfig.sslCertificate',
    JSON_EXTRACT(json, '$.connection.config.SSLCertificateLocation'))
    
where serviceType = 'OpenLineage'
  AND JSON_EXTRACT(json, '$.connection.config.SSLCALocation') IS NOT NULL;

-- Change viewDefinition to schemaDefinition
UPDATE table_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.viewDefinition'),
    '$.schemaDefinition',
    JSON_EXTRACT(json, '$.viewDefinition')
);

UPDATE table_entity SET json = JSON_REMOVE(json, '$.testSuite');

-- Clean up QRTZ tables
delete from QRTZ_SIMPLE_TRIGGERS;
delete from QRTZ_CRON_TRIGGERS;
delete from QRTZ_TRIGGERS;
delete from QRTZ_LOCKS;
delete from QRTZ_SCHEDULER_STATE;
delete from QRTZ_JOB_DETAILS;
delete from QRTZ_FIRED_TRIGGERS;

DELETE from event_subscription_entity where name = 'ActivityFeedAlert';

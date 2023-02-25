-- Remove markDeletedTablesFromFilterOnly 
UPDATE ingestion_pipeline_entity
SET json = json::jsonb #- '{sourceConfig,config,markDeletedTablesFromFilterOnly}';

UPDATE data_insight_chart
SET json = jsonb_set(
        json,
        '{dimensions}',
        '[{"name":"entityFqn","chartDataType":"STRING"},{"name":"entityType","chartDataType":"STRING"},{"name":"owner","chartDataType":"STRING"},{"name":"entityHref","chartDataType":"STRING"}]'
)
WHERE name = 'mostViewedEntities';

DROP TABLE webhook_entity;

CREATE TABLE IF NOT EXISTS alert_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    json JSONB NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS alert_action_def (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    alertActionType VARCHAR(36) GENERATED ALWAYS AS (json ->> 'alertActionType') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    json JSONB NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (name)
);

UPDATE dbservice_entity
SET json = jsonb_set(json, '{connection,config,database}', json#>'{connection,config,databaseSchema}')
where serviceType in ('Db2')
  and json#>'{connection,config,databaseSchema}' is not null;

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,databaseSchema}'
where serviceType in ('Db2');

DELETE from openmetadata_settings where configType = 'activityFeedFilterSetting';

UPDATE ingestion_pipeline_entity
SET json = json::jsonb #- '{sourceConfig,config,dbtConfigSource}';

UPDATE pipeline_service_entity 
SET json = jsonb_set(jsonb_set(json::jsonb #- '{connection,config,configSource}', '{connection,config,token}', json#> '{connection,config,configSource,token}', true) ,'{connection,config,host}', json #> '{connection,config,configSource,host}' , true)
WHERE serviceType = 'Dagster' and json #>'{connection,config,configSource,host}' is not null;


UPDATE pipeline_service_entity
SET json = jsonb_set(json::jsonb #- '{connection,config,configSource}', '{connection,config,host}', json#> '{connection,config,configSource,hostPort}', true)
WHERE servicetype = 'Dagster' and json #>'{connection,config,configSource,hostPort}' is not null;

UPDATE topic_entity
SET json = jsonb_set(json::jsonb #- '{schemaText}', '{messageSchema}', jsonb_build_object('schemaText', json#>'{schemaText}'), true)
WHERE json #> '{schemaText}' IS NOT NULL;

UPDATE topic_entity
SET json = jsonb_set(json::jsonb #- '{schemaType}', '{messageSchema,schemaType}', json#> '{schemaType}', true)
WHERE json #> '{schemaType}' IS NOT NULL;
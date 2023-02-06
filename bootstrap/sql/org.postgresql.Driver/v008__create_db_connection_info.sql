ALTER TABLE tag_category
RENAME TO classification;

-- Rename tagCategoryName in BigQuery for classificationName
UPDATE dbservice_entity
SET json = jsonb_set(json, '{connection,config,classificationName}', json#>'{connection,config,tagCategoryName}')
where serviceType in ('BigQuery')
  and json#>'{connection,config,tagCategoryName}' is not null;

-- Deprecate SampleData db service type
-- * Delete ingestion pipelines associated to the services
DELETE FROM ingestion_pipeline_entity ipe
USING entity_relationship er
WHERE (
    er.toId = ipe.id
    AND fromEntity = 'databaseService'
    AND fromId IN (SELECT id FROM dbservice_entity de WHERE serviceType = 'SampleData')
);
-- * Delete relationships
DELETE FROM entity_relationship er
USING dbservice_entity db
WHERE (db.id = er.fromId OR db.id = er.toId)
  AND db.serviceType = 'SampleData';
-- * Delete services
DELETE FROM dbservice_entity WHERE serviceType = 'SampleData';

-- Delete supportsUsageExtraction from vertica
UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,supportsUsageExtraction}'
WHERE serviceType = 'Vertica';

UPDATE ingestion_pipeline_entity
SET json = json::jsonb #- '{sourceConfig,config,dbtConfigSource,dbtUpdateDescriptions}'
WHERE json#>>'{sourceConfig,config,type}' = 'DBT';

UPDATE test_definition
SET json = jsonb_set(
  json,
  '{supportedDataTypes}',
  '["NUMBER", "INT", "FLOAT", "DOUBLE", "DECIMAL", "TINYINT", "SMALLINT", "BIGINT", "BYTEINT", "TIMESTAMP", "TIMESTAMPZ","DATETIME", "DATE"]',
  false
)
WHERE json->>'name' = 'columnValuesToBeBetween';

UPDATE pipeline_entity
SET json = jsonb_set(
        json,
        '{name}',
        to_jsonb(replace(json ->> 'name',':',''))
    )
WHERE json ->> 'serviceType' = 'Dagster';

UPDATE pipeline_entity
SET json = jsonb_set(
        json,
        '{fullyQualifiedName}',
        to_jsonb(replace(json ->> 'fullyQualifiedName',':',''))
    )
WHERE json ->> 'serviceType' = 'Dagster';

UPDATE dashboard_service_entity  
SET json = JSONB_SET(json::jsonb,
'{connection,config}',json::jsonb #>'{connection,config}' #- '{password}' #- '{username}' #- '{provider}'|| 
jsonb_build_object('connection',jsonb_build_object(
'username',json #>'{connection,config,username}',
'password',json #>'{connection,config,password}',
'provider',json #>'{connection,config,provider}'
)), true)
where servicetype = 'Superset';

CREATE TABLE IF NOT EXISTS query_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    UNIQUE (fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS temp_query_migration (
    tableId VARCHAR(36) NOT NULL,
    queryId VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    json JSONB NOT NULL
);

CREATE EXTENSION pgcrypto;

INSERT INTO temp_query_migration(tableId,json)
SELECT id,json_build_object('id',gen_random_uuid(),'vote',vote,'query',query,'users',users,'checksum',checksum,'duration',duration,'name','table','fullyQualifiedName',CONCAT(checksum, '.', 'table'),'updatedAt',
floor(EXTRACT(EPOCH FROM NOW())),'updatedBy','admin','deleted',false,'entityRefrences',json_build_object('id',id,'type','table')) AS json FROM entity_extension AS ee , jsonb_to_recordset(ee.json) AS x (vote decimal,query varchar,users json,
checksum varchar,duration decimal,queryDate varchar)
WHERE ee.extension = 'table.tableQueries';

INSERT INTO query_entity(json)
SELECT json FROM temp_query_migration;

INSERT INTO entity_relationship(fromId,toId,fromEntity,toEntity,relation)
SELECT tableId,queryId,'table','query',10 FROM temp_query_migration;

DELETE FROM entity_extension WHERE id in
(SELECT DISTINCT tableId FROM temp_query_migration) AND extension = 'table.tableQueries';

DROP TABLE temp_query_migration;

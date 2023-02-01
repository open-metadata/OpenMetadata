RENAME TABLE tag_category TO classification;

-- Rename tagCategoryName in BigQuery for classificationName
UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.tagCategoryName'),
    '$.connection.config.classificationName',
    JSON_EXTRACT(json, '$.connection.config.tagCategoryName')
) where serviceType in ('BigQuery');

-- Deprecate SampleData db service type
-- * Delete ingestion pipelines associated to the services
DELETE ipe
FROM ingestion_pipeline_entity ipe
INNER JOIN entity_relationship er
    ON (
        er.toId = ipe.id
        AND fromEntity = "databaseService"
        AND fromId IN (SELECT id FROM dbservice_entity de WHERE serviceType = 'SampleData')
    );
-- * Delete relationships
DELETE er
FROM entity_relationship er
JOIN dbservice_entity db
  ON db.id = er.fromId
  OR db.id = er.toId
WHERE db.serviceType = 'SampleData';
-- * Delete services
DELETE FROM dbservice_entity where serviceType = 'SampleData';

-- Delete supportsUsageExtraction from vertica
UPDATE dbservice_entity 
SET json = JSON_REMOVE(json, '$.connection.config.supportsUsageExtraction')
WHERE serviceType = 'Vertica';

UPDATE ingestion_pipeline_entity
SET json = JSON_REMOVE(json ,'$.sourceConfig.config.dbtConfigSource.dbtUpdateDescriptions')
WHERE json -> '$.sourceConfig.config.type' = 'DBT';

UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.supportedDataTypes'),
	'$.supportedDataTypes',
	JSON_ARRAY('NUMBER', 'INT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'TINYINT', 'SMALLINT', 'BIGINT', 'BYTEINT', 'TIMESTAMP', 'TIMESTAMPZ','DATETIME', 'DATE')
)
WHERE name = 'columnValuesToBeBetween';

UPDATE pipeline_entity
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.name'),
        '$.name',
		REPLACE(JSON_UNQUOTE(JSON_EXTRACT(json, '$.name')),':','')
    )
WHERE JSON_EXTRACT(json, '$.serviceType') = 'Dagster';

UPDATE pipeline_entity 
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.fullyQualifiedName'),
        '$.fullyQualifiedName',
		REPLACE(JSON_UNQUOTE(JSON_EXTRACT(json, '$.fullyQualifiedName')),':','')
    )
WHERE JSON_EXTRACT(json, '$.serviceType') = 'Dagster';


UPDATE dashboard_service_entity  
SET json = JSON_INSERT(
JSON_REMOVE(json,'$.connection.config.username','$.connection.config.password','$.connection.config.provider'),
'$.connection.config.connection',
JSON_OBJECT(
	'username',JSON_EXTRACT(json,'$.connection.config.username'),
	'password',JSON_EXTRACT(json,'$.connection.config.password'),
	'provider',JSON_EXTRACT(json,'$.connection.config.provider')
	)
)
WHERE serviceType = 'Superset';

CREATE TABLE IF NOT EXISTS query_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fullyQualifiedName') NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    UNIQUE(fullyQualifiedName),
    INDEX name_index (fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS temp_query_migration (
    tableId VARCHAR(36)NOT NULL,
    queryId VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') NOT NULL,
    json JSON NOT NULL
);


INSERT INTO temp_query_migration(tableId,json)
select id,JSON_OBJECT('id',UUID(),'vote',vote,'query',query,'users',users,'checksum',checksum,'duration',duration,'name','table','fullyQualifiedName',CONCAT(checksum, '.', 'table'),'updatedAt','1674566180730','updatedBy','admin','deleted',false) as json from entity_extension d, json_table(d.json, '$[*]' columns (vote double path '$.vote', query varchar(200) path '$.query',users json path '$.users',checksum varchar(200) path '$.checksum',duration double path '$.duration',
queryDate varchar(200) path '$.queryDate')) as j where extension = "table.tableQueries";

INSERT INTO query_entity(json)
select json from temp_query_migration;

INSERT INTO entity_relationship(fromId,toId,fromEntity,toEntity,relation)
select tableId,queryId,"table","query",10 from temp_query_migration;

delete from entity_extension where id in
 (select DISTINCT tableId from temp_query_migration) and extension = "table.tableQueries";

drop table temp_query_migration;
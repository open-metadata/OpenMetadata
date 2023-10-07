RENAME TABLE tag_category TO classification;

-- Rename tagCategoryName in BigQuery for classificationName
UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.tagCategoryName'),
    '$.connection.config.classificationName',
    JSON_EXTRACT(json, '$.connection.config.tagCategoryName')
) where serviceType in ('BigQuery');

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

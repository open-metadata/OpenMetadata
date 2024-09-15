ALTER TABLE tag_category
RENAME TO classification;

-- Rename tagCategoryName in BigQuery for classificationName
UPDATE dbservice_entity
SET json = jsonb_set(json, '{connection,config,classificationName}', json#>'{connection,config,tagCategoryName}')
where serviceType in ('BigQuery')
  and json#>'{connection,config,tagCategoryName}' is not null;

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


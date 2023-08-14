-- Rename includeTempTables in snowflake to includeTransientTables

UPDATE dbservice_entity
SET json = jsonb_set(json::jsonb #- '{connection,config,includeTempTables}', '{connection,config,includeTransientTables}',
json#>'{connection,config,includeTempTables}')
where serviceType in ('Snowflake') and json#>'{connection,config,includeTempTables}' is not null ;


update dbservice_entity
set json = jsonb_set(json::jsonb, '{connection,config,scheme}', '"hive"')
where json#>>'{connection,config,scheme}' in ('impala', 'impala4')
and serviceType = 'Hive';

-- remove the dataModel references from Data Models
UPDATE dashboard_data_model_entity SET json = json #- '{dataModels}';

-- migrate ingestAllDatabases in mssql
UPDATE dbservice_entity de2 
SET json = JSONB_SET(
    json || JSONB_SET(json,'{connection,config}', json#>'{connection,config}'|| 
    jsonb_build_object('database',
    (SELECT json->>'name' 
        FROM database_entity de 
        WHERE id = (SELECT er.toId 
                    FROM entity_relationship er 
                    WHERE er.fromId = de2.id 
                    AND er.toEntity = 'database' 
                    LIMIT 1)
    )
    )), 
    '{connection,config,ingestAllDatabases}', 
    'true'::jsonb
)
WHERE de2.serviceType = 'Mssql' 
AND json->>'{connection,config,database}' IS NULL;

-- remove keyfile from clickhouse
UPDATE dbservice_entity
SET json = json #-'{connection,config,keyfile}'
WHERE serviceType = 'Clickhouse';

-- Clean old test connections
TRUNCATE automations_workflow;

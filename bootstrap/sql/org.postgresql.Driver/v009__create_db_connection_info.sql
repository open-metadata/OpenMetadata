-- Unique constraint for user email address
ALTER TABLE user_entity
ADD UNIQUE (email);


-- Remove classificationName in BigQuery
UPDATE dbservice_entity SET json = json #- '{connection,config,classificationName}' where serviceType in ('BigQuery');

-- migrate ingestAllDatabases in postgres 
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
WHERE de2.serviceType = 'Postgres' 
AND json->>'{connection,config,database}' IS NULL;

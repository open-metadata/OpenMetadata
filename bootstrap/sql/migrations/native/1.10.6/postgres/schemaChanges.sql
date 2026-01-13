-- Migrate Airbyte connections from flat username/password to auth object structure
UPDATE pipeline_service_entity
SET json = jsonb_set(
    json #- '{connection,config,username}' #- '{connection,config,password}',
    '{connection,config,auth}',
    jsonb_build_object(
        'username', json#>>'{connection,config,username}',
        'password', json#>>'{connection,config,password}'
    ),
    true
)
WHERE json->>'serviceType' = 'Airbyte';
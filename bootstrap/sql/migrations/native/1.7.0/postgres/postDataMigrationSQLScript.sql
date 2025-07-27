UPDATE test_case
SET json = json || jsonb_build_object('createdBy', json->>'updatedBy')
WHERE json->>'createdBy' IS NULL;

-- Made httpPath a required field for Databricks, updating records 
-- where httpPath is NULL or missing to an empty string.  
UPDATE
    dbservice_entity
SET
    json = jsonb_set(
        json,
        '{connection,config,httpPath}',
        '""' :: jsonb,
        true
    )
WHERE
    serviceType = 'Databricks'
    AND (
        NOT jsonb_path_exists(json, '$.connection.config.httpPath')
        OR (json -> 'connection' -> 'config' ->> 'httpPath') IS NULL
        OR (json -> 'connection' -> 'config' ->> 'httpPath') = 'null'
    );
    
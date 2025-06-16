UPDATE test_case
SET json = json_set(json, '$.createdBy', json->>'$.updatedBy')
WHERE json->>'$.createdBy' IS NULL;

-- Made httpPath a required field for Databricks, updating records 
-- where httpPath is NULL or missing to an empty string.
UPDATE
    dbservice_entity
SET
    json = JSON_SET(json, '$.connection.config.httpPath', '')
WHERE
    serviceType = 'Databricks'
    AND (
        JSON_CONTAINS_PATH(json, 'one', '$.connection.config.httpPath') = 0
        OR JSON_UNQUOTE(json ->> '$.connection.config.httpPath') IS NULL
        OR json ->> '$.connection.config.httpPath' = 'null'
    );
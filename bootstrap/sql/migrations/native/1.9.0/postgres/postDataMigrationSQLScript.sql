UPDATE test_definition 
SET json = jsonb_set(json, '{supportsRowLevelPassedFailed}', 'true'::jsonb)
WHERE json->>'name' = 'tableCustomSQLQuery';

UPDATE test_definition
SET json = jsonb_set(
    json,
    '{parameterDefinition}',
    (json->'parameterDefinition') || jsonb_build_object(
        'name', 'partitionExpression',
        'displayName', 'Partition Expression',
        'description', 'Partition expression that will be used to compute the passed/failed row count, if compute row count is enabled.',
        'dataType', 'STRING',
        'required', false
    )
)
WHERE json->>'name' = 'tableCustomSQLQuery'
AND NOT EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(json->'parameterDefinition') AS elem
    WHERE elem->>'name' = 'partitionExpression'
);

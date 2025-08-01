UPDATE test_definition 
SET json = JSON_SET(json, '$.supportsRowLevelPassedFailed', true)
WHERE JSON_EXTRACT(json, '$.name') = 'tableCustomSQLQuery';

UPDATE test_definition 
SET json = JSON_ARRAY_APPEND(
    json, 
    '$.parameterDefinition',
    JSON_OBJECT(
        'name', 'partitionExpression',
        'displayName', 'Partition Expression',
        'description', 'Partition expression that will be used to compute the passed/failed row count, if compute row count is enabled (e.g. created_date > DATE_SUB(CURDATE(), INTERVAL 1 DAY)).',
        'dataType', 'STRING',
        'required', false
    )
)
WHERE JSON_EXTRACT(json, '$.name') = 'tableCustomSQLQuery'
AND NOT JSON_CONTAINS(JSON_EXTRACT(json, '$.parameterDefinition[*].name'),'"partitionExpression"');

-- matchEnum Test Definition Parameter for columnValuesToBeInSet
UPDATE test_definition
set json = JSON_MERGE_PRESERVE(
	json,
    '{"parameterDefinition": ['
    '{"name": "matchEnum", "displayName": "Match enum", "description": "If enabled, validate that each value independently matches the enum.", "dataType": "BOOLEAN", "required": false, "optionValues": []}'
    ']}'
)
WHERE name = 'columnValuesToBeInSet'
AND JSON_LENGTH(json, '$.parameterDefinition') < 2;

-- Test Case dyanic test migration
UPDATE test_definition
SET json = JSON_SET(json, '$.supportsDynamicAssertion', true)
WHERE name IN (
	'columnValueMaxToBeBetween',
    'columnValueMeanToBeBetween',
    'columnValueMedianToBeBetween',
    'columnValueMinToBeBetween',
    'columnValueStdDevToBeBetween',
    'columnValuesLengthsToBeBetween',
    'columnValuesSumToBeBetween',
    'columnValuesToBeBetween',
    'tableRowCountToBeBetween'
);

-- Remove Duplicate Usernames and Lowercase Them
WITH cte AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY LOWER(JSON_UNQUOTE(JSON_EXTRACT(json, '$.name'))) ORDER BY id) as rn
    FROM 
        user_entity
)
DELETE FROM user_entity
WHERE id IN (
    SELECT id
    FROM cte
    WHERE rn > 1
);

UPDATE user_entity
SET json = JSON_SET(
    json,
    '$.name',
    LOWER(JSON_UNQUOTE(JSON_EXTRACT(json, '$.name')))
);

-- Remove Duplicate Emails and Lowercase Them
WITH cte AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY LOWER(JSON_UNQUOTE(JSON_EXTRACT(json, '$.email'))) ORDER BY id) as rn
    FROM 
        user_entity
)
DELETE FROM user_entity
WHERE id IN (
    SELECT id
    FROM cte
    WHERE rn > 1
);

UPDATE user_entity
SET json = JSON_SET(
    json,
    '$.email',
    LOWER(JSON_UNQUOTE(JSON_EXTRACT(json, '$.email')))
);

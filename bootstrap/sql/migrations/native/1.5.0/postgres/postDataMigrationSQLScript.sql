-- matchEnum Test Definition Parameter for columnValuesToBeInSet
UPDATE test_definition
SET json = jsonb_set(json, '{parameterDefinition}', json->'parameterDefinition' || '['
    '{"name": "matchEnum", "displayName": "Match enum", "description": "If enabled, validate that each value independently matches the enum.", "dataType": "BOOLEAN", "required": false, "optionValues": []}'
    ']'::jsonb
)
WHERE name = 'columnValuesToBeInSet'
AND JSONB_ARRAY_LENGTH(json->'parameterDefinition') < 2;


-- Test Case dyanic test migration
UPDATE test_definition
SET json = JSONB_SET(json, '{supportsDynamicAssertion}', 'true', true)
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

-- Remove Duplicate UserNames and lowercase them
WITH cte AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY to_jsonb(LOWER(json->>'name')) ORDER BY id) as rn
    FROM 
        user_entity
)
DELETE from user_entity
WHERE id IN (
    SELECT id
    FROM cte
    WHERE rn > 1
);

UPDATE user_entity
SET json = jsonb_set(
    json,
    '{name}',
    to_jsonb(LOWER(json->>'name'))
);

-- Remove Duplicate Emails and lowercase them
WITH cte AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY to_jsonb(LOWER(json->>'email')) ORDER BY id) as rn
    FROM 
        user_entity
)
DELETE from user_entity
WHERE id IN (
    SELECT id
    FROM cte
    WHERE rn > 1
);

UPDATE user_entity
SET json = jsonb_set(
    json,
    '{email}',
    to_jsonb(LOWER(json->>'email'))
);

-- DROP entityId column from thread_entity table
ALTER TABLE thread_entity DROP COLUMN entityId;

-- Add entityRef column to thread_entity table
UPDATE thread_entity
SET json = jsonb_set(
    json - 'entityId' - 'entityType',
    '{entityRef}',
    jsonb_build_object(
        'id', json->>'entityId',
        'type', json->>'entityType'
    ),
    true
)
WHERE jsonb_exists(json, 'entityId') OR jsonb_exists(json, 'entityType');

-- Add entityId and type column to thread_entity table
ALTER TABLE thread_entity ADD COLUMN entityId VARCHAR(36) GENERATED ALWAYS AS (json->'entityRef'->>'id') STORED;
ALTER TABLE thread_entity ADD COLUMN entityType VARCHAR(36) GENERATED ALWAYS AS (json->'entityRef'->>'type') STORED;

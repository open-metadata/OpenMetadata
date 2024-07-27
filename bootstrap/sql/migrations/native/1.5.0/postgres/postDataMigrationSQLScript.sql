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
    'columnValueLengthsToBeBetween',
    'columnValuesSumToBeBetween',
    'columnValuesToBeBetween',
    'tableRowCountToBeBetween'
);

-- Update schedule type for applications
UPDATE installed_apps
SET json = json || '{"scheduleType": "ScheduledOrManual"}'
WHERE json->>'scheduleType' = 'Scheduled';

-- recreate all scheduled apps
DELETE FROM apps_marketplace
WHERE json->>'scheduleType' = 'Scheduled';
-- matchEnum Test Definition Parameter for columnValuesToBeInSet 
UPDATE test_definition
SET json = jsonb_set(json, '{parameterDefinition}', json->'parameterDefinition' || '['
    '{"name": "matchEnum", "displayName": "Match enum", "description": "If enabled, validate that each value independently matches the enum.", "dataType": "BOOLEAN", "required": false, "optionValues": []}'
    ']'::jsonb
)
WHERE name = 'columnValuesToBeInSet'
AND JSONB_ARRAY_LENGTH(json->'parameterDefinition') < 2;

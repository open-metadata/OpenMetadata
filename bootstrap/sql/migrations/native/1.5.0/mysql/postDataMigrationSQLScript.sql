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


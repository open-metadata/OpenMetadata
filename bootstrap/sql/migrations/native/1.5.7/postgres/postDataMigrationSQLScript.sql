UPDATE test_definition
SET json = jsonb_set(
        json,
        '{parameterDefinition}',
        (json->'parameterDefinition')::jsonb || 
        '{"name": "caseSensitiveColumns", "dataType": "BOOLEAN", "required": false, "description": "Use case sensitivity when comparing the columns.", "displayName": "Case sensitive columns"}'::jsonb
    )
WHERE name = 'tableDiff';

UPDATE test_definition
SET json = JSON_MERGE_PRESERVE(
        json,
        JSON_OBJECT(
            'parameterDefinition',
            JSON_ARRAY(
                JSON_OBJECT(
                    'name', 'caseSensitiveColumns',
                    'dataType', 'BOOLEAN',
                    'required', false,
                    'description', 'Use case sensitivity when comparing the columns.',
                    'displayName', 'Case sensitive columns'
                )
            )
        )
    )
WHERE name = 'tableDiff';

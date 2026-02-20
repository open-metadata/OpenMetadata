-- Correct the table diff test definition
-- This is to include the new parameter table2.keyColumns
UPDATE test_definition
SET json = JSON_SET(
        json,
        '$.parameterDefinition',
        JSON_ARRAY(
                JSON_OBJECT(
                        'name', 'keyColumns',
                        'displayName', 'Table 1''s key columns',
            'description', 'The columns to use as the key for the comparison. If not provided, it will be resolved from the primary key or unique columns. The tuples created from the key columns must be unique.',
            'dataType', 'ARRAY',
            'required', false
        ),
        JSON_OBJECT(
            'name', 'table2',
            'displayName', 'Table 2',
            'description', 'Fully qualified name of the table to compare against.',
            'dataType', 'STRING',
            'required', true
        ),
        JSON_OBJECT(
            'name', 'table2.keyColumns',
            'displayName', 'Table 2''s key columns',
                        'description', 'The columns in table 2 to use as comparison. If not provided, it will default to `Key Columns`, risking errors if the key columns'' names have changed.',
            'dataType', 'ARRAY',
            'required', false
        ),
        JSON_OBJECT(
            'name', 'threshold',
            'displayName', 'Threshold',
            'description', 'Threshold to use to determine if the test passes or fails (defaults to 0).',
            'dataType', 'NUMBER',
            'required', false
        ),
        JSON_OBJECT(
            'name', 'useColumns',
            'displayName', 'Use Columns',
            'description', 'Limits the scope of the test to this list of columns. If not provided, all columns will be used except the key columns.',
            'dataType', 'ARRAY',
            'required', false
        ),
        JSON_OBJECT(
            'name', 'where',
            'displayName', 'SQL Where Clause',
            'description', 'Use this where clause to filter the rows to compare.',
            'dataType', 'STRING',
            'required', false
        ),
        JSON_OBJECT(
            'name', 'caseSensitiveColumns',
            'displayName', 'Case sensitive columns',
            'description', 'Use case sensitivity when comparing the columns.',
            'dataType', 'BOOLEAN',
            'required', false
        )
    ),
    '$.version',
    0.2
)
WHERE name = 'tableDiff';

-- Update DataRetentionApplication add profileDataRetentionPeriod and testCaseResultsRetentionPeriod
UPDATE installed_apps
SET json = JSON_SET(
    json,
    '$.appConfiguration.testCaseResultsRetentionPeriod', 1440,
    '$.appConfiguration.profileDataRetentionPeriod', 1440
)
WHERE JSON_EXTRACT(json, '$.name') = 'DataRetentionApplication';

UPDATE notification_template_entity
SET json = JSON_REMOVE(json, '$.defaultTemplateChecksum')
WHERE JSON_CONTAINS_PATH(json, 'one', '$.defaultTemplateChecksum');

-- Update appType from 'internal' to 'external' and add sourcePythonClass for CollateAIQualityAgentApplication and CollateAITierAgentApplication
UPDATE apps_marketplace
SET json = JSON_SET(
    JSON_SET(
        json,
        '$.appType',
        'external'
    ),
    '$.sourcePythonClass',
    'metadata.applications.dynamic_agent.app.DynamicAgentApp'
)
WHERE json->>'$.name' IN  ('CollateAIQualityAgentApplication', 'CollateAITierAgentApplication')
    AND json->>'$.appType' = 'internal' AND json->>'$.sourcePythonClass' IS NULL;

-- Update appType from 'internal' to 'external' and add sourcePythonClass for CollateAITierAgentApplication and CollateAIQualityAgentApplication
UPDATE installed_apps
SET json = JSON_SET(
    json,
    '$.appType', 'external',
    '$.sourcePythonClass', 'metadata.applications.dynamic_agent.app.DynamicAgentApp'
)
WHERE json->>'$.name' IN ('CollateAITierAgentApplication', 'CollateAIQualityAgentApplication')
  AND json->>'$.appType' = 'internal' AND json->>'$.sourcePythonClass' IS NULL;
  
-- Remove bot form App entity    
UPDATE installed_apps SET json = JSON_REMOVE(json, '$.bot') WHERE JSON_CONTAINS_PATH(json, 'one', '$.bot');

-- Remove SearchIndexingApplication past runs
delete from apps_extension_time_series where appname = 'SearchIndexingApplication';

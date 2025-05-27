UPDATE test_definition
SET json = JSON_ARRAY_INSERT(
    json,                     
    '$.parameterDefinition[2]',   
    JSON_OBJECT(                  
        'name', 'operator',
        'displayName', 'Operator',
        'description', 'Operator to use to compare the result of the custom SQL query to the threshold.',
        'dataType', 'STRING',
        'required', false,
        'optionValues', JSON_ARRAY('==', '>', '>=', '<', '<=', '!=')
    )
)
WHERE NOT JSON_CONTAINS(
    JSON_EXTRACT(json, '$.parameterDefinition[*].name'),
    JSON_QUOTE('operator')
  ) AND name = 'tableCustomSQLQuery';

UPDATE dashboard_service_entity
SET json = JSON_REMOVE(
    json,
    '$.connection.config.siteUrl',
    '$.connection.config.apiVersion',
    '$.connection.config.env'
)
WHERE serviceType = 'Tableau';

-- Add runtime: enabled for AutoPilot
UPDATE apps_marketplace
SET json =
    CASE
        WHEN JSON_EXTRACT(json, '$.runtime') IS NULL THEN
            JSON_MERGE_PATCH(json, JSON_OBJECT('runtime', JSON_OBJECT('enabled', true)))
        ELSE
            JSON_SET(json, '$.runtime.enabled', true)
    END
WHERE name = 'AutoPilotApplication';

-- Update workflow settings with default values if present
UPDATE openmetadata_settings
SET json = JSON_SET(
    json,
    '$.executorConfiguration.corePoolSize', 10,
    '$.executorConfiguration.maxPoolSize', 20,
    '$.executorConfiguration.jobLockTimeInMillis', 1296000000
)
WHERE configType = 'workflowSettings';

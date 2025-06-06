UPDATE test_definition
SET
  json = jsonb_insert(
    json,                           
    '{parameterDefinition, 2}',     
    jsonb_build_object(
        'name', 'operator',
        'displayName', 'Operator',
        'description', 'Operator to use to compare the result of the custom SQL query to the threshold.',
        'dataType', 'STRING',
        'required', false,
        'optionValues', jsonb_build_array('==', '>', '>=', '<', '<=', '!=')
    )
  )
WHERE
  name = 'tableCustomSQLQuery'
  AND NOT jsonb_path_exists(
    json,                                           
    '$.parameterDefinition[*] ? (@.name == "operator")' 
  );

UPDATE dashboard_service_entity
SET json = jsonb_set(
    json,
    '{connection,config}',
    (json->'connection'->'config') - 'siteUrl' - 'apiVersion' - 'env'
)
WHERE serviceType = 'Tableau'
  AND json ?? 'connection'
  AND json->'connection' ?? 'config';

-- Add runtime: enabled for AutoPilot
UPDATE apps_marketplace
SET json =
  CASE
    WHEN json::jsonb -> 'runtime' IS NULL THEN
      jsonb_set(
        json::jsonb,
        '{runtime}',
        jsonb_build_object('enabled', true),
        true
      )
    ELSE
      jsonb_set(
        json::jsonb,
        '{runtime,enabled}',
        'true',
        true
      )
  END
WHERE name = 'AutoPilotApplication';

-- Update workflow settings with default values if present
UPDATE openmetadata_settings
SET json = jsonb_set(
              jsonb_set(
                jsonb_set(
                  json,
                  '{executorConfiguration,corePoolSize}',
                  '10',
                  true
                ),
                '{executorConfiguration,maxPoolSize}',
                '20',
                true
              ),
              '{executorConfiguration,jobLockTimeInMillis}',
              '1296000000',
              true
           )
WHERE configType = 'workflowSettings';

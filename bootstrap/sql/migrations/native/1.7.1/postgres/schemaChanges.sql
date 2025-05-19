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
    jsonb_set(
        json,
        '{connection,config}',
        (json->'connection'->'config') - 'siteUrl' - 'apiVersion' - 'env'
    ),
    '{connection}',
    json->'connection'
)
WHERE serviceType = 'Tableau';

-- Update workflow definitions to add storeStageStatus field in config if config doesn't exist
UPDATE workflow_definition_entity 
SET json = jsonb_set(
    json::jsonb,
    '{config}',
    '{"storeStageStatus": false}'::jsonb,
    true
)
WHERE NOT json::jsonb ? 'config';

-- Update workflow definitions to add storeStageStatus field in config if config exists but field doesn't
UPDATE workflow_definition_entity 
SET json = jsonb_set(
    json::jsonb,
    '{config,storeStageStatus}',
    'false'::jsonb,
    true
)
WHERE json::jsonb ? 'config' 
AND NOT json::jsonb->'config' ? 'storeStageStatus';

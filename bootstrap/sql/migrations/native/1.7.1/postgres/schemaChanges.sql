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

-- Add runtime: enabled for AutoPilot
UPDATE apps_marketplace
SET json = jsonb_set(
	json::jsonb,
	'{runtime,enabled}',
	'true'
)
where name = 'AutoPilotApplication';
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
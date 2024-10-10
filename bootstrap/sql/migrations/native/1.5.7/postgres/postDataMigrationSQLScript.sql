-- Add caseSensitiveColumns to tableDiff
UPDATE test_definition
SET json = jsonb_set(
 json,
 '{parameterDefinition}',
 (json->'parameterDefinition') || jsonb_build_array(
  jsonb_build_object(
   'name', 'caseSensitiveColumns',
   'dataType', 'BOOLEAN',
   'required', false,
   'description', 'Use case sensitivity when comparing the columns. (default: true)',
   'displayName', 'Case sensitive columns',
   'optionValues', jsonb_build_array()
  )
 )
)
WHERE name = 'tableDiff';
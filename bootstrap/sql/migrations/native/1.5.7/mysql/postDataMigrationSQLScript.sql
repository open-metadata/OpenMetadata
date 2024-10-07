-- Add caseSensitiveColumns to tableDiff
UPDATE test_definition
SET json = JSON_ARRAY_APPEND(
 json,
 '$.parameterDefinition',
 JSON_OBJECT(
  'name', 'caseSensitiveColumns',
  'dataType', 'BOOLEAN',
  'required', false,
  'description', 'Use case sensitivity when comparing the columns. (default: true)',
  'displayName', 'Case sensitive columns'
  'optionValues', JSON_ARRAY()
 )
)
WHERE name = 'tableDiff';

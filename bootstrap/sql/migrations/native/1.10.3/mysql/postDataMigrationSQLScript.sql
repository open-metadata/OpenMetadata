UPDATE test_definition
SET json = JSON_ARRAY_INSERT(
    json,
    CONCAT('$.supportedDataTypes[', JSON_LENGTH(json, '$.supportedDataTypes'), ']'),
    'NUMERIC'
)
WHERE JSON_CONTAINS(json->'$.supportedDataTypes', '"NUMBER"')
  AND NOT JSON_CONTAINS(json->'$.supportedDataTypes', '"NUMERIC"');

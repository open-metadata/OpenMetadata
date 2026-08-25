-- Add LOWCARDINALITY to supportedDataTypes for test definitions that already support STRING
UPDATE test_definition
SET json = JSON_ARRAY_APPEND(json, '$.supportedDataTypes', 'LOWCARDINALITY')
WHERE name = 'columnValueLengthsToBeBetween'
  AND JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedDataTypes'), '"STRING"')
  AND NOT JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedDataTypes'), '"LOWCARDINALITY"');

UPDATE test_definition
SET json = JSON_ARRAY_APPEND(json, '$.supportedDataTypes', 'LOWCARDINALITY')
WHERE name = 'columnValuesMissingCount'
  AND JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedDataTypes'), '"STRING"')
  AND NOT JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedDataTypes'), '"LOWCARDINALITY"');

UPDATE test_definition
SET json = JSON_ARRAY_APPEND(json, '$.supportedDataTypes', 'LOWCARDINALITY')
WHERE name = 'columnValuesToBeInSet'
  AND JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedDataTypes'), '"STRING"')
  AND NOT JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedDataTypes'), '"LOWCARDINALITY"');

UPDATE test_definition
SET json = JSON_ARRAY_APPEND(json, '$.supportedDataTypes', 'LOWCARDINALITY')
WHERE name = 'columnValuesToBeNotInSet'
  AND JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedDataTypes'), '"STRING"')
  AND NOT JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedDataTypes'), '"LOWCARDINALITY"');

UPDATE test_definition
SET json = JSON_ARRAY_APPEND(json, '$.supportedDataTypes', 'LOWCARDINALITY')
WHERE name = 'columnValuesToBeNotNull'
  AND JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedDataTypes'), '"STRING"')
  AND NOT JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedDataTypes'), '"LOWCARDINALITY"');

UPDATE test_definition
SET json = JSON_ARRAY_APPEND(json, '$.supportedDataTypes', 'LOWCARDINALITY')
WHERE name = 'columnValuesToBeUnique'
  AND JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedDataTypes'), '"STRING"')
  AND NOT JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedDataTypes'), '"LOWCARDINALITY"');

UPDATE test_definition
SET json = JSON_ARRAY_APPEND(json, '$.supportedDataTypes', 'LOWCARDINALITY')
WHERE name = 'columnValuesToMatchRegex'
  AND JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedDataTypes'), '"STRING"')
  AND NOT JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedDataTypes'), '"LOWCARDINALITY"');

UPDATE test_definition
SET json = JSON_ARRAY_APPEND(json, '$.supportedDataTypes', 'LOWCARDINALITY')
WHERE name = 'columnValuesToNotMatchRegex'
  AND JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedDataTypes'), '"STRING"')
  AND NOT JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedDataTypes'), '"LOWCARDINALITY"');

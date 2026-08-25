-- Add LOWCARDINALITY to supportedDataTypes for test definitions that already support STRING
UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{supportedDataTypes}',
    (json->'supportedDataTypes')::jsonb || '["LOWCARDINALITY"]'::jsonb
)
WHERE name = 'columnValueLengthsToBeBetween'
  AND json->'supportedDataTypes' @> '"STRING"'::jsonb
  AND NOT json->'supportedDataTypes' @> '"LOWCARDINALITY"'::jsonb;

UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{supportedDataTypes}',
    (json->'supportedDataTypes')::jsonb || '["LOWCARDINALITY"]'::jsonb
)
WHERE name = 'columnValuesMissingCount'
  AND json->'supportedDataTypes' @> '"STRING"'::jsonb
  AND NOT json->'supportedDataTypes' @> '"LOWCARDINALITY"'::jsonb;

UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{supportedDataTypes}',
    (json->'supportedDataTypes')::jsonb || '["LOWCARDINALITY"]'::jsonb
)
WHERE name = 'columnValuesToBeInSet'
  AND json->'supportedDataTypes' @> '"STRING"'::jsonb
  AND NOT json->'supportedDataTypes' @> '"LOWCARDINALITY"'::jsonb;

UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{supportedDataTypes}',
    (json->'supportedDataTypes')::jsonb || '["LOWCARDINALITY"]'::jsonb
)
WHERE name = 'columnValuesToBeNotInSet'
  AND json->'supportedDataTypes' @> '"STRING"'::jsonb
  AND NOT json->'supportedDataTypes' @> '"LOWCARDINALITY"'::jsonb;

UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{supportedDataTypes}',
    (json->'supportedDataTypes')::jsonb || '["LOWCARDINALITY"]'::jsonb
)
WHERE name = 'columnValuesToBeNotNull'
  AND json->'supportedDataTypes' @> '"STRING"'::jsonb
  AND NOT json->'supportedDataTypes' @> '"LOWCARDINALITY"'::jsonb;

UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{supportedDataTypes}',
    (json->'supportedDataTypes')::jsonb || '["LOWCARDINALITY"]'::jsonb
)
WHERE name = 'columnValuesToBeUnique'
  AND json->'supportedDataTypes' @> '"STRING"'::jsonb
  AND NOT json->'supportedDataTypes' @> '"LOWCARDINALITY"'::jsonb;

UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{supportedDataTypes}',
    (json->'supportedDataTypes')::jsonb || '["LOWCARDINALITY"]'::jsonb
)
WHERE name = 'columnValuesToMatchRegex'
  AND json->'supportedDataTypes' @> '"STRING"'::jsonb
  AND NOT json->'supportedDataTypes' @> '"LOWCARDINALITY"'::jsonb;

UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{supportedDataTypes}',
    (json->'supportedDataTypes')::jsonb || '["LOWCARDINALITY"]'::jsonb
)
WHERE name = 'columnValuesToNotMatchRegex'
  AND json->'supportedDataTypes' @> '"STRING"'::jsonb
  AND NOT json->'supportedDataTypes' @> '"LOWCARDINALITY"'::jsonb;

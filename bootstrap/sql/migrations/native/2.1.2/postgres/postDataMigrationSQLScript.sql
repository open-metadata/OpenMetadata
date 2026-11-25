-- Offer Table Diff on Vertica.
-- tableDiff.json gained Vertica, but test definitions are seed data and
-- initializeEntity() skips a row that already exists, so an upgraded deployment
-- keeps its previous list. An empty list already means "every service", so leave
-- it alone rather than narrowing it to one.
UPDATE test_definition
SET json = jsonb_set(json, '{supportedServices}',
                     (json->'supportedServices') || '["Vertica"]'::jsonb)
WHERE name = 'tableDiff'
  AND CASE
        WHEN jsonb_typeof(json->'supportedServices') = 'array'
        THEN jsonb_array_length(json->'supportedServices') > 0
             AND NOT (json->'supportedServices') @> '["Vertica"]'::jsonb
        ELSE FALSE
      END;

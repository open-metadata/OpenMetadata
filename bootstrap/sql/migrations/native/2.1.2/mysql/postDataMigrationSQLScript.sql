-- Offer Table Diff on Vertica.
-- tableDiff.json gained Vertica, but test definitions are seed data and
-- initializeEntity() skips a row that already exists, so an upgraded deployment
-- keeps its previous list. An empty list already means "every service", so leave
-- it alone rather than narrowing it to one.
UPDATE test_definition
SET json = JSON_ARRAY_APPEND(json, '$.supportedServices', 'Vertica')
WHERE name = 'tableDiff'
  AND JSON_TYPE(JSON_EXTRACT(json, '$.supportedServices')) = 'ARRAY'
  AND JSON_LENGTH(JSON_EXTRACT(json, '$.supportedServices')) > 0
  AND NOT JSON_CONTAINS(JSON_EXTRACT(json, '$.supportedServices'), JSON_QUOTE('Vertica'));

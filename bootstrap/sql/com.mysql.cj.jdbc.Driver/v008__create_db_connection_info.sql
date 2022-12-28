RENAME TABLE tag_category TO classification;

-- Rename tagCategoryName in BigQuery for classificationName
UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.tagCategoryName'),
    '$.connection.config.classificationName',
    JSON_EXTRACT(json, '$.connection.config.tagCategoryName')
) where serviceType in ('BigQuery');

-- Deprecate SampleData db service type
DELETE er
FROM entity_relationship er
JOIN dbservice_entity db
  ON db.id = er.fromId
  OR db.id = er.toId
WHERE db.serviceType = 'SampleData';

DELETE FROM dbservice_entity where serviceType = 'SampleData';

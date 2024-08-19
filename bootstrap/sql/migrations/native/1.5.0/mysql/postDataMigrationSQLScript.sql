-- matchEnum Test Definition Parameter for columnValuesToBeInSet
UPDATE test_definition
set json = JSON_MERGE_PRESERVE(
	json,
    '{"parameterDefinition": ['
    '{"name": "matchEnum", "displayName": "Match enum", "description": "If enabled, validate that each value independently matches the enum.", "dataType": "BOOLEAN", "required": false, "optionValues": []}'
    ']}'
)
WHERE name = 'columnValuesToBeInSet'
AND JSON_LENGTH(json, '$.parameterDefinition') < 2;

-- Test Case dyanic test migration
UPDATE test_definition
SET json = JSON_SET(json, '$.supportsDynamicAssertion', true)
WHERE name IN (
	'columnValueMaxToBeBetween',
    'columnValueMeanToBeBetween',
    'columnValueMedianToBeBetween',
    'columnValueMinToBeBetween',
    'columnValueStdDevToBeBetween',
    'columnValueLengthsToBeBetween',
    'columnValuesSumToBeBetween',
    'columnValuesToBeBetween',
    'tableRowCountToBeBetween'
);


-- KPI Migrations
UPDATE entity_relationship
SET    toid = (SELECT id
               FROM   di_chart_entity
               WHERE  NAME = 'percentage_of_data_asset_with_owner_kpi'),
       toentity = 'dataInsightCustomChart'
WHERE  toid = (SELECT id
               FROM   data_insight_chart dic
               WHERE  NAME = 'PercentageOfEntitiesWithOwnerByType')
       AND fromId IN (SELECT id from kpi_entity WHERE JSON_EXTRACT(json, '$.metricType') = 'PERCENTAGE')
       AND toentity = 'dataInsightChart'
       AND fromentity = 'kpi';


UPDATE entity_relationship
SET    toid = (SELECT id
               FROM   di_chart_entity
               WHERE  NAME = 'number_of_data_asset_with_owner_kpi'),
       toentity = 'dataInsightCustomChart'
WHERE  toid = (SELECT id
               FROM   data_insight_chart dic
               WHERE  NAME = 'PercentageOfEntitiesWithOwnerByType')
       AND fromId IN (SELECT id from kpi_entity WHERE JSON_EXTRACT(json, '$.metricType') = 'NUMBER')
       AND toentity = 'dataInsightChart'
       AND fromentity = 'kpi';


UPDATE entity_relationship
SET    toid = (SELECT id
               FROM   di_chart_entity
               WHERE  NAME = 'percentage_of_data_asset_with_description_kpi'),
       toentity = 'dataInsightCustomChart'
WHERE  toid = (SELECT id
               FROM   data_insight_chart dic
               WHERE  NAME = 'PercentageOfEntitiesWithDescriptionByType')
       AND fromId IN (SELECT id from kpi_entity WHERE JSON_EXTRACT(json, '$.metricType') = 'PERCENTAGE')
       AND toentity = 'dataInsightChart'
       AND fromentity = 'kpi';


UPDATE entity_relationship
SET    toid = (SELECT id
               FROM   di_chart_entity
               WHERE  NAME = 'number_of_data_asset_with_description_kpi'),
       toentity = 'dataInsightCustomChart'
WHERE  toid = (SELECT id
               FROM   data_insight_chart dic
               WHERE  NAME = 'PercentageOfEntitiesWithDescriptionByType')
       AND fromId IN (SELECT id from kpi_entity WHERE JSON_EXTRACT(json, '$.metricType') = 'NUMBER')
       AND toentity = 'dataInsightChart'
       AND fromentity = 'kpi';
-- KPI MIgrations end

-- Update schedule type for applications
UPDATE installed_apps
SET json = JSON_MERGE_PATCH(json, '{"scheduleType": "ScheduledOrManual"}')
WHERE JSON_UNQUOTE(json->'$.scheduleType') = 'Scheduled';

-- recreate all scheduled apps
DELETE FROM apps_marketplace
WHERE JSON_UNQUOTE(json->'$.scheduleType') = 'Scheduled';

ALTER table thread_entity DROP COLUMN entityId;

-- Add entityRef column to thread_entity table
UPDATE thread_entity
SET json = JSON_SET(
    JSON_REMOVE(
        JSON_REMOVE(json, '$.entityId'),
        '$.entityType'
    ),
    '$.entityRef',
    JSON_OBJECT(
        'id', JSON_UNQUOTE(JSON_EXTRACT(json, '$.entityId')),
        'type', JSON_UNQUOTE(JSON_EXTRACT(json, '$.entityType'))
    )
)
WHERE JSON_CONTAINS_PATH(json, 'one', '$.entityId') OR JSON_CONTAINS_PATH(json, 'one', '$.entityType');

-- Add entityId and type column to thread_entity table
ALTER table thread_entity ADD COLUMN entityId VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.entityRef.id');
ALTER table thread_entity ADD COLUMN entityType VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.entityRef.type');


UPDATE test_definition
SET json = JSON_SET(json, '$.supportedDataTypes', JSON_ARRAY('NUMBER',  'TINYINT',  'SMALLINT',  'INT',  'BIGINT',  'BYTEINT',  'BYTES',  'FLOAT',  'DOUBLE',  'DECIMAL',  'NUMERIC',  'TIMESTAMP',  'TIMESTAMPZ',  'TIME',  'DATE',  'DATETIME',  'INTERVAL',  'STRING',  'MEDIUMTEXT',  'TEXT',  'CHAR',  'VARCHAR',  'BOOLEAN',  'BINARY',  'VARBINARY',  'BLOB',  'LONGBLOB',  'MEDIUMBLOB',  'MAP',  'STRUCT',  'UNION',  'SET',  'GEOGRAPHY',  'ENUM',  'UUID',  'VARIANT',  'GEOMETRY',  'POINT',  'POLYGON'))
WHERE name = 'columnValuesToBeUnique';
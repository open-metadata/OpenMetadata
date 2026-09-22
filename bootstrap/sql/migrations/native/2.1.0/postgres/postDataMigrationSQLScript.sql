-- Backfill test_case_incident from existing history: fold each stateId chain to its
-- first/last timestamps, pick the latest record (MAX(id) tie-break, matching the read
-- query this table replaces), and upsert one summary row per incident. Idempotent.
INSERT INTO test_case_incident (stateId, entityFQNHash, testCaseResolutionStatusType, assignee, severity, createdAt, updatedAt, latestRecordId)
WITH chain AS (
  SELECT stateId, MIN(timestamp) AS createdAt, MAX(timestamp) AS updatedAt
  FROM test_case_resolution_status_time_series
  GROUP BY stateId
),
latestRecord AS (
  SELECT c.stateId, c.createdAt, c.updatedAt, MAX(t.id) AS latestId
  FROM chain c
  INNER JOIN test_case_resolution_status_time_series t
    ON t.stateId = c.stateId AND t.timestamp = c.updatedAt
  GROUP BY c.stateId, c.createdAt, c.updatedAt
)
SELECT t.stateId, t.entityFQNHash, t.testCaseResolutionStatusType, t.assignee,
       t.json ->> 'severity', l.createdAt, l.updatedAt, t.id
FROM latestRecord l
INNER JOIN test_case_resolution_status_time_series t ON t.id = l.latestId
WHERE t.entityFQNHash IS NOT NULL
ON CONFLICT (stateId) DO UPDATE SET
  testCaseResolutionStatusType = EXCLUDED.testCaseResolutionStatusType,
  assignee = EXCLUDED.assignee,
  severity = EXCLUDED.severity,
  createdAt = LEAST(test_case_incident.createdAt, EXCLUDED.createdAt),
  updatedAt = EXCLUDED.updatedAt,
  latestRecordId = EXCLUDED.latestRecordId;

-- Invalidate pre-2.1 projection success records. RDF status remains REBUILDING until a new
-- RdfIndexApp run succeeds, and the applications page exposes that Search indexing must be run.
DELETE FROM apps_extension_time_series
WHERE appname IN ('RdfIndexApp', 'SearchIndexingApplication');

-- Search reindexing is staged and recreates every selected index. Include every entity so the
-- new relationshipType index and the new glossaryTerm attribute mapping are materialized.
UPDATE installed_apps
SET json = jsonb_set(
  COALESCE(json::jsonb, '{}'::jsonb),
  '{appConfiguration}',
  COALESCE(json::jsonb -> 'appConfiguration', '{}'::jsonb)
    || jsonb_build_object('entities', jsonb_build_array('all')),
  true
)
WHERE name = 'SearchIndexingApplication';

UPDATE apps_marketplace
SET json = jsonb_set(
  COALESCE(json::jsonb, '{}'::jsonb),
  '{appConfiguration}',
  COALESCE(json::jsonb -> 'appConfiguration', '{}'::jsonb)
    || jsonb_build_object('entities', jsonb_build_array('all')),
  true
)
WHERE name = 'SearchIndexingApplication';

-- Ontology Studio relationships use stable identifiers independent of physical row order.
UPDATE entity_relationship
SET relationshipid = COALESCE(
  relationshipid,
  substring(md5(concat_ws('|', 'ontology-relationship', fromid, toid, relation, relationtype)), 1, 8)
    || '-' || substring(md5(concat_ws('|', 'ontology-relationship', fromid, toid, relation, relationtype)), 9, 4)
    || '-' || substring(md5(concat_ws('|', 'ontology-relationship', fromid, toid, relation, relationtype)), 13, 4)
    || '-' || substring(md5(concat_ws('|', 'ontology-relationship', fromid, toid, relation, relationtype)), 17, 4)
    || '-' || substring(md5(concat_ws('|', 'ontology-relationship', fromid, toid, relation, relationtype)), 21, 12)
)
WHERE fromentity = 'glossaryTerm'
  AND toentity = 'glossaryTerm'
  AND relation = 15;

UPDATE entity_relationship relationship
SET relationshiptypeid = relationship_type.id,
    json = COALESCE(relationship.json, '{}'::jsonb) || jsonb_build_object(
      'id', relationship.relationshipid,
      'relationshipTypeId', relationship_type.id,
      'sourceTermId', COALESCE(relationship.json->>'sourceTermId', relationship.fromid),
      'relationType', relationship.relationtype,
      'provenance', COALESCE(relationship.json->>'provenance', 'Manual'),
      'status', COALESCE(relationship.json->>'status', 'Approved'),
      'createdBy', COALESCE(relationship.json->>'createdBy', 'system'),
      'createdAt', COALESCE(
        (relationship.json->>'createdAt')::bigint,
        (extract(epoch from now()) * 1000)::bigint
      )
    )
FROM relationship_type_entity relationship_type
WHERE relationship_type.name = relationship.relationtype
  AND relationship.fromentity = 'glossaryTerm'
  AND relationship.toentity = 'glossaryTerm'
  AND relationship.relation = 15;
-- Activity comments are retained indefinitely unless an administrator explicitly configures a
-- positive retention period. Preserve any value already chosen by an administrator.
UPDATE installed_apps
SET json = jsonb_set(
    json::jsonb, '{appConfiguration,activityCommentsRetentionPeriod}', '0'::jsonb, true)
WHERE name = 'DataRetentionApplication'
  AND NOT jsonb_exists(json::jsonb #> '{appConfiguration}', 'activityCommentsRetentionPeriod');

UPDATE apps_marketplace
SET json = jsonb_set(
    json::jsonb, '{appConfiguration,activityCommentsRetentionPeriod}', '0'::jsonb, true)
WHERE name = 'DataRetentionApplication'
  AND NOT jsonb_exists(json::jsonb #> '{appConfiguration}', 'activityCommentsRetentionPeriod');

UPDATE entity_extension
SET json = jsonb_set(
    json::jsonb, '{appConfiguration,activityCommentsRetentionPeriod}', '0'::jsonb, true)
WHERE extension LIKE 'app.version.%'
  AND json::jsonb ->> 'name' = 'DataRetentionApplication'
  AND NOT jsonb_exists(json::jsonb #> '{appConfiguration}', 'activityCommentsRetentionPeriod');

-- Data quality dimensions became entities in 2.1.0 (issue #30362) and a test case now holds its
-- dimension as a `relatedTo` relationship. Pre-existing test cases have no such row and need one
-- backfilled from their test definition.
--
-- That backfill deliberately is NOT here. It has to join against data_quality_dimension, and the
-- system dimensions do not exist yet at this point on an upgrading deployment -- they are seeded
-- from JSON resources, which a SQL script cannot do. Joining anyway matches an empty table and
-- inserts nothing, silently and permanently, since the statement is then checksummed as applied
-- and never runs again. It is done in DataQualityDimensionMigration.backfillTestCaseDimensions(),
-- which seeds the dimensions first.

-- Data Quality failure thresholds: declare the `threshold` / `thresholdUnit` parameters on the
-- in-scope system test definitions, plus `dimensionFailurePolicy` on the ones that support
-- dimensional analysis. Seeding only covers fresh installs (initializeEntity returns early when the
-- entity exists) and TestCaseRepository rejects parameters that the definition does not declare, so
-- existing installs need this backfill. Every statement is guarded on the parameter being absent,
-- which keeps re-runs a no-op.

-- Definitions that ship without any parameter need the array before we can append to it.
UPDATE test_definition
SET json = jsonb_set(json::jsonb, '{parameterDefinition}', '[]'::jsonb)
WHERE name IN (
    'columnValueMaxToBeBetween', 'columnValueMeanToBeBetween', 'columnValueMedianToBeBetween',
    'columnValueMinToBeBetween', 'columnValueStdDevToBeBetween',
    'columnValueToBeAtExpectedLocation', 'columnValuesLengthsToBeBetween',
    'columnValuesMissingCountToBeEqual', 'columnValuesSumToBeBetween', 'columnValuesToBeBetween',
    'columnValuesToBeInSet', 'columnValuesToBeNotInSet', 'columnValuesToBeNotNull',
    'columnValuesToBeUnique', 'columnValuesToMatchRegex', 'columnValuesToNotMatchRegex',
    'tableColumnCountToBeBetween', 'tableColumnCountToEqual', 'tableRowCountToBeBetween',
    'tableRowCountToEqual', 'tableRowInsertedCountToBeBetween', 'tableCustomSQLQuery'
  )
  AND json->'parameterDefinition' IS NULL;

-- `tableRowInsertedCountToBeBetween` cannot run without `columnName` / `rangeType` /
-- `rangeInterval`, yet deployments still carry a definition that only declares `min` and `max`
-- (issue #33617). The 1.12.0 script already adds them back, but only reaches deployments that
-- upgraded through that release, so repeat it here as a plain guarded append. These run before the
-- `threshold` / `thresholdUnit` statements below so the resulting parameter order matches the seeded
-- definition. Guarded on each parameter being absent, which keeps re-runs -- and every deployment
-- that already has them -- a no-op.
UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{parameterDefinition}',
    (json->'parameterDefinition')::jsonb || jsonb_build_object(
        'name', 'columnName',
        'displayName', 'Column Name',
        'description', 'Name of the Column. It should be a timestamp, date or datetime field.',
        'dataType', 'STRING',
        'required', true
    )::jsonb
)
WHERE name = 'tableRowInsertedCountToBeBetween'
  AND NOT ((json->'parameterDefinition')::jsonb @> '[{"name": "columnName"}]'::jsonb);

UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{parameterDefinition}',
    (json->'parameterDefinition')::jsonb || jsonb_build_object(
        'name', 'rangeType',
        'displayName', 'Range Type',
        'description', 'One of ''HOUR'', ''DAY'', ''MONTH'', ''YEAR''',
        'dataType', 'STRING',
        'required', true
    )::jsonb
)
WHERE name = 'tableRowInsertedCountToBeBetween'
  AND NOT ((json->'parameterDefinition')::jsonb @> '[{"name": "rangeType"}]'::jsonb);

UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{parameterDefinition}',
    (json->'parameterDefinition')::jsonb || jsonb_build_object(
        'name', 'rangeInterval',
        'displayName', 'Interval',
        'description', 'Interval Range. E.g. if rangeInterval=1 and rangeType=DAY, we''ll check the numbers of rows inserted where columnName=-1 DAY',
        'dataType', 'INT',
        'required', true
    )::jsonb
)
WHERE name = 'tableRowInsertedCountToBeBetween'
  AND NOT ((json->'parameterDefinition')::jsonb @> '[{"name": "rangeInterval"}]'::jsonb);

UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{parameterDefinition}',
    (json->'parameterDefinition')::jsonb || jsonb_build_object(
        'name', 'threshold',
        'displayName', 'Failure Threshold',
        'description', 'Number of failures tolerated before the test is marked as failed. Read as an absolute count or as a percentage depending on `thresholdUnit` (defaults to 0).',
        'dataType', 'NUMBER',
        'required', false
    )::jsonb
)
WHERE name IN (
    'columnValueMaxToBeBetween', 'columnValueMeanToBeBetween', 'columnValueMedianToBeBetween',
    'columnValueMinToBeBetween', 'columnValueStdDevToBeBetween',
    'columnValueToBeAtExpectedLocation', 'columnValuesLengthsToBeBetween',
    'columnValuesMissingCountToBeEqual', 'columnValuesSumToBeBetween', 'columnValuesToBeBetween',
    'columnValuesToBeInSet', 'columnValuesToBeNotInSet', 'columnValuesToBeNotNull',
    'columnValuesToBeUnique', 'columnValuesToMatchRegex', 'columnValuesToNotMatchRegex',
    'tableColumnCountToBeBetween', 'tableColumnCountToEqual', 'tableRowCountToBeBetween',
    'tableRowCountToEqual', 'tableRowInsertedCountToBeBetween'
  )
  AND NOT ((json->'parameterDefinition')::jsonb @> '[{"name": "threshold"}]'::jsonb);

UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{parameterDefinition}',
    (json->'parameterDefinition')::jsonb || jsonb_build_object(
        'name', 'thresholdUnit',
        'displayName', 'Threshold Unit',
        'description', 'How to read `threshold`: `ABSOLUTE` for a raw count of failures, `PERCENTAGE` for a share of the evaluated rows (defaults to ABSOLUTE).',
        'dataType', 'STRING',
        'required', false,
        'optionValues', '["ABSOLUTE","PERCENTAGE"]'::jsonb
    )::jsonb
)
WHERE name IN (
    'columnValueMaxToBeBetween', 'columnValueMeanToBeBetween', 'columnValueMedianToBeBetween',
    'columnValueMinToBeBetween', 'columnValueStdDevToBeBetween',
    'columnValueToBeAtExpectedLocation', 'columnValuesLengthsToBeBetween',
    'columnValuesMissingCountToBeEqual', 'columnValuesSumToBeBetween', 'columnValuesToBeBetween',
    'columnValuesToBeInSet', 'columnValuesToBeNotInSet', 'columnValuesToBeNotNull',
    'columnValuesToBeUnique', 'columnValuesToMatchRegex', 'columnValuesToNotMatchRegex',
    'tableColumnCountToBeBetween', 'tableColumnCountToEqual', 'tableRowCountToBeBetween',
    'tableRowCountToEqual', 'tableRowInsertedCountToBeBetween', 'tableCustomSQLQuery'
  )
  AND NOT ((json->'parameterDefinition')::jsonb @> '[{"name": "thresholdUnit"}]'::jsonb);

UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{parameterDefinition}',
    (json->'parameterDefinition')::jsonb || jsonb_build_object(
        'name', 'dimensionFailurePolicy',
        'displayName', 'Dimension Failure Policy',
        'description', 'How dimensional results roll up into the overall test status: `OVERALL_ONLY` only looks at the overall result, `ANY_DIMENSION` fails the test as soon as one dimension fails (defaults to OVERALL_ONLY).',
        'dataType', 'STRING',
        'required', false,
        'optionValues', '["OVERALL_ONLY","ANY_DIMENSION"]'::jsonb
    )::jsonb
)
WHERE name IN (
    'columnValueMaxToBeBetween', 'columnValueMeanToBeBetween', 'columnValueMedianToBeBetween',
    'columnValueMinToBeBetween', 'columnValueStdDevToBeBetween',
    'columnValueToBeAtExpectedLocation', 'columnValuesLengthsToBeBetween',
    'columnValuesMissingCountToBeEqual', 'columnValuesSumToBeBetween', 'columnValuesToBeBetween',
    'columnValuesToBeInSet', 'columnValuesToBeNotInSet', 'columnValuesToBeNotNull',
    'columnValuesToBeUnique', 'columnValuesToMatchRegex', 'columnValuesToNotMatchRegex'
  )
  AND NOT ((json->'parameterDefinition')::jsonb @> '[{"name": "dimensionFailurePolicy"}]'::jsonb);

-- NUMERIC is a distinct member of the column dataType enum and is what BigQuery, Postgres,
-- Snowflake and DB2 numeric columns are ingested as, but the numeric system test definitions were
-- only ever seeded with NUMBER/DECIMAL. The "Add test case" dropdown filters on the column's exact
-- dataType, so mean/min/max/median/stddev/sum were unreachable on any NUMERIC column. Seeding only
-- covers fresh installs (initializeEntity returns early when the entity exists), hence this
-- backfill. The guard on NUMERIC being absent keeps re-runs a no-op, and it also skips a definition
-- with no supportedDataTypes at all -- that already means "every data type" (issue #27718), so
-- appending to it would narrow it to exactly one.
UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{supportedDataTypes}',
    (json->'supportedDataTypes')::jsonb || '["NUMERIC"]'::jsonb
)
WHERE name IN (
    'columnValueMaxToBeBetween', 'columnValueMeanToBeBetween', 'columnValueMedianToBeBetween',
    'columnValueMinToBeBetween', 'columnValueStdDevToBeBetween',
    'columnValuesToBeAtExpectedLocation', 'columnValuesSumToBeBetween', 'columnValuesToBeBetween',
    'columnValuesToBeInSet', 'columnValuesToBeNotInSet'
  )
  AND json->'supportedDataTypes' IS NOT NULL
  AND NOT ((json->'supportedDataTypes')::jsonb @> '["NUMERIC"]'::jsonb);

-- Normalize user emails to lowercase: email is the primary identity lookup key and the
-- application always compares lowercased values. No collision guard is needed -- the 1.5.0
-- migration already deleted rows duplicated by LOWER(email) and lowercased the survivors, and
-- every write since normalizes, so at most one row can hold any given lowercased address.
UPDATE user_entity
SET json = jsonb_set(json, '{email}', to_jsonb(lower(json ->> 'email')))
WHERE json ->> 'email' <> lower(json ->> 'email');
-- External S3 sample-data storage support was removed (collate#5995), and with it the
-- whole sampleDataStorageConfig property: once the external branch was gone the field
-- could only ever hold an empty object, so it carried no information and was dropped
-- from every connection and profiler schema. Connection schemas set
-- "additionalProperties": false, so any stored row that still carries the key -- the
-- legacy S3 shape or the empty OpenMetadata-hosted object alike -- stops deserializing
-- on upgrade. Remove the node outright wherever it appears. The field was optional, so
-- removing it is the same as never having set it, and OpenMetadata-hosted sample data
-- (stored under the table.sampleData extension) is untouched. Idempotent: #- of an
-- absent path is a no-op, and re-running finds nothing left to remove.
--
-- Hive nests its metastore connection, so a database service can hold the key at two
-- depths.
UPDATE dbservice_entity
SET json = json::jsonb
      #- '{connection,config,sampleDataStorageConfig}'
      #- '{connection,config,metastoreConnection,sampleDataStorageConfig}'
WHERE json::jsonb #> '{connection,config,sampleDataStorageConfig}' IS NOT NULL
   OR json::jsonb #> '{connection,config,metastoreConnection,sampleDataStorageConfig}' IS NOT NULL;

-- Superset reaches its database through a nested connection, and a dashboard service is
-- not stored in dbservice_entity.
UPDATE dashboard_service_entity
SET json = json::jsonb #- '{connection,config,connection,sampleDataStorageConfig}'
WHERE json::jsonb #> '{connection,config,connection,sampleDataStorageConfig}' IS NOT NULL;

-- Airflow nests under connection; SSIS and Wherescape under databaseConnection.
UPDATE pipeline_service_entity
SET json = json::jsonb
      #- '{connection,config,connection,sampleDataStorageConfig}'
      #- '{connection,config,databaseConnection,sampleDataStorageConfig}'
WHERE json::jsonb #> '{connection,config,connection,sampleDataStorageConfig}' IS NOT NULL
   OR json::jsonb #> '{connection,config,databaseConnection,sampleDataStorageConfig}' IS NOT NULL;

-- Alation, same nesting, metadata service table.
UPDATE metadata_service_entity
SET json = json::jsonb #- '{connection,config,connection,sampleDataStorageConfig}'
WHERE json::jsonb #> '{connection,config,connection,sampleDataStorageConfig}' IS NOT NULL;

-- Test Connection stores the submitted form as a workflow request. The UI deletes the
-- row once the check finishes, but rows survive an interrupted test, and a row that no
-- longer deserializes is also a row the retention sweep cannot delete.
UPDATE automations_workflow
SET json = json::jsonb
      #- '{request,connection,config,sampleDataStorageConfig}'
      #- '{request,connection,config,connection,sampleDataStorageConfig}'
      #- '{request,connection,config,metastoreConnection,sampleDataStorageConfig}'
      #- '{request,connection,config,databaseConnection,sampleDataStorageConfig}'
WHERE json::jsonb #> '{request,connection,config,sampleDataStorageConfig}' IS NOT NULL
   OR json::jsonb #> '{request,connection,config,connection,sampleDataStorageConfig}' IS NOT NULL
   OR json::jsonb #> '{request,connection,config,metastoreConnection,sampleDataStorageConfig}' IS NOT NULL
   OR json::jsonb #> '{request,connection,config,databaseConnection,sampleDataStorageConfig}' IS NOT NULL;

UPDATE database_entity
SET json = json::jsonb #- '{databaseProfilerConfig,sampleDataStorageConfig}'
WHERE json::jsonb #> '{databaseProfilerConfig,sampleDataStorageConfig}' IS NOT NULL;

UPDATE database_schema_entity
SET json = json::jsonb #- '{databaseSchemaProfilerConfig,sampleDataStorageConfig}'
WHERE json::jsonb #> '{databaseSchemaProfilerConfig,sampleDataStorageConfig}' IS NOT NULL;

-- Version history keeps a second copy of the same JSON. `EntityRepository.getVersion`
-- deserializes an entity_extension row straight into the generated POJO, so a snapshot
-- still carrying the key fails GET .../versions/{version} -- 400 for a service
-- connection (the secrets-manager decrypt rejects the unrecognized field) and 500 for a
-- profiler config (raw Jackson). The live rows above are only half the copies.
--
-- One statement covers every versioned entity the key can reach: the four service
-- types, database, databaseSchema, and the automations workflow (Test Connection
-- requests are versioned too). A path a snapshot does not have is a no-op, so the paths
-- apply uniformly; the extension prefixes stay explicit so the scan can use
-- `extension_index` instead of a leading wildcard.
UPDATE entity_extension
SET json = json::jsonb
      #- '{connection,config,sampleDataStorageConfig}'
      #- '{connection,config,metastoreConnection,sampleDataStorageConfig}'
      #- '{connection,config,connection,sampleDataStorageConfig}'
      #- '{connection,config,databaseConnection,sampleDataStorageConfig}'
      #- '{request,connection,config,sampleDataStorageConfig}'
      #- '{request,connection,config,connection,sampleDataStorageConfig}'
      #- '{request,connection,config,metastoreConnection,sampleDataStorageConfig}'
      #- '{request,connection,config,databaseConnection,sampleDataStorageConfig}'
      #- '{databaseProfilerConfig,sampleDataStorageConfig}'
      #- '{databaseSchemaProfilerConfig,sampleDataStorageConfig}'
WHERE (extension LIKE 'databaseService.version.%'
    OR extension LIKE 'dashboardService.version.%'
    OR extension LIKE 'pipelineService.version.%'
    OR extension LIKE 'metadataService.version.%'
    OR extension LIKE 'database.version.%'
    OR extension LIKE 'databaseSchema.version.%'
    OR extension LIKE 'workflow.version.%')
  AND (json::jsonb #> '{connection,config,sampleDataStorageConfig}' IS NOT NULL
    OR json::jsonb #> '{connection,config,metastoreConnection,sampleDataStorageConfig}' IS NOT NULL
    OR json::jsonb #> '{connection,config,connection,sampleDataStorageConfig}' IS NOT NULL
    OR json::jsonb #> '{connection,config,databaseConnection,sampleDataStorageConfig}' IS NOT NULL
    OR json::jsonb #> '{request,connection,config,sampleDataStorageConfig}' IS NOT NULL
    OR json::jsonb #> '{request,connection,config,connection,sampleDataStorageConfig}' IS NOT NULL
    OR json::jsonb #> '{request,connection,config,metastoreConnection,sampleDataStorageConfig}' IS NOT NULL
    OR json::jsonb #> '{request,connection,config,databaseConnection,sampleDataStorageConfig}' IS NOT NULL
    OR json::jsonb #> '{databaseProfilerConfig,sampleDataStorageConfig}' IS NOT NULL
    OR json::jsonb #> '{databaseSchemaProfilerConfig,sampleDataStorageConfig}' IS NOT NULL);

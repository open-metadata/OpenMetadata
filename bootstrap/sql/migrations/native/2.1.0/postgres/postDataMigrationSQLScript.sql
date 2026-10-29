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

-- Existing metrics predate the approval workflow and must remain usable. Explicit
-- workflow statuses are preserved, and this update is idempotent.
UPDATE metric_entity
SET json = jsonb_set(json::jsonb, '{entityStatus}', '"Approved"'::jsonb)
WHERE json->>'entityStatus' IS NULL
   OR json->>'entityStatus' = 'Unprocessed';

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
    'columnValuesToBeAtExpectedLocation', 'columnValueLengthsToBeBetween',
    'columnValuesMissingCount', 'columnValuesSumToBeBetween', 'columnValuesToBeBetween',
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
    'columnValuesToBeAtExpectedLocation', 'columnValueLengthsToBeBetween',
    'columnValuesMissingCount', 'columnValuesSumToBeBetween', 'columnValuesToBeBetween',
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
    'columnValuesToBeAtExpectedLocation', 'columnValueLengthsToBeBetween',
    'columnValuesMissingCount', 'columnValuesSumToBeBetween', 'columnValuesToBeBetween',
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
    'columnValuesToBeAtExpectedLocation', 'columnValueLengthsToBeBetween',
    'columnValuesMissingCount', 'columnValuesSumToBeBetween', 'columnValuesToBeBetween',
    'columnValuesToBeInSet', 'columnValuesToBeNotInSet', 'columnValuesToBeNotNull',
    'columnValuesToBeUnique', 'columnValuesToMatchRegex', 'columnValuesToNotMatchRegex'
  )
  AND NOT ((json->'parameterDefinition')::jsonb @> '[{"name": "dimensionFailurePolicy"}]'::jsonb);

-- `minRowsPerDimension` keeps small dimension groups out of the ANY_DIMENSION roll-up under a
-- PERCENTAGE threshold. Only the row-countable definitions declare it: a percentage of a statistic
-- is not distorted by group size. These are the definition names, which differ from the seed file
-- names for columnValueLengthsToBeBetween. Guarded on the parameter being absent, like the above.
UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{parameterDefinition}',
    (json->'parameterDefinition')::jsonb || jsonb_build_object(
        'name', 'minRowsPerDimension',
        'displayName', 'Minimum Rows per Dimension',
        'description', 'Under the `ANY_DIMENSION` policy and a `PERCENTAGE` threshold, a dimension with fewer rows than this is still evaluated and reported, but does not fail the test (defaults to 0: every dimension counts).',
        'dataType', 'INT',
        'required', false
    )::jsonb
)
WHERE name IN (
    'columnValueLengthsToBeBetween', 'columnValuesToBeBetween', 'columnValuesToBeInSet',
    'columnValuesToBeNotInSet', 'columnValuesToBeNotNull', 'columnValuesToBeUnique',
    'columnValuesToMatchRegex', 'columnValuesToNotMatchRegex'
  )
  AND NOT ((json->'parameterDefinition')::jsonb @> '[{"name": "minRowsPerDimension"}]'::jsonb);

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

-- Profiler settings are not stored on the entity row. `addDatabaseProfilerConfig` writes
-- the config straight to `entity_extension` under a fixed extension name, and the stored
-- JSON is the config itself -- so the key sits at the root, not under
-- `databaseProfilerConfig`, and the extension never matches a `*.version.%` prefix. The
-- statement above reaches neither. These rows are the only copies that survive.
UPDATE entity_extension
SET json = json::jsonb #- '{sampleDataStorageConfig}'
WHERE extension IN ('database.databaseProfilerConfig',
                    'databaseSchema.databaseSchemaProfilerConfig')
  AND json::jsonb #> '{sampleDataStorageConfig}' IS NOT NULL;

-- Microsoft Fabric service principals now choose a client secret or a certificate under
-- authType. Services saved before keep their client secret as the client secret option.
UPDATE dbservice_entity
SET json = jsonb_set(
    json #- '{connection,config,clientSecret}',
    '{connection,config,authType}',
    jsonb_build_object('clientSecret', json #> '{connection,config,clientSecret}'),
    true
)
WHERE serviceType = 'MicrosoftFabric'
  AND jsonb_exists(json -> 'connection' -> 'config', 'clientSecret');

-- Version history goes through the same connection converter on read, so its snapshots move too.
UPDATE entity_extension
SET json = jsonb_set(
    json #- '{connection,config,clientSecret}',
    '{connection,config,authType}',
    jsonb_build_object('clientSecret', json #> '{connection,config,clientSecret}'),
    true
)
WHERE extension LIKE 'databaseService.version.%'
  AND json ->> 'serviceType' = 'MicrosoftFabric'
  AND jsonb_exists(json -> 'connection' -> 'config', 'clientSecret');

-- Context memories move from their own Draft/Active/Archived `status` onto `entityStatus`, the
-- lifecycle stage every entity type shares: Active becomes Approved, and a memory with no status
-- was documented as Active, so it becomes Approved too. Version history is rewritten as well:
-- `status` is no longer part of the ContextMemory schema, so rows still carrying it would fail to
-- load. Idempotent: rows without `status` are untouched.
UPDATE context_memory
SET json = (json::jsonb - 'status') || jsonb_build_object(
  'entityStatus',
  CASE json::jsonb ->> 'status'
    WHEN 'Draft' THEN 'Draft'
    WHEN 'Archived' THEN 'Archived'
    ELSE 'Approved'
  END)
WHERE json::jsonb -> 'status' IS NOT NULL;

UPDATE context_memory
SET json = jsonb_set(json::jsonb, '{entityStatus}', '"Approved"'::jsonb)
WHERE json::jsonb ->> 'entityStatus' IS NULL;

UPDATE entity_extension
SET json = (json::jsonb - 'status') || jsonb_build_object(
  'entityStatus',
  CASE json::jsonb ->> 'status'
    WHEN 'Draft' THEN 'Draft'
    WHEN 'Archived' THEN 'Archived'
    ELSE 'Approved'
  END)
WHERE jsonSchema = 'contextMemory'
  AND json::jsonb -> 'status' IS NOT NULL;

-- Landing-page widgets: re-point the six panels whose widget was replaced, and drop the five
-- whose widget was retired.
--
-- The seed loader (EntityRepository.initializeEntity) only inserts rows it cannot find -- it
-- returns early on an existing fullyQualifiedName and never updates or deletes. So the new seed
-- files reach a fresh install and nothing else: on an upgrade the four added panels appear, the
-- rewritten ones keep the name and description of the widget they replaced, and the retired ones
-- linger. KnowledgePanel.ActivityFeed renders the Team Activity card now, so without this the
-- picker advertises it as "Activity Feed" and describes a feed that is no longer there.
--
-- Values mirror json/data/document/docs/*.json exactly, so an upgraded install ends up byte-equal
-- to a fresh one. gridSizes is set on its own path rather than by replacing `data` wholesale, so
-- the statement means the same thing as its MySQL counterpart. Re-runnable: every statement is an
-- absolute write or a delete that matches nothing on a second pass.
UPDATE doc_store
SET json = jsonb_set(
    json || jsonb_build_object(
      'displayName', 'Team Activity',
      'description', 'Recent activity across the assets and domains the user owns, showing who changed what and when.'
    ),
    '{data,gridSizes}', '["small","medium","large"]'::jsonb
)
WHERE name = 'ActivityFeed' AND entityType = 'KnowledgePanel';

UPDATE doc_store
SET json = jsonb_set(
    json || jsonb_build_object(
      'description', 'A filtered list of high-impact assets. Ships with a certified Tier-1 rule and can be pointed at any saved filter from the persona editor.'
    ),
    '{data,gridSizes}', '["small","medium","large"]'::jsonb
)
WHERE name = 'CuratedAssets' AND entityType = 'KnowledgePanel';

UPDATE doc_store
SET json = jsonb_set(
    json || jsonb_build_object(
      'description', 'Data products across the platform with their owning domain, for quicker access to high-value products.'
    ),
    '{data,gridSizes}', '["small","medium","large"]'::jsonb
)
WHERE name = 'DataProducts' AND entityType = 'KnowledgePanel';

UPDATE doc_store
SET json = jsonb_set(
    json || jsonb_build_object(
      'description', 'Domain-by-domain overview of owner, description coverage, and failing tests, so a gap is visible without opening each one.'
    ),
    '{data,gridSizes}', '["small","medium","large"]'::jsonb
)
WHERE name = 'Domains' AND entityType = 'KnowledgePanel';

UPDATE doc_store
SET json = jsonb_set(
    json || jsonb_build_object(
      'displayName', 'KPIs',
      'description', 'Progress against each active KPI: target, current pace, and whether it is on track to land by its end date.'
    ),
    '{data,gridSizes}', '["small","medium","large"]'::jsonb
)
WHERE name = 'KPI' AND entityType = 'KnowledgePanel';

-- Collate seeded this same fullyQualifiedName for its own Data Quality widget, which the topic
-- card replaced. An install that came up through that build keeps the old row -- the loader skips
-- the OSS seed -- and with it the old description and a single "small" grid size.
UPDATE doc_store
SET json = jsonb_set(
    json || jsonb_build_object(
      'displayName', 'Data Quality',
      'description', 'Overview of data quality test results (passing, failing, and aborted) with a link through to the failing tests.'
    ),
    '{data,gridSizes}', '["small","medium","large"]'::jsonb
)
WHERE name = 'DataQuality' AND entityType = 'KnowledgePanel';

-- The Context Center card moved into OSS from Collate, which seeded this fullyQualifiedName as
-- "Knowledge Center" with a description of a widget that no longer exists. OSS installs get the
-- row from the seed file; this brings an upgraded Collate row in line with it.
UPDATE doc_store
SET json = jsonb_set(
    json || jsonb_build_object(
      'displayName', 'Context Center',
      'description', 'The most recently updated Context Center pages, articles and quick links, with how many changed this week.'
    ),
    '{data,gridSizes}', '["small","medium","large"]'::jsonb
)
WHERE name = 'KnowledgeCenter' AND entityType = 'KnowledgePanel';

-- Retired: their seed files are gone and no component resolves their key, so the renderer would
-- answer with a render-nothing component and leave an empty cell. The UI already filters them out
-- of both the grid and the picker; this stops the rows accumulating.
--
-- MyTask and TotalAssets are the exception: their keys now hold the My Tasks and Total Data Assets
-- topic cards and their seed files are back. Deleting the old rows is still right, because the
-- loader re-inserts any seeded row it cannot find on the next boot, so they come back with the
-- topic cards' name and description rather than the retired widgets'.
DELETE FROM doc_store
WHERE entityType = 'KnowledgePanel'
  AND name IN ('DataAssets', 'Following', 'MyData', 'MyTask', 'TotalAssets');

-- transitive-lineage-closure stores every ancestor/descendant pair, which grows quadratically with
-- lineage depth, so it now ships disabled. Turn off rows that pre-release builds seeded as enabled.
UPDATE rdf_inference_rule
SET json = jsonb_set(json, '{enabled}', 'false'::jsonb),
    dirty = TRUE,
    dirtyVersion = dirtyVersion + 1
WHERE name = 'transitive-lineage-closure'
  AND systemRule = TRUE
  AND json ->> 'enabled' = 'true';

-- Table Diff gained the optional parallelQueries parameter. Seeding only covers fresh installs
-- (initializeEntity returns early when the entity exists), so without this backfill an upgraded
-- deployment would never offer it in the test case form. A no-op once the parameter is present.
UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{parameterDefinition}',
    (json->'parameterDefinition')::jsonb || jsonb_build_array(jsonb_build_object(
        'name', 'parallelQueries',
        'displayName', 'Parallel queries per database',
        'description', 'How many queries the comparison may run at once against each database (defaults to 1). Both databases are always queried at the same time. A higher value compares large tables faster, but adds load to both databases and holds more rows in memory.',
        'dataType', 'NUMBER',
        'required', false
    ))
)
WHERE name = 'tableDiff'
  AND jsonb_typeof(json->'parameterDefinition') = 'array'
  AND NOT ((json->'parameterDefinition')::jsonb @> '[{"name": "parallelQueries"}]'::jsonb);

-- Auto-classification sampleDataCount gained a schema maximum of 1000, the most rows a run reads.
-- Clamp saved pipelines above it so they still validate after upgrade instead of failing on edit.
UPDATE ingestion_pipeline_entity
SET json = jsonb_set(json::jsonb, '{sourceConfig,config,sampleDataCount}', '1000'::jsonb)::json
WHERE json::jsonb -> 'sourceConfig' -> 'config' ->> 'type' = 'AutoClassification'
  AND jsonb_typeof(json::jsonb -> 'sourceConfig' -> 'config' -> 'sampleDataCount') = 'number'
  AND (json::jsonb -> 'sourceConfig' -> 'config' ->> 'sampleDataCount')::numeric > 1000;

-- Say how to choose tableCustomSQLQuery.strategy and what columnValuesToBeInSet.matchEnum changes,
-- so users and test generation read it from the definition. Seed data only creates missing definitions.
UPDATE test_definition
SET json = jsonb_set(
    json,
    '{parameterDefinition}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN param->>'name' = 'strategy' THEN param || jsonb_build_object(
                    'description',
                    'How the query result is compared to the threshold. ROWS (default): the query returns the rows that break the rule, such as `SELECT * FROM t WHERE amount < 0`, and the number of rows returned is compared. COUNT: the query returns a single integer, such as `SELECT COUNT(*) FROM t WHERE amount < 0`, and that number is compared. Under ROWS a `SELECT COUNT(*)` query always returns one row. Do not use COUNT with a query that can return NULL or a non-integer, such as SUM or AVG.'
                )
                ELSE param
            END
            ORDER BY position
        )
        FROM jsonb_array_elements(json->'parameterDefinition') WITH ORDINALITY AS params(param, position)
    )
)
WHERE name = 'tableCustomSQLQuery'
  AND json->'parameterDefinition' @> '[{"name": "strategy"}]'::jsonb;

UPDATE test_definition
SET json = jsonb_set(
    json,
    '{parameterDefinition}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN param->>'name' = 'matchEnum' THEN param || jsonb_build_object(
                    'description',
                    'If true, every observed value must be allowed. If false or omitted, the test passes when at least one allowed value occurs, even if other values are outside the set.'
                )
                WHEN param->>'name' = 'allowedValues' THEN param || jsonb_build_object(
                    'description',
                    'Values used for matching. Neither mode requires every allowed value to occur in the column.'
                )
                ELSE param
            END
            ORDER BY position
        )
        FROM jsonb_array_elements(json->'parameterDefinition') WITH ORDINALITY AS params(param, position)
    )
)
WHERE name = 'columnValuesToBeInSet'
  AND json->'parameterDefinition' @> '[{"name": "matchEnum"}]'::jsonb;

UPDATE test_definition
SET json = jsonb_set(json, '{description}', to_jsonb('Checks column values against an allowed set according to the matchEnum mode.'::text))
WHERE name = 'columnValuesToBeInSet';

-- `tableCustomSQLQuery.operator` was seeded in #20307 and `partitionExpression` in #22697, but
-- seeding only creates missing definitions (EntityRepository.initializeEntity returns early once
-- the entity exists) — a definition record created from a pre-#20307 seed keeps neither, and no
-- earlier migration backfilled them: the deployment then renders the Add Test Case form with no
-- Operator to compare the query result to the threshold, and no Partition Expression for Compute
-- Row Count. Both are appended to the migrated definition, after the `thresholdUnit` statement
-- above, so a migrated install matches a fresh install except for these two trailing entries.
-- Each parameter is guarded on being absent, which keeps re-runs — and every deployment that
-- already has it — a no-op.
UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{parameterDefinition}',
    (json->'parameterDefinition')::jsonb || jsonb_build_object(
        'name', 'operator',
        'displayName', 'Operator',
        'description', 'Operator to use to compare the result of the custom SQL query to the threshold.',
        'dataType', 'STRING',
        'required', false,
        'optionValues', '["==",">",">=","<","<=","!="]'::jsonb
    )::jsonb
)
WHERE name = 'tableCustomSQLQuery'
  AND NOT ((json->'parameterDefinition')::jsonb @> '[{"name": "operator"}]'::jsonb);

UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{parameterDefinition}',
    (json->'parameterDefinition')::jsonb || jsonb_build_object(
        'name', 'partitionExpression',
        'displayName', 'Partition Expression',
        'description', 'Partition expression that will be used to compute the passed/failed row count, if compute row count is enabled.',
        'dataType', 'STRING',
        'required', false
    )::jsonb
)
WHERE name = 'tableCustomSQLQuery'
  AND NOT ((json->'parameterDefinition')::jsonb @> '[{"name": "partitionExpression"}]'::jsonb);

-- Apps no longer create the alerts listed in their marketplace definition. An app's own code
-- still creates alerts it needs and links them to the app (relation 0 is CONTAINS); those run
-- the app's own consumer class. An alert linked to an app that is named in the app's
-- definition, or that uses the default alert consumer, came from a definition: it is disabled,
-- kept for an admin to review and no longer tied to the app. The list then leaves every stored
-- definition, definition version and definition change event.

-- event_subscription_entity: alerts an app install created from its definition
UPDATE event_subscription_entity
SET json = jsonb_set(json, '{enabled}', 'false'::jsonb)
WHERE id IN (SELECT id FROM (
  SELECT DISTINCT e.id FROM event_subscription_entity e
    JOIN entity_relationship r ON r.toId = e.id
      AND r.fromEntity = 'app' AND r.toEntity = 'eventsubscription' AND r.relation = 0
    LEFT JOIN installed_apps a ON a.id = r.fromId
    LEFT JOIN apps_marketplace m ON m.name = a.name
    WHERE e.json ->> 'className' IS NULL
      OR e.json ->> 'className' = 'alert'
      OR e.json ->> 'className' LIKE '%.AlertPublisher'
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(m.json -> 'eventSubscriptions') = 'array'
          THEN m.json -> 'eventSubscriptions' ELSE '[]'::jsonb END) s
        WHERE s ->> 'name' = e.name)
) planted);

DELETE FROM entity_relationship
WHERE fromEntity = 'app' AND toEntity = 'eventsubscription' AND relation = 0
  AND toId IN (SELECT id FROM (
  SELECT DISTINCT e.id FROM event_subscription_entity e
    JOIN entity_relationship r ON r.toId = e.id
      AND r.fromEntity = 'app' AND r.toEntity = 'eventsubscription' AND r.relation = 0
    LEFT JOIN installed_apps a ON a.id = r.fromId
    LEFT JOIN apps_marketplace m ON m.name = a.name
    WHERE e.json ->> 'className' IS NULL
      OR e.json ->> 'className' = 'alert'
      OR e.json ->> 'className' LIKE '%.AlertPublisher'
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(m.json -> 'eventSubscriptions') = 'array'
          THEN m.json -> 'eventSubscriptions' ELSE '[]'::jsonb END) s
        WHERE s ->> 'name' = e.name)
) planted);

UPDATE apps_marketplace SET json = json - 'eventSubscriptions'
WHERE json -> 'eventSubscriptions' IS NOT NULL;

UPDATE entity_extension SET json = json - 'eventSubscriptions'
WHERE extension LIKE 'appMarketPlaceDefinition.version.%'
  AND json -> 'eventSubscriptions' IS NOT NULL;

-- change_event: an event that holds its entity as an object
UPDATE change_event
SET json = json #- '{entity,eventSubscriptions}'
WHERE entityType = 'appMarketPlaceDefinition'
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'object'
    THEN json -> 'entity' -> 'eventSubscriptions' IS NOT NULL
    ELSE false END;

-- change_event: an event that holds its entity as a string of JSON
UPDATE change_event
SET json = jsonb_set(json, '{entity}',
  to_jsonb(((json ->> 'entity')::jsonb - 'eventSubscriptions')::text))
WHERE entityType = 'appMarketPlaceDefinition'
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'string'
    THEN CASE WHEN (json ->> 'entity') LIKE '{%'
      THEN (json ->> 'entity')::jsonb -> 'eventSubscriptions' IS NOT NULL
      ELSE false END
    ELSE false END;

-- successful_sent_change_events: an event that holds its entity as an object
UPDATE successful_sent_change_events
SET json = json #- '{entity,eventSubscriptions}'
WHERE json ->> 'entityType' = 'appMarketPlaceDefinition'
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'object'
    THEN json -> 'entity' -> 'eventSubscriptions' IS NOT NULL
    ELSE false END;

-- successful_sent_change_events: an event that holds its entity as a string of JSON
UPDATE successful_sent_change_events
SET json = jsonb_set(json, '{entity}',
  to_jsonb(((json ->> 'entity')::jsonb - 'eventSubscriptions')::text))
WHERE json ->> 'entityType' = 'appMarketPlaceDefinition'
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'string'
    THEN CASE WHEN (json ->> 'entity') LIKE '{%'
      THEN (json ->> 'entity')::jsonb -> 'eventSubscriptions' IS NOT NULL
      ELSE false END
    ELSE false END;

-- consumers_dlq: an event that holds its entity as an object
UPDATE consumers_dlq
SET json = json #- '{changeEvent,entity,eventSubscriptions}'
WHERE json -> 'changeEvent' ->> 'entityType' = 'appMarketPlaceDefinition'
  AND CASE WHEN jsonb_typeof(json -> 'changeEvent' -> 'entity') = 'object'
    THEN json -> 'changeEvent' -> 'entity' -> 'eventSubscriptions' IS NOT NULL
    ELSE false END;

-- consumers_dlq: an event that holds its entity as a string of JSON
UPDATE consumers_dlq
SET json = jsonb_set(json, '{changeEvent,entity}',
  to_jsonb(((json -> 'changeEvent' ->> 'entity')::jsonb - 'eventSubscriptions')::text))
WHERE json -> 'changeEvent' ->> 'entityType' = 'appMarketPlaceDefinition'
  AND CASE WHEN jsonb_typeof(json -> 'changeEvent' -> 'entity') = 'string'
    THEN CASE WHEN (json -> 'changeEvent' ->> 'entity') LIKE '{%'
      THEN (json -> 'changeEvent' ->> 'entity')::jsonb -> 'eventSubscriptions' IS NOT NULL
      ELSE false END
    ELSE false END;

-- audit_log_event: an event that holds its entity as an object
UPDATE audit_log_event
SET event_json = (event_json::jsonb #- '{entity,eventSubscriptions}')::text
WHERE entity_type = 'appMarketPlaceDefinition'
  AND CASE WHEN event_json LIKE '{%'
    THEN CASE WHEN jsonb_typeof(event_json::jsonb -> 'entity') = 'object'
      THEN event_json::jsonb -> 'entity' -> 'eventSubscriptions' IS NOT NULL
      ELSE false END
    ELSE false END;

-- audit_log_event: an event that holds its entity as a string of JSON
UPDATE audit_log_event
SET event_json = (jsonb_set(event_json::jsonb, '{entity}',
  to_jsonb(((event_json::jsonb ->> 'entity')::jsonb - 'eventSubscriptions')::text)))::text
WHERE entity_type = 'appMarketPlaceDefinition'
  AND CASE WHEN event_json LIKE '{%'
    THEN CASE WHEN jsonb_typeof(event_json::jsonb -> 'entity') = 'string'
      THEN CASE WHEN (event_json::jsonb ->> 'entity') LIKE '{%'
        THEN (event_json::jsonb ->> 'entity')::jsonb -> 'eventSubscriptions' IS NOT NULL
        ELSE false END
      ELSE false END
    ELSE false END;

-- An app's alert list is filled from the app->alert relationship on every read and is no longer
-- stored. The copy in the app JSON, and any alert written into it by hand, leaves stored apps and
-- app versions; the relationship rows that record the app's own alerts stay.
UPDATE installed_apps SET json = json - 'eventSubscriptions'
WHERE json -> 'eventSubscriptions' IS NOT NULL;

UPDATE entity_extension SET json = json - 'eventSubscriptions'
WHERE extension LIKE 'app.version.%'
  AND json -> 'eventSubscriptions' IS NOT NULL;

-- A user's authentication mechanism (a password hash or a bot token) leaves every stored
-- change event and user version; new ones no longer carry it.

-- change_event: an event that holds its entity as an object
UPDATE change_event
SET json = json #- '{entity,authenticationMechanism}'
WHERE entityType IN ('user')
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'object'
    THEN json -> 'entity' -> 'authenticationMechanism' IS NOT NULL
    ELSE false END;

-- change_event: an event that holds its entity as a string of JSON
UPDATE change_event
SET json = jsonb_set(json, '{entity}',
  to_jsonb(((json ->> 'entity')::jsonb - 'authenticationMechanism')::text))
WHERE entityType IN ('user')
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'string'
    THEN CASE WHEN (json ->> 'entity') LIKE '{%'
      THEN (json ->> 'entity')::jsonb -> 'authenticationMechanism' IS NOT NULL
      ELSE false END
    ELSE false END;

-- successful_sent_change_events: an event that holds its entity as an object
UPDATE successful_sent_change_events
SET json = json #- '{entity,authenticationMechanism}'
WHERE json ->> 'entityType' IN ('user')
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'object'
    THEN json -> 'entity' -> 'authenticationMechanism' IS NOT NULL
    ELSE false END;

-- successful_sent_change_events: an event that holds its entity as a string of JSON
UPDATE successful_sent_change_events
SET json = jsonb_set(json, '{entity}',
  to_jsonb(((json ->> 'entity')::jsonb - 'authenticationMechanism')::text))
WHERE json ->> 'entityType' IN ('user')
  AND CASE WHEN jsonb_typeof(json -> 'entity') = 'string'
    THEN CASE WHEN (json ->> 'entity') LIKE '{%'
      THEN (json ->> 'entity')::jsonb -> 'authenticationMechanism' IS NOT NULL
      ELSE false END
    ELSE false END;

-- consumers_dlq: an event that holds its entity as an object
UPDATE consumers_dlq
SET json = json #- '{changeEvent,entity,authenticationMechanism}'
WHERE json -> 'changeEvent' ->> 'entityType' IN ('user')
  AND CASE WHEN jsonb_typeof(json -> 'changeEvent' -> 'entity') = 'object'
    THEN json -> 'changeEvent' -> 'entity' -> 'authenticationMechanism' IS NOT NULL
    ELSE false END;

-- consumers_dlq: an event that holds its entity as a string of JSON
UPDATE consumers_dlq
SET json = jsonb_set(json, '{changeEvent,entity}',
  to_jsonb(((json -> 'changeEvent' ->> 'entity')::jsonb - 'authenticationMechanism')::text))
WHERE json -> 'changeEvent' ->> 'entityType' IN ('user')
  AND CASE WHEN jsonb_typeof(json -> 'changeEvent' -> 'entity') = 'string'
    THEN CASE WHEN (json -> 'changeEvent' ->> 'entity') LIKE '{%'
      THEN (json -> 'changeEvent' ->> 'entity')::jsonb -> 'authenticationMechanism' IS NOT NULL
      ELSE false END
    ELSE false END;

-- audit_log_event: an event that holds its entity as an object
UPDATE audit_log_event
SET event_json = (event_json::jsonb #- '{entity,authenticationMechanism}')::text
WHERE entity_type IN ('user')
  AND CASE WHEN event_json LIKE '{%'
    THEN CASE WHEN jsonb_typeof(event_json::jsonb -> 'entity') = 'object'
      THEN event_json::jsonb -> 'entity' -> 'authenticationMechanism' IS NOT NULL
      ELSE false END
    ELSE false END;

-- audit_log_event: an event that holds its entity as a string of JSON
UPDATE audit_log_event
SET event_json = (jsonb_set(event_json::jsonb, '{entity}',
  to_jsonb(((event_json::jsonb ->> 'entity')::jsonb - 'authenticationMechanism')::text)))::text
WHERE entity_type IN ('user')
  AND CASE WHEN event_json LIKE '{%'
    THEN CASE WHEN jsonb_typeof(event_json::jsonb -> 'entity') = 'string'
      THEN CASE WHEN (event_json::jsonb ->> 'entity') LIKE '{%'
        THEN (event_json::jsonb ->> 'entity')::jsonb -> 'authenticationMechanism' IS NOT NULL
        ELSE false END
      ELSE false END
    ELSE false END;

-- entity_extension: stored user versions
UPDATE entity_extension SET json = json - 'authenticationMechanism'
WHERE extension LIKE 'user.version.%'
  AND json -> 'authenticationMechanism' IS NOT NULL;

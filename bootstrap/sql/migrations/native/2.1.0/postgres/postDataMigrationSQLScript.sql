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

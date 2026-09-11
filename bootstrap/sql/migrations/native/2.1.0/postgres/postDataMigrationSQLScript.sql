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
-- dimension as a `relatedTo` relationship written at create time. Test cases that already existed
-- have no such row and nothing else creates one, so without this backfill the REST API returns no
-- dimension for every pre-upgrade test case and the Data Quality settings page counts them all as
-- zero -- including in the delete confirmation. The search index and the UI hide it by falling
-- back to the test definition, which is why it is invisible in the product but wrong on the API.
--
-- This mirrors exactly what TestCaseRepository does for a new test case: inherit whatever
-- dimension the test definition carries at this moment, then freeze it. Reclassifying a test
-- definition later does not move existing test cases, before or after this migration.
--
-- relation 15 = relatedTo, relation 0 = contains (type/entityRelationship.json ordinals).
-- Test definitions set to `NoDimension`, or to a name with no dimension entity, drop out of the
-- join and are left with no relationship -- the same result as creating one today.
INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation, relationType, deleted, json)
SELECT dqd.id, tc.id, 'dataQualityDimension', 'testCase', 15, '', false, '{"inherited": true}'::jsonb
FROM test_case tc
JOIN entity_relationship td_rel
  ON td_rel.toId = tc.id
 AND td_rel.toEntity = 'testCase'
 AND td_rel.fromEntity = 'testDefinition'
 AND td_rel.relation = 0
JOIN test_definition td
  ON td.id = td_rel.fromId
JOIN data_quality_dimension dqd
  ON dqd.name = td.json ->> 'dataQualityDimension'
LEFT JOIN entity_relationship existing
  ON existing.toId = tc.id
 AND existing.toEntity = 'testCase'
 AND existing.fromEntity = 'dataQualityDimension'
 AND existing.relation = 15
WHERE existing.toId IS NULL;

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
       JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.severity')), l.createdAt, l.updatedAt, t.id
FROM latestRecord l
INNER JOIN test_case_resolution_status_time_series t ON t.id = l.latestId
WHERE t.entityFQNHash IS NOT NULL
ON DUPLICATE KEY UPDATE
  testCaseResolutionStatusType = VALUES(testCaseResolutionStatusType),
  assignee = VALUES(assignee),
  severity = VALUES(severity),
  test_case_incident.createdAt = LEAST(test_case_incident.createdAt, VALUES(createdAt)),
  updatedAt = VALUES(updatedAt),
  latestRecordId = VALUES(latestRecordId);

-- Invalidate pre-2.1 projection success records. RDF status remains REBUILDING until a new
-- RdfIndexApp run succeeds, and the applications page exposes that Search indexing must be run.
DELETE FROM apps_extension_time_series
WHERE appName IN ('RdfIndexApp', 'SearchIndexingApplication');

-- Search reindexing is staged and recreates every selected index. Include every entity so the
-- new relationshipType index and the new glossaryTerm attribute mapping are materialized.
UPDATE installed_apps
SET json = JSON_SET(
  COALESCE(json, JSON_OBJECT()),
  '$.appConfiguration',
  JSON_SET(
    COALESCE(JSON_EXTRACT(json, '$.appConfiguration'), JSON_OBJECT()),
    '$.entities',
    JSON_ARRAY('all')
  )
)
WHERE name = 'SearchIndexingApplication';

UPDATE apps_marketplace
SET json = JSON_SET(
  COALESCE(json, JSON_OBJECT()),
  '$.appConfiguration',
  JSON_SET(
    COALESCE(JSON_EXTRACT(json, '$.appConfiguration'), JSON_OBJECT()),
    '$.entities',
    JSON_ARRAY('all')
  )
)
WHERE name = 'SearchIndexingApplication';

-- Ontology Studio relationships use stable identifiers independent of physical row order.
UPDATE entity_relationship
SET relationshipId = COALESCE(
  relationshipId,
  CONCAT(
    SUBSTRING(MD5(CONCAT_WS('|', 'ontology-relationship', fromId, toId, relation, relationType)), 1, 8), '-',
    SUBSTRING(MD5(CONCAT_WS('|', 'ontology-relationship', fromId, toId, relation, relationType)), 9, 4), '-',
    SUBSTRING(MD5(CONCAT_WS('|', 'ontology-relationship', fromId, toId, relation, relationType)), 13, 4), '-',
    SUBSTRING(MD5(CONCAT_WS('|', 'ontology-relationship', fromId, toId, relation, relationType)), 17, 4), '-',
    SUBSTRING(MD5(CONCAT_WS('|', 'ontology-relationship', fromId, toId, relation, relationType)), 21, 12)
  )
)
WHERE fromEntity = 'glossaryTerm'
  AND toEntity = 'glossaryTerm'
  AND relation = 15;

UPDATE entity_relationship relationship
JOIN relationship_type_entity relationship_type
  ON relationship_type.name COLLATE utf8mb4_bin = relationship.relationType COLLATE utf8mb4_bin
SET relationship.relationshipTypeId = relationship_type.id,
    relationship.json = JSON_SET(
      COALESCE(relationship.json, JSON_OBJECT()),
      '$.id', relationship.relationshipId,
      '$.relationshipTypeId', relationship_type.id,
      '$.sourceTermId', COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(relationship.json, '$.sourceTermId')),
        relationship.fromId
      ),
      '$.relationType', relationship.relationType,
      '$.provenance', COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(relationship.json, '$.provenance')),
        'Manual'
      ),
      '$.status', COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(relationship.json, '$.status')),
        'Approved'
      ),
      '$.createdBy', COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(relationship.json, '$.createdBy')),
        'system'
      ),
      '$.createdAt', COALESCE(
        CAST(JSON_UNQUOTE(JSON_EXTRACT(relationship.json, '$.createdAt')) AS UNSIGNED),
        UNIX_TIMESTAMP() * 1000
      )
    )
WHERE relationship.fromEntity = 'glossaryTerm'
  AND relationship.toEntity = 'glossaryTerm'
  AND relationship.relation = 15;
-- Activity comments are retained indefinitely unless an administrator explicitly configures a
-- positive retention period. Preserve any value already chosen by an administrator.
UPDATE installed_apps
SET json = JSON_INSERT(json, '$.appConfiguration.activityCommentsRetentionPeriod', 0)
WHERE name = 'DataRetentionApplication';

UPDATE apps_marketplace
SET json = JSON_INSERT(json, '$.appConfiguration.activityCommentsRetentionPeriod', 0)
WHERE name = 'DataRetentionApplication';

UPDATE entity_extension
SET json = JSON_INSERT(json, '$.appConfiguration.activityCommentsRetentionPeriod', 0)
WHERE extension LIKE 'app.version.%'
  AND json->>'$.name' = 'DataRetentionApplication';

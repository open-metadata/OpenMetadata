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

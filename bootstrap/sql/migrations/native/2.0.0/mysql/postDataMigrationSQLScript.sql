-- Post data migration script for Task System Redesign - OpenMetadata 2.0.0
-- This script runs after the data migration completes

-- =====================================================
-- NOTE: Suggestion migration (suggestions → task_entity),
-- thread-based task migration (thread_entity → task_entity),
-- and legacy system activity migration
-- (thread_entity generated feed rows → activity_stream)
-- are handled in Java MigrationUtil because they require
-- entity-link aware transformation logic.
-- =====================================================

-- =====================================================
-- PHASE 2D: Migrate announcements from thread_entity → announcement_entity
-- =====================================================
INSERT INTO announcement_entity (id, json, fqnHash)
SELECT
  a_id AS id,
  a_json AS json,
  a_fqnHash AS fqnHash
FROM (
  SELECT
    JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.id')) AS a_id,
    JSON_OBJECT(
      'id', JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.id')),
      'name', CONCAT('announcement-', JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.id'))),
      'fullyQualifiedName', CONCAT('announcement-', JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.id'))),
      'displayName', NULLIF(JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.message')), ''),
      'description', COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.announcement.description')),
        JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.message')),
        ''
      ),
      'entityLink', JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.about')),
      'startTime', CAST(JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.announcement.startTime')) AS UNSIGNED),
      'endTime', CAST(JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.announcement.endTime')) AS UNSIGNED),
      'status', CASE
                  WHEN CAST(JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.announcement.endTime')) AS UNSIGNED) < UNIX_TIMESTAMP() * 1000
                    THEN 'Expired'
                  WHEN CAST(JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.announcement.startTime')) AS UNSIGNED) > UNIX_TIMESTAMP() * 1000
                    THEN 'Scheduled'
                  ELSE 'Active'
                END,
      'createdBy', JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.createdBy')),
      'updatedBy', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.updatedBy')), JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.createdBy'))),
      'createdAt', CAST(JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.threadTs')) AS UNSIGNED),
      'updatedAt', CAST(
        COALESCE(
          JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.updatedAt')),
          JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.threadTs'))
        ) AS UNSIGNED
      ),
      'deleted', false,
      'version', 0.1,
      'reactions', COALESCE(JSON_EXTRACT(t.json, '$.reactions'), JSON_ARRAY())
    ) AS a_json,
    MD5(CONCAT('announcement-', JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.id')))) AS a_fqnHash
  FROM thread_entity t
  WHERE JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.type')) = 'Announcement'
  AND NOT EXISTS (
    SELECT 1 FROM announcement_entity a WHERE a.id = JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.id'))
  )
) migrated;

-- =====================================================
-- PHASE 2E: Rename legacy thread storage to fail stale references
-- =====================================================
SET @thread_entity_exists = (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'thread_entity'
);

SET @thread_entity_legacy_exists = (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'thread_entity_legacy'
);

SET @rename_thread_entity_sql = IF(
  @thread_entity_exists = 1 AND @thread_entity_legacy_exists = 0,
  'RENAME TABLE thread_entity TO thread_entity_legacy',
  'SELECT 1'
);

PREPARE rename_thread_entity_stmt FROM @rename_thread_entity_sql;
EXECUTE rename_thread_entity_stmt;
DEALLOCATE PREPARE rename_thread_entity_stmt;

-- =====================================================
-- PHASE 2F: Lower workflow trigger polling intervals
-- =====================================================
-- Reduce WorkflowEventConsumer poll interval from 10s to 1s.
-- The legacy 10s default added up to a 10s wait between an entity change and the
-- workflow-triggered approval task being created. On CI under resource pressure this
-- often drifted to >2 minutes when combined with Flowable's 60s async job poll. The
-- new value keeps the trigger pipeline near-real-time.
UPDATE event_subscription_entity
SET json = JSON_SET(json, '$.pollInterval', 1)
WHERE name = 'WorkflowEventConsumer'
  AND CAST(JSON_EXTRACT(json, '$.pollInterval') AS UNSIGNED) > 1;

-- Lower Flowable async/timer job acquisition intervals to keep workflow-driven
-- task creation responsive. The previous 60s default was a Flowable production setting
-- carried over verbatim; for OpenMetadata's interactive task UX we want sub-second pickup.
UPDATE openmetadata_settings
SET json = JSON_SET(
             JSON_SET(json, '$.executorConfiguration.asyncJobAcquisitionInterval', 1000),
             '$.executorConfiguration.timerJobAcquisitionInterval', 5000)
WHERE configType = 'workflowSettings'
  AND JSON_EXTRACT(json, '$.executorConfiguration') IS NOT NULL
  AND (CAST(JSON_EXTRACT(json, '$.executorConfiguration.asyncJobAcquisitionInterval') AS UNSIGNED) > 1000
    OR CAST(JSON_EXTRACT(json, '$.executorConfiguration.timerJobAcquisitionInterval') AS UNSIGNED) > 5000);


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

INSERT INTO announcement_entity (id, json, fqnhash)
SELECT
  json->>'id' AS id,
  jsonb_build_object(
    'id', json->>'id',
    'name', 'announcement-' || (json->>'id'),
    'fullyQualifiedName', 'announcement-' || (json->>'id'),
    'displayName', NULLIF(json->>'message', ''),
    'description', COALESCE(
      json->'announcement'->>'description',
      json->>'message',
      ''
    ),
    'entityLink', json->>'about',
    'startTime', (json->'announcement'->>'startTime')::bigint,
    'endTime', (json->'announcement'->>'endTime')::bigint,
    'status', CASE
                WHEN (json->'announcement'->>'endTime')::bigint < (extract(epoch from now()) * 1000)::bigint
                  THEN 'Expired'
                WHEN (json->'announcement'->>'startTime')::bigint > (extract(epoch from now()) * 1000)::bigint
                  THEN 'Scheduled'
                ELSE 'Active'
              END,
    'createdBy', json->>'createdBy',
    'updatedBy', COALESCE(json->>'updatedBy', json->>'createdBy'),
    'createdAt', (json->>'threadTs')::bigint,
    'updatedAt', COALESCE((json->>'updatedAt')::bigint, (json->>'threadTs')::bigint),
    'deleted', false,
    'version', 0.1,
    'reactions', COALESCE(json->'reactions', '[]'::jsonb)
  ) AS json,
  md5('announcement-' || (json->>'id')) AS fqnhash
FROM thread_entity t
WHERE json->>'type' = 'Announcement'
AND NOT EXISTS (
  SELECT 1 FROM announcement_entity a WHERE a.id = t.json->>'id'
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- PHASE 2E: Rename legacy thread storage to fail stale references
-- =====================================================
ALTER TABLE IF EXISTS thread_entity RENAME TO thread_entity_legacy;

-- =====================================================
-- PHASE 2F: Lower workflow trigger polling intervals
-- =====================================================
-- Reduce WorkflowEventConsumer poll interval from 10s to 1s.
-- The legacy 10s default added up to a 10s wait between an entity change and the
-- workflow-triggered approval task being created. On CI under resource pressure this
-- often drifted to >2 minutes when combined with Flowable's 60s async job poll. The
-- new value keeps the trigger pipeline near-real-time.
UPDATE event_subscription_entity
SET json = jsonb_set(json, '{pollInterval}', '1'::jsonb)
WHERE name = 'WorkflowEventConsumer'
  AND (json->>'pollInterval')::int > 1;

-- Lower Flowable async/timer job acquisition intervals to keep workflow-driven
-- task creation responsive. The previous 60s default was a Flowable production setting
-- carried over verbatim; for OpenMetadata's interactive task UX we want sub-second pickup.
UPDATE openmetadata_settings
SET json = jsonb_set(
             jsonb_set(json, '{executorConfiguration,asyncJobAcquisitionInterval}', '1000'::jsonb),
             '{executorConfiguration,timerJobAcquisitionInterval}', '5000'::jsonb)
WHERE configtype = 'workflowSettings'
  AND json->'executorConfiguration' IS NOT NULL
  AND ((json->'executorConfiguration'->>'asyncJobAcquisitionInterval')::int > 1000
    OR (json->'executorConfiguration'->>'timerJobAcquisitionInterval')::int > 5000);

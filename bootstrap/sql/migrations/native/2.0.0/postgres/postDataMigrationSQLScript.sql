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

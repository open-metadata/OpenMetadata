-- Remove page related-entity relationships that point at a column. 'tableColumn' is a
-- search-only pseudo-type with no repository, so resolving such a related-entity row throws
-- "Entity repository for tableColumn not found" and 404s the Context Center list.
-- page relatedEntities are stored as HAS (relation 10).
DELETE FROM entity_relationship
WHERE fromEntity = 'tableColumn'
  AND toEntity = 'page'
  AND relation = 10;

-- Reduce WorkflowEventConsumer poll interval from 10s to 1s so governance approval workflows
-- are processed within seconds of the triggering entity change instead of lagging minutes
-- behind under bulk-event load (e.g. bulk custom-property / entity operations that flood the
-- change_event stream). The seed WorkflowEvents.json already ships pollInterval=1; this updates
-- existing installs. Idempotent: only lowers values still above 1.
UPDATE event_subscription_entity
SET json = jsonb_set(json, '{pollInterval}', '1'::jsonb)
WHERE name = 'WorkflowEventConsumer'
  AND (json->>'pollInterval')::int > 1;

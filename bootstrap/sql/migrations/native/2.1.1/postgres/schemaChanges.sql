-- Preserve memory lifecycle outcomes written by earlier development builds while
-- moving to the existing shared entity status vocabulary.
UPDATE context_memory
SET json = jsonb_set(json::jsonb, '{entityStatus}',
  to_jsonb(CASE json::jsonb ->> 'entityStatus'
    WHEN 'Superseded' THEN 'Deprecated'
    ELSE 'Rejected'
  END))
WHERE json::jsonb ->> 'entityStatus' IN ('Superseded', 'Invalidated');

UPDATE entity_extension
SET json = jsonb_set(json::jsonb, '{entityStatus}',
  to_jsonb(CASE json::jsonb ->> 'entityStatus'
    WHEN 'Superseded' THEN 'Deprecated'
    ELSE 'Rejected'
  END))
WHERE jsonSchema = 'contextMemory'
  AND json::jsonb ->> 'entityStatus' IN ('Superseded', 'Invalidated');

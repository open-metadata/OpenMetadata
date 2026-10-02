-- Preserve memory lifecycle outcomes written by earlier development builds while
-- moving to the existing shared entity status vocabulary.
UPDATE context_memory
SET json = JSON_SET(json, '$.entityStatus',
  CASE JSON_UNQUOTE(JSON_EXTRACT(json, '$.entityStatus'))
    WHEN 'Superseded' THEN 'Deprecated'
    ELSE 'Rejected'
  END)
WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.entityStatus')) IN ('Superseded', 'Invalidated');

UPDATE entity_extension
SET json = JSON_SET(json, '$.entityStatus',
  CASE JSON_UNQUOTE(JSON_EXTRACT(json, '$.entityStatus'))
    WHEN 'Superseded' THEN 'Deprecated'
    ELSE 'Rejected'
  END)
WHERE jsonSchema = 'contextMemory'
  AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.entityStatus')) IN ('Superseded', 'Invalidated');

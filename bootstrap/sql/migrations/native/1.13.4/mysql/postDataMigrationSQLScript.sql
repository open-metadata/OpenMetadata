-- MCP configuration lives solely in the mcpConfiguration setting. Drop the app-level copy, which
-- no code reads, and hide the now empty configure step.
UPDATE installed_apps
SET json = JSON_SET(JSON_REMOVE(json, '$.appConfiguration'), '$.allowConfiguration', CAST('false' AS JSON))
WHERE name = 'McpApplication';

UPDATE apps_marketplace
SET json = JSON_SET(JSON_REMOVE(json, '$.appConfiguration'), '$.allowConfiguration', CAST('false' AS JSON))
WHERE name = 'McpApplication';

UPDATE entity_extension
SET json = JSON_SET(JSON_REMOVE(json, '$.appConfiguration'), '$.allowConfiguration', CAST('false' AS JSON))
WHERE extension LIKE 'app.version.%'
  AND json->>'$.name' = 'McpApplication';

-- Remove page related-entity relationships that point at a column. 'tableColumn' is a
-- search-only pseudo-type with no repository, so resolving such a related-entity row throws
-- "Entity repository for tableColumn not found" and 404s the Context Center list.
-- page relatedEntities are stored as HAS (relation 10).
DELETE FROM entity_relationship
WHERE fromEntity = 'tableColumn'
  AND toEntity = 'page'
  AND relation = 10;

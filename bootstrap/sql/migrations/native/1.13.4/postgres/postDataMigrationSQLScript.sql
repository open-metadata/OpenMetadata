-- Remove related-entity relationships that point at a column. 'tableColumn' is a search-only
-- pseudo-type with no repository, so resolving it throws "Entity repository for tableColumn not
-- found" and 404s the Knowledge/Context Center list. relation 10 = HAS.
DELETE FROM entity_relationship
WHERE fromEntity = 'tableColumn'
  AND toEntity IN ('page', 'contextMemory')
  AND relation = 10;

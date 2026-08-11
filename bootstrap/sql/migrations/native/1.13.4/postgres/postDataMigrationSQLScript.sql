-- Remove page related-entity relationships that point at a column. 'tableColumn' is a
-- search-only pseudo-type with no repository, so resolving such a related-entity row throws
-- "Entity repository for tableColumn not found" and 404s the Context Center list.
-- page relatedEntities are stored as HAS (relation 10).
DELETE FROM entity_relationship
WHERE fromEntity = 'tableColumn'
  AND toEntity = 'page'
  AND relation = 10;

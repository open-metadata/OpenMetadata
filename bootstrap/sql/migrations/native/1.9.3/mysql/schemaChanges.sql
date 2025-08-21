-- Update the relation between table and dataContract to 0 (CONTAINS)
UPDATE entity_relationship
SET relation = 0
WHERE fromEntity = 'table' AND toEntity = 'dataContract' AND relation = 10;
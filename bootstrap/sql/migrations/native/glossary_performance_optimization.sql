-- Migration to optimize glossary term performance for large glossaries
-- This addresses issue #23934 by adding indexes for common query patterns

-- Add index on parent relationship for faster child term queries
ALTER TABLE entity_relationship
ADD INDEX idx_glossary_parent_child (fromEntity, toEntity, relation)
WHERE relation = 'PARENT';

-- Add index on glossary term entity for faster filtering by glossary
ALTER TABLE glossary_term_entity
ADD INDEX idx_glossary_term_name (name);

-- Add index for deleted field for faster filtering of active terms
ALTER TABLE glossary_term_entity
ADD INDEX idx_glossary_term_deleted (deleted);

-- Add composite index for common query patterns (glossary + status + deleted)
ALTER TABLE glossary_term_entity
ADD INDEX idx_glossary_term_composite (
  CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.glossary.fullyQualifiedName')) AS CHAR(255)),
  CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.status')) AS CHAR(50)),
  deleted
);

-- Add index for parent FQN to speed up hierarchy queries
ALTER TABLE glossary_term_entity
ADD INDEX idx_glossary_term_parent (
  CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.parent.fullyQualifiedName')) AS CHAR(255))
);
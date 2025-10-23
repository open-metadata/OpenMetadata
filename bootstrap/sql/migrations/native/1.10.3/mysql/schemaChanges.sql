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

-- Add generated columns for efficient querying without JSON_EXTRACT
ALTER TABLE glossary_term_entity
ADD COLUMN glossary_fqn VARCHAR(255) AS (JSON_UNQUOTE(JSON_EXTRACT(json, '$.glossary.fullyQualifiedName'))) STORED,
ADD COLUMN status VARCHAR(50) AS (JSON_UNQUOTE(JSON_EXTRACT(json, '$.status'))) STORED,
ADD COLUMN parent_fqn VARCHAR(255) AS (JSON_UNQUOTE(JSON_EXTRACT(json, '$.parent.fullyQualifiedName'))) STORED;

-- Add composite index for common query patterns using generated columns
ALTER TABLE glossary_term_entity
ADD INDEX idx_glossary_term_composite (glossary_fqn, status, deleted);

-- Add index for parent FQN to speed up hierarchy queries using generated column
ALTER TABLE glossary_term_entity
ADD INDEX idx_glossary_term_parent (parent_fqn);
-- Migration to optimize glossary term performance for large glossaries (PostgreSQL)
-- This addresses issue #23934 by adding indexes for common query patterns

-- Add index on parent relationship for faster child term queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_glossary_parent_child
ON entity_relationship (fromEntity, toEntity, relation)
WHERE relation = 'PARENT';

-- Add index on glossary term entity for faster filtering by glossary
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_glossary_term_name
ON glossary_term_entity (name);

-- Add index for deleted field for faster filtering of active terms
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_glossary_term_deleted
ON glossary_term_entity (deleted);

-- Add index for parent FQN to speed up hierarchy queries (using GIN for JSON)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_glossary_term_parent
ON glossary_term_entity USING GIN (
  (json ->> 'parent') jsonb_path_ops
);

-- Add composite index for common query patterns (glossary + status + deleted)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_glossary_term_composite
ON glossary_term_entity (
  (json ->> 'glossary'),
  (json ->> 'status'),
  deleted
);
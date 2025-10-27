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

-- Add generated columns for efficient querying without JSON extraction
ALTER TABLE glossary_term_entity
ADD COLUMN glossary_fqn VARCHAR(255) GENERATED ALWAYS AS (json #>> '{glossary,fullyQualifiedName}') STORED,
ADD COLUMN status VARCHAR(50) GENERATED ALWAYS AS (json ->> 'status') STORED,
ADD COLUMN parent_fqn VARCHAR(255) GENERATED ALWAYS AS (json #>> '{parent,fullyQualifiedName}') STORED;

-- Add index for parent FQN using generated column
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_glossary_term_parent
ON glossary_term_entity (parent_fqn);

-- Add composite index for common query patterns using generated columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_glossary_term_composite
ON glossary_term_entity (glossary_fqn, status, deleted);
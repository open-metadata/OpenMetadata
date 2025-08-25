<<<<<<< HEAD
-- Add displayName virtual column to glossary_term_entity for efficient search
ALTER TABLE glossary_term_entity ADD COLUMN IF NOT EXISTS displayName VARCHAR(256) GENERATED ALWAYS AS (json ->> 'displayName') STORED;

-- Create index on displayName for efficient LIKE queries
CREATE INDEX IF NOT EXISTS idx_glossary_term_displayName ON glossary_term_entity (displayName);
=======
-- Update the relation between table and dataContract to 0 (CONTAINS)
UPDATE entity_relationship
SET relation = 0
WHERE fromEntity = 'table' AND toEntity = 'dataContract' AND relation = 10;
>>>>>>> upstream/main

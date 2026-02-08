-- Add entityStatus generated column to glossary_term_entity table for efficient filtering
-- This supports the entityStatus filtering in the search API endpoint
ALTER TABLE glossary_term_entity 
  ADD COLUMN IF NOT EXISTS entityStatus VARCHAR(32) 
  GENERATED ALWAYS AS (json ->> 'entityStatus') 
  STORED;

-- Add index for efficient entityStatus filtering
CREATE INDEX IF NOT EXISTS idx_glossary_term_entity_status ON glossary_term_entity (entityStatus);
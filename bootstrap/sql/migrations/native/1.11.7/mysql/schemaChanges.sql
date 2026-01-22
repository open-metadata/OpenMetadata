-- Add entityStatus generated column to glossary_term_entity table for efficient filtering
-- This supports the entityStatus filtering in the search API endpoint
ALTER TABLE glossary_term_entity
  ADD COLUMN entityStatus VARCHAR(32) 
  GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.entityStatus'))) 
  STORED;

-- Add index for efficient entityStatus filtering
CREATE INDEX idx_glossary_term_entity_status ON glossary_term_entity (entityStatus);
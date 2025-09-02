-- Modify the path to the auto-generated operation column to extract from the JSON field
ALTER TABLE profiler_data_time_series
MODIFY COLUMN operation VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.profileData.operation') NULL;

-- Add displayName virtual column to glossary_term_entity for efficient search
ALTER TABLE glossary_term_entity ADD COLUMN displayName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.displayName') STORED;

-- Create index on displayName for efficient LIKE queries
CREATE INDEX idx_glossary_term_displayName ON glossary_term_entity (displayName);
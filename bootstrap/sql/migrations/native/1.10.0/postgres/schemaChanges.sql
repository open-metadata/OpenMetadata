-- Add virtual column for customUnitOfMeasurement in metric_entity table
-- This improves query performance by allowing direct indexing instead of JSON_EXTRACT

-- Add generated column for customUnitOfMeasurement in PostgreSQL
ALTER TABLE metric_entity 
ADD COLUMN customUnitOfMeasurement VARCHAR(256) 
GENERATED ALWAYS AS ((json->>'customUnitOfMeasurement')::VARCHAR(256)) STORED;

-- Add index on the column for better query performance
-- This allows efficient ORDER BY and filtering operations
CREATE INDEX idx_metric_custom_unit ON metric_entity(customUnitOfMeasurement);
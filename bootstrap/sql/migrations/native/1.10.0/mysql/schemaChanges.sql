-- Add virtual column for customUnitOfMeasurement in metric_entity table
-- This improves query performance by allowing direct indexing instead of JSON_EXTRACT

-- Add virtual column for customUnitOfMeasurement
ALTER TABLE metric_entity 
ADD COLUMN customUnitOfMeasurement VARCHAR(256) 
GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.customUnitOfMeasurement'))) VIRTUAL;

-- Add index on the virtual column for better query performance
-- This allows efficient ORDER BY and filtering operations
CREATE INDEX idx_metric_custom_unit ON metric_entity(customUnitOfMeasurement);
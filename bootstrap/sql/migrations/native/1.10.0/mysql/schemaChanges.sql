-- Add virtual column for customUnitOfMeasurement
ALTER TABLE metric_entity 
ADD COLUMN customUnitOfMeasurement VARCHAR(256) 
GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.customUnitOfMeasurement'))) VIRTUAL;
-- Add index on the virtual column
CREATE INDEX idx_metric_custom_unit ON metric_entity(customUnitOfMeasurement);
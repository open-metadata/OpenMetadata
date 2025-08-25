-- Add generated column for customUnitOfMeasurement
ALTER TABLE metric_entity 
ADD COLUMN customUnitOfMeasurement VARCHAR(256) 
GENERATED ALWAYS AS ((json->>'customUnitOfMeasurement')::VARCHAR(256)) STORED;
-- Add index on the column
CREATE INDEX idx_metric_custom_unit ON metric_entity(customUnitOfMeasurement);
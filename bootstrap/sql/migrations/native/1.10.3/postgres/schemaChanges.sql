-- Migration for 1.10.3: Add generated columns and indexes for entity status visibility filtering

-- Add generated column for entityStatus to data_contract_entity
ALTER TABLE data_contract_entity 
ADD COLUMN entityStatus VARCHAR(50) GENERATED ALWAYS AS (json->>'entityStatus') STORED;

-- Add generated column for entityStatus to metric_entity  
ALTER TABLE metric_entity 
ADD COLUMN entityStatus VARCHAR(50) GENERATED ALWAYS AS (json->>'entityStatus') STORED;

-- Add generated column for entityStatus to data_product_entity
ALTER TABLE data_product_entity 
ADD COLUMN entityStatus VARCHAR(50) GENERATED ALWAYS AS (json->>'entityStatus') STORED;

-- Create optimized indexes for visibility filtering on data_contract_entity
CREATE INDEX idx_data_contract_visibility ON data_contract_entity (entityStatus, id);

-- Create optimized indexes for visibility filtering on metric_entity
CREATE INDEX idx_metric_visibility ON metric_entity (entityStatus, id);

-- Create optimized indexes for visibility filtering on data_product_entity  
CREATE INDEX idx_data_product_visibility ON data_product_entity (entityStatus, id);


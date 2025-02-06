-- Add constraint to apps_data_store
ALTER TABLE apps_data_store ADD CONSTRAINT entity_relationship_pky PRIMARY KEY (identifier, type);
UPDATE user_entity SET json = JSON_SET(json, '$.isBot', false) WHERE JSON_EXTRACT(json, '$.isBot') IS NULL;
ALTER TABLE user_entity  ADD COLUMN isBot BOOLEAN GENERATED ALWAYS AS (json -> '$.isBot') NOT NULL;
CREATE INDEX idx_isBot ON user_entity (isBot);
DELETE from apps_data_store;
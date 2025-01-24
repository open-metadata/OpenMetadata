-- Add constraint to apps_data_store
ALTER TABLE apps_data_store ADD CONSTRAINT entity_relationship_pkey PRIMARY KEY (identifier, type);
UPDATE user_entity SET json = JSON_SET(json, '$.isBot', false) WHERE JSON_EXTRACT(json, '$.isBot') IS NULL;
ALTER TABLE user_entity  ADD COLUMN isBot BOOLEAN GENERATED ALWAYS AS (json -> '$.isBot') NOT NULL;
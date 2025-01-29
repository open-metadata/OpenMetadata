-- Add constraint to apps_data_store
ALTER TABLE apps_data_store ADD CONSTRAINT entity_relationship_pky PRIMARY KEY (identifier, type);
UPDATE user_entity SET json = jsonb_set(json::jsonb, '{isBot}', 'false'::jsonb, true) WHERE NOT (json ?? 'isBot');
ALTER TABLE user_entity ADD COLUMN isBot BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED NOT NULL;
CREATE INDEX idx_isBot ON user_entity (isBot);
DELETE from apps_data_store;
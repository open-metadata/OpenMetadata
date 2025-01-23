-- Add constraint to apps_data_store
ALTER TABLE apps_data_store ADD CONSTRAINT entity_relationship_pkey PRIMARY KEY (identifier, type);
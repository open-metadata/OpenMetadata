-- Composite index for apps_extension_time_series to fix query performance
-- Create index only if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_apps_extension_composite 
ON apps_extension_time_series(appId, extension, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_er_toEntity_toId_relation 
ON entity_relationship (toEntity, toId, relation);

CREATE INDEX IF NOT EXISTS idx_er_fromEntity_toEntity 
ON entity_relationship (fromEntity, toEntity);

CREATE INDEX IF NOT EXISTS idx_er_relation_fromEntity_toId 
ON entity_relationship (relation, fromEntity, toId);

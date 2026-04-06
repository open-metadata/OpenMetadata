-- Add FQN hash columns to entity_relationship to enable fast prefix-based bulk deletion.
-- This allows deleting all relationships for an entire entity subtree in a single indexed query
-- instead of walking the tree entity-by-entity.
ALTER TABLE entity_relationship
    ADD COLUMN IF NOT EXISTS fromFQNHash VARCHAR(768) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS toFQNHash   VARCHAR(768) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_er_from_fqn_hash ON entity_relationship (fromFQNHash(768));
CREATE INDEX IF NOT EXISTS idx_er_to_fqn_hash   ON entity_relationship (toFQNHash(768));

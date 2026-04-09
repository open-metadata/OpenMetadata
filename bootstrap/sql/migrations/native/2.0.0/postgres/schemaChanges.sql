-- MCP tables are created in 1.13.0 migration. This file is intentionally empty.

-- Fix entity_deletion_lock column types: id and entityId were created as native UUID
-- in 1.9.0 but the rest of the codebase uses VARCHAR(36) for UUID columns so that
-- BindUUID (which binds via UUID.toString()) can compare them without an explicit cast.
ALTER TABLE entity_deletion_lock
    ALTER COLUMN id TYPE VARCHAR(36) USING id::VARCHAR,
    ALTER COLUMN entityId TYPE VARCHAR(36) USING entityId::VARCHAR;
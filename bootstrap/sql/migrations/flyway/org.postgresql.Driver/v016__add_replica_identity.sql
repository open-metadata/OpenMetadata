--
-- Add replica identity for PostgreSQL replication support (for upgrades)
-- This is required for PostgreSQL read replicas to handle UPDATE statements properly
-- See: https://github.com/open-metadata/OpenMetadata/issues/12880
--
-- Note: New installations already have replica identity set in v001__create_db_connection_info.sql
-- This migration is only for existing installations that need to add replica identity
--

-- Set replica identity for commonly updated tables using their unique constraints
-- Using DO blocks to handle cases where replica identity is already set or indexes might have different names
DO $$
BEGIN
    -- Set replica identity for tag table (uses unique constraint)
    -- Check if replica identity is already set to avoid errors
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c 
        WHERE c.relname = 'tag' 
        AND c.relreplident != 'd'  -- 'd' means default (no replica identity)
    ) THEN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tag_fqnhash_key') THEN
            ALTER TABLE tag REPLICA IDENTITY USING INDEX tag_fqnhash_key;
        ELSIF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tag_fullyqualifiedname_key') THEN
            ALTER TABLE tag REPLICA IDENTITY USING INDEX tag_fullyqualifiedname_key;
        ELSE
            -- Fallback to full replica identity if no suitable index found
            ALTER TABLE tag REPLICA IDENTITY FULL;
        END IF;
    END IF;

    -- Set replica identity for tag_category table (uses name unique constraint)
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c 
        WHERE c.relname = 'tag_category' 
        AND c.relreplident != 'd'
    ) THEN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tag_category_name_key') THEN
            ALTER TABLE tag_category REPLICA IDENTITY USING INDEX tag_category_name_key;
        ELSE
            ALTER TABLE tag_category REPLICA IDENTITY FULL;
        END IF;
    END IF;

    -- Set replica identity for other commonly updated entity tables using primary keys
    -- Only set if not already configured
    IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'bot_entity' AND c.relreplident != 'd') 
       AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bot_entity_pkey') THEN
        ALTER TABLE bot_entity REPLICA IDENTITY USING INDEX bot_entity_pkey;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'role_entity' AND c.relreplident != 'd') 
       AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_entity_pkey') THEN
        ALTER TABLE role_entity REPLICA IDENTITY USING INDEX role_entity_pkey;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'policy_entity' AND c.relreplident != 'd') 
       AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'policy_entity_pkey') THEN
        ALTER TABLE policy_entity REPLICA IDENTITY USING INDEX policy_entity_pkey;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'pipeline_service_entity' AND c.relreplident != 'd') 
       AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_service_entity_pkey') THEN
        ALTER TABLE pipeline_service_entity REPLICA IDENTITY USING INDEX pipeline_service_entity_pkey;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'ingestion_pipeline_entity' AND c.relreplident != 'd') 
       AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ingestion_pipeline_entity_pkey') THEN
        ALTER TABLE ingestion_pipeline_entity REPLICA IDENTITY USING INDEX ingestion_pipeline_entity_pkey;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the migration
        RAISE NOTICE 'Error setting replica identity: %', SQLERRM;
END $$;
-- Compact grouping data; the source tables remain authoritative.
CREATE TABLE IF NOT EXISTS test_case_incident_dimension (
    fqnHash varchar(768) NOT NULL PRIMARY KEY,
    id varchar(36) NOT NULL,
    entityFQN varchar(1024) NOT NULL,
    tableFqn varchar(512) NOT NULL,
    deleted boolean
);
CREATE INDEX IF NOT EXISTS idx_tcid_id ON test_case_incident_dimension (id);
CREATE INDEX IF NOT EXISTS idx_tcid_table ON test_case_incident_dimension (tableFqn, deleted);
CREATE TABLE IF NOT EXISTS test_case_incident_definition (
    fromId varchar(36) NOT NULL,
    toId varchar(36) NOT NULL,
    relationType varchar(64) NOT NULL DEFAULT '',
    PRIMARY KEY (fromId, toId, relationType)
);
CREATE INDEX IF NOT EXISTS idx_tcid_definition_test ON test_case_incident_definition (toId, fromId);

-- This source index precedes the bounded definition-membership backfill.
CREATE INDEX IF NOT EXISTS idx_er_fromentity_toentity_relation_toid
    ON entity_relationship (fromEntity,toEntity,relation,toId);

CREATE OR REPLACE FUNCTION sync_incident_case_dimension() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM test_case_incident_dimension WHERE fqnHash=OLD.fqnHash;
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.fqnHash IS DISTINCT FROM NEW.fqnHash THEN
        DELETE FROM test_case_incident_dimension WHERE fqnHash=OLD.fqnHash;
    END IF;
    IF NEW.fqnHash IS NOT NULL THEN
        INSERT INTO test_case_incident_dimension (fqnHash,id,entityFQN,tableFqn,deleted)
        VALUES (NEW.fqnHash,NEW.json->>'id',NEW.json->>'entityFQN',
            TRIM(TRAILING '>' FROM SPLIT_PART(NEW.json->>'entityLink','::',3)),(NEW.json->>'deleted')::boolean)
        ON CONFLICT (fqnHash) DO UPDATE SET id=EXCLUDED.id,entityFQN=EXCLUDED.entityFQN,
            tableFqn=EXCLUDED.tableFqn,deleted=EXCLUDED.deleted
        WHERE (test_case_incident_dimension.id,test_case_incident_dimension.entityFQN,
            test_case_incident_dimension.tableFqn,test_case_incident_dimension.deleted)
            IS DISTINCT FROM (EXCLUDED.id,EXCLUDED.entityFQN,EXCLUDED.tableFqn,EXCLUDED.deleted);
    END IF;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION sync_incident_definition_dimension() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND (OLD.fromId,OLD.toId,OLD.relationType,OLD.fromEntity,OLD.toEntity,OLD.relation)
        IS NOT DISTINCT FROM (NEW.fromId,NEW.toId,NEW.relationType,NEW.fromEntity,NEW.toEntity,NEW.relation) THEN
        RETURN NEW;
    END IF;
    IF TG_OP <> 'INSERT' THEN
        IF OLD.fromEntity='testDefinition' AND OLD.toEntity='testCase' AND OLD.relation=0 THEN
            DELETE FROM test_case_incident_definition WHERE fromId=OLD.fromId AND toId=OLD.toId AND relationType=OLD.relationType;
        END IF;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        IF NEW.fromEntity='testDefinition' AND NEW.toEntity='testCase' AND NEW.relation=0 THEN
            INSERT INTO test_case_incident_definition (fromId,toId,relationType)
            VALUES (NEW.fromId,NEW.toId,NEW.relationType) ON CONFLICT DO NOTHING;
        END IF;
        RETURN NEW;
    END IF;
    RETURN OLD;
END;
$$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_tcid_case' AND tgrelid='test_case'::regclass) THEN
        CREATE TRIGGER trg_tcid_case AFTER INSERT OR UPDATE OR DELETE ON test_case
            FOR EACH ROW EXECUTE FUNCTION sync_incident_case_dimension();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_tcid_definition' AND tgrelid='entity_relationship'::regclass) THEN
        CREATE TRIGGER trg_tcid_definition AFTER INSERT OR UPDATE OR DELETE ON entity_relationship
            FOR EACH ROW EXECUTE FUNCTION sync_incident_definition_dimension();
    END IF;
END;
$$;

-- Compact grouping data; the source tables remain authoritative.
CREATE TABLE IF NOT EXISTS test_case_incident_dimension (
    fqnHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    id varchar(36) NOT NULL,
    entityFQN varchar(1024) NOT NULL,
    tableFqn varchar(512) NOT NULL,
    deleted boolean,
    INDEX idx_tcid_id (id),
    INDEX idx_tcid_table (tableFqn, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS test_case_incident_definition (
    fromId varchar(36) NOT NULL,
    toId varchar(36) NOT NULL,
    relationType varchar(64) NOT NULL DEFAULT '',
    PRIMARY KEY (fromId, toId, relationType),
    INDEX idx_tcid_definition_test (toId, fromId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Native migration statement logs gate replay; plain CREATE supports MySQL before 8.0.29.
-- JSON is read directly: MySQL prohibits NEW/OLD references to generated source columns.
DELIMITER $$
CREATE TRIGGER trg_tcid_case_insert AFTER INSERT ON test_case FOR EACH ROW
BEGIN
    IF NEW.fqnHash IS NOT NULL THEN
        INSERT INTO test_case_incident_dimension (fqnHash,id,entityFQN,tableFqn,deleted)
        VALUES (NEW.fqnHash, JSON_UNQUOTE(JSON_EXTRACT(NEW.json, '$.id')), JSON_UNQUOTE(JSON_EXTRACT(NEW.json, '$.entityFQN')), TRIM(TRAILING '>' FROM SUBSTRING_INDEX(SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(NEW.json, '$.entityLink')), '::', 3), '::', -1)), JSON_EXTRACT(NEW.json, '$.deleted'))
        ON DUPLICATE KEY UPDATE id=VALUES(id),entityFQN=VALUES(entityFQN),tableFqn=VALUES(tableFqn),deleted=VALUES(deleted);
    END IF;
END$$
CREATE TRIGGER trg_tcid_case_update AFTER UPDATE ON test_case FOR EACH ROW
BEGIN
    IF NOT (OLD.fqnHash <=> NEW.fqnHash) OR
       NOT (JSON_EXTRACT(OLD.json,'$.id') <=> JSON_EXTRACT(NEW.json,'$.id')) OR
       NOT (JSON_EXTRACT(OLD.json,'$.entityFQN') <=> JSON_EXTRACT(NEW.json,'$.entityFQN')) OR
       NOT (JSON_EXTRACT(OLD.json,'$.entityLink') <=> JSON_EXTRACT(NEW.json,'$.entityLink')) OR
       NOT (JSON_EXTRACT(OLD.json,'$.deleted') <=> JSON_EXTRACT(NEW.json,'$.deleted')) THEN
        IF NOT (OLD.fqnHash <=> NEW.fqnHash) THEN
            DELETE FROM test_case_incident_dimension WHERE fqnHash=OLD.fqnHash;
        END IF;
        IF NEW.fqnHash IS NOT NULL THEN
            INSERT INTO test_case_incident_dimension (fqnHash,id,entityFQN,tableFqn,deleted)
            VALUES (NEW.fqnHash, JSON_UNQUOTE(JSON_EXTRACT(NEW.json, '$.id')), JSON_UNQUOTE(JSON_EXTRACT(NEW.json, '$.entityFQN')), TRIM(TRAILING '>' FROM SUBSTRING_INDEX(SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(NEW.json, '$.entityLink')), '::', 3), '::', -1)), JSON_EXTRACT(NEW.json, '$.deleted'))
            ON DUPLICATE KEY UPDATE id=VALUES(id),entityFQN=VALUES(entityFQN),tableFqn=VALUES(tableFqn),deleted=VALUES(deleted);
        END IF;
    END IF;
END$$
CREATE TRIGGER trg_tcid_case_delete AFTER DELETE ON test_case FOR EACH ROW
BEGIN
    DELETE FROM test_case_incident_dimension WHERE fqnHash=OLD.fqnHash;
END$$
CREATE TRIGGER trg_tcid_definition_insert AFTER INSERT ON entity_relationship FOR EACH ROW
BEGIN
    IF NEW.fromEntity='testDefinition' AND NEW.toEntity='testCase' AND NEW.relation=0 THEN
        INSERT INTO test_case_incident_definition (fromId,toId,relationType)
        VALUES (NEW.fromId,NEW.toId,NEW.relationType)
        ON DUPLICATE KEY UPDATE fromId=VALUES(fromId);
    END IF;
END$$
CREATE TRIGGER trg_tcid_definition_update AFTER UPDATE ON entity_relationship FOR EACH ROW
BEGIN
    IF NOT (OLD.fromId <=> NEW.fromId) OR NOT (OLD.toId <=> NEW.toId) OR NOT (OLD.relationType <=> NEW.relationType) OR NOT (OLD.fromEntity <=> NEW.fromEntity) OR NOT (OLD.toEntity <=> NEW.toEntity) OR NOT (OLD.relation <=> NEW.relation) THEN
        IF OLD.fromEntity='testDefinition' AND OLD.toEntity='testCase' AND OLD.relation=0 THEN
            DELETE FROM test_case_incident_definition WHERE fromId=OLD.fromId AND toId=OLD.toId AND relationType=OLD.relationType;
        END IF;
        IF NEW.fromEntity='testDefinition' AND NEW.toEntity='testCase' AND NEW.relation=0 THEN
            INSERT INTO test_case_incident_definition (fromId,toId,relationType)
            VALUES (NEW.fromId,NEW.toId,NEW.relationType)
            ON DUPLICATE KEY UPDATE fromId=VALUES(fromId);
        END IF;
    END IF;
END$$
CREATE TRIGGER trg_tcid_definition_delete AFTER DELETE ON entity_relationship FOR EACH ROW
BEGIN
    IF OLD.fromEntity='testDefinition' AND OLD.toEntity='testCase' AND OLD.relation=0 THEN
        DELETE FROM test_case_incident_definition WHERE fromId=OLD.fromId AND toId=OLD.toId AND relationType=OLD.relationType;
    END IF;
END$$
DELIMITER ;

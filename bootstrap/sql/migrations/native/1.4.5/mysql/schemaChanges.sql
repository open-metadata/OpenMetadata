ALTER TABLE thread_entity
ADD COLUMN hash_id VARCHAR(32) GENERATED ALWAYS AS (MD5(id)) STORED;
CREATE INDEX idx_thread_entity_hash_id ON thread_entity(hash_id);

ALTER TABLE thread_entity
ADD COLUMN testCaseResolutionStatusId VARCHAR(255)
    GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(json, '$.task.testCaseResolutionStatusId'))) STORED;
CREATE INDEX idx_testCaseResolutionStatusId ON thread_entity (testCaseResolutionStatusId);

CREATE INDEX idx_entity_relationship_fromEntity_fromId_relation
ON entity_relationship (fromEntity, fromId, relation);

CREATE INDEX idx_field_relationship_from ON field_relationship (fromType, fromFQNHash, toType, relation);
CREATE INDEX idx_field_relationship_to ON field_relationship (fromType, toFQNHash, toType, relation);


DELIMITER $$

CREATE PROCEDURE IF NOT EXISTS CreateIndexesIfNeeded()
BEGIN
    SET @index_name_1 = 'idx_thread_entity_on_entityId';
    SET @table_name = 'thread_entity';
    SET @schema_name = DATABASE();

    SELECT COUNT(1) INTO @index_exists_1
    FROM information_schema.statistics
    WHERE table_schema = @schema_name
      AND table_name = @table_name
      AND index_name = @index_name_1;

    IF @index_exists_1 = 0 THEN
      SET @create_index_sql_1 = CONCAT('CREATE INDEX ', @index_name_1, ' ON ', @table_name, ' (entityId)');
      PREPARE stmt1 FROM @create_index_sql_1;
      EXECUTE stmt1;
      DEALLOCATE PREPARE stmt1;
    END IF;

    SET @index_name_2 = 'idx_thread_entity_on_type_taskStatus';

    SELECT COUNT(1) INTO @index_exists_2
    FROM information_schema.statistics
    WHERE table_schema = @schema_name
      AND table_name = @table_name
      AND index_name = @index_name_2;

    IF @index_exists_2 = 0 THEN
      SET @create_index_sql_2 = CONCAT('CREATE INDEX ', @index_name_2, ' ON ', @table_name, ' (type, taskStatus)');
      PREPARE stmt2 FROM @create_index_sql_2;
      EXECUTE stmt2;
      DEALLOCATE PREPARE stmt2;
    END IF;
END$$

DELIMITER ;

-- Call the stored procedure to create indexes if not exist
CALL CreateIndexesIfNeeded();




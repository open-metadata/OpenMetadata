ALTER TABLE thread_entity
ADD COLUMN hash_id VARCHAR(32)
    GENERATED ALWAYS AS (MD5(json ->> 'id')) STORED;
CREATE INDEX idx_thread_entity_hash_id ON thread_entity(hash_id);

ALTER TABLE thread_entity
ADD COLUMN testCaseResolutionStatusId TEXT GENERATED ALWAYS AS (json -> 'task' ->> 'testCaseResolutionStatusId') STORED;
CREATE INDEX idx_testCaseResolutionStatusId ON thread_entity (testCaseResolutionStatusId);

CREATE INDEX idx_entity_relationship_fromEntity_fromId_relation
ON entity_relationship (fromEntity, fromId, relation);

CREATE INDEX idx_field_relationship_from ON field_relationship (fromType, fromFQNHash, toType, relation);
CREATE INDEX idx_field_relationship_to ON field_relationship (fromType, toFQNHash, toType, relation);

CREATE INDEX idx_entity_id ON thread_entity (entityId);

CREATE INDEX idx_type_task_status ON thread_entity (type, taskStatus);

-- Clean dangling workflows not removed after test connection
truncate automations_workflow;

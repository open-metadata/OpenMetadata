-- Two governance workflow reads look runs up by the entity they ran for: the run list on an
-- entity's page (entityLink filter) and Data Retention's "is there a newer run of this workflow for
-- this entity" probe. Nothing indexed entityLink, so both scanned workflow_instance_time_series.
-- entityLink is a TEXT column, which InnoDB cannot index whole, so key its md5 through a VIRTUAL
-- column (a metadata-only add); runs with no entity share md5(''). MySQL has no
-- `CREATE INDEX IF NOT EXISTS`, so both statements are guarded via information_schema. InnoDB
-- builds the secondary index with ALGORITHM=INPLACE and permits concurrent DML.
SET @wf_instance_entity_link_hash_column_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'workflow_instance_time_series'
        AND column_name = 'entityLinkHash'
    ),
    'SELECT 1',
    'ALTER TABLE workflow_instance_time_series ADD COLUMN entityLinkHash CHAR(32) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (MD5(COALESCE(json ->> ''$.variables.global_relatedEntity'', ''''))) VIRTUAL'
  )
);
PREPARE wf_instance_entity_link_hash_column_stmt FROM @wf_instance_entity_link_hash_column_ddl;
EXECUTE wf_instance_entity_link_hash_column_stmt;
DEALLOCATE PREPARE wf_instance_entity_link_hash_column_stmt;

SET @wf_instance_entity_link_index_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'workflow_instance_time_series'
        AND index_name = 'idx_wf_instance_entity_link'
    ),
    'SELECT 1',
    'CREATE INDEX idx_wf_instance_entity_link ON workflow_instance_time_series (entityLinkHash, workflowDefinitionId, timestamp)'
  )
);
PREPARE wf_instance_entity_link_index_stmt FROM @wf_instance_entity_link_index_ddl;
EXECUTE wf_instance_entity_link_index_stmt;
DEALLOCATE PREPARE wf_instance_entity_link_index_stmt;

ALTER TABLE workflow_instance_time_series
    ADD COLUMN scheduleRunId VARCHAR(36)
    GENERATED ALWAYS AS (json ->> '$.scheduleRunId');
ALTER TABLE workflow_instance_time_series
    ADD INDEX idx_workflow_instance_schedule_run_id (scheduleRunId);

ALTER TABLE workflow_instance_state_time_series
    ADD COLUMN scheduleRunId VARCHAR(36)
    GENERATED ALWAYS AS (json ->> '$.scheduleRunId');
ALTER TABLE workflow_instance_state_time_series
    ADD INDEX idx_workflow_instance_state_schedule_run_id (scheduleRunId);

-- Marker: forces v1140 Java runDataMigration() to re-run via the reprocessing path on existing
-- DBs after fixing migrateWorkflowJson trigger-output bug in MigrationUtil.java. Idempotent.
DELETE FROM SERVER_MIGRATION_SQL_LOGS WHERE 1=0;

-- Update entityLink generated column to read from global_entityList[0] instead of global_relatedEntity
ALTER TABLE workflow_instance_time_series
MODIFY COLUMN entityLink TEXT GENERATED ALWAYS AS (json ->> '$.variables.global_entityList[0]');

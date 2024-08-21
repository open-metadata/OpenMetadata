DROP INDEX IF EXISTS taskAssigneesIds_index;

-- Drop the column
ALTER TABLE thread_entity DROP COLUMN IF EXISTS taskAssigneesIds;

ALTER TABLE thread_entity
ADD COLUMN taskAssigneesIds TEXT GENERATED ALWAYS AS (
    TRIM(BOTH '[]' FROM (
        (jsonb_path_query_array(json, '$.task.assignees[*].id'))::TEXT
    ))
) STORED;


CREATE INDEX idx_task_assignees_ids_fulltext
ON thread_entity USING GIN (to_tsvector('simple', taskAssigneesIds));

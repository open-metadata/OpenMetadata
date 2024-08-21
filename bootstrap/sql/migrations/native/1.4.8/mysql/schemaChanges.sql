-- Drop the index
DROP INDEX taskAssigneesIds_index ON thread_entity;

-- Drop the column
ALTER TABLE thread_entity DROP COLUMN taskAssigneesIds;

ALTER TABLE thread_entity
ADD COLUMN taskAssigneesIds TEXT GENERATED ALWAYS AS (
    REPLACE(
        REPLACE(
            JSON_UNQUOTE(
                JSON_EXTRACT(taskAssignees, '$[*].id')
            ), '[', ''
        ), ']', ''
    )
) STORED;

CREATE FULLTEXT INDEX taskAssigneesIds_index ON thread_entity(taskAssigneesIds);

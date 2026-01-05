ALTER TABLE topic_entity ADD COLUMN namespace VARCHAR(512) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.namespace'))) VIRTUAL;

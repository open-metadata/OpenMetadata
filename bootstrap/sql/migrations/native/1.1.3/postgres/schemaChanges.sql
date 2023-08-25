-- Update table and column profile timestamps to be in milliseconds
UPDATE entity_extension_time_series
SET json = jsonb_set(
	json,
	'{timestamp}',
	to_jsonb(cast(json#>'{timestamp}' as int8) *1000)
)
WHERE
	extension  in ('table.tableProfile', 'table.columnProfile');
;

ALTER TABLE entity_extension_time_series ALTER COLUMN entityFQNHash TYPE VARCHAR(768), ALTER COLUMN jsonSchema TYPE VARCHAR(50) , ALTER COLUMN extension TYPE VARCHAR(100) ,
    ADD CONSTRAINT entity_extension_time_series_constraint UNIQUE (entityFQNHash, extension, timestamp);
ALTER TABLE field_relationship ALTER COLUMN fromFQNHash TYPE VARCHAR(768), ALTER COLUMN toFQNHash TYPE VARCHAR(768);
ALTER TABLE thread_entity ALTER COLUMN entityLink TYPE VARCHAR(3072);
ALTER TABLE tag_usage ALTER COLUMN tagFQNHash TYPE VARCHAR(768), ALTER COLUMN targetFQNHash TYPE VARCHAR(768);
ALTER TABLE test_suite ALTER COLUMN fqnHash TYPE VARCHAR(768);

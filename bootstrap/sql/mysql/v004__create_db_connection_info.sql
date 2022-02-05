-- Set default as false for all existing roles, to avoid unintended manipulation of roles during migration.
UPDATE role_entity
SET json = JSON_SET(json, '$.default', FALSE);

ALTER TABLE role_entity
ADD COLUMN `default` BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.default')),
ADD INDEX(`default`);

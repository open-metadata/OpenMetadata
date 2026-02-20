-- DO NOT RENAME OR DELETE THIS FILE
-- Migrations are applied from Java code based on the version in the file name inside folder openmetadata-service/src/main/java/org/openmetadata/service/migration/mysql/v1114

-- Include `tag_usage.appliedAt` and `tag_usage.appliedBy` fields

ALTER TABLE tag_usage ADD appliedAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tag_usage ADD appliedBy VARCHAR(64) NULL DEFAULT 'admin';

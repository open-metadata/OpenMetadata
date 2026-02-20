-- DO NOT RENAME OR DELETE THIS FILE
-- Migrations are applied from Java code based on the version in the file name inside folder openmetadata-service/src/main/java/org/openmetadata/service/migration/postgres/v1114

-- Include `tag_usage.appliedAt` field
-- Add nullable column and then include default to avoid backfill
ALTER TABLE tag_usage
ADD COLUMN appliedAt TIMESTAMP;

ALTER TABLE tag_usage
ALTER COLUMN appliedAt SET DEFAULT NOW();

-- Include `tag_usage.appliedBy` field
ALTER TABLE tag_usage
ADD COLUMN appliedBy VARCHAR(64) DEFAULT 'admin';

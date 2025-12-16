-- Include `tag_usage.appliedAt` and `tag_usage.appliedBy` fields

ALTER TABLE tag_usage ADD appliedAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tag_usage ADD appliedBy VARCHAR(64) NULL DEFAULT 'Unknown';

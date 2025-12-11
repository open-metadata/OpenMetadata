-- Include `tag_usage.appliedAt` field
ALTER TABLE tag_usage ADD appliedAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP;

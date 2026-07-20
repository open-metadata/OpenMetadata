-- Data-only migration: retarget the stale owner terms aggregation field
-- (owners.displayName.keyword -> ownerDisplayName) in stored searchSettings.
-- Handled in org.openmetadata.service.migration.mysql.v1132.Migration. No schema changes.

-- PII recognizer context keyword cleanup: remove overly broad context keywords
-- (e.g. "code", "security", "address", "name", "call", "check", "save", "social", "number")
-- that caused false-positive PII classification on non-PII columns.
-- Handled by Java data migration in v1132.MigrationUtil.removeBroadPiiContextKeywords.

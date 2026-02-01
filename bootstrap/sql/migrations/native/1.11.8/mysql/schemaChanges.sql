-- Upgrade appliedAt to microsecond precision to match PostgreSQL behavior.
-- Without this, MySQL returns second-precision timestamps which cause spurious
-- diffs in JSON patch operations, leading to deserialization failures.
ALTER TABLE tag_usage MODIFY appliedAt TIMESTAMP(6) NULL DEFAULT CURRENT_TIMESTAMP(6);

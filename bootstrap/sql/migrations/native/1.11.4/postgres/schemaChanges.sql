-- Include `tag_usage.appliedAt` field
-- Add nullable column and then include default to avoid backfill
ALTER TABLE tag_usage
ADD COLUMN appliedAt TIMESTAMP;

ALTER TABLE tag_usage
ALTER COLUMN appliedAt SET DEFAULT NOW();

-- Include `tag_usage.appliedBy` field
ALTER TABLE tag_usage
ADD COLUMN appliedBy VARCHAR(64) DEFAULT 'Unknown';

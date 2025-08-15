CREATE INDEX IF NOT EXISTS idx_tag_usage_targetfqnhash ON tag_usage(targetfqnhash);
CREATE INDEX IF NOT EXISTS idx_tag_usage_target_source ON tag_usage(targetfqnhash, source);
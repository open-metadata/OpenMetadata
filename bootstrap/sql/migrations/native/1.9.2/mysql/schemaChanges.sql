ALTER TABLE tag_usage ADD INDEX idx_tag_usage_targetfqnhash(targetFQNHash);
ALTER TABLE tag_usage ADD INDEX idx_tag_usage_target_source(targetFQNHash, source);
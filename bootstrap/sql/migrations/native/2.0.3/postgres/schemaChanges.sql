-- Fixes #29493: expand entity_extension.extension from VARCHAR(256) to VARCHAR(512).
-- FullyQualifiedName.buildHash joins one MD5 hash (32 chars) per FQN segment with dots.
-- 8 nesting levels produce 8*32 + 7 = 263 chars, exceeding the old limit.
-- VARCHAR(512) safely covers up to 15 nesting levels (15*32 + 14 = 494 chars).
ALTER TABLE entity_extension ALTER COLUMN extension TYPE VARCHAR(512);

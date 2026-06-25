-- Fixes #29493: expand entity_extension.extension from VARCHAR(256) to VARCHAR(512).
-- FullyQualifiedName.buildHash joins one MD5 hash (32 chars) per FQN segment with dots.
-- 8 nesting levels produce 8*32 + 7 = 263 chars, exceeding the old limit.
-- VARCHAR(512) safely covers up to 15 nesting levels (15*32 + 14 = 494 chars).
-- TEXT is not used here because extension is part of the primary key (id, extension);
-- MySQL cannot use a TEXT column as a PK component without a prefix index.
ALTER TABLE entity_extension ALTER COLUMN extension TYPE VARCHAR(512);

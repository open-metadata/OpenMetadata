-- Column extension keys hash every FQN segment separately and join the hashes with dots.
-- A fourth-level nested table column has eight segments and needs 263 characters.
-- Keep the width aligned with MySQL: 512 supports eleven column levels after the four-part
-- table FQN.
ALTER TABLE entity_extension ALTER COLUMN extension TYPE VARCHAR(512);

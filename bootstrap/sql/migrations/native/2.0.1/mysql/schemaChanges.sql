-- Column extension keys hash every FQN segment separately and join the hashes with dots.
-- A fourth-level nested table column has eight segments and needs 263 characters.
-- VARCHAR(512) supports eleven column levels after the four-part table FQN while keeping
-- extension usable in the composite primary key; MySQL cannot fully index a TEXT value.
ALTER TABLE entity_extension MODIFY COLUMN extension VARCHAR(512) NOT NULL;

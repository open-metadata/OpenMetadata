# On MySQL, entity_extension.extension uses its table's default collation

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `EntityExtensionCollationAlignmentTest`, reviewer
- **Related:** #29493, #37167, #37180, PR #37181

## Context

`entity_extension.extension` was created with no collation, so it takes its table's default like
the table's other text columns. The 2.0.3 migration that widened it to `VARCHAR(512)` also set
`CHARACTER SET ascii COLLATE ascii_bin`, on the belief that it kept the existing character set. It
did not, and it left MySQL databases in two states depending on when they upgraded.

Changing a column's character set makes MySQL copy the whole table and block writes to it. On a
446 GB table that took about 7 hours. An `ascii` column also rejects non-ASCII keys and compares
keys case-sensitively, unlike every other text column in the table. Keys are not only hashes:
custom property values use the property's name.

## Decision

- On MySQL, `extension` uses its table's default character set and collation.
- The target is read from the table, not fixed. OpenMetadata never set a collation on this table,
  so older databases can have a default other than `utf8mb4_0900_ai_ci`, and forcing one would copy
  tables that are already consistent.
- A migration never pins this column to another collation such as `ascii_bin`. Widening it keeps
  its character set and collation, which MySQL can do in place.
- A migration that changes the column's collation first refuses to run if keys of one entity would
  become equal, and names them.

Postgres is not affected.

## Consequences

- Every MySQL database ends up in one state, so later changes to this column have one case.
- Databases still on `ascii_bin` pay one table copy when they align. A large one can convert the
  column ahead of the upgrade, and the migration then has nothing to do.
- An index that includes `extension` must fit MySQL's 3072-byte key limit with `extension` counted
  at 2048 bytes, since `utf8mb4` reserves 4 bytes per character.
- Two custom properties whose names differ only in case collide on one entity. The migration stops
  on existing ones; nothing rejects new ones yet.
- Revisit only if the column stops holding names, so it could hold ASCII hashes alone.

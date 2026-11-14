# A hard delete removes only rows of the deleted entity

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial); v2 2026-11-04 (deleting a type leaves `tag_usage`
  alone)
- **Deciders:** Mohit Yadav
- **Guard:** `HardDeleteCleanupIT`, `EntityRepositoryRestoreTest`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
A hard delete also removes rows that point at the deleted entity by FQN: tag labels in `tag_usage`
and field relationships in `field_relationship`. Those tables are keyed by FQN alone, and an FQN is
unique only within a type, so a user, a service and an entity type can share one. The cleanup
therefore covers only the rows the deleted entity's type can own.

## Decision
- The FQN-prefix cleanup runs only for types that carry such rows: taggable types, and `type`,
  whose custom property definitions are field relationships under its name
  (`EntityRepository.shouldCleanupFqnDependents()` defaults to `supportsTags`). Of the two tables,
  `tag_usage` is cleaned only for taggable types, so deleting a type removes its field
  relationships and no tag labels.
- `field_relationship` rows of type `type` are removed only when a type is deleted.
- No delete removes labels by tag FQN alone; tags and glossary terms remove their own labels,
  bound to their source, in `postDelete`.

## Consequences
Deleting a user, team, role, policy or bot touches no FQN-keyed rows. `tag_usage` does not record
the target's entity type, so two taggable entities of different types that share an FQN share
their rows there; recording the type on each row is a schema change left for later.

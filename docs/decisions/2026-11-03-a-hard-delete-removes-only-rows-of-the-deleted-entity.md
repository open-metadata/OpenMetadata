# A hard delete removes only rows of the deleted entity

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial); v2 2026-11-04 (deleting a type leaves `tag_usage`
  alone)
- **Deciders:** Mohit Yadav
- **Guard:** `HardDeleteCleanupIT`, `EntityRepositoryRestoreTest`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
Every hard delete removed the `tag_usage` rows whose target FQN started with the deleted entity's
FQN, the `field_relationship` rows under it, and the `tag_usage` rows whose tag FQN equalled it.
Those tables are keyed by FQN alone, and an FQN is unique only within a type, so deleting a user
named like a service stripped the service's tags, deleting a user named like an entity type
removed that type's custom property definitions, and deleting a glossary term named like a
classification tag removed that tag from every asset.

## Decision
- The FQN-prefix cleanup runs only for types that carry such rows: taggable types, and `type`,
  whose custom property definitions are field relationships under its name
  (`EntityRepository.shouldCleanupFqnDependents()` defaults to `supportsTags`). Of the two tables,
  `tag_usage` is cleaned only for taggable types, so deleting a type removes its field
  relationships and no tag labels.
- `field_relationship` rows of type `type` are removed only when a type is deleted.
- The tag-FQN delete without a source is gone; tags and glossary terms remove their own labels,
  bound to their source, in `postDelete`.

## Consequences
Users, teams, roles, policies and bots no longer touch FQN-keyed rows when deleted. Two taggable
entities of different types that share an FQN can still collide in `tag_usage`; closing that needs
the target's entity type recorded on each row, which is a schema change left for later.

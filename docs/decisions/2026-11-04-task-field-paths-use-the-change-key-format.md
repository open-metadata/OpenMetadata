# A task's field path is written in the entity's change-key format, and only that format is accepted

- **Status:** Accepted
- **Revisions:** v1 2026-11-04 (initial)
- **Deciders:** Platform
- **Guard:** `EntityFieldPathTest`, `TaskFieldTargetTest`, `TaskFieldPathMigrationTest`, `TaskFieldPathUtils.test.ts`
- **Related:** #36615, PR #36632

## Context
Description, tag and suggestion tasks name the field they change with a string, `fieldPath`, that
no one owned. Five formats were written: `columns::"a.b"::description` by the UI's description
tasks, `columns."a.b"` by its tag tasks, `columns.a.b` by the 2.0.0 upgrade, `columns.a.b.description`
by the Collate AI agent, and anything by API callers. Six places parsed it by hand, and each one
guessed when the property was missing. One guess wrote a nested column's description onto its
parent (#36615).

## Decision
A task's field path is `<container>.<name>[.<child name>...].<property>`, for example
`columns.address.city.description`, or `description` / `tags` alone for the entity itself. A name
that itself contains a dot is quoted, as in an FQN: `columns."order.id".tags` is one field named
`order.id`, while `columns.order.id.tags` is a field `id` nested in `order`. It is the key the
entity's own change descriptions and change summaries use. A task filed without a path is about the
entity itself, and the server stores that path written out.

- The property is always present and must be the one the task changes.
- The container must be one `ChildFieldResolver` declares for the entity's type.
- `EntityFieldPath.parse` is the only parser on the server; the UI's is
  `TaskFieldPathUtils.parseTaskFieldPath`.
- The server refuses any other path with a 400 when a task is filed, when its path is edited, and
  when it is approved.
- The 2.1.0 data migration `TaskFieldPathMigration` rewrites every stored task into this format.
  It is the only code that reads the old formats. It works on stored JSON with plain SQL and keeps
  its own copy of the 2.1.0 format and containers (`FieldPathFormat`), so a later change to the
  server's classes cannot change what an upgrade from 2.0 writes.

## Consequences
Readers trust the stored value, and the same string is the change-summary key, so the two cannot
drift. A field outside a declared container (a dashboard's charts, which are entities of their
own) cannot be named; such a task is refused rather than approved with nothing changed. A new task
property or field container is added to `FieldProperty` or `ChildFieldResolver`, never parsed by
a new reader.

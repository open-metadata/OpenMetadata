# A versioned migration carries its own logic: it reads and writes rows itself, and work that must follow current code runs outside it

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `MigrationArchitectureTest` (repositories, secrets, search, workflows, the pipeline service client, `Entity` lookups); reviewer for generated classes and entity DAOs
- **Related:** ADR:2026-10-13-a-removed-connector-is-retired-in-the-first-data-migration-step; ADR:2026-10-09-data-migration-backfills-walk-ids-in-batches; ADR:2026-10-22-guarded-index-ddl-runs-from-a-java-data-migration

## Context

A migration step is written once, for the data of one release, but it runs with the code of every
later release. A database upgrading from 1.12 to 2.1 runs the 1.13 steps on the 2.1 server. When a
step calls a repository, an entity DAO, a generated class, a secrets manager, search or a workflow
handler, what it does is decided by that code as it is today, not as it was when the step was
written and tested.

That code keeps changing. A repository gains validation, side effects or a new required field. A
schema field is renamed, or an enum value is removed, so an old row no longer loads into its
generated class. A step that worked when it shipped then fails on a later release, or quietly
writes something else, and no test notices: the step's tests run against current data and current
code. The 2.1.0 data migration already aborted once in a step that loaded tables, on a service type
that had been removed
(ADR:2026-10-13-a-removed-connector-is-retired-in-the-first-data-migration-step).

## Decision

1. **A versioned step works on rows.** Code under `migration/mysql/vNNN`, `migration/postgres/vNNN`
   and `migration/utils/vNNN` reads and writes with SQL through the JDBI `Handle` or plain table
   queries. It changes stored JSON as a tree, with the field names it needs as its own constants,
   and does not load a row into a generated class to change it.
2. **Some formats are contracts and may be called.** The stored value must match what the running
   server reads, so a step uses the shared code for it: FQN quoting and hashing
   (`FullyQualifiedName`), the Fernet token format (`Fernet`), entity link parsing (`MessageParser`)
   and JSON parsing (`JsonUtils`).
3. **Work that must follow current code does not go in a versioned step.** Seed data follows the
   resource files through each resource's `initialize`, which runs on every start. Deploying
   ingestion pipelines, reindexing and moving secrets are the `deploy-pipelines`, `reindex` and
   `migrate-secrets` commands. A step that needs one of them says so in the upgrade notes.
4. **The rest is a named exception.** When a step cannot avoid platform code, for example because a
   removed connector's pipelines must leave the pipeline service in the same upgrade, it is listed
   in the exceptions of `MigrationArchitectureTest` with the reason. It checks the shape of the data
   it expects first and fails the migration when the shape differs, instead of guessing.

## Consequences

A step is longer, because it carries its own SQL and field names, and it repeats a little logic that
also lives in a repository. That copy is the point: it is frozen with the release it belongs to.

The 1.x and 2.0.x steps shipped before this rule and are left as they are; one is rewritten when it
breaks. The nine 2.1.0 steps the guard flags were written before the rule and are listed as
exceptions, each with what it calls. Moving them to rows, or out of the migration, is separate work.

The guard checks direct dependencies only. A step that reaches platform code through a shared
helper, or through an entity DAO or generated class, is caught in review.

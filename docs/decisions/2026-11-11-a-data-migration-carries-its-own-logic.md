# A versioned migration carries its own logic: it reads and writes rows itself, and work that must follow current code runs outside it

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial) · v2 2026-11-23 (the server deploys changed workflows on start)
- **Deciders:** Adrià Manero
- **Guard:** `MigrationArchitectureTest` (an allowlist: a step may use only the libraries, framework classes and contracts it names)
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
   (`FullyQualifiedName`), the Fernet token format (`Fernet`), entity link parsing (`MessageParser`),
   JSON parsing (`JsonUtils`) and the stored relationship numbers (`Relationship`).
3. **A step uses only what is allowed, not everything that is not forbidden.** It may depend on the
   libraries whose behaviour does not follow the product (the JDK, JDBI, Jackson, logging, Lombok,
   the Fernet and Bouncy Castle crypto libraries), on what runs it (`MigrationProcessImpl`,
   `MigrationFile`, `ConnectionType`, `MigrationDAO`, `DataMigrationStep`, `IdBatches`,
   `MigrationTableUtil`), on the contracts above and on other steps the rule checks. Anything else
   fails the guard, including classes added to the product after this rule. From its base class it
   may not call `initializeWorkflowHandler` or `getPipelineServiceClient`. A list of forbidden
   classes would miss whatever is added next; a short list of allowed ones changes only when the
   team decides that something is a contract.
4. **Work that must follow current code does not go in a versioned step.** Seed data follows the
   resource files through each resource's `initialize`, which runs on every start, and so does
   deploying a workflow whose stored definition or builders changed
   (ADR:2026-11-23-a-changed-workflow-is-deployed-when-the-server-starts). Deploying
   ingestion pipelines, reindexing and moving secrets are the `deploy-pipelines`, `reindex` and
   `migrate-secrets` commands. A step that needs one of them says so in the upgrade notes.
5. **The rest is a named exception.** When a step cannot avoid other code, for example because a
   removed connector's pipelines must leave the pipeline service in the same upgrade, it is listed
   in the exceptions of `MigrationArchitectureTest` with the reason. It checks the shape of the data
   it expects first and fails the migration when the shape differs, instead of guessing.

## Consequences

A step is longer, because it carries its own SQL and field names, and it repeats a little logic that
also lives in a repository. That copy is the point: it is frozen with the release it belongs to.

A step writes its own SQL for the tables it touches, relationships included, instead of calling
the `CollectionDAO` methods for them.

The 1.x, 2.0.x and 2.1.0 steps were written before this rule and are left as they are; one is
rewritten when it breaks. Most 2.1.0 steps use `CollectionDAO`, `Entity` or generated classes, so
the guard starts with the first folder after 2.1.0.

The guard reads each step's own dependencies. An allowed class does not hide what it calls, so the
allowed framework classes are kept to ones that only read and write rows; a helper added to that
list is held to the same bar.

## Amendment

v2 2026-11-23. A step that changes a stored workflow changes only its row: the server deploys each
workflow whose BPMN differs from its deployment when it starts
(ADR:2026-11-23-a-changed-workflow-is-deployed-when-the-server-starts). The 2.1.1 step, which
deployed `SuggestionTaskWorkflow` itself as the first named exception, now only edits its row, and
`MigrationArchitectureTest` lists no exception. The 2.1.1 folder exists, so the guard checks classes.

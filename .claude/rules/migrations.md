---
description: Database migrations — append-only, native path, MySQL+Postgres, idempotent, own logic
paths: "bootstrap/sql/**,openmetadata-service/src/main/java/org/openmetadata/service/migration/**"
---

# Database migrations

Applies to `bootstrap/sql/**` and the Java steps under `openmetadata-service/.../migration/`.
Flyway handles legacy migrations; the current system is native OpenMetadata migrations tracked in
`SERVER_CHANGE_LOG` (Flyway's SQL parsers are still used only to split statements). Compliant
reference: `bootstrap/sql/migrations/native/1.1.0/mysql/schemaChanges.sql`.

- **Migrations are append-only by convention — never edit an already-applied migration.** Nothing
  enforces this today (no CI check, no runtime checksum-abort), so an edited migration **silently**
  either never re-runs on existing databases (version already recorded) or only partially applies —
  producing schema drift with no error. Add a **new** version instead.
- **New migration**: create `bootstrap/sql/migrations/native/{version}/mysql/schemaChanges.sql` **and**
  the `postgres/` variant — always both databases, one `schemaChanges.sql` per database per version
  (no numbered sub-files). Never add new `v0xx` Flyway files; always use the native path. Extension
  migrations go under `bootstrap/sql/migrations/extensions/{name}/`.
- Write both dialects (MySQL `JSON`/`AUTO_INCREMENT` vs PostgreSQL `JSONB`/`SERIAL`) and make them
  **idempotent** where possible (`IF NOT EXISTS`, etc.).
- Use Docker containers for local DB setup; sample data loads automatically in the dev environment.
- **Put a migration in the release its feature ships in, in a folder that has not shipped.** A
  database that has run a later version of the same release line never reads an earlier folder
  again, so a statement added to a shipped folder never runs there.

## Java steps carry their own logic

A step under `migration/{mysql,postgres,utils}/vNNN` runs with the code of every later release, so
it must not depend on code that keeps changing.
ADR:2026-11-11-a-data-migration-carries-its-own-logic

- **Work on rows.** Read and write with SQL through the JDBI `Handle` or plain table queries. Change
  stored JSON as a tree, with the field names as constants of the step. Do not call a repository,
  `Entity.getEntity*` / `getEntityRepository`, an entity DAO's entity methods, a secrets manager,
  search, workflow code or the pipeline service client, and do not load a row into a generated
  class to change it.
- **Contracts are fine:** `FullyQualifiedName` (quoting and hashing), `Fernet`, `MessageParser`
  (entity links) and `JsonUtils` as a parser.
- **Work that must follow current code goes elsewhere.** Seeding runs in each resource's
  `initialize` on every start; deploying ingestion pipelines, reindexing and moving secrets are the
  `deploy-pipelines`, `reindex` and `migrate-secrets` commands.
- **An unavoidable exception** is added to `MigrationArchitectureTest` with its reason, and the step
  checks the data shape it expects and fails when it differs. That test fails on anything else.

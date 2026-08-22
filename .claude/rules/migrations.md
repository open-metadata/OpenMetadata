---
description: Database migrations — append-only, baseline floor, MySQL+Postgres, idempotent
paths: "bootstrap/sql/**"
---

# Database migrations

Applies to `bootstrap/sql/**`. Migrations are native OpenMetadata SQL directories tracked in
`SERVER_CHANGE_LOG`; statements are split by `SqlStatementSplitter` (there is no Flyway anymore —
neither the runner nor its parsers). Compliant reference:
`bootstrap/sql/migrations/native/2.1.0/mysql/schemaChanges.sql`.

- **Migrations are append-only by convention — never edit an already-applied migration.** Nothing
  enforces this today (no CI check, no runtime checksum-abort), so an edited migration **silently**
  either never re-runs on existing databases (version already recorded) or only partially applies —
  producing schema drift with no error. Add a **new** version instead.
- **New migration**: create `bootstrap/sql/migrations/native/{version}/mysql/schemaChanges.sql` **and**
  the `postgres/` variant — always both databases, one `schemaChanges.sql` per database per version
  (no numbered sub-files). Extension migrations go under `bootstrap/sql/migrations/extensions/{name}/`.
- Write both dialects (MySQL `JSON`/`AUTO_INCREMENT` vs PostgreSQL `JSONB`/`SERIAL`) and make them
  **idempotent** where possible (`IF NOT EXISTS`, etc.).
- **Supported SQL constructs**: plain semicolon-terminated statements, comments, quoted strings and
  identifiers, and PostgreSQL dollar-quoted blocks (`DO $$ … $$`). MySQL `DELIMITER` — and therefore
  stored procedures, functions, and triggers — is **not** supported; express the logic in a Java
  migration instead.
- **Everything below 2.0.0 is frozen into the baseline** (`bootstrap/sql/migrations/baseline/`).
  Never re-add a pre-2.0 version directory: the runner filters that range out entirely on
  baseline-managed databases, so it would silently never run. See the baseline README for the
  freeze policy and how to regenerate.
- **Migrations write rows only to fix databases that already exist.** A fresh install gets its data
  from the application's own boot-time seeding (`json/data/**`), so never add seed rows to the
  baseline — add or edit the seed JSON instead.
- Use Docker containers for local DB setup; sample data loads automatically in the dev environment.

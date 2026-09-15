---
description: Database migrations — append-only, native path, MySQL+Postgres, idempotent
paths: "bootstrap/sql/**"
---

# Database migrations

Applies to `bootstrap/sql/**`. Flyway handles legacy migrations; the current system is native
OpenMetadata migrations tracked in `SERVER_CHANGE_LOG` (Flyway's SQL parsers are still used only to
split statements). Compliant reference:
`bootstrap/sql/migrations/native/1.1.0/mysql/schemaChanges.sql`.

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

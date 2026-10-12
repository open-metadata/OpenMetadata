# OpenMetadata Migration System

This document describes the migration system architecture and execution order for OpenMetadata database schema and data migrations.

## Migration System Overview

OpenMetadata uses a hybrid migration system that combines:
1. **Legacy Flyway migrations** (being phased out)
2. **Native OpenMetadata migrations** (current system)
3. **Extension migrations** (for custom/plugin functionality)

## Migration Execution Order

All migrations run in one order, sorted by version number. When a native and an extension
version share a number, the native one runs first. Flyway migrations are numbered `0.0.x`, so
they always come first:

```
0.0.0 … 0.0.15        Flyway (legacy); v000 creates the migration tracking tables
1.1.0, 1.1.1, …       native
1.2.0, 1.2.0-collate  native, then the extension version with the same number
1.2.1, …, 1.6.0, 1.6.0-collate, 1.6.1, 1.6.1-collate, …
```

The order is the same on an empty database and on one that has already run some versions. A
run that stops part way leaves the versions before the failure recorded, and the next run
continues with exactly the rest of the order. A database can therefore be upgraded across many
versions, or retried after a failure, without reaching a state an empty database never goes
through.

This means a version's SQL and its Java data migration run on the schema of every version at or
below it, native and extension alike, and on nothing newer. A native migration may depend on
an older extension migration and the other way round, but neither may depend on a later version.
Java data migrations run with the current code, so a data migration must not call code paths
that read or write tables or columns added by a later version.

## Migration Tracking Tables

### SERVER_CHANGE_LOG
Primary table for tracking all migration executions:
- `installed_rank`: Auto-increment sequence number
- `version`: Migration version identifier (PRIMARY KEY)
- `migrationFileName`: Path to the migration file
- `checksum`: Hash of migration content for integrity validation
- `installed_on`: Timestamp of migration execution
- `metrics`: JSON/JSONB field for migration execution metrics

### SERVER_MIGRATION_SQL_LOGS
Detailed SQL execution logs:
- `version`: Migration version identifier
- `sqlStatement`: Individual SQL statement executed
- `checksum`: Hash of the SQL statement (PRIMARY KEY)
- `executedAt`: Timestamp of SQL execution

This table also records Java data migrations. A migration class that overrides
`runDataMigration()` is identified by a fingerprint of its compiled code: the class itself plus
every class in the version's `migration/utils/vXYZ` package. The fingerprint is written here as a
marker row once the migration returns without throwing. That is what lets the workflow add
Java-only work to a version that is already in `SERVER_CHANGE_LOG`: the version is reprocessed
while its fingerprint is unrecorded, and dropped again afterwards. Adding a step to the
migration, or changing one of its helpers, changes the fingerprint, so deployments that already
ran it run the whole `runDataMigration()` once more — keep it safe to re-run. A toolchain change
that alters the bytecode (a JDK or Lombok upgrade) causes one extra run the same way.

This applies to the current release train's latest version only. The previous train's latest
version is reprocessed for appended SQL alone: its data migration was written against that
train's schema, so it never runs again on a database that has moved to a newer train. Ship Java
work that newer-train deployments need in the current train's version instead.

## Migration Logic

The migration workflow follows this decision tree:

```
IF SERVER_CHANGE_LOG has executed versions:
    ├── Skip all Flyway migrations (they've already run)
    ├── Select pending native versions and pending extension versions, each against
    │   its own executed history (including the versions it reprocesses)
    └── Execute them together, in the execution order above

ELSE (empty database):
    └── Execute every Flyway, native and extension migration, in the execution order above
```

## File Structure

```
bootstrap/sql/migrations/
├── flyway/
│   ├── com.mysql.cj.jdbc.Driver/     # MySQL-specific Flyway migrations
│   │   ├── v000__create_server_change_log.sql
│   │   ├── v001__*.sql
│   │   └── ...
│   └── org.postgresql.Driver/        # PostgreSQL-specific Flyway migrations
│       ├── v000__create_server_change_log.sql
│       ├── v001__*.sql
│       └── ...
├── native/
│   ├── 1.1.0/
│   │   ├── mysql/schemaChanges.sql
│   │   └── postgres/schemaChanges.sql
│   ├── 1.1.1/
│   └── ...
└── extensions/                       # Custom extension migrations
    └── [extension-name]/
        ├── mysql/
        └── postgres/
```

## Migration Implementation Classes

- `MigrationWorkflow`: Orchestrates the entire migration process
- `FlywayMigrationFile`: Adapter for legacy Flyway migrations
- `MigrationFile`: Handler for native OpenMetadata migrations
- `MigrationProcess`: Executes individual migration steps

## SQL Statement Parsing

**Important**: While OpenMetadata has removed Flyway as the migration framework, we still use **Flyway's SQL parsers** for reliable statement splitting:

- **MySQL**: Uses `org.flywaydb.database.mysql.MySQLParser`
- **PostgreSQL**: Uses `org.flywaydb.database.postgresql.PostgreSQLParser`

This ensures proper handling of:
- Complex SQL statements with string literals containing semicolons
- Comments (both `--` and `/* */` style)
- Escaped characters and quotes
- Database-specific SQL syntax

The parsers split SQL files into individual statements via `SqlStatementIterator`, which is far more reliable than simple string splitting.

**Dependencies**: Requires `flyway-core` and `flyway-mysql` for SQL parsing only (not migration management).

## Key Design Decisions

1. **Hybrid Approach**: Custom migration management + Flyway SQL parsing for reliability
2. **Backward Compatibility**: Flyway migrations continue to work during transition period
3. **Single Source of Truth**: All migrations are tracked in `SERVER_CHANGE_LOG` regardless of type
4. **Database Agnostic**: Separate migration files for MySQL and PostgreSQL
5. **Execution Order**: one version order for native and extension migrations, the same on an empty database and on a partly migrated one
6. **Migration Tracking**: v000 Flyway migration creates the tracking infrastructure before any other migrations

## Troubleshooting

### Common Issues

1. **Missing SERVER_CHANGE_LOG table**:
   - Ensure v000 Flyway migration has executed
   - Check database permissions

2. **Migration version conflicts**:
   - Verify no duplicate version numbers across migration types
   - Check migration file naming conventions

3. **Database-specific failures**:
   - Ensure correct SQL syntax for target database (MySQL vs PostgreSQL)
   - Validate database-specific features (JSON vs JSONB, AUTO_INCREMENT vs SERIAL)

### Migration Recovery

If migrations fail:
1. Check `SERVER_CHANGE_LOG` table for last successful migration
2. Review `SERVER_MIGRATION_SQL_LOGS` for failed SQL statements
3. Fix underlying issues and restart migration process
4. Use `--force` flag only if absolutely necessary

## Configuration

Migration paths are configured in `MigrationConfiguration`:
- `nativePath`: Path to native OpenMetadata migrations
- `flywayPath`: Path to legacy Flyway migrations  
- `extensionPath`: Path to extension migrations

Example:
```yaml
migrationConfiguration:
  nativePath: "bootstrap/sql/migrations/native"
  flywayPath: "bootstrap/sql/migrations/flyway"
  extensionPath: "bootstrap/sql/migrations/extensions"
```
# OpenMetadata Migration System

This document describes the migration system architecture and execution order for OpenMetadata database schema and data migrations.

## Migration System Overview

OpenMetadata uses a hybrid migration system that combines:
1. **Legacy Flyway migrations** (being phased out)
2. **Native OpenMetadata migrations** (current system)
3. **Extension migrations** (for custom/plugin functionality)

## Migration Execution Order

The migration system executes in a specific order to ensure database consistency:

```
1. Flyway Migrations (Legacy)
   ├── v000__create_server_change_log.sql  (Creates migration tracking tables)
   ├── v001__*.sql
   ├── v002__*.sql
   └── ...

2. Native OpenMetadata Migrations
   ├── 1.1.0/
   ├── 1.1.1/
   ├── 1.2.0/
   └── ...

3. Extension Migrations
   ├── custom-extension-1.0.0/
   └── ...
```

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

## Migration Logic

The migration workflow follows this decision tree:

```
IF native migrations are already executed:
    └── Skip all Flyway migrations (they've already run)
    └── Execute remaining native migrations
    └── Execute extension migrations

ELSE IF no native migrations executed:
    ├── Execute Flyway migrations (creates SERVER_CHANGE_LOG tables)
    ├── Execute native migrations  
    └── Execute extension migrations
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
5. **Execution Order**: Flyway → Native → Extensions ensures proper dependency resolution
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
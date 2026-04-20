---
name: connector-standards
description: Load all OpenMetadata connector development standards into context. Use before building or reviewing connectors to ensure consistent patterns.
user-invocable: true
argument-hint: "[optional: specific standard name like 'testing' or 'database']"
allowed-tools:
  - Read
  - Glob
---

# Load OpenMetadata Connector Standards

## When to Activate

When a user asks to "load standards", "show connector standards", or before starting any connector development or review work.

## Behavior

### Load All Standards

If no specific standard is requested, load all standards in this order:

1. `${CLAUDE_SKILL_DIR}/standards/main.md` — Architecture overview
2. `${CLAUDE_SKILL_DIR}/standards/patterns.md` — Error handling, logging, pagination
3. `${CLAUDE_SKILL_DIR}/standards/code_style.md` — Python and JSON Schema conventions
4. `${CLAUDE_SKILL_DIR}/standards/schema.md` — Connection schema patterns
5. `${CLAUDE_SKILL_DIR}/standards/connection.md` — Connection class patterns
6. `${CLAUDE_SKILL_DIR}/standards/service_spec.md` — ServiceSpec registration
7. `${CLAUDE_SKILL_DIR}/standards/testing.md` — Unit and integration test patterns
8. `${CLAUDE_SKILL_DIR}/standards/registration.md` — How to register a connector
9. `${CLAUDE_SKILL_DIR}/standards/performance.md` — Performance best practices
10. `${CLAUDE_SKILL_DIR}/standards/memory.md` — Memory management and OOM prevention
11. `${CLAUDE_SKILL_DIR}/standards/lineage.md` — Lineage extraction methods
12. `${CLAUDE_SKILL_DIR}/standards/sql.md` — SQLAlchemy patterns and URL building

Then read all source-type standards:
```
${CLAUDE_SKILL_DIR}/standards/source_types/*.md
```

### Load Specific Standard

If a specific standard or service type is requested:

| Request | File to Load |
|---------|-------------|
| "testing" | `standards/testing.md` |
| "patterns" | `standards/patterns.md` |
| "schema" | `standards/schema.md` |
| "lineage" | `standards/lineage.md` |
| "sql" | `standards/sql.md` |
| "memory" | `standards/memory.md` |
| "database" | `standards/source_types/database.md` |
| "sql databases" | `standards/source_types/sql_databases.md` |
| "data warehouses" | `standards/source_types/data_warehouses.md` |
| "nosql" | `standards/source_types/nosql_databases.md` |
| "dashboard" | `standards/source_types/dashboard.md` |
| "pipeline" | `standards/source_types/pipeline.md` |
| "messaging" | `standards/source_types/messaging.md` |
| "mlmodel" | `standards/source_types/mlmodel.md` |
| "storage" | `standards/source_types/storage.md` |
| "search" | `standards/source_types/search.md` |
| "api" | `standards/source_types/api.md` |
| etc. | `standards/source_types/{name}.md` |

### After Loading

Confirm to the user which standards were loaded and summarize the key points. Example:

> Loaded 12 core standards + 11 source-type standards. Key points:
> - Schema-first: one JSON Schema → Python, Java, TypeScript, UI forms
> - Use `BaseConnection` for SQLAlchemy, `get_connection()`/`test_connection()` for others
> - Use pytest with plain `assert`, no unittest.TestCase
> - Always include copyright header, use `ingestion_logger()`
> - Lineage via query logs (database), SQL parsing (dashboard), or task metadata (pipeline)

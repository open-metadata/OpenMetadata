# OpenMetadata Skills

AI-powered connector development toolkit for OpenMetadata. Scaffold, implement, review, and validate connectors using schema-first architecture.

## Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| [Connector Building](connector-building/SKILL.md) | `/scaffold-connector` | Scaffold a new connector with JSON Schema, Python boilerplate, and AI context |
| [Connector Review](connector-review/SKILL.md) | `/connector-review` | Review connector code against golden standards with multi-agent analysis, optionally post findings to GitHub PR |
| [Connector Standards](connector-standards/SKILL.md) | `/connector-standards` | Load connector development standards into agent context |
| [Test Locally](test-locally/SKILL.md) | `/test-locally` | Build and deploy a full local Docker stack to test your connector in the UI |

## Agents

| Agent | Purpose |
|-------|---------|
| [connector-researcher](agents/connector-researcher.md) | Research source system APIs, SDKs, auth, and data models |
| [connector-validator](agents/connector-validator.md) | Validate connector implementation against standards |
| [comment-resolution-checker](agents/comment-resolution-checker.md) | Verify PR review comments were substantively addressed (used by connector-review Step 7) |

## Standards

12 core standards + 11 source-type standards in [standards/](standards/):

### Core Standards

| Standard | Content |
|----------|---------|
| [main.md](standards/main.md) | Architecture overview, schema-first approach, service types |
| [patterns.md](standards/patterns.md) | Error handling, logging, pagination, auth, filters |
| [testing.md](standards/testing.md) | Unit tests, integration tests, pytest patterns |
| [code_style.md](standards/code_style.md) | Python and JSON Schema conventions |
| [schema.md](standards/schema.md) | Connection schema structure, $ref patterns |
| [connection.md](standards/connection.md) | BaseConnection vs function patterns |
| [service_spec.md](standards/service_spec.md) | DefaultDatabaseSpec vs BaseSpec |
| [registration.md](standards/registration.md) | Service enum, UI utils, i18n steps |
| [performance.md](standards/performance.md) | Pagination, batching, rate limiting |
| [memory.md](standards/memory.md) | Memory management, streaming, OOM prevention |
| [lineage.md](standards/lineage.md) | Lineage extraction methods, dialect mapping, query logs |
| [sql.md](standards/sql.md) | SQLAlchemy patterns, URL building, auth, multi-DB |

### Source-Type Standards

| Standard | Covers |
|----------|--------|
| [database.md](standards/source_types/database.md) | General database patterns |
| [sql_databases.md](standards/source_types/sql_databases.md) | MySQL, PostgreSQL, Oracle, MSSQL |
| [data_warehouses.md](standards/source_types/data_warehouses.md) | BigQuery, Snowflake, Redshift, Databricks |
| [nosql_databases.md](standards/source_types/nosql_databases.md) | MongoDB, DynamoDB, Couchbase, Cassandra |
| [dashboard.md](standards/source_types/dashboard.md) | Dashboard connectors |
| [pipeline.md](standards/source_types/pipeline.md) | Pipeline connectors |
| [messaging.md](standards/source_types/messaging.md) | Messaging connectors |
| [mlmodel.md](standards/source_types/mlmodel.md) | ML model connectors |
| [storage.md](standards/source_types/storage.md) | Storage connectors |
| [search.md](standards/source_types/search.md) | Search connectors |
| [api.md](standards/source_types/api.md) | API connectors |

## References

Architecture guides and decision trees in [connector-building/references/](connector-building/references/):

| Reference | Content |
|-----------|---------|
| [architecture-decision-tree.md](connector-building/references/architecture-decision-tree.md) | Service type, connection type, and base class selection |
| [connection-type-guide.md](connector-building/references/connection-type-guide.md) | SQLAlchemy vs REST API vs SDK client comparison |
| [capability-mapping.md](connector-building/references/capability-mapping.md) | Capabilities by service type, schema flags, generated files |

## Review Templates

| Template | Purpose |
|----------|---------|
| [full-review-report.md](connector-review/templates/full-review-report.md) | New connector or major refactor review |
| [incremental-review-report.md](connector-review/templates/incremental-review-report.md) | PR with changes to existing connector |
| [specialized-review-report.md](connector-review/templates/specialized-review-report.md) | Focused review on one area (tests, security, schema, etc.) |
| [pr-review-comment.md](connector-review/templates/pr-review-comment.md) | Condensed format for posting reviews as GitHub PR comments |

## Scripts

| Script | Purpose |
|--------|---------|
| [gather-connector-context.sh](connector-review/scripts/gather-connector-context.sh) | Shell script to collect connector file inventory |
| [analyze_connector.py](connector-review/scripts/analyze_connector.py) | Python script for structured connector analysis (supports `--json` output) |

## Installation

### Claude Code

```bash
# From the OpenMetadata repo root
claude plugin install skills/
```

Or reference the skills directory in your Claude Code configuration.

### Cursor

Settings → Rules → Add Rule → select the skills directory, or add to `.cursor/skills/`.

### Codex

Add the skills directory to your Codex workspace context.

### GitHub Copilot

Reference the skills directory in your workspace instructions.

### Windsurf

Add the skills directory to your Windsurf rules configuration.

### Manual

The skills follow the [Agent Skills](https://agentskills.io) open standard and work with any compatible agent tool.

## Architecture

OpenMetadata uses **schema-first** architecture. One JSON Schema definition cascades through 6 layers:

```
JSON Schema (single source of truth)
    ├── Python Pydantic models     (make generate)
    ├── Java models                (mvn install)
    ├── TypeScript types           (yarn parse-schema)
    ├── UI config forms            (RJSF auto-renders)
    ├── API request validation     (server uses Java models)
    └── Test fixtures              (tests import Pydantic models)
```

The scaffold tool (`metadata scaffold-connector`) generates the JSON Schema and Python boilerplate, while `CONNECTOR_CONTEXT.md` gives any AI agent everything it needs to implement the connector.

## Quick Start

```bash
# 1. Scaffold a new connector
source env/bin/activate
metadata scaffold-connector

# 2. Ask your AI agent to implement it
# Claude Code:
claude "Read CONNECTOR_CONTEXT.md and implement all TODO items"

# 3. Review the implementation
# /connector-review ingestion/src/metadata/ingestion/source/database/my_db/
```

## CI

The [`.github/workflows/lint-standards.yml`](.github/workflows/lint-standards.yml) workflow lints all standards markdown, validates JSON files, and checks symlink integrity on PRs that modify `skills/`.

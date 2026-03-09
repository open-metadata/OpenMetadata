# OpenMetadata Skills

AI-powered connector development toolkit for OpenMetadata. Scaffold, implement, review, and validate connectors using schema-first architecture.

## Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| [Connector Building](connector-building/SKILL.md) | `/scaffold-connector` | Scaffold a new connector with JSON Schema, Python boilerplate, and AI context |
| [Connector Review](connector-review/SKILL.md) | `/connector-review` | Review connector code against golden standards with multi-agent analysis |
| [Load Standards](load-standards/SKILL.md) | `/load-standards` | Load connector development standards into agent context |
| [Test Locally](commands/test-locally.md) | `/test-locally` | Build and deploy a full local Docker stack to test your connector in the UI |

## Agents

| Agent | Purpose |
|-------|---------|
| [connector-researcher](agents/connector-researcher.md) | Research source system APIs, SDKs, auth, and data models |
| [connector-validator](agents/connector-validator.md) | Validate connector implementation against standards |
| [comment-resolution-checker](agents/comment-resolution-checker.md) | Verify PR review comments were substantively addressed |

## Standards

9 core standards + 8 source-type standards in [standards/](standards/):

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

Source-type standards in [standards/source_types/](standards/source_types/):
`database.md`, `dashboard.md`, `pipeline.md`, `messaging.md`, `mlmodel.md`, `storage.md`, `search.md`, `api.md`

## Installation

### Claude Code

```bash
# From the OpenMetadata repo root
claude plugin install skills/
```

Or reference the skills directory in your Claude Code configuration.

### Cursor

Settings → Rules → Add Rule → select the skills directory, or add to `.cursor/skills/`.

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

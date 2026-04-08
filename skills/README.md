# OpenMetadata Skills Plugin (v2.0.0)

Complete AI development workflow for OpenMetadata. Provides structured planning, test-driven development, 90% test coverage enforcement, code review, systematic debugging, and connector development skills.

Inspired by [obra/superpowers](https://github.com/obra/superpowers) and [everything-claude-code](https://github.com/affaan-m/everything-claude-code), tailored for OpenMetadata's multi-language, schema-first architecture.

## Installation

### Claude Code (Plugin)

```bash
# From the OpenMetadata repo root
claude plugin install skills/
```

This installs all skills, agents, hooks, and commands. The plugin auto-loads the OpenMetadata workflow on session start.

### Claude Code (In-Repo, Zero Setup)

If you're working in the OpenMetadata repo, `.claude/settings.json` provides project-level hooks automatically — no plugin install needed. The `.claude/skills/` directory also provides skills directly.

### Other Tools

| Tool | Method |
|------|--------|
| Cursor | Settings -> Rules -> Add Rule -> select `skills/` directory |
| Codex | Add `skills/` to workspace context |
| GitHub Copilot | Reference `skills/` in workspace instructions |
| Windsurf | Add `skills/` to rules configuration |
| Any | Skills follow the [Agent Skills](https://agentskills.io) open standard |

## Workflow Overview

The plugin enforces a structured development workflow:

```
1. /planning          — Design before code (brainstorm, propose, get approval)
2. /tdd               — Write failing test, implement, refactor
3. /test-enforcement   — Verify 90% coverage, integration tests, Playwright E2E
4. /verification       — Show evidence of passing tests before claiming done
5. /code-review        — Two-stage review (spec compliance + code quality)
```

The `openmetadata-workflow` meta-skill is loaded at session start and directs Claude to use the appropriate skills for each task type.

## Skills

### Development Workflow Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| [OpenMetadata Workflow](openmetadata-workflow/SKILL.md) | *(auto-loaded)* | Meta-skill: routes tasks to the right workflow |
| [Planning](planning/SKILL.md) | `/planning` | Brainstorm approaches, get approval, create step-by-step plan |
| [TDD](tdd/SKILL.md) | `/tdd` | RED-GREEN-REFACTOR for Java, Python, and TypeScript |
| [Test Enforcement](test-enforcement/SKILL.md) | `/test-enforcement` | Enforce 90% line coverage, integration tests, Playwright E2E |
| [Systematic Debugging](systematic-debugging/SKILL.md) | `/systematic-debugging` | 4-phase root cause analysis |
| [Code Review](code-review/SKILL.md) | `/code-review` | Two-stage review: spec compliance then code quality |
| [Verification](verification/SKILL.md) | `/verification` | Evidence-based completion — show test output, not claims |

### Connector Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| [Connector Building](connector-building/SKILL.md) | `/scaffold-connector` | Scaffold a new connector with JSON Schema, Python boilerplate, and AI context |
| [Connector Review](connector-review/SKILL.md) | `/connector-review` | Review connector code against golden standards with multi-agent analysis |
| [Connector Standards](connector-standards/SKILL.md) | `/connector-standards` | Load connector development standards into agent context |
| [Test Locally](test-locally/SKILL.md) | `/test-locally` | Build and deploy a full local Docker stack to test your connector |

## Agents

### Language-Specific Reviewers

| Agent | Purpose |
|-------|---------|
| [java-reviewer](agents/java-reviewer.md) | Review Java code — Dropwizard, Flyway, JUnit 5, spotless, 90% coverage |
| [python-reviewer](agents/python-reviewer.md) | Review Python code — Pydantic 2.x, pytest, connector architecture, 90% coverage |
| [frontend-reviewer](agents/frontend-reviewer.md) | Review TypeScript/React — core components, `tw:` prefix, i18n, no MUI, Jest/Playwright |

### Connector Agents

| Agent | Purpose |
|-------|---------|
| [connector-researcher](agents/connector-researcher.md) | Research source system APIs, SDKs, auth, and data models |
| [connector-validator](agents/connector-validator.md) | Validate connector implementation against standards |
| [comment-resolution-checker](agents/comment-resolution-checker.md) | Verify PR review comments were substantively addressed |

## Hooks

The plugin includes hooks (`hooks/hooks.json`) that fire automatically:

| Hook | Event | What it does |
|------|-------|-------------|
| OpenMetadata Workflow | SessionStart | Loads the meta-skill to route tasks to the right workflow |
| Block `--no-verify` | PreToolUse | Prevents skipping pre-commit hooks |
| Java format reminder | PostToolUse | Reminds to run `mvn spotless:apply` after `.java` edits |
| Schema regeneration | PostToolUse | Reminds to run `make generate` after JSON schema edits |

Additional hooks in `.claude/settings.json` (in-repo, no plugin needed):
- Block MUI imports
- Remind `yarn parse-schema` after connection schema edits
- Warn about `any` type in TypeScript

## Test Coverage Targets

The `/test-enforcement` skill enforces these targets:

| Layer | Target | Tool |
|-------|--------|------|
| Java service (`openmetadata-service`) | 90% line coverage | JaCoCo |
| API endpoints | 100% of changed endpoints have integration tests | `openmetadata-integration-tests` |
| React components | 90% line coverage | Jest |
| UI features | Playwright E2E for all user-facing changes | Playwright |
| Python ingestion | 90% line coverage | pytest --cov |

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
| [specialized-review-report.md](connector-review/templates/specialized-review-report.md) | Focused review on one area |
| [pr-review-comment.md](connector-review/templates/pr-review-comment.md) | Condensed format for GitHub PR comments |

## Scripts

| Script | Purpose |
|--------|---------|
| [gather-connector-context.sh](connector-review/scripts/gather-connector-context.sh) | Shell script to collect connector file inventory |
| [analyze_connector.py](connector-review/scripts/analyze_connector.py) | Python script for structured connector analysis |

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

## Quick Start

```bash
# 1. Install the plugin
claude plugin install skills/

# 2. Start a new feature
# Just describe what you want — the workflow skill will guide you to /planning

# 3. Implement with TDD
# /tdd "Add new endpoint for data quality scores"

# 4. Verify coverage before PR
# /test-enforcement

# 5. Review your changes
# /code-review
```

## CI

The [`.github/workflows/lint-standards.yml`](.github/workflows/lint-standards.yml) workflow lints all standards markdown, validates JSON files, and checks symlink integrity on PRs that modify `skills/`.

# Building an OpenMetadata Connector

This guide walks you through creating a new connector for OpenMetadata, from
zero to a fully registered and tested integration. It works whether you're
coding manually, pair-programming with an AI agent, or letting an agent do it
end-to-end.

## How It Works

OpenMetadata uses a **schema-first** architecture. You define one JSON Schema
for your connector's configuration and that single definition cascades through
six layers automatically:

```
JSON Schema (you write this)
    ├── Python Pydantic models     (make generate)
    ├── Java models                (mvn install)
    ├── TypeScript types           (yarn parse-schema)
    ├── UI config forms            (RJSF auto-renders from schema)
    ├── API request validation     (server uses Java models)
    └── Test fixtures              (tests import Pydantic models)
```

The scaffold tool generates the JSON Schema and all Python boilerplate, so you
can focus on the actual integration logic.

---

## Quick Start

### Step 0: Set Up the Development Environment

Before running any `make` or `python` commands, create and activate a Python virtual environment:

```bash
# From the root of the OpenMetadata project
python3.11 -m venv env
source env/bin/activate
make install_dev generate
```

Always activate the env before running commands in subsequent sessions:

```bash
source env/bin/activate
```

### Step 1: Run the Scaffold

Interactive mode — answers a series of questions:

```bash
metadata scaffold-connector
```

Or non-interactive with all flags:

```bash
metadata scaffold-connector \
    --name clickhouse \
    --service-type database \
    --connection-type sqlalchemy \
    --scheme "clickhousedb+connect" \
    --auth-types basic \
    --capabilities metadata lineage usage profiler \
    --docs-url "https://clickhouse.com/docs/en/interfaces/http" \
    --sdk-package "clickhouse-connect"
```

The interactive mode asks for:

| Prompt | What It Controls |
|--------|-----------------|
| Connector name | Directory name, class names, schema file name |
| Service type | Base class, directory structure, test patterns |
| Connection type | Database only: sqlalchemy, rest_api, or sdk_client |
| Auth types | Which auth `$ref` schemas to include |
| Capabilities | Which extra files to generate (lineage, usage, profiler) |
| Docs URL | Included in AI context for implementation |
| SDK package | Included in AI context for implementation |
| API endpoints | Included in AI context for implementation |
| Implementation notes | Auth quirks, pagination, rate limits — AI context |
| Docker image | If available, generates real testcontainers integration tests |
| Container port | Port to expose from the Docker container |

### Step 2: Review Generated Files

The scaffold generates the following files:

```
# Connection schema (the single source of truth)
openmetadata-spec/.../connections/{service_type}/{name}Connection.json

# Test connection definition
openmetadata-service/.../testConnections/{service_type}/{name}.json

# Python connector code
ingestion/src/metadata/ingestion/source/{service_type}/{name}/
├── __init__.py
├── connection.py        # ← Implement connection logic
├── metadata.py          # ← Implement extraction (often works as-is for DB)
├── service_spec.py      # ← Complete, no changes needed
├── queries.py           # ← Database only: add SQL queries
├── client.py            # ← Non-database only: implement REST/SDK client
├── lineage.py           # ← If lineage capability selected
├── usage.py             # ← If usage capability selected
├── query_parser.py      # ← If lineage or usage selected
└── CONNECTOR_CONTEXT.md # ← AI implementation brief
```

Tests are **not** scaffolded — write them using the reference connector's tests as a pattern:

```
ingestion/tests/unit/topology/{service_type}/test_{name}.py
ingestion/tests/integration/connections/test_{name}_connection.py
ingestion/tests/integration/{name}/conftest.py
ingestion/tests/integration/{name}/test_metadata.py
```

### Step 3: Implement the TODO Items

Every generated file has `# TODO` markers showing exactly what to implement.
The amount of work depends on connector type:

**Database (SQLAlchemy)** — Often the least work:
- `connection.py`: Usually works as-is if the DB uses standard host/port/user/password
- `metadata.py`: Usually works as-is via `CommonDbSourceService`
- `queries.py`: Add SQL for query logs if supporting lineage/usage

**Non-Database (Dashboard, Pipeline, etc.)** — More work:
- `client.py`: Implement the REST/SDK client with actual API calls
- `connection.py`: Wire up `get_connection()` and `test_connection()`
- `metadata.py`: Implement the abstract methods from the base class

### Step 4: Register the Connector

The scaffold prints a checklist. These files need manual edits:

1. **Service schema** — Add the new type to the service enum:
   ```
   openmetadata-spec/.../entity/services/{serviceType}Service.json
   ```
   - Add your connector name to the `type` enum array
   - Add a `$ref` to your connection schema in the `connection` oneOf

2. **UI service utils** — Import the schema and add a switch case:
   ```
   openmetadata-ui/.../utils/{ServiceType}ServiceUtils.tsx
   ```

3. **Localization** — Add i18n display name keys:
   ```
   openmetadata-ui/.../locale/languages/
   ```

### Step 5: Run Code Generation

```bash
# Make sure env is activated
source env/bin/activate

# Generate Python Pydantic models from JSON Schema
make generate

# Generate Java models
mvn clean install -pl openmetadata-spec

# Generate resolved JSON for UI forms
cd openmetadata-ui/src/main/resources/ui && yarn parse-schema
```

### Step 6: Validate

```bash
# Make sure env is activated
source env/bin/activate

# Format Python code (from repo root)
make py_format

# Format Java code
mvn spotless:apply

# Tests
python -m pytest ingestion/tests/unit/topology/{service_type}/test_{name}.py
```

### Step 7: Test Locally in Docker

Build everything and bring up a full local OpenMetadata stack:

```bash
# Full build (first time or after Java/UI changes)
./docker/run_local_docker.sh -m ui -d mysql -s false -i true -r true

# Fast rebuild (ingestion-only changes, ~2-3 minutes)
./docker/run_local_docker.sh -m ui -d mysql -s true -i true -r false
```

Once services are up (~3-5 minutes):
1. Open **http://localhost:8585**
2. Go to **Settings → Services → {Your Service Type}**
3. Click **Add New Service** and select your connector
4. Configure connection details and **Test Connection**
5. Run metadata ingestion to verify entities are created

| Service | URL |
|---------|-----|
| OpenMetadata UI + API | http://localhost:8585 |
| Airflow | http://localhost:8080 (admin / admin) |
| Elasticsearch | http://localhost:9200 |

Tear down: `cd docker/development && docker compose down -v`

---

## Using AI Agents

The scaffold generates a `CONNECTOR_CONTEXT.md` file inside the connector
directory. This file is designed to be read by AI agents (Claude Code, Cursor,
GitHub Copilot, Codex) and contains everything they need:

- Connector profile (name, type, capabilities, auth)
- Source documentation (API docs URL, SDK package, endpoints, notes)
- File list with what to implement in each
- Reference connector to copy patterns from
- Registration checklist
- Validation checklist

### With Claude Code

```bash
# 1. Scaffold
metadata scaffold-connector

# 2. Ask Claude to implement it
claude "Read ingestion/src/metadata/ingestion/source/database/my_db/CONNECTOR_CONTEXT.md
and implement all the TODO items. Use the reference connector as a pattern."
```

### With Cursor / Copilot

Open `CONNECTOR_CONTEXT.md` in your editor. The AI will use it as context
when you work on the connector files.

### With Any Agent

Point the agent at the context file and the reference connector:

```
Read these files:
1. ingestion/src/metadata/ingestion/source/{type}/{name}/CONNECTOR_CONTEXT.md
2. ingestion/src/metadata/ingestion/source/{type}/{reference}/metadata.py
3. ingestion/src/metadata/ingestion/source/{type}/{reference}/connection.py

Then implement all TODO items in the generated files.
```

---

## Service Type Reference

### Database Connectors

**Base class**: `CommonDbSourceService`
**Connection pattern**: `BaseConnection[Config, Engine]` subclass (SQLAlchemy)
**ServiceSpec**: `DefaultDatabaseSpec` (includes profiler, sampler, test suite)

Files:
```
connection.py   — BaseConnection subclass with _get_client() → Engine
metadata.py     — CommonDbSourceService subclass (often no overrides needed)
service_spec.py — DefaultDatabaseSpec with metadata/lineage/usage/connection classes
queries.py      — SQL query templates
lineage.py      — LineageSource mixin with query filters
usage.py        — UsageSource mixin
query_parser.py — QueryParserSource with create() and get_sql_statement()
```

Reference: `ingestion/src/metadata/ingestion/source/database/mysql/`

### Dashboard Connectors

**Base class**: `DashboardServiceSource`
**Connection pattern**: `get_connection()` → client, `test_connection()` functions
**ServiceSpec**: `BaseSpec(metadata_source_class=...)`

Key methods to implement in `metadata.py`:
- `get_dashboards_list()` — Return list of dashboard objects
- `get_dashboard_name()` — Extract name from dashboard object
- `get_dashboard_details()` — Fetch full dashboard details
- `yield_dashboard()` — Create dashboard entity
- `yield_dashboard_chart()` — Create chart entities
- `yield_dashboard_lineage_details()` — Optional: dashboard-to-table lineage

Reference: `ingestion/src/metadata/ingestion/source/dashboard/metabase/`

### Pipeline Connectors

**Base class**: `PipelineServiceSource`
**Connection pattern**: `get_connection()` → client, `test_connection()` functions
**ServiceSpec**: `BaseSpec(metadata_source_class=...)`

Key methods to implement in `metadata.py`:
- `get_pipelines_list()` — Return list of pipeline objects
- `get_pipeline_name()` — Extract name from pipeline object
- `yield_pipeline()` — Create pipeline entity with tasks
- `yield_pipeline_status()` — Create pipeline execution status
- `yield_pipeline_lineage_details()` — Optional: pipeline-to-table lineage

Reference: `ingestion/src/metadata/ingestion/source/pipeline/airflow/`

### Messaging Connectors

**Base class**: `MessagingServiceSource`
**Connection pattern**: `get_connection()` → client, `test_connection()` functions
**ServiceSpec**: `BaseSpec(metadata_source_class=...)`

Key methods to implement in `metadata.py`:
- `yield_topic()` — Create topic entities with schema info

Reference: `ingestion/src/metadata/ingestion/source/messaging/kafka/`

### ML Model Connectors

**Base class**: `MlModelServiceSource`
**Reference**: `ingestion/src/metadata/ingestion/source/mlmodel/mlflow/`

### Storage Connectors

**Base class**: `StorageServiceSource`
**Reference**: `ingestion/src/metadata/ingestion/source/storage/s3/`

### Search Connectors

**Base class**: `SearchServiceSource`
**Reference**: `ingestion/src/metadata/ingestion/source/search/elasticsearch/`

### API Connectors

**Base class**: `ApiServiceSource`
**Reference**: `ingestion/src/metadata/ingestion/source/api/rest/`

---

## Architecture Deep Dive

### JSON Schema → Everything

The connection schema at
`openmetadata-spec/.../connections/{type}/{name}Connection.json` drives:

- **`$id`** and **`javaType`** — Used by Java code generation
- **`definitions`** — Type enum (connector identity) and scheme enum (SQLAlchemy)
- **`properties`** — Each property becomes a config field in Python, Java, and UI
- **`$ref`** links — Compose from shared schemas (auth, SSL, filters, supports*)
- **`required`** — Enforced at API and UI validation layers
- **`additionalProperties: false`** — Strict schema enforcement

### Shared `$ref` Schemas

Auth:
- `./common/basicAuth.json` — username/password
- `./common/iamAuthConfig.json` — AWS IAM
- `./common/azureConfig.json` — Azure AD
- `./common/jwtAuth.json` — JWT tokens

Security:
- `../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig`

Filters:
- `../../../../type/filterPattern.json#/definitions/filterPattern`

Connection extras:
- `../connectionBasicType.json#/definitions/connectionOptions`
- `../connectionBasicType.json#/definitions/connectionArguments`

Capability flags:
- `../connectionBasicType.json#/definitions/supportsMetadataExtraction`
- `../connectionBasicType.json#/definitions/supportsProfiler`
- `../connectionBasicType.json#/definitions/supportsUsageExtraction`
- `../connectionBasicType.json#/definitions/supportsLineageExtraction`
- `../connectionBasicType.json#/definitions/supportsDBTExtraction`
- `../connectionBasicType.json#/definitions/supportsDataDiff`
- `../connectionBasicType.json#/definitions/supportsQueryComment`

### ServiceSpec System

Every connector has a `service_spec.py` that tells the framework how to load
it. The framework resolves the spec dynamically:

```
metadata.ingestion.source.{service_type}.{name}.service_spec.ServiceSpec
```

Database connectors use `DefaultDatabaseSpec` which pre-wires:
- `profiler_class` → `SQAProfilerInterface`
- `sampler_class` → `SQASampler`
- `test_suite_class` → `SQATestSuiteInterface`
- `data_diff` → `BaseTableParameter`

Non-database connectors use `BaseSpec` with just `metadata_source_class`.

### Test Connection Framework

Each connector defines test steps in
`openmetadata-service/.../testConnections/{type}/{name}.json`.

Steps have:
- `name` — Must match a key in the `test_fn` dict in `connection.py`
- `mandatory` — Fail the whole test if this step fails
- `shortCircuit` — Stop testing if this step fails

---

## Troubleshooting

### "Module not found" after scaffold

Run code generation first:
```bash
make generate
```

### JSON Schema $ref doesn't resolve

Check that relative paths are correct. Database schemas use `./common/` for
auth and `../../../../` to reach shared types. Non-database schemas use
`../connectionBasicType.json` for connection options.

### UI form doesn't show new connector

1. Check you added the type to `{serviceType}Service.json`
2. Check you ran `yarn parse-schema`
3. Check you added the switch case in `{ServiceType}ServiceUtils.tsx`

### Test connection fails

1. Read `testConnections/{type}/{name}.json` — step names must match
2. In `connection.py`, the `test_fn` dict keys must match step names exactly
3. Each test function should raise on failure (assert or raise)

---

## Examples

See `skills/connector-building/examples/` for complete connector profiles:

- `database-sqlalchemy.yaml` — ClickHouse-style OLAP database
- `dashboard-rest.yaml` — Superset-style dashboard tool
- `pipeline-sdk.yaml` — Prefect-style workflow orchestrator

# Ssrs Connector — Implementation Brief

## Instructions

You are implementing a new OpenMetadata connector. This file contains
everything you need. Follow these steps in order:

1. **Set up the development environment**
2. **Read the reference connector** to learn the patterns
3. **Implement the TODO items** in the generated files
4. **Register the connector** in the service schema and UI
5. **Run code generation** and formatting
6. **Run tests** and validate

Do NOT skip steps. Do NOT guess patterns — copy them from the reference.

## Prerequisites: Environment Setup

Before running any `make` or `python` commands, set up the Python environment:

```bash
# From the root of the OpenMetadata project
python3.11 -m venv env
source env/bin/activate
make install_dev generate
```

Always activate the env before running commands:

```bash
source env/bin/activate
```

## Connector Profile

- **Name**: `Ssrs`
- **Service Type**: `dashboard`
- **Connection Type**: `rest_api`
- **Base Class**: `DashboardServiceSource` from `metadata.ingestion.source.dashboard.dashboard_service`
- **Auth Types**: basic
- **Capabilities**: metadata
- **Description**: SQL Server Reporting Services (SSRS) provides a set of on-premises tools and services to create, deploy, and manage paginated reports

## Source Documentation

- **API Docs**: https://learn.microsoft.com/en-us/sql/reporting-services/developer/rest-api
- **Key Endpoints**: SSRS 2017+ REST API v2.0 at http://{host}/reports/api/v2.0. Auth is Windows/NTLM.

### Notes
Reports=Dashboards, visuals=Charts. Folders=Projects. OData pagination with $top/$skip. Auth uses NTLM (pip install requests-ntlm).

## Step 1: Read the Reference Connector

The `metabase` connector is the closest reference. **Read these files first**:

- `ingestion/src/metadata/ingestion/source/dashboard/metabase/metadata.py`
- `ingestion/src/metadata/ingestion/source/dashboard/metabase/connection.py`
- `ingestion/src/metadata/ingestion/source/dashboard/metabase/client.py`
- `ingestion/src/metadata/ingestion/source/dashboard/metabase/models.py`
- `ingestion/src/metadata/ingestion/source/dashboard/metabase/service_spec.py`

Also read the base class to understand the topology and abstract methods:
- `ingestion/src/metadata/ingestion/source/dashboard/dashboard_service.py`

## Step 2: Implement the Generated Files

Each file below has `# TODO` markers. Implement them.

### `ingestion/src/metadata/ingestion/source/dashboard/ssrs/client.py` (main implementation work)

Build the REST/SDK client. Required methods:

- `__init__(self, config)` — Initialize HTTP session or SDK client, set up auth
- `test_access(self)` — Make a lightweight API call to verify credentials work

Add methods for each API operation needed by `metadata.py`. For example:

- `get_dashboards(self)` — List all dashboards
- `get_dashboard_details(self, dashboard_id)` — Get full dashboard details
- `get_charts(self, dashboard_id)` — List charts for a dashboard

### `ingestion/src/metadata/ingestion/source/dashboard/ssrs/connection.py`

Already wired. Update the `test_fn` dict keys to match the step names
in `openmetadata-service/src/main/resources/json/data/testConnections/dashboard/ssrs.json`. Add client methods for each test step.

### `ingestion/src/metadata/ingestion/source/dashboard/ssrs/metadata.py`

Extends `DashboardServiceSource`. You **must** implement these abstract methods:

- `get_dashboards_list(self)` -> `Optional[List[Any]]` — Return list of all dashboard objects from the source
- `get_dashboard_name(self, dashboard: Any)` -> `str` — Extract name from a dashboard object
- `get_dashboard_details(self, dashboard: Any)` -> `Any` — Fetch full dashboard details for a given dashboard
- `yield_dashboard(self, dashboard_details: Any)` -> `Iterable[Either[CreateDashboardRequest]]` — Create and yield a CreateDashboardRequest entity
- `yield_dashboard_chart(self, dashboard_details: Any)` -> `Iterable[Either[CreateChartRequest]]` — Create and yield CreateChartRequest entities for each chart
- `yield_dashboard_lineage_details(self, dashboard_details: Any, db_service_prefix: Optional[str] = None)` -> `Iterable[Either[AddLineageRequest]]` — Yield lineage between dashboard and data sources (can yield nothing if N/A)

### `ingestion/src/metadata/ingestion/source/dashboard/ssrs/service_spec.py`
Already complete. No changes needed.

### Optional Capability Overrides (in `metadata.py`)

These are **not required** but can be implemented by overriding the
default no-op methods in the base class. No extra files needed.

- `yield_dashboard_lineage_details(self, dashboard_details, db_service_prefix=None)` -> `Iterable[Either[AddLineageRequest]]` — Dashboard-to-table lineage. Parse SQL from charts or map dashboard data sources to database tables. See metabase or tableau metadata.py for examples.
- `yield_dashboard_usage(self, dashboard_details)` -> `Iterable[Either[DashboardUsage]]` — Dashboard view counts. Fetch usage/view count from the API and yield DashboardUsage. See tableau or looker metadata.py for examples.
- `yield_bulk_datamodel(self, _)` -> `Iterable[Either[CreateDashboardDataModelRequest]]` — Data models (e.g. LookML views, Tableau datasources). See looker metadata.py for examples.
- `get_owner_ref(self, dashboard_details)` -> `Optional[EntityReferenceList]` — Dashboard ownership. Resolve owner email to OpenMetadata user reference.
- `get_project_name(self, dashboard_details)` -> `Optional[str]` — Folder/project/workspace name for organizing dashboards.

## Step 3: Register the Connector

After implementation, modify these existing files:

### 3a. Service schema: `openmetadata-spec/src/main/resources/json/schema/entity/services/dashboardService.json`

- Add `"Ssrs"` to the `dashboardServiceType` enum array
- Add to the connection `oneOf` array:
  ```json
  {"$ref": "connections/dashboard/ssrsConnection.json"}
  ```

### 3b. UI service utils: `openmetadata-ui/src/main/resources/ui/src/utils/DashboardServiceUtils.ts`

- Import the resolved connection schema for `Ssrs`
- Add a `case 'Ssrs':` in the switch statement that returns the schema

### 3c. Localization

- Add i18n keys in `openmetadata-ui/src/main/resources/ui/src/locale/languages/`
- Add display name entry for `"Ssrs"` service

## Step 4: Code Generation and Formatting

Run these commands in order:

```bash
# Activate the Python environment
source env/bin/activate

# Generate Python Pydantic models from JSON Schema
make generate

# Generate Java models from JSON Schema
mvn clean install -pl openmetadata-spec

# Generate resolved JSON for UI forms
cd openmetadata-ui/src/main/resources/ui && yarn parse-schema

# Format and lint Python code
make py_format

# Format Java code
mvn spotless:apply
```

## Step 5: Run Tests

```bash
source env/bin/activate

# Unit tests
python -m pytest ingestion/tests/unit/topology/dashboard/test_ssrs.py -v

# Integration tests (requires OpenMetadata server running locally)
python -m pytest ingestion/tests/integration/ssrs/ -v

# Connection integration test
python -m pytest ingestion/tests/integration/connections/test_ssrs_connection.py -v
```

Note: Integration tests are stubs. To enable real E2E testing, either:
- Re-run scaffold with `--docker-image` to generate testcontainers-based tests
- Manually update `ingestion/tests/integration/ssrs/conftest.py` with a container or mock server

## Step 6: Validate Checklist

- [ ] `make generate` succeeds
- [ ] `mvn clean install -pl openmetadata-spec` succeeds
- [ ] `yarn parse-schema` succeeds
- [ ] Unit tests pass
- [ ] Integration tests pass (if Docker available)
- [ ] `make py_format` passes (run from repo root with env activated)
- [ ] `mvn spotless:apply` passes

## Generated Files Index

| File | Purpose |
|------|---------|
| `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/ssrsConnection.json` | Connection JSON Schema (single source of truth) |
| `openmetadata-service/src/main/resources/json/data/testConnections/dashboard/ssrs.json` | Test connection step definitions |
| `ingestion/src/metadata/ingestion/source/dashboard/ssrs/connection.py` | Connection handler |
| `ingestion/src/metadata/ingestion/source/dashboard/ssrs/metadata.py` | Source class with extraction logic |
| `ingestion/src/metadata/ingestion/source/dashboard/ssrs/service_spec.py` | ServiceSpec registration |
| `ingestion/src/metadata/ingestion/source/dashboard/ssrs/client.py` | REST/SDK client |
| `ingestion/tests/unit/topology/dashboard/test_ssrs.py` | Unit tests |
| `ingestion/tests/integration/connections/test_ssrs_connection.py` | Connection integration test |
| `ingestion/tests/integration/ssrs/conftest.py` | Test container fixtures |
| `ingestion/tests/integration/ssrs/test_metadata.py` | Metadata integration test |

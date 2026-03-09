# MyDb Connector — Implementation Brief

## Instructions

You are implementing a new OpenMetadata connector. This file contains
everything you need. Follow these steps in order:

1. **Read the reference connector** to learn the patterns
2. **Implement the files** in the generated directory
3. **Register the connector** in the service schema and UI
4. **Run code generation** and formatting
5. **Write tests** and validate

Do NOT guess patterns — copy them from the reference connector.

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

- **Name**: `MyDb`
- **Service Type**: `database`
- **Connection Type**: `sqlalchemy`
- **Base Class**: `CommonDbSourceService` from `metadata.ingestion.source.database.common_db_source`
- **Auth Types**: basic
- **Capabilities**: metadata
- **SQLAlchemy Scheme**: `mydb+pymydb`
- **Default Port**: 5432

## Step 1: Read the Reference Connector

The `mysql` connector is the closest reference. **Read these files first**:

- `ingestion/src/metadata/ingestion/source/database/mysql/metadata.py`
- `ingestion/src/metadata/ingestion/source/database/mysql/connection.py`
- `ingestion/src/metadata/ingestion/source/database/mysql/queries.py`
- `ingestion/src/metadata/ingestion/source/database/mysql/service_spec.py`

Also read the base class to understand the topology and abstract methods:
- `ingestion/src/metadata/ingestion/source/database/common_db_source.py`

## Step 2: Implement the Connector Files

The scaffold generated concrete code templates for this SQLAlchemy connector.
Each file has `# TODO` markers showing what to implement.

### `ingestion/src/metadata/ingestion/source/database/my_db/connection.py`
- `_get_client()` — Return a SQLAlchemy `Engine`. The default `create_generic_db_connection` works if the DB uses standard host/port/user/password. Customize for special auth (e.g., token injection).
- `test_connection()` — Usually works as-is with `test_connection_db_schema_sources`.

### `ingestion/src/metadata/ingestion/source/database/my_db/metadata.py`
- Usually works as-is via `CommonDbSourceService`. Override only for custom behavior (stored procedures, custom type mapping).

### `ingestion/src/metadata/ingestion/source/database/my_db/queries.py`
- Add SQL queries for metadata extraction or query log access.

### `ingestion/src/metadata/ingestion/source/database/my_db/service_spec.py`
Already complete. No changes needed.

## Step 3: Register the Connector

Modify these existing files:

### 3a. Service schema: `openmetadata-spec/src/main/resources/json/schema/entity/services/databaseService.json`

- Add `"MyDb"` to the `databaseServiceType` enum array
- Add to the connection `oneOf` array:
  ```json
  {"$ref": "connections/database/myDbConnection.json"}
  ```

### 3b. UI service utils: `openmetadata-ui/src/main/resources/ui/src/utils/DatabaseServiceUtils.tsx`

- Import the resolved connection schema for `MyDb`
- Add a `case 'MyDb':` in the switch statement that returns the schema

### 3c. Localization

- Add i18n keys in `openmetadata-ui/src/main/resources/ui/src/locale/languages/`
- Add display name entry for `"MyDb"` service

## Step 4: Code Generation and Formatting

```bash
source env/bin/activate
make generate                                # Python models from JSON Schema
mvn clean install -pl openmetadata-spec      # Java models
cd openmetadata-ui/src/main/resources/ui && yarn parse-schema  # UI forms
make py_format                               # Format Python code
mvn spotless:apply                           # Format Java code
```

## Step 5: Write Tests and Validate

Write tests following the patterns in existing connectors:

### Unit tests
- **Reference directory**: `ingestion/tests/unit/topology/database/`
- **Create**: `ingestion/tests/unit/topology/database/test_my_db.py`
- Pattern: mock config dict, patch `test_connection`/`get_connection`, create source, test methods

### Validate

```bash
source env/bin/activate
python -m pytest ingestion/tests/unit/topology/database/test_my_db.py -v
```

## Checklist

- [ ] `make generate` succeeds
- [ ] `mvn clean install -pl openmetadata-spec` succeeds
- [ ] `yarn parse-schema` succeeds
- [ ] Unit tests pass
- [ ] `make py_format` passes
- [ ] `mvn spotless:apply` passes

## Generated Files

| File | Status |
|------|--------|
| `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/myDbConnection.json` | Complete — connection JSON Schema |
| `openmetadata-service/src/main/resources/json/data/testConnections/database/myDb.json` | Complete — test connection steps |
| `ingestion/src/metadata/ingestion/source/database/my_db/connection.py` | Template — has TODOs |
| `ingestion/src/metadata/ingestion/source/database/my_db/metadata.py` | Template — usually works as-is |
| `ingestion/src/metadata/ingestion/source/database/my_db/service_spec.py` | Complete |
| `ingestion/src/metadata/ingestion/source/database/my_db/queries.py` | Template — has TODOs |

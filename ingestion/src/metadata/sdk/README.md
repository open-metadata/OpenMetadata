# OpenMetadata Python SDK

A modern, fluent Python SDK for OpenMetadata that provides an intuitive API for all operations.

## Installation

The SDK is part of the openmetadata-ingestion package:

```bash
pip install openmetadata-ingestion
```

### Data Quality SDK Installation

For running data quality tests, additional dependencies may be required:

**DataFrame Validation:**
```bash
pip install 'openmetadata-ingestion[pandas]'
```

**Table-Based Testing:**
```bash
# Install the database extra matching your table's service type
pip install 'openmetadata-ingestion[mysql]'        # For MySQL
pip install 'openmetadata-ingestion[postgres]'     # For PostgreSQL
pip install 'openmetadata-ingestion[snowflake]'    # For Snowflake
pip install 'openmetadata-ingestion[clickhouse]'   # For ClickHouse
```

## Quick Start

### Configure the SDK

The simplest way to configure the SDK is using the `configure()` function:

```python
from metadata.sdk import configure

# Configure with explicit credentials
configure(host="http://localhost:8585/api", jwt_token="your-jwt-token")

# Or configure from environment variables
# Set OPENMETADATA_HOST and OPENMETADATA_JWT_TOKEN
configure()
```

The `configure()` function supports:
- **`host`** or **`server_url`**: OpenMetadata server URL
- **`jwt_token`**: JWT authentication token
- Falls back to environment variables:
  - `OPENMETADATA_HOST` or `OPENMETADATA_SERVER_URL` for the server URL
  - `OPENMETADATA_JWT_TOKEN` or `OPENMETADATA_API_KEY` for authentication
  - `OPENMETADATA_VERIFY_SSL`: Enable SSL verification (default: false)
  - `OPENMETADATA_CA_BUNDLE`: Path to CA bundle
  - `OPENMETADATA_CLIENT_TIMEOUT`: Client timeout in seconds (default: 30)

### Alternative: Manual Initialization

For more control, you can manually initialize the SDK:

```python
from metadata.sdk import OpenMetadata, OpenMetadataConfig
from metadata.sdk.entities import Table, User
from metadata.sdk.api import Search, Lineage, Bulk

# Configure the client
config = OpenMetadataConfig(
    server_url="http://localhost:8585/api",
    jwt_token="your-jwt-token"
)

# Initialize the client
client = OpenMetadata.initialize(config)

# Set default client for static APIs
Table.set_default_client(client)
User.set_default_client(client)
Search.set_default_client(client)
Lineage.set_default_client(client)
Bulk.set_default_client(client)
```

### Configuration from Environment Variables Only

You can also load configuration entirely from environment variables:

```python
from metadata.sdk.config import OpenMetadataConfig

# Reads from OPENMETADATA_HOST, OPENMETADATA_JWT_TOKEN, etc.
config = OpenMetadataConfig.from_env()
```

## Entity Operations

### Tables

```python
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.sdk.entities.table import TableListParams

# Create a table
request = CreateTableRequest(
    name="my_table",
    databaseSchema="my_schema",
    columns=[...]
)
table = Table.create(request)

# Retrieve a table by ID
table = Table.retrieve("table-id")

# Retrieve by fully qualified name with specific fields
table = Table.retrieve_by_name(
    "service.database.schema.table",
    fields=["owners", "tags", "columns"]
)

# List tables with pagination
for table in Table.list().auto_paging_iterable():
    print(table.name)

# List with filters
params = TableListParams.builder() \
    .limit(50) \
    .database("my_database") \
    .fields(["owners", "tags"]) \
    .build()
    
tables = Table.list(params)

# Update a table
table.description = "Updated description"
updated = Table.update(table.id, table)

# Delete a table
Table.delete("table-id")

# Delete with options
Table.delete("table-id", recursive=True, hard_delete=True)

# Export/Import CSV
csv_data = Table.export_csv("table-name")
Table.import_csv(csv_data, dry_run=False)
```

### Users

```python
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.sdk.entities.user import UserListParams

# Create a user
request = CreateUserRequest(
    name="john.doe",
    email="john@example.com",
    isAdmin=False
)
user = User.create(request)

# Retrieve a user
user = User.retrieve("user-id")
user = User.retrieve_by_name("john.doe", fields=["teams", "roles"])

# List users
for user in User.list().auto_paging_iterable():
    print(user.email)

# List with filters
params = UserListParams.builder() \
    .team("engineering") \
    .is_admin(False) \
    .limit(100) \
    .build()
    
users = User.list(params)

# Update a user
user.displayName = "John Doe"
updated = User.update(user.id, user)

# Delete a user
User.delete("user-id")
```

## Search Operations

```python
# Simple search
results = Search.search("customer")

# Search with parameters
results = Search.search(
    query="customer",
    index="table_search_index",
    from_=0,
    size=100,
    sort_field="name.keyword",
    sort_order="asc"
)

# Get suggestions
suggestions = Search.suggest("cust", size=10)

# Aggregations
aggregations = Search.aggregate(
    "type:Table",
    index="table_search_index",
    field="database"
)

# Advanced search with custom request
search_request = {
    "query": {
        "match": {
            "name": "customer"
        }
    },
    "size": 50
}
results = Search.search_advanced(search_request)

# Reindex operations
Search.reindex("table")
Search.reindex_all()

# Using the builder
results = Search.builder() \
    .query("customer") \
    .index("table_search_index") \
    .from_(0) \
    .size(100) \
    .sort_field("name.keyword") \
    .sort_order("asc") \
    .execute()
```

## Lineage Operations

```python
# Get lineage for an entity
lineage = Lineage.get_lineage("entity-fqn", upstream_depth=3, downstream_depth=2)

# Get entity lineage by type and ID
lineage = Lineage.get_entity_lineage(
    entity_type="table",
    entity_id="entity-id",
    upstream_depth=3,
    downstream_depth=2
)

# Add lineage relationship
Lineage.add_lineage(
    from_entity_id="source-id",
    from_entity_type="table",
    to_entity_id="target-id",
    to_entity_type="dashboard",
    description="Data flow from table to dashboard"
)

# Delete lineage
Lineage.delete_lineage(
    from_entity="entity1",
    from_entity_type="table",
    to_entity="entity2",
    to_entity_type="dashboard"
)

# Export lineage
export = Lineage.export_lineage("table", "entity-id")

# Using the builder
lineage = Lineage.builder() \
    .entity_type("table") \
    .entity_id("entity-id") \
    .upstream_depth(3) \
    .downstream_depth(2) \
    .execute()
```

## Bulk Operations

```python
# Import CSV data
csv_data = "name,description\ntable1,desc1\ntable2,desc2"
result = Bulk.import_csv("table", csv_data, dry_run=True)

# Export CSV data
csv = Bulk.export_csv("table")

# Bulk add assets
assets = [
    {"name": "table1", "database": "db1"},
    {"name": "table2", "database": "db1"}
]
Bulk.add_assets("table", assets)

# Bulk patch
patches = [
    {"id": "id1", "patch": [{"op": "add", "path": "/description", "value": "Updated"}]},
    {"id": "id2", "patch": [{"op": "add", "path": "/description", "value": "Another"}]}
]
Bulk.patch("table", patches)

# Bulk delete
ids = ["id1", "id2", "id3"]
Bulk.delete("table", ids, hard_delete=True)

# Bulk restore
Bulk.restore("table", ids)

# Using the builder
result = Bulk.builder() \
    .entity_type("table") \
    .csv_data(csv_data) \
    .dry_run(True) \
    .execute()
```

## Async Operations

All operations support async execution:

```python
import asyncio

# Async entity operations
table = await Table.create_async(request)
table = await Table.retrieve_async("id")
await Table.delete_async("id", recursive=True, hard_delete=True)

# Async search
results = await Search.search_async("query")
suggestions = await Search.suggest_async("query")
await Search.reindex_async("table")

# Async lineage
lineage = await Lineage.get_lineage_async("entity")
await Lineage.add_lineage_async(
    "id1", "table", "id2", "dashboard"
)
export = await Lineage.export_lineage_async("table", "id")

# Async bulk operations
result = await Bulk.import_csv_async("table", csv_data)
deleted = await Bulk.delete_async("table", ids)

# Run async operations
async def main():
    table = await Table.retrieve_async("table-id")
    print(table.name)

asyncio.run(main())
```

## Advanced Configuration

```python
# Full configuration options
config = OpenMetadataConfig(
    server_url="https://metadata.company.com",
    jwt_token="jwt-token",
    verify_ssl=True,
    ca_bundle="/path/to/ca-bundle.crt",
    client_timeout=30
)

# Using builder pattern
config = OpenMetadataConfig.builder() \
    .server_url("https://metadata.company.com") \
    .jwt_token("jwt-token") \
    .verify_ssl(True) \
    .client_timeout(60) \
    .build()
```

## Error Handling

```python
from metadata.ingestion.ometa.client import APIError

try:
    table = Table.retrieve("table-id")
except APIError as e:
    if e.status_code == 404:
        print("Table not found")
    elif e.status_code == 401:
        print("Authentication failed")
    else:
        print(f"Error: {e}")
```

## Auto-Pagination

The SDK automatically handles pagination for list operations:

```python
# Iterate through all tables
for table in Table.list().auto_paging_iterable():
    process_table(table)

# Manual pagination control
params = TableListParams.builder() \
    .limit(100) \
    .after("cursor-token") \
    .build()
    
collection = Table.list(params)
for table in collection.get_data():
    print(table.name)
```

## Supported Entity Types

The SDK provides the same fluent API for all OpenMetadata entity types:

- **Data Assets**: Table, Database, DatabaseSchema, Dashboard, Pipeline, Topic, Container, Query, StoredProcedure, DashboardDataModel, SearchIndex, MlModel, Report
- **Services**: DatabaseService, MessagingService, DashboardService, PipelineService, MlModelService, StorageService, SearchService, MetadataService, ApiService
- **Teams & Users**: User, Team, Role, Policy
- **Governance**: Glossary, GlossaryTerm, Classification, Tag, DataProduct, Domain
- **Quality**: TestCase, TestSuite, TestDefinition, DataQualityDashboard
- **Ingestion**: Ingestion, Workflow, Connection
- **Other**: Type, Webhook, Kpi, Application, Persona, DocStore, Page, SearchQuery

## Thread Safety

The OpenMetadata client is thread-safe and can be shared across multiple threads. The static API methods use a shared default client instance.

## Testing

Run the SDK tests:

```bash
# Run all SDK tests
pytest tests/unit/sdk/

# Run specific test
pytest tests/unit/sdk/test_sdk_entities.py
```

## Contributing

Please read the main [CONTRIBUTING.md](../../CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](../../LICENSE) file for details.
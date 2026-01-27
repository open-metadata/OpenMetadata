# OpenMetadata Python SDK - Improved Version

## Overview

The improved Python SDK provides a clean, consistent API for interacting with OpenMetadata entities, following the successful patterns from the Java SDK. This redesign addresses key issues:

1. **Clean API without Pydantic conflicts** - Static methods instead of instance methods
2. **Full PATCH support** - Proper JSON Patch operations for partial updates
3. **Complete entity coverage** - Support for all 44+ entity types
4. **Comprehensive testing** - Mock-based tests without server dependencies
5. **Async support** - Built-in async operations for all CRUD methods

## Key Improvements from Original SDK

### 1. No Pydantic Model Conflicts

The original SDK mixed Pydantic models with custom methods, causing conflicts. The new design uses **static methods** on wrapper classes:

```python
# Old way (conflicts with Pydantic)
table = Table(name="users")  # Pydantic validation issues
table.save()  # Method conflicts

# New way (clean separation)
create_request = CreateTableRequest(name="users", ...)
table = Table.create(create_request)  # Static method, no conflicts
```

### 2. Proper PATCH Support

Full JSON Patch (RFC 6902) support for partial updates:

```python
# PATCH operation - only update what changed
patch = [
    {"op": "replace", "path": "/description", "value": "New description"},
    {"op": "add", "path": "/tags/0", "value": {"tagFQN": "PII.Sensitive"}}
]
table = Table.patch(table_id, patch)

# vs PUT operation - full replacement
table.description = "New description"
table = Table.update(table_id, table)  # Sends entire entity
```

### 3. Consistent API Across All Entities

Every entity follows the same pattern via `BaseEntity`:

```python
# Same API for all entities
table = Table.create(request)
database = Database.create(request)
dashboard = Dashboard.create(request)
pipeline = Pipeline.create(request)
user = User.create(request)
team = Team.create(request)

# All support the same operations
entity = EntityClass.retrieve(id)
entity = EntityClass.retrieve_by_name(fqn)
entity = EntityClass.update(id, entity)
entity = EntityClass.patch(id, json_patch)
EntityClass.delete(id)
entities = EntityClass.list()
```

### 4. Built-in Async Support

All operations have async variants:

```python
# Synchronous
table = Table.create(request)

# Asynchronous
table = await Table.create_async(request)

# Batch operations with async
tables = await asyncio.gather(
    Table.create_async(request1),
    Table.create_async(request2),
    Table.create_async(request3)
)
```

## Installation

```bash
pip install openmetadata-ingestion
```

## Quick Start

```python
from metadata.sdk import OpenMetadata, OpenMetadataConfig
from metadata.sdk.entities import Table, Database, Dashboard
from metadata.generated.schema.api.data.createTable import CreateTableRequest

# Initialize the SDK
config = OpenMetadataConfig(
    server_url="http://localhost:8585",
    jwt_token="your-jwt-token"
)
OpenMetadata.initialize(config)

# Create a table
create_request = CreateTableRequest(
    name="users",
    databaseSchema="prod.analytics",
    columns=[
        Column(name="id", dataType="INTEGER"),
        Column(name="email", dataType="VARCHAR", dataLength=255)
    ]
)
table = Table.create(create_request)

# Retrieve entities
table = Table.retrieve("550e8400-e29b-41d4-a716-446655440000")
table = Table.retrieve_by_name("prod.analytics.users")

# Update with PATCH
patch = [
    {"op": "add", "path": "/description", "value": "User data table"},
    {"op": "add", "path": "/tags/0", "value": {"tagFQN": "PII.Sensitive"}}
]
table = Table.patch(table.id, patch)

# List with pagination
tables = Table.list(limit=50, fields=["owner", "tags"])

# Delete
Table.delete(table.id, recursive=True)
```

## Entity Coverage

The SDK provides wrappers for all OpenMetadata entities:

### Data Assets
- `Table` - Database tables
- `Database` - Databases
- `DatabaseSchema` - Database schemas
- `Dashboard` - BI dashboards
- `DashboardDataModel` - Dashboard data models
- `Chart` - Dashboard charts
- `Pipeline` - Data pipelines
- `Topic` - Messaging topics
- `Container` - Storage containers
- `SearchIndex` - Search indexes
- `Query` - SQL queries
- `MlModel` - Machine learning models
- `Metric` - Business metrics

### Services
- `DatabaseService` - Database services (MySQL, Postgres, etc.)
- `DashboardService` - Dashboard services (Tableau, Looker, etc.)
- `MessagingService` - Messaging services (Kafka, Pulsar, etc.)
- `PipelineService` - Pipeline services (Airflow, Dagster, etc.)
- `StorageService` - Storage services (S3, GCS, etc.)
- `SearchService` - Search services (Elasticsearch, OpenSearch)
- `MlModelService` - ML services (MLflow, Sagemaker, etc.)
- `MetadataService` - Metadata services

### Governance
- `Glossary` - Business glossaries
- `GlossaryTerm` - Glossary terms
- `Classification` - Data classifications
- `Tag` - Classification tags
- `Policy` - Access control policies
- `Role` - User roles

### Teams & Users
- `User` - User accounts
- `Team` - Teams and departments
- `Bot` - Service accounts

### Data Quality
- `TestCase` - Data quality test cases
- `TestSuite` - Test suite collections
- `TestDefinition` - Test definitions

### Lineage & Discovery
- `DataProduct` - Data products
- `Domain` - Data domains
- `Workflow` - Workflows
- `APICollection` - API collections
- `APIEndpoint` - API endpoints

## Advanced Features

### Batch Operations

```python
# Create multiple tables efficiently
tables_to_create = [
    CreateTableRequest(name=f"table_{i}", ...) 
    for i in range(100)
]

# Synchronous batch
tables = [Table.create(req) for req in tables_to_create]

# Asynchronous batch (much faster)
tables = await asyncio.gather(
    *[Table.create_async(req) for req in tables_to_create]
)
```

### Field Selection

```python
# Only fetch specific fields for performance
table = Table.retrieve(
    table_id, 
    fields=["name", "description", "owner", "tags"]
)

# List with field selection
tables = Table.list(
    fields=["name", "owner"],
    limit=100
)
```

### Complex PATCH Operations

```python
# Advanced JSON Patch operations
patch = [
    # Replace description
    {"op": "replace", "path": "/description", "value": "New description"},
    
    # Add multiple tags
    {"op": "add", "path": "/tags/0", "value": {"tagFQN": "PII.Sensitive"}},
    {"op": "add", "path": "/tags/1", "value": {"tagFQN": "Tier.Tier1"}},
    
    # Update owner
    {"op": "replace", "path": "/owner", "value": {"id": "user-id", "type": "user"}},
    
    # Add custom properties
    {"op": "add", "path": "/extension/customProperty", "value": "custom-value"}
]

table = Table.patch(table_id, patch)
```

### CSV Import/Export

```python
# Export entities to CSV
csv_data = Table.export_csv("table_export")

# Import entities from CSV
import_status = Table.import_csv(csv_data, dry_run=True)
```

## Testing

The SDK includes comprehensive mock-based tests that don't require a running server:

```python
import unittest
from unittest.mock import MagicMock
from metadata.sdk.entities import Table

class TestTableOperations(unittest.TestCase):
    def setUp(self):
        self.mock_client = MagicMock()
        Table.set_default_client(self.mock_client)
    
    def test_create_table(self):
        # Mock response
        expected_table = TableEntity(id="123", name="test")
        self.mock_client.ometa.create_or_update.return_value = expected_table
        
        # Test
        result = Table.create(CreateTableRequest(...))
        self.assertEqual(result.name, "test")
```

## Migration from Original SDK

### Old Pattern
```python
from metadata.ingestion.ometa.ometa_api import OpenMetadata

client = OpenMetadata(config)
table = client.create_or_update(CreateTableRequest(...))
table = client.get_by_name(Table, "fqn")
client.patch(Table, table_id, json_patch)
```

### New Pattern
```python
from metadata.sdk import OpenMetadata, OpenMetadataConfig
from metadata.sdk.entities import Table

OpenMetadata.initialize(config)
table = Table.create(CreateTableRequest(...))
table = Table.retrieve_by_name("fqn")
table = Table.patch(table_id, json_patch)
```

## Benefits Summary

1. **Type Safety** - Full type hints and IDE support
2. **Consistency** - Same API pattern for all entities
3. **Performance** - Async support for batch operations
4. **Testability** - Easy mocking without server dependencies
5. **Maintainability** - Clear separation of concerns
6. **Completeness** - All entities and operations supported
7. **Documentation** - Self-documenting API design

## Contributing

To add a new entity:

1. Create a new file in `metadata/sdk/entities/`
2. Extend `BaseEntity` with proper type parameters
3. Override `entity_type()` method
4. Add tests in `tests/unit/sdk/`

Example:
```python
from metadata.sdk.entities.base import BaseEntity

class NewEntity(BaseEntity[NewEntitySchema, CreateNewEntityRequest]):
    @classmethod
    def entity_type(cls) -> Type[NewEntitySchema]:
        return NewEntitySchema
```

## License

Apache 2.0
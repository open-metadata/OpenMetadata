# OpenMetadata Python SDK

A typed Python SDK for common OpenMetadata operations. The SDK wraps the
generated Pydantic entity models with plural facade classes such as `Tables`,
`Databases`, and `Users`.

## Installation

The SDK is part of the `openmetadata-ingestion` package:

```bash
pip install openmetadata-ingestion
```

For data quality examples, install the extra that matches your workload:

```bash
pip install 'openmetadata-ingestion[pandas]'
pip install 'openmetadata-ingestion[mysql]'
pip install 'openmetadata-ingestion[postgres]'
```

## Configure the SDK

Use `configure()` for application code. It initializes the default client used
by the entity facades.

```python
from metadata.sdk import configure

configure(host="http://localhost:8585/api", jwt_token="your-jwt-token")
```

You can also configure the SDK from environment variables:

```python
from metadata.sdk import configure

# Reads OPENMETADATA_HOST or OPENMETADATA_SERVER_URL.
# Reads OPENMETADATA_JWT_TOKEN or OPENMETADATA_API_KEY.
configure()
```

Supported environment variables:

- `OPENMETADATA_HOST` or `OPENMETADATA_SERVER_URL`
- `OPENMETADATA_JWT_TOKEN` or `OPENMETADATA_API_KEY`
- `OPENMETADATA_VERIFY_SSL`
- `OPENMETADATA_CA_BUNDLE`
- `OPENMETADATA_CLIENT_TIMEOUT`

For tests or advanced setup, you can initialize the client manually:

```python
from metadata.sdk import OpenMetadata, OpenMetadataConfig

config = OpenMetadataConfig(
    server_url="http://localhost:8585/api",
    jwt_token="your-jwt-token",
)
client = OpenMetadata.initialize(config)
```

## Entity Facades and Generated Models

The SDK facade classes are plural to avoid name conflicts with generated
Pydantic entity classes.

```python
from metadata.sdk import Tables
from metadata.generated.schema.entity.data.table import Table

table: Table = Tables.retrieve_by_name("service.database.schema.table")
```

Use the plural facade for SDK operations. The singular generated classes, such
as `metadata.generated.schema.entity.data.table.Table`, are data models and do
not expose SDK methods like `create()` or `update()`.

## Table Operations

```python
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.sdk import Tables

request = CreateTableRequest(
    name="orders",
    databaseSchema="service.database.schema",
    columns=[
        Column(name="id", dataType=DataType.BIGINT),
        Column(name="status", dataType=DataType.VARCHAR, dataLength=255),
    ],
)

table = Tables.create(request)

table = Tables.retrieve(str(table.id.root), fields=["owners", "tags", "columns"])
table = Tables.retrieve_by_name(
    "service.database.schema.orders",
    fields=["owners", "tags", "columns"],
)

table.description = "Order facts loaded from the commerce warehouse"
updated = Tables.update(table)

Tables.delete(str(updated.id.root), recursive=True, hard_delete=True)
```

`Tables.update(entity)` expects the entity object only. It reads the current
entity by `entity.id` and patches the changed fields through the underlying
OpenMetadata client.

## Listing and Pagination

`list()` returns one page as an `EntityList` with `entities`, `after`, and
`before` attributes.

```python
from metadata.sdk import Tables

page = Tables.list(
    limit=50,
    fields=["owners", "tags"],
    filters={"databaseSchema": "service.database.schema"},
)

for table in page.entities:
    print(table.fullyQualifiedName)

if page.after:
    next_page = Tables.list(limit=50, after=page.after)
```

Use `list_all()` when you want the SDK to fetch every page.

```python
from metadata.sdk import Tables

for table in Tables.list_all(
    batch_size=100,
    fields=["owners", "tags"],
    filters={"databaseSchema": "service.database.schema"},
):
    print(table.name)
```

There is no `TableListParams` class and `EntityList` does not expose
`auto_paging_iterable()`. Use the keyword arguments above instead.

## Users

```python
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.sdk import Users

request = CreateUserRequest(
    name="john.doe",
    email="john@example.com",
    displayName="John Doe",
)

user = Users.create(request)
user = Users.retrieve_by_name("john.doe", fields=["teams", "roles"])

for user in Users.list_all(batch_size=100):
    print(user.email)

user.displayName = "John D."
updated = Users.update(user)
```

## Partial Updates

The facade classes do not expose a `patch(entity_id, json_patch)` method. For
partial updates, retrieve the entity, mutate a copy, and call `update(entity)`.

```python
from metadata.generated.schema.type.basic import Markdown
from metadata.sdk import Tables

table = Tables.retrieve_by_name("service.database.schema.orders")
updated_table = table.model_copy(deep=True)
updated_table.description = Markdown("Orders curated by the analytics team")

patched = Tables.update(updated_table)
```

For specialized patch flows that are not covered by a facade helper, use the
underlying ingestion client from the SDK wrapper.

```python
from metadata.generated.schema.entity.data.table import Table
from metadata.sdk import client

metadata = client().ometa
current = metadata.get_by_id(entity=Table, entity_id="table-id", fields=["tags"])
destination = current.model_copy(deep=True)
destination.tags = []

patched = metadata.patch(entity=Table, source=current, destination=destination)
```

## Table Helpers

`Tables` includes table-specific helpers that internally patch the entity.

```python
from metadata.generated.schema.entity.data.table import TableData
from metadata.sdk import Tables

table = Tables.add_tag("table-id", "PII.Sensitive")
table = Tables.update_column_description(
    "table-id",
    column_name="status",
    description="Current order state",
)

sample_data = TableData(columns=["id", "status"], rows=[[1, "COMPLETE"]])
Tables.add_sample_data("table-id", sample_data)
table_with_sample_data = Tables.get_sample_data("table-id")
```

## Governance Tags

Use the plural governance facades to create or retrieve classifications and
tags, then assign tag FQNs to assets with `Tables.add_tag()` or `update()`.

```python
from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.sdk import Classifications, Tables, Tags

classification = Classifications.create(
    CreateClassificationRequest(
        name="PII",
        description="Personally identifiable information",
    )
)

tag = Tags.create(
    CreateTagRequest(
        classification=classification.fullyQualifiedName.root,
        name="Sensitive",
        description="Sensitive customer data",
    )
)

table = Tables.add_tag("table-id", tag.fullyQualifiedName.root)
```

To replace tags instead of appending one, retrieve the table with `fields=["tags"]`,
mutate a copy, and call `Tables.update(destination)`.

## CSV Import and Export

CSV operations return operation objects. Call `execute()` to run them.

```python
from metadata.sdk import Glossaries, Tables

csv_text = Tables.export_csv("service.database.schema.orders").execute()

dry_run = (
    Glossaries.import_csv("BusinessGlossary")
    .with_data(csv_text)
    .set_dry_run(True)
    .execute()
)
```

## Search

```python
from metadata.sdk.api import Search

results = Search.search(
    query="customer",
    index="table_search_index",
    from_=0,
    size=25,
    sort_field="name.keyword",
    sort_order="asc",
)

suggestions = Search.suggest("cust", size=10)
aggregations = Search.aggregate(
    query="*",
    index="table_search_index",
    field="database.name.keyword",
)

builder_results = (
    Search.builder()
    .query("customer")
    .index("table_search_index")
    .size(25)
    .execute()
)
```

## Lineage

```python
from metadata.generated.schema.entity.data.table import Table
from metadata.sdk.api import Lineage

lineage = Lineage.get_lineage(
    "service.database.schema.orders",
    upstream_depth=1,
    downstream_depth=1,
)

lineage_by_id = Lineage.get_entity_lineage(
    entity_type=Table,
    entity_id="table-id",
    upstream_depth=2,
    downstream_depth=1,
)

Lineage.add_lineage(
    from_entity_id="source-table-id",
    from_entity_type="table",
    to_entity_id="target-table-id",
    to_entity_type="table",
    description="Curated order facts",
)
```

## Supported Entity Facades

The current SDK exports these facade classes:

- Data assets: `APICollections`, `APIEndpoints`, `Charts`, `Containers`,
  `DashboardDataModels`, `Dashboards`, `Databases`, `DatabaseSchemas`,
  `DataContracts`, `Metrics`, `MLModels`, `Pipelines`, `Queries`,
  `SearchIndexes`, `StoredProcedures`, `Tables`
- Services: `DashboardServices`, `DatabaseServices`, `StorageServices`
- Governance: `Classifications`, `DataProducts`, `Domains`, `Glossaries`,
  `GlossaryTerms`, `Tags`
- Teams and users: `Teams`, `Users`
- Data quality: `TestCases`, `TestDefinitions`, `TestSuites`

If a facade does not exist for an entity yet, use the underlying
ingestion client returned by `metadata.sdk.client().ometa` or the ingestion
client APIs directly.

## Entity References

```python
from metadata.sdk import Teams, Users, to_entity_reference

team = Teams.retrieve_by_name("engineering")
user = Users.retrieve_by_name("john.doe")

team_ref = to_entity_reference(team)
user_ref = to_entity_reference(user)
```

## Error Handling

```python
from metadata.ingestion.ometa.client import APIError
from metadata.sdk import Tables

try:
    table = Tables.retrieve("table-id")
except APIError as err:
    if err.status_code == 404:
        print("Table not found")
    elif err.status_code == 401:
        print("Authentication failed")
    else:
        raise
```

## Testing

Run the SDK unit tests from the `ingestion` directory:

```bash
pytest tests/unit/sdk/
```

Run the SDK integration tests against a local OpenMetadata server:

```bash
pytest tests/integration/sdk/test_sdk_integration.py -v
```

## Contributing

To add a new entity facade:

1. Create a new file in `metadata/sdk/entities/`.
2. Extend `BaseEntity` with the generated entity type and create request type.
3. Override `entity_type()`.
4. Export the facade from `metadata/sdk/entities/__init__.py` and
   `metadata/sdk/__init__.py`.
5. Add unit tests under `tests/unit/sdk/`.

Example:

```python
from typing import Type

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.sdk.entities.base import BaseEntity


class Tables(BaseEntity[Table, CreateTableRequest]):
    @classmethod
    def entity_type(cls) -> Type[Table]:
        return Table
```

## License

This project is licensed under the Apache License 2.0. See
[`LICENSE`](../../LICENSE) for details.

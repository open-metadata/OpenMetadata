# OpenMetadata Python SDK Compatibility Notes

This file captures the current Python SDK API shape and the most common
migration corrections for examples written against earlier design drafts.

## Use Plural Facade Classes

SDK operations live on plural facade classes. The singular generated entity
classes are Pydantic models and do not expose SDK methods.

```python
from metadata.sdk import Databases, Tables, Users
from metadata.generated.schema.entity.data.table import Table

table: Table = Tables.retrieve_by_name("service.database.schema.orders")
```

Do not import singular facade names such as `Table`, `Database`, or
`Dashboard` from `metadata.sdk.entities`; they are not exported SDK classes.

Use:

```python
from metadata.sdk import Dashboards, Databases, Tables
```

or module-specific imports:

```python
from metadata.sdk.entities.tables import Tables
```

## Configure Once

Use `configure()` for most scripts and applications.

```python
from metadata.sdk import configure

configure(host="http://localhost:8585/api", jwt_token="your-jwt-token")
```

Manual initialization is available for advanced setup or tests.

```python
from metadata.sdk import OpenMetadata, OpenMetadataConfig

config = OpenMetadataConfig(
    server_url="http://localhost:8585/api",
    jwt_token="your-jwt-token",
)
client = OpenMetadata.initialize(config)
```

Both paths initialize the default client used by the facade classes.

## CRUD Examples

```python
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.type.basic import Markdown
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
table = Tables.retrieve(str(table.id.root), fields=["owners", "tags"])
table = Tables.retrieve_by_name("service.database.schema.orders")

updated_table = table.model_copy(deep=True)
updated_table.description = Markdown("Curated order facts")
table = Tables.update(updated_table)

Tables.delete(str(table.id.root), recursive=True, hard_delete=True)
```

`update()` takes only the entity. The facade reads `entity.id`, fetches the
current entity, and patches the changed fields through the underlying client.

## Listing and Pagination

`list()` returns a single `EntityList` page.

```python
from metadata.sdk import Tables

page = Tables.list(
    limit=50,
    fields=["owners", "tags"],
    filters={"databaseSchema": "service.database.schema"},
)

for table in page.entities:
    print(table.name)

if page.after:
    next_page = Tables.list(limit=50, after=page.after)
```

Use `list_all()` for automatic pagination.

```python
from metadata.sdk import Tables

for table in Tables.list_all(batch_size=100):
    print(table.fullyQualifiedName)
```

There is no `TableListParams` class and `EntityList` does not have an
`auto_paging_iterable()` method.

## Patch Behavior

Facade classes do not expose `patch(entity_id, json_patch)`. Use
`update(entity)` for ordinary partial updates:

```python
from metadata.generated.schema.type.basic import Markdown
from metadata.sdk import Tables

table = Tables.retrieve_by_name("service.database.schema.orders")
destination = table.model_copy(deep=True)
destination.description = Markdown("Updated description")

patched = Tables.update(destination)
```

For lower-level patch flows, use the default OpenMetadata client:

```python
from metadata.generated.schema.entity.data.table import Table
from metadata.sdk import client

metadata = client().ometa
source = metadata.get_by_id(entity=Table, entity_id="table-id", fields=["tags"])
destination = source.model_copy(deep=True)
destination.tags = []

patched = metadata.patch(entity=Table, source=source, destination=destination)
```

## Async Support

Search and lineage expose async helpers such as `Search.search_async()` and
`Lineage.get_lineage_async()`. Entity CRUD facades currently expose synchronous
methods only; examples should not use `Tables.create_async()` or
`Tables.retrieve_async()`.

```python
from metadata.sdk.api import Search

results = await Search.search_async("customer", index="table_search_index")
```

## Governance Tags

Use `Classifications` and `Tags` for governance taxonomy CRUD. Use
`Tables.add_tag(table_id, "Classification.Tag")` to append a table tag, or
retrieve the table with `fields=["tags"]`, replace `tags` on a copied entity,
and call `Tables.update(destination)` when reassignment is required.

```python
from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.sdk import Classifications, Tables, Tags

classification = Classifications.create(
    CreateClassificationRequest(name="PII", description="PII taxonomy")
)
tag = Tags.create(
    CreateTagRequest(
        classification=classification.fullyQualifiedName.root,
        name="Sensitive",
        description="Sensitive data",
    )
)

table = Tables.add_tag("table-id", tag.fullyQualifiedName.root)
```

## Lineage

Lineage operations live under `metadata.sdk.api.Lineage`, not the entity
facades. Add edges by entity IDs and types, or retrieve lineage by FQN or ID.

```python
from metadata.generated.schema.entity.data.table import Table
from metadata.sdk.api import Lineage

Lineage.add_lineage(
    from_entity_id="source-table-id",
    from_entity_type="table",
    to_entity_id="target-table-id",
    to_entity_type="table",
    description="Curated order facts",
)

lineage = Lineage.get_entity_lineage(
    entity_type=Table,
    entity_id="target-table-id",
    upstream_depth=2,
    downstream_depth=1,
)
```

## CSV Operations

CSV helpers return operation objects.

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

## Current Facade Coverage

The SDK currently exports:

```python
from metadata.sdk import (
    APICollections,
    APIEndpoints,
    Charts,
    Classifications,
    Containers,
    DashboardDataModels,
    DashboardServices,
    Dashboards,
    DatabaseSchemas,
    DatabaseServices,
    Databases,
    DataContracts,
    DataProducts,
    Domains,
    Glossaries,
    GlossaryTerms,
    Metrics,
    MLModels,
    Pipelines,
    Queries,
    SearchIndexes,
    StorageServices,
    StoredProcedures,
    Tables,
    Tags,
    Teams,
    TestCases,
    TestDefinitions,
    TestSuites,
    Users,
)
```

For entities without a facade, use `metadata.sdk.client()` or the ingestion
OpenMetadata client until a facade is added.

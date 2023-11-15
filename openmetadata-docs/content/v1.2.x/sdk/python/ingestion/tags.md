---
title: Python SDK for Tags
slug: /sdk/python/ingestion/tags
---

# Python SDK for Tags

In this guide, we will use the Python SDK to create Tags.

A **prerequisite** for this section is to have previously gone through the following [docs](/sdk/python).

In the following sections we will:
- Create a Database Service, a Database, a Schema and one Table,
- Create a Classification,
- Create a Tag for the Classification and add it to the Table.

## Creating the Entities

To prepare the necessary ingredients, execute the following steps.

### 1. Preparing the Client

```python
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata

server_config = OpenMetadataConnection(
    hostPort="http://localhost:8585/api",
    authProvider="openmetadata",
    securityConfig=OpenMetadataJWTClientConfig(
        jwtToken="<token>"
    ),
)
metadata = OpenMetadata(server_config)

assert metadata.health_check()  # Will fail if we cannot reach the server
```

### 2. Creating the Database Service

We are mocking a MySQL instance. Note how we need to pass the right configuration class `MysqlConnection`, as a
parameter for the generic `DatabaseConnection` type.

```python
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)

db_service = CreateDatabaseServiceRequest(
    name="test-service-db-lineage",
    serviceType=DatabaseServiceType.Mysql,
    connection=DatabaseConnection(
        config=MysqlConnection(
            username="username",
            authType=BasicAuth(password="password"),
            hostPort="http://localhost:1234",
        )
    ),
)

db_service_entity = metadata.create_or_update(data=db_service)
```

### 3. Creating the Database

Any Entity that is created and linked to another Entity, has to hold the `fullyQualifiedName` to the Entity it
relates to. In this case, a Database is bound to a specific service.

```python
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest

create_db = CreateDatabaseRequest(
    name="test-db",
    service=db_service_entity.EntityName,
)

create_db_entity = metadata.create_or_update(data=create_db)    
```

### 4. Creating the Schema

The same happens with the Schemas. They are related to a Database.

```python
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)

create_schema = CreateDatabaseSchemaRequest(
    name="test-schema", database=create_db_entity.fullyQualifiedName
)

create_schema_entity = metadata.create_or_update(data=create_schema)
```

### 5. Creating the Table

We are doing a simple example with a single column.

```python
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Column, DataType

table = CreateTableRequest(
    name="my_table",
    databaseSchema=create_schema_entity.fullyQualifiedName,
    columns=[Column(name="id", dataType=DataType.BIGINT)],
)

table = metadata.create_or_update(data=table)
```

### 6. Creating the Classification

Classifications are the entities we use to group tag definitions. Let's create a sample one:

```python
from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest

classification_request=CreateClassificationRequest(
    name="TestClassification",
    description="Sample classification.",
)

metadata.create_or_update(classification_request)
```

### 7. Creating the Tag

Once there is an existing classification, we create tags within that given classification:

```python
tag_request=CreateTagRequest(
    classification=classification_request.name,
    name="TestTag",
    description="Sample Tag.",
)

metadata.create_or_update(tag_request)
```

### 8. Tagging a Table

Now that we have the Tag, we can proceed and tag a specific asset. In this example, we'll
tag the Table we created above. For that, the API uses a PATCH request, but the Python SDK has
a helper method that handles most of the work:

```python
from metadata.generated.schema.entity.data.table import Table

metadata.patch_tag(
    entity=Table,
    entity_id=table.id,
    tag_fqn="TestClassification.TestTag",
)
```

If we now check the tags for the Table, the new tag will be appearing in there.

Note that we now used the `patch_tag` method because the Table already existed. If we can
control the Tag creation process when the Table metadata is generated, we can assign
the tags in the `tags` property of `CreateTableRequest`.

### 9. Tagging a Column

The same idea can be replicated to tag a column:

```python
metadata.patch_column_tag(
    entity_id=table.id,
    tag_fqn="TestClassification.TestTag",
    column_name="id",
)
```

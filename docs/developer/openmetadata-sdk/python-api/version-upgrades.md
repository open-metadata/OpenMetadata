---
description: API changes when upgrading `openmetadata-ingestion` to 0.9
---

# Version Upgrades

## Upgrading to 0.9

If you were already using the Python API and you are upgrading the service to version 0.9, consider the following changes:

### Create class naming

All `Create` classes have now a simplified naming. E.g., from `CreateTableEntityRequest` to `CreateTableRequest`. In general, the change is from `Create<EntityName>EntityRequest` to `Create<EntityName>Request`

### Create Database Service JDBC

The `jdbc` field in `CreateDatabaseServiceRequest` has been updating in favor of `databaseConnection`. E.g., from:

{% code title="old_style.py" %}
```python
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceEntityRequest,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.type.jdbcConnection import JdbcInfo


create_service = CreateDatabaseServiceEntityRequest(
    name="test-service-table",
    serviceType=DatabaseServiceType.MySQL,
    jdbc=JdbcInfo(driverClass="jdbc", connectionUrl="jdbc://localhost"),
)
```
{% endcode %}

to:

{% code title="new_style.py" %}
```python
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
    DatabaseConnection,
)


create_service = CreateDatabaseServiceRequest(
    name="test-service-table",
    serviceType=DatabaseServiceType.MySQL,
    databaseConnection=DatabaseConnection(hostPort="localhost:0000"),
)
```
{% endcode %}

### Table Database Reference

Before, when creating a `Table`, we needed to pass the `Database` ID in the Create request. We have now standardized the process and you can run the creation passing an `EntityReference`. E.g., from:

{% code title="old_style.py" %}
```python
from metadata.generated.schema.api.data.createTable import CreateTableEntityRequest
from metadata.generated.schema.entity.data.table import (
    Column,
    DataType,
    Table,
)

create_table = CreateTableEntityRequest(
    name="test",
    database=db_entity.id,
    columns=[Column(name="id", dataType=DataType.BIGINT)],
)
```
{% endcode %}

to:

{% code title="new_style.py" %}
```python
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import (
    Column,
    DataType,
    Table,
)
from metadata.generated.schema.type.entityReference import EntityReference


db_reference = EntityReference(
            id=<database-entity-instance>.id, type="database"
        )

create_table = CreateTableRequest(
    name="test",
    database=db_reference,
    columns=[Column(name="id", dataType=DataType.BIGINT)],
)
```
{% endcode %}

##

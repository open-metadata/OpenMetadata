---
title: Python SDK for Lineage
description: Learn to implement data lineage tracking with OpenMetadata'sPython SDK. Complete guide with code examples, API usage, and best practices for data flow ...
slug: /sdk/python/ingestion/lineage
---

# Python SDK for Lineage

In this guide, we will use the Python SDK to create and fetch Lineage information.

For simplicity, we are going to create lineage between Tables. However, this would work with ANY entity.

You can find the Lineage Entity defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/type/entityLineage.json),
as well as the Entity defining the payload to add a new lineage: [AddLineage](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/api/lineage/addLineage.json).

{% note %}

Note that in OpenMetadata, the Lineage information is just a possible relationship between Entities. Other types
of relationships for example could be:

- Contains (a Database contains Schemas, which at the same time contain Tables),
- or Ownership of any asset.

The point being, any Entity existent in OpenMetadata can be related to any other via Lineage.

{% /note %}

In the following sections we will:
- Create a Database Service, a Database, a Schema and two Tables,
- Add Lineage between both Tables,
- Get the Lineage information back.

A **prerequisite** for this section is to have previously gone through the following [docs](/sdk/python).

## Creating the Entities

To prepare the necessary ingredients, execute the following steps.

All functions that we are going to use related to Lineage can be found in [here](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/ometa/mixins/lineage_mixin.py)

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
    service=db_service_entity.fullyQualifiedName,
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

### 5. Creating the Tables

And finally, Tables are contained in a specific Schema, so we use the `fullyQualifiedName` here as well.

We are doing a simple example with a single column.

```python
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Column, DataType

table_a = CreateTableRequest(
    name="tableA",
    databaseSchema=create_schema_entity.fullyQualifiedName,
    columns=[Column(name="id", dataType=DataType.BIGINT)],
)

table_b = CreateTableRequest(
    name="tableB",
    databaseSchema=create_schema_entity.fullyQualifiedName,
    columns=[Column(name="id", dataType=DataType.BIGINT)],
)

table_a_entity = metadata.create_or_update(data=table_a)
table_b_entity = metadata.create_or_update(data=table_b)
```

### 6. Adding Lineage

With everything prepared, we can now create the Lineage between both Entities. An `AddLineageRequest` type
represents the edge between two Entities, typed under `EntitiesEdge`.

```python
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.type.entityLineage import EntitiesEdge

add_lineage_request = AddLineageRequest(
    edge=EntitiesEdge(
        description="test lineage",
        fromEntity=EntityReference(id=table_a_entity.id, type="table"),
        toEntity=EntityReference(id=table_b_entity.id, type="table"),
    ),
)

created_lineage = metadata.add_lineage(data=add_lineage_request)
```

The Python client will already return us a JSON object with the Lineage information about the `fromEntity` node
we added:

```json
{
  "entity": {
    "id": "e7bee99b-5c5e-43ec-805c-8beba04804f5",
    "type": "table",
    "name": "tableA",
    "fullyQualifiedName": "test-service-db-lineage.test-db.test-schema.tableA",
    "deleted": false,
    "href": "http://localhost:8585/api/v1/tables/e7bee99b-5c5e-43ec-805c-8beba04804f5"
  },
  "nodes": [
    {
      "id": "800caa0f-a149-48d2-a0ce-6ca84501767e",
      "type": "table",
      "name": "tableB",
      "fullyQualifiedName": "test-service-db-lineage.test-db.test-schema.tableB",
      "deleted": false,
      "href": "http://localhost:8585/api/v1/tables/800caa0f-a149-48d2-a0ce-6ca84501767e"
    }
  ],
  "upstreamEdges": [],
  "downstreamEdges": [
    {
      "fromEntity": "e7bee99b-5c5e-43ec-805c-8beba04804f5",
      "toEntity": "800caa0f-a149-48d2-a0ce-6ca84501767e"
    }
  ]
}
```

If the node were to have other edges already, they would be showing up here.

If we validate the Lineage from the UI, we will see:

{% image src="/images/v1.10/sdk/python/ingestion/lineage/simple-lineage.png" alt="simple-lineage" /%}


### 7. Fetching Lineage

Finally, let's fetch the lineage from the other node involved:

```python
from metadata.generated.schema.entity.data.table import Table

metadata.get_lineage_by_name(
    entity=Table,
    fqn="test-service-db-lineage.test-db.test-schema.tableB",
    # Tune this to control how far in the lineage graph to go
    up_depth=1,
    down_depth=1
)
```

Which will give us the symmetric results from above

```json
{
  "entity": {
    "id": "800caa0f-a149-48d2-a0ce-6ca84501767e",
    "type": "table",
    "name": "tableB",
    "fullyQualifiedName": "test-service-db-lineage.test-db.test-schema.tableB",
    "deleted": false,
    "href": "http://localhost:8585/api/v1/tables/800caa0f-a149-48d2-a0ce-6ca84501767e"
  },
  "nodes": [
    {
      "id": "e7bee99b-5c5e-43ec-805c-8beba04804f5",
      "type": "table",
      "name": "tableA",
      "fullyQualifiedName": "test-service-db-lineage.test-db.test-schema.tableA",
      "deleted": false,
      "href": "http://localhost:8585/api/v1/tables/e7bee99b-5c5e-43ec-805c-8beba04804f5"
    }
  ],
  "upstreamEdges": [
    {
      "fromEntity": "e7bee99b-5c5e-43ec-805c-8beba04804f5",
      "toEntity": "800caa0f-a149-48d2-a0ce-6ca84501767e"
    }
  ],
  "downstreamEdges": []
}
```

{% note noteType="Tip" %}

You can also get lineage by ID using the `get_lineage_by_id` method, which accepts `entity_id` instead of `fqn`.

{% /note %}

# Lineage Details

Note how when adding lineage information we give to the API an [AddLineage](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/api/lineage/addLineage.json)
Request. This is composed of an Entity Edge, whose definition you can find [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/type/entityLineage.json#L75).

In a nutshell, an Entity Edge has:
1. The Entity Reference as the lineage origin,
2. The Entity Reference as the lineage destination,
3. Optionally, Lineage Details.

In the Lineage Details property we can pass further information specific about Table to Table lineage:
- `sqlQuery` specifying the transformation,
- An array of `columnsLineage` as an object with an array of source and destination columns, as well as their own specific transformation function,
- Optionally, the Entity Reference of a Pipeline powering the transformation from Table A to Table B.

The API call will be exactly the same as before, but now we will add more ingredients when defining our objects. Let's
see how to do that and play with the possible combinations:

First, import the required classes and create a new table:

```python
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)

# Prepare a new table
table_c = CreateTableRequest(
    name="tableC",
    databaseSchema=create_schema_entity.ifullyQualifiedName,
    columns=[Column(name="id", dataType=DataType.BIGINT)],
)

table_c_entity = metadata.create_or_update(data=table_c)
```

## Column Level Lineage

We can start by linking our columns together. For that we are going to create:

1. A `ColumnLineage` object, linking our Table A column ID -> Table C column ID. Note that this can be a list!
2. A `LineageDetails` object, passing the column lineage and the SQL query that powers the transformation.

```python
column_lineage = ColumnLineage(
    fromColumns=["test-service-db-lineage.test-db.test-schema.tableA.id"], 
    toColumn="test-service-db-lineage.test-db.test-schema.tableC.id"
)

lineage_details = LineageDetails(
    sqlQuery="SELECT * FROM AWESOME",
    columnsLineage=[column_lineage],
)

add_lineage_request = AddLineageRequest(
    edge=EntitiesEdge(
        fromEntity=EntityReference(id=table_a_entity.id, type="table"),
        toEntity=EntityReference(id=table_c_entity.id, type="table"),
        lineageDetails=lineage_details,
    ),
)

created_lineage = metadata.add_lineage(data=add_lineage_request)
```

This information will now be reflected in the UI as well:

{% image src="/images/v1.10/sdk/python/ingestion/lineage/lineage-col.png" alt="lineage-col" /%}

### Adding a Pipeline Reference

We can as well pass the reference to the pipeline used to create the lineage (e.g., the ETL feeding the tables).

To prepare this example, we need to start by creating the Pipeline Entity. Again, we'll need first
to prepare the Pipeline Service:

```python
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.services.createPipelineService import (
    CreatePipelineServiceRequest,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.entity.services.connections.pipeline.backendConnection import (
    BackendConnection,
)

pipeline_service = CreatePipelineServiceRequest(
    name="test-service-pipeline",
    serviceType=PipelineServiceType.Airflow,
    connection=PipelineConnection(
        config=AirflowConnection(
            hostPort="http://localhost:8080",
            connection=BackendConnection(),
        ),
    ),
)

pipeline_service_entity = metadata.create_or_update(data=pipeline_service)

create_pipeline = CreatePipelineRequest(
    name="test",
    service=pipeline_service_entity.fullyQualifiedName,
)

pipeline_entity = metadata.create_or_update(data=create_pipeline)
```

With these ingredients ready, we can then follow the code above and add there a `pipeline` argument
as an Entity Reference:

```python
lineage_details = LineageDetails(
    sqlQuery="SELECT * FROM AWESOME",
    columnsLineage=[column_lineage],
    pipeline=EntityReference(id=pipeline_entity.id, type="pipeline"),
)
```

{% note %}

The UI currently supports showing the column lineage information. Data about the SQL queries and the Pipeline Entities
will be surfaced soon. Thanks!

{% /note %}

# Automated SQL lineage

In case you want OpenMetadata to identify the lineage based on the sql query, then you can make use of the method `add_lineage_by_query` of the python SDK to parser the sql and generate the lineage in OpenMetadata.


follow the below code snippet for the example:

```python
from metadata.generated.schema.entity.services.databaseService import DatabaseService

database_service: DatabaseService = metadata.get_by_name(
    entity=DatabaseService, fqn="my_service"
)

metadata.add_lineage_by_query(
    database_service=database_service,
    timeout=200, # timeout in seconds
    sql="insert into target_table(id) as select id from source_table" # your sql query
)
```

Above example would create a lineage between `target_table` and `source_table` within `my_service` database service.


## Automated SQL lineage via CLI

To create the automated sql lineage via CLI, you need to make sure that you have installed the openmetadata-ingestion package in your local environment using command `pip install openmetadata-ingestion`.

Once that is done you will have to prepare a yaml file as follows.

```yaml
serviceName: local_mysql
query: insert into target_table(id) as select id from source_table
# filePath: test.sql
# parseTimeout: 360 # timeout in seconds
workflowConfig:
  # loggerLevel: DEBUG  # DEBUG, INFO, WARN or ERROR
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

- **serviceName**: Name of the database service which contains the table involved in query.
- **query**: You can specify the raw sql query within the yaml file itself.
- **filePath**: In case the query is too big then you can also save query in a file and pass the path to the file in this field. 
- **parseTimeout**: Timeout for the lineage parsing process.
- **workflowConfig**: The main property here is the openMetadataServerConfig, where you can define the host and security provider of your OpenMetadata installation.



Once the yaml file is prepare you can run the command 

```
metadata lineage -c path/to/your_config_yaml.yaml
```
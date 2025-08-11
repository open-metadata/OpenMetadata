---
title: Python SDK | OpenMetadata Python SDK Documentation
description: Master OpenMetadata'sPython SDK with comprehensive documentation, code examples, and API guides. Build powerful data discovery and governance solutions.
slug: /sdk/python
---

# Python SDK

We are now going to present a high-level Python API as a type-safe and gentle wrapper for the OpenMetadata backend.

{% note %}

The Python SDK is part of the `openmetadata-ingestion` base package. You can install it from [PyPI](https://pypi.org/project/openmetadata-ingestion/).

Make sure to use the same `openmetadata-ingestion` version as your server version. For example, if you have the OpenMetadata
server at version 1.7.5, you will need to install:

```python
pip install "openmetadata-ingestion~=1.7.5.0"
```

{% /note %}

In the [OpenMetadata Design](/developers/architecture), we have been dissecting the internals of OpenMetadata. The main conclusion here is twofold:

- **Everything** is handled via the API, and
- **Data structures** (Entity definitions) are at the heart of the solution.

This means that whenever we need to interact with the metadata system or develop a new connector or logic, we have to make sure that we pass the proper inputs and handle the types of outputs.

## Introducing the Python API
Let's suppose that we have our local OpenMetadata server running at `http:localhost:8585`. We can play with it with simple `cURL` or `httpie` commands, and if we just want to take a look at the Entity instances we have lying around, that might probably be enough.

However, let's imagine that we want to create or update an ML Model Entity with a `PUT`. To do so, we need to make sure that we are providing a proper JSON, covering all the attributes and types required by the Entity definition.

By reviewing the [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/api/data/createMlModel.json) for the create operation and the [fields definitions](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/data/mlmodel.json) of the Entity, we could come up with a rather simple description of a toy ML Model:

```python
{
    "name": "my-model",
    "description": "sample ML Model",
    "algorithm": "regression",
    "mlFeatures": [
        {
            "name": "age",
            "dataType": "numerical",
            "featureSources": [
                {
                    "name": "age",
                    "dataType": "integer"
                }
            ]
        },
        {
            "name": "persona",
            "dataType": "categorical",
            "featureSources": [
                {
                    "name": "age",
                    "dataType": "integer"
                },
                {
                    "name": "education",
                    "dataType": "string"
                }
            ],
            "featureAlgorithm": "PCA"
        }
    ],
    "mlHyperParameters": [
        {
            "name": "regularisation",
            "value": "0.5"
        }
    ]
}
```

If we needed to repeat this process with a full-fledged model that is built ad-hoc and updated during the CICD process, we would just be adding a hardly maintainable, error-prone requirement to our production deployment pipelines.

The same would happen if, inside the actual OpenMetadata code, there was not a way to easily interact with the API and make sure that we send proper data and can safely process the outputs.

## Using Generated Sources
As OpenMetadata is a data-centric solution, we need to make sure we have the right ingredients at all times. That is why we have developed a high-level Python API, using pydantic models automatically generated from the JSON Schemas.

> OBS: If you are using a [published](https://pypi.org/project/openmetadata-ingestion/) version of the Ingestion Framework, you are already good to go, as we package the code with the metadata.generated module. If you are developing a new feature, you can get more information [here](/developers).

This API wrapper helps developers and consumers in:

- Validating data during development and with specific error messages at runtime,
- Receiving typed responses to ease further processing.

Thanks to the recursive model setting of `pydantic` the example above can be rewritten using only Python classes, and thus being able to get help from IDEs and the Python interpreter. We can rewrite the previous JSON as:

```python
from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest

from metadata.generated.schema.entity.data.mlmodel import (
    FeatureSource,
    FeatureSourceDataType,
    FeatureType,
    MlFeature,
    MlHyperParameter,
    MlModel,
)

model = CreateMlModelRequest(
    name="test-model-properties",
    algorithm="algo",
    service="demo-ml-service",
    mlFeatures=[
        MlFeature(
            name="age",
            dataType=FeatureType.numerical,
            featureSources=[
                FeatureSource(
                    name="age",
                    dataType=FeatureSourceDataType.integer,
                )
            ],
        ),
        MlFeature(
            name="persona",
            dataType=FeatureType.categorical,
            featureSources=[
                FeatureSource(
                    name="age",
                    dataType=FeatureSourceDataType.integer,
                ),
                FeatureSource(
                    name="education",
                    dataType=FeatureSourceDataType.string,
                ),
            ],
            featureAlgorithm="PCA",
        ),
    ],
    mlHyperParameters=[
        MlHyperParameter(name="regularisation", value="0.5"),
    ],
)
```

## One syntax to rule them all
Now that we know how to directly use the pydantic models, we can start showcasing the solution. This module has been built with two main principles in mind:

- **Reusability**: We should be able to support existing and new entities with minimum effort,
- **Extensibility**: However, we are aware that not all Entities are the same. Some of them may require specific functionalities or slight variations (such as `Lineage` or `Location`), so it should be easy to identify those special methods and create new ones when needed.

To this end, we have the main class `OpenMetadata` ([source](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py)) based on Python's `TypeVar`. Thanks to this we can exploit the complete power of the `pydantic` models, having methods with Type Parameters that know how to respond to each Entity.

At the same time, we have the Mixins ([source](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins)) module, with special extensions to some Entities.

## Walkthrough
Let's use Python's API to create, update and delete a `Table` Entity. Choosing the `Table` is a nice starter, as its attributes define the following hierarchy:

```
DatabaseService -> Database -> Schema -> Table
```

This will help us showcase how we can reuse the same syntax with the three different Entities.

### 1. Initialize OpenMetadata
OpenMetadata is the class holding the connection to the API and handling the requests. We can instantiate this by passing the proper configuration to reach the server API:

```python
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection, AuthProvider,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import OpenMetadataJWTClientConfig

server_config = OpenMetadataConnection(
    hostPort="http://localhost:8585/api",
    authProvider=AuthProvider.openmetadata,
    securityConfig=OpenMetadataJWTClientConfig(
        jwtToken="<YOUR-INGESTION-BOT-JWT-TOKEN>",
    ),
)
metadata = OpenMetadata(server_config)
```

For local development, we can get a JWT token for the ingestion bot as described [here](/deployment/security/enable-jwt-tokens#generate-token) and use that when we specify the `jwtToken`. For a real-world deployment, we can also use [different authentication methods](/deployment/security) and specify other settings of the connection (such as `sslConfig`).

Below is an example of how the user can configure `sslConfig` using `Python SDK`.

```python
from metadata.generated.schema.security.ssl.validateSSLClientConfig import ValidateSslClientConfig
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import OpenMetadataJWTClientConfig
from metadata.ingestion.ometa.ometa_api import OpenMetadata


server_config = OpenMetadataConnection(
    hostPort="http://localhost:8585/api",
    authProvider=AuthProvider.openmetadata,
    securityConfig=OpenMetadataJWTClientConfig(
        jwtToken="<YOUR-INGESTION-BOT-JWT-TOKEN>",
    ),
    verifySSL="validate" # ignore, validate or no-ssl,
    sslConfig=ValidateSslClientConfig(caCertificate="/path/to/rootCert"),
)

metadata = OpenMetadata(server_config)
```


{% note %}

The OpenMetadataConnection is defined as a JSON Schema as well. You can check the definition [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/metadata/openMetadataConnection.json)
{% /note %}

From this point onwards, we will interact with the API by using `OpenMetadata` methods.

An interesting validation we can already make at this point is verifying that the service is reachable and healthy. To do so, we can validate the `Bool` output from:

```json
metadata.health_check()  # `True` means we are alright :)
```

### 2. Create the DatabaseService
Following the hierarchy, we need to start by defining a `DatabaseService`. This will be system hosting our `Database`, which will contain the `Table`.

Recall how we have mainly two types of models:

- Entity definitions, such as `Table`, `MlModel` or `Topic`.
- API definitions, useful when running a `PUT`, `POST` or `PATCH` request: `CreateTable`, `CreateMlModel` or `CreateTopic`.

As we are just creating Entities right now, we'll stick to the `pydantic` models with the API definitions.

Let's imagine that we are defining a MySQL:

```python
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
    DatabaseConnection,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)

create_service = CreateDatabaseServiceRequest(
    name="test-service-table",
    serviceType=DatabaseServiceType.Mysql,
    connection=DatabaseConnection(
        config=MysqlConnection(
            username="username",
            authType=BasicAuth(password="password"),
            hostPort="http://localhost:1234",
        )
    ),
)
```

Note how we can use both `String` definitions for the attributes, as well as specific types when possible, such as `serviceType=DatabaseServiceType.Mysql`. The less information we need to hardcode, the better.

Another important point here is that the connection definitions are centralized as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections) you can find the root of all of them.

We can review the information that will be passed to the API by visiting the JSON definition of the class we just instantiated. As all these models are powered by `pydantic`, this conversion is transparent to us:

```python
create_service.json()
# '{"name": "test-service-table", "description": null, "serviceType": "Mysql", "connection": {"config": {"type": "Mysql", "scheme": "mysql+pymysql", "username": "username", "password": "**********", "hostPort": "http://localhost:1234", "database": null, "connectionOptions": null, "connectionArguments": null, "supportsMetadataExtraction": null, "supportsProfiler": null}}, "owner": null}'
```

Executing the actual creation is easy! As our `create_service` variable already holds the proper datatype, there is a single line to execute:

```python
service_entity = metadata.create_or_update(data=create_service)
```

Moreover, running a `create_or_update` will return us the Entity type, so we can explore its attributes easily:

```python
type(service_entity)
# metadata.generated.schema.entity.services.databaseService.DatabaseService

service_entity.json()
# '{"id": "a823952a-1fc1-46d4-bd0e-27f9812871f4", "name": "test-service-table", "displayName": null, "serviceType": "Mysql", "description": null, "connection": {"config": {"type": "Mysql", "scheme": "mysql+pymysql", "username": "username", "password": "**********", "hostPort": "http://localhost:1234", "database": null, "connectionOptions": null, "connectionArguments": null, "supportsMetadataExtraction": null, "supportsProfiler": null}}, "pipelines": null, "version": 0.1, "updatedAt": 1651237632058, "updatedBy": "anonymous", "owner": null, "href": "http://localhost:8585/api/v1/services/databaseServices/a823952a-1fc1-46d4-bd0e-27f9812871f4", "changeDescription": null, "deleted": false}'
```

### 3. Create the Database
We can now repeat the process to create a `Database` Entity. However, if we review the definition of the `CreateDatabaseEntityRequest` model...

```python
class CreateDatabaseRequest(BaseModel):
    class Config:
        extra = Extra.forbid
    
    name: basic.EntityName = Field(
        ..., description='Name that identifies this database instance uniquely.'
    )
    description: Optional[str] = Field(
        None,
        description='Description of the database instance. What it has and how to use it.',
    )
    owner: Optional[entityReference.EntityReference] = Field(
        None, description='Owner of this database'
    )
    service: basic.FullyQualifiedEntityName = Field(
        ...,
        description='Link to the database service fully qualified name where this database is hosted in',
    )
    default: Optional[bool] = Field(
        False,
        description="Some databases don't support a database/catalog in the hierarchy and use default database. For example, `MySql`. For such databases, set this flag to true to indicate that this is a default database.",
    )
```

Note how the only non-optional fields are `name` and `service`. The type of `service`, however, is `FullyQualifiedEntityName`. This is expected, as there we need to pass the information of an existing Entity. In our case, the `fullyQualifiedName` of the `DatabaseService` we just created.

In the case of the `owner` field, repeating the exercise and reviewing the required fields to instantiate an `EntityReference` we notice how we need to pass an `id: uuid.UUID` and `type: str`. There we need to specify the `id` and `type` of an `User`.

**Querying by name**

The `id` we actually saw it by printing the `service_entity` JSON. However, let's imagine that it did not happen, and the only information we have from the `DatabaseService` is its name.

To retrieve the `id`, we should then ask the `metadata` to find our Entity by its FQN:

```python
service_query = metadata.get_by_name(entity=DatabaseService, fqn="test-service-table")
```

We have just used the `get_by_name` method. This method is the same that we will use for any Entity. This is why as an argument, we need to provide the `entity` field. Again, instead of relying on error-prone handwritten parameters, we can just pass the `pydantic` model we expect to get back. In our case, a `DatabaseService`.

```python
from metadata.generated.schema.api.data.createDatabase import (
    CreateDatabaseRequest,
)

create_db = CreateDatabaseRequest(
    name="test-db",
    service=service_entity.fullyQualifiedName,
)

db_entity = metadata.create_or_update(create_db)
```

### 4. Create the Schema
With the addition of the Schema Entity in 0.10, we now also need to create a Schema, which will be the one containing the Tables. As this entity is a link between other entities, an Entity Reference will be required too.

```python
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)

create_schema = CreateDatabaseSchemaRequest(
    name="test-schema",
    database=db_entity.fullyQualifiedName
)

schema_entity = metadata.create_or_update(data=create_schema)
```

### 5. Create the Table
Now that we have all the preparations ready, we can just reuse the same steps to create the `Table`:

```python
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import (
    Column,
    DataType,
    Table,
)

create_table = CreateTableRequest(
    name="test",
    databaseSchema=schema_entity.fullyQualifiedName,
    columns=[Column(name="id", dataType=DataType.BIGINT)],
)

table_entity = metadata.create_or_update(create_table)
```

### 6. Update the Table
Let's now update the `Table` by adding an owner. This will require us to create a `User`, and then update the `Table` with it. Afterwards, we will validate that the information has been properly stored.

First, make sure that no owner has been set during the creation:

```python
print(table_entity.owner)
# None
```

Now, create a `User`:

```python
from metadata.generated.schema.api.teams.createUser import CreateUserRequest

user = metadata.create_or_update(
    data=CreateUserRequest(name="random-user", email="random@user.com"),
)
```

Update our instance  of `create_table` to add the `owner` field (we need to use the `Create` class as we'll run a `PUT`), and update the Entity:

```python
from metadata.generated.schema.type.entityReference import EntityReference

create_table.owner = EntityReference(id=user.id, type="user")
updated_table_entity = metadata.create_or_update(create_table)

print(updated_table_entity.owner)
# EntityReference(id=Uuid(__root__=UUID('48793f0c-5308-45c1-9bf4-06a82c8d7bf9')), type='user', name='random-user', description=None, displayName=None, href=Href(__root__=AnyUrl('http://localhost:8585/api/v1/users/48793f0c-5308-45c1-9bf4-06a82c8d7bf9', scheme='http', host='localhost', host_type='int_domain', port='8585', path='/api/v1/users/48793f0c-5308-45c1-9bf4-06a82c8d7bf9')))
```

If we did not save the `updated_table_entity` variable, we should need to query it to review the `owner` field. We can run the `get_by_name` using the proper FQN definition for `Table`s:

```python
my_table = metadata.get_by_name(entity=Table, fqn="test-service-table.test-db.test-schema.test")
```

{% note %}

When querying an Entity we might not find it! The Entity could not exist, or there might be an error in the `id` or `fullyQualifiedName`.

In those cases, the `get` method won't fail, but instead will return None. Note that the signature of the `get` methods is `Optional[T]`, so make sure to validate that there is data coming back!
{% /note %}

### 7. Cleanup
Finally, we can clean up the Table by running the `delete` method:

```python
metadata.delete(entity=Table, entity_id=my_table.id)
```

We could directly clean up the service itself with a Hard and Recursive delete. Note that this is ok for this test, but beware when working with production data!

```python
service_id = metadata.get_by_name(
    entity=DatabaseService, fqn="test-service-table"
).id

metadata.delete(
    entity=DatabaseService,
    entity_id=service_id,
    recursive=True,
    hard_delete=True,
)
```

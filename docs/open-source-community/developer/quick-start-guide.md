# Quick start guide

Use this document as a quick start guide to begin developing in OpenMetdata. Below, we address the following topics:

1. Schema (Metadata Models)
2. API's 
3. System and Components

## Schema (Metadata Models)
OpenMetadata takes a schema-first approach to model metadata. We define entities, types, API requests, and relationships between entities. We define the OpenMetadata schema using the [JSON Schema](https://json-schema.org/) vocabulary.

We convert models defined using JSON Schema to [Plain Old Java Objects (POJOs)](https://www.jsonschema2pojo.org/) using the `jsonschema2pojo-maven-plugin` plugin as defined in [`pom.xml`](https://github.com/open-metadata/OpenMetadata/blob/16d8ba548d968c09e6634eefbd32c87c66996b90/catalog-rest-service/pom.xml#L395). You can find the generated POJOs under `OpenMetadata/catalog-rest-service/target/generated-sources/jsonschema2pojo`.

### Entities  
The entities are located at [`OpenMetadata/catalog-rest-service/src/main/resources/json/schema/entity`](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/resources/json/schema/entity), and the following are few examples of the entities supported by OpenMetadata.
- data
- feed
- policies
- services
- tags
- teams

### Common Types    
All OpenMetadata supported types are defined under [`OpenMetadata/catalog-rest-service/src/main/resources/json/schema/type`](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/resources/json/schema/type)

### API request objects  
The API request objects are defined under [`OpenMetadata/catalog-rest-service/src/main/resources/json/schema/api`](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/resources/json/schema/api).  


## API
[Dropwizard](https://www.dropwizard.io/) java framework is used to build the RESTful API's.  All the API's are defined under [`OpenMetadata/catalog-rest-service/src/main/java/org/openmetadata/catalog/resources`](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/java/org/openmetadata/catalog/resources). 
[Swagger](https://swagger.io/) is used for API documentation following the OpenAPI standards.


## System and Components
![system](https://user-images.githubusercontent.com/3944743/144579545-e51aa37e-93ed-4080-9f32-ce617029571f.png)

### Events  
Changes to the entities are captured as `events` and are stored in the database and elastic search.

The event handlers are defined under [`OpenMetadata/catalog-rest-service/src/main/java/org/openmetadata/catalog/events`](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/java/org/openmetadata/catalog/events) and are applied globally to any outgoing response using the `ContainerResponseFilter`

### Database  
MySql is used to persist the entities and the repository code to interact with MySql is located under [`OpenMetadata/catalog-rest-service/src/main/java/org/openmetadata/catalog/jdbi3`](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/java/org/openmetadata/catalog/jdbi3).

The database entity tables are created using the command [`OpenMetadata/bootstrap/bootstrap_storage.sh`](https://github.com/open-metadata/OpenMetadata/blob/main/bootstrap/bootstrap_storage.sh). [Flyway](https://flywaydb.org/) is used for managing the database table versions.

### Elastic Search  
Entity change events are stored in elastic search. The [`OpenMetadata/catalog-rest-service/src/main/java/org/openmetadata/catalog/events/ElasticSearchEventHandler.java`](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/java/org/openmetadata/catalog/events/ElasticSearchEventHandler.java) is responsible for capturing the change events and updating es.

The es indices are created when the [`OpenMetadata/ingestion/pipelines/metadata_to_es.json`](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/pipelines/metadata_to_es.json) ingestion connector is run.

### Authentication/Authorization  
Authentication is provided by google oauth provider. All incoming requests are filtered by validating the JWT token using the google oauth provider. Access control is provided by [`CatalogAuthorizer`](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/java/org/openmetadata/catalog/security/CatalogAuthorizer.java).

Auth/Authz details are configured at [`OpenMetadata/conf/openmetadata-security.yaml`](https://github.com/open-metadata/OpenMetadata/blob/main/conf/openmetadata-security.yaml)

### Ingestion  
Ingestion is a simple python framework to ingest the metadata from various external sources into OpenMetadata platform.

**Connectors**

The ingestion is carried out using a set of components called `Connectors` as described [here](https://docs.open-metadata.org/open-source-community/developer/build-a-connector#workflow) and it consists of

1. Workflow [`OpenMetadata/ingestion/src/metadata/ingestion/api/workflow.py`](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/api/workflow.py)
2. Source [`OpenMetadata/ingestion/src/metadata/ingestion/api/source.py`](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/api/source.py)
3. Processor [`OpenMetadata/ingestion/src/metadata/ingestion/api/processor.py`](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/api/processor.py)
4. Sink [`OpenMetadata/ingestion/src/metadata/ingestion/api/sink.py`](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/api/sink.py)
5. Stage [`OpenMetadata/ingestion/src/metadata/ingestion/api/stage.py`](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/api/stage.py)
6. BulkSink [`OpenMetadata/ingestion/src/metadata/ingestion/api/bulk_sink.py`](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/api/bulk_sink.py)

Workflow is a simple orchestration job that runs `Source`, `Porcessor`, `Sink`, `Stage` and `BulkSink` based on the configurations present under [`OpenMetadata/ingestion/examples/workflows`](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/examples/workflows)

There are some popular connectors already developed and can be found under

1. Source → [`OpenMetadata/ingestion/src/metadata/ingestion/source`](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/source)
2. Processor → [`OpenMetadata/ingestion/src/metadata/ingestion/processor`](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/processor)
3. Sink → [`OpenMetadata/ingestion/src/metadata/ingestion/sink`](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/sink)
4. Stage → [`OpenMetadata/ingestion/src/metadata/ingestion/stage`](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/stage)
5. BulkSink → [`OpenMetadata/ingestion/src/metadata/ingestion/bulksink`](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/bulksink)

**Airflow**

For simplicity, the metadata from external sources are ingested in a pull-based model, and Apache Airflow is used as an orchestration framework to perform ingestion.

Example Airflow dags are found under [`OpenMetadata/ingestion/examples/airflow/dags`](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/examples/airflow/dags) for reference.

**JsonSchema python typings**

The python typings for OpenMetadata JsonSchema is generated from the [`Makefile`](https://github.com/open-metadata/OpenMetadata/blob/main/Makefile) using the command `make generate`. The generated files are located at `OpenMetadata/ingestion/src/metadata/generated`
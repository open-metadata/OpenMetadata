# Quick start guide

Use this document as a quick start guide to begin developing in OpenMetdata. Below, we address the following topics:

1. Schema (Metadata Models)
2. API's 
3. System and Components

## Schema (Metadata Models)
OpenMetadata takes a schema-first approach to model metadata. We define entities, types, API requests, and relationships between entities. We define the OpenMetadata schema using the [JSON Schema](https://json-schema.org/) vocabulary.

We convert models defined using JSON Schema to [Plain Old Java Objects (POJOs)](https://www.jsonschema2pojo.org/) using the `jsonschema2pojo-maven-plugin` plugin as defined in [`pom.xml`](https://github.com/open-metadata/OpenMetadata/blob/16d8ba548d968c09e6634eefbd32c87c66996b90/catalog-rest-service/pom.xml#L395). You can find the generated POJOs under `OpenMetadata/catalog-rest-service/target/generated-sources/jsonschema2pojo`.

### Entities  
You can locate defined entities in the directory [`OpenMetadata/catalog-rest-service/src/main/resources/json/schema/entity`](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/resources/json/schema/entity). Currently, OpenMetadata supports the following entities:
- data
- feed
- policies
- services
- tags
- teams

### Types    
All OpenMetadata supported types are defined under [`OpenMetadata/catalog-rest-service/src/main/resources/json/schema/type`](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/resources/json/schema/type)

### API request objects  
The API request objects are defined under [`OpenMetadata/catalog-rest-service/src/main/resources/json/schema/api`](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/resources/json/schema/api).  


## API
OpenMetadata uses the [Dropwizard](https://www.dropwizard.io/) Java framework to build REST APIs. You can locate defined APIs in the directory [`OpenMetadata/catalog-rest-service/src/main/java/org/openmetadata/catalog/resources`](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/java/org/openmetadata/catalog/resources). 
OpenMetdata uses [Swagger](https://swagger.io/) to generate API documentation following OpenAPI standards.


## System and Components
![system](https://user-images.githubusercontent.com/3944743/144579545-e51aa37e-93ed-4080-9f32-ce617029571f.png)

### Events  
OpenMetadata captures changes to entities as `events` and stores them in the OpenMetadata server database. OpenMetadata also indexes change events in Elasticsearch to make them searchable.

The event handlers are defined under [`OpenMetadata/catalog-rest-service/src/main/java/org/openmetadata/catalog/events`](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/java/org/openmetadata/catalog/events) and are applied globally to any outgoing response using the `ContainerResponseFilter`

### Database  
OpenMetadata uses MySQL for the metadata catalog. The catalog code is located in the directory [`OpenMetadata/catalog-rest-service/src/main/java/org/openmetadata/catalog/jdbi3`](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/java/org/openmetadata/catalog/jdbi3).

The database entity tables are created using the command [`OpenMetadata/bootstrap/bootstrap_storage.sh`](https://github.com/open-metadata/OpenMetadata/blob/main/bootstrap/bootstrap_storage.sh). [Flyway](https://flywaydb.org/) is used for managing the database table versions.

### Elasticsearch  
OpenMetadata uses Elasticsearch to store the Entity change events and makes it searchable by search index. The [`OpenMetadata/catalog-rest-service/src/main/java/org/openmetadata/catalog/elasticsearch/ElasticSearchEventHandler.java`](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/java/org/openmetadata/catalog/elasticsearch/ElasticSearchEventHandler.java) is responsible for capturing the change events and updating Elasticsearch.

Elasticsearch indices are created when the [`OpenMetadata/ingestion/pipelines/metadata_to_es.json`](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/pipelines/metadata_to_es.json) ingestion connector is run.

### Authentication/Authorization  
OpenMetadata uses Google OAuth for authentication. All incoming requests are filtered by validating the JWT token using the Google OAuth provider. Access control is provided by [`Authorizer`](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/java/org/openmetadata/catalog/security/Authorizer.java).

See the configuration file [`OpenMetadata/conf/openmetadata-security.yaml`](https://github.com/open-metadata/OpenMetadata/blob/main/conf/openmetadata-security.yaml) for the authentication and authorization configurations.

### Ingestion  
Ingestion is a simple Python framework to ingest metadata from external sources into OpenMetadata.

**Connectors**

OpenMetadata defines and uses a set of components called `Connectors` for metadata ingestion. Each data service requires its own connector.  See the documentation on how to [build a connector](https://docs.open-metadata.org/open-source-community/developer/build-a-connector#workflow) for details on developing connectors for new services. 

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

For simplicity, OpenMetadata ingests metadata from external sources using a pull-based model. OpenMetadata uses Apache Airflow to orchestrate ingestion workflows.

See the directory [`OpenMetadata/ingestion/examples/airflow/dags`](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/examples/airflow/dags) for reference DAG definitions.

**JsonSchema python typings**

You can generate Python types for OpenMetadata models defined using Json Schema using the `make generate` command of the [`Makefile`](https://github.com/open-metadata/OpenMetadata/blob/main/Makefile). Generated files are located in the directory `OpenMetadata/ingestion/src/metadata/generated`
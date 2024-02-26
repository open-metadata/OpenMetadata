---
title: Run the Airflow Connector Externally
slug: /connectors/pipeline/airflow/yaml
---

{% connectorDetailsHeader
name="Airflow"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage", "Owners"]
unavailableFeatures=["Tags"]
/ %}

In this section, we provide guides and references to use the Airbyte connector.

Configure and schedule Airbyte metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

To run the Airflow ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[airflow]"
```

Note that this installs the same Airflow version that we ship in the Ingestion Container.

The ingestion using Airflow version 2.3.3 as a source package has been tested against Airflow 2.3.3 and Airflow 2.2.5.

**Note:** we only support officially supported Airflow versions. You can check the version list [here](https://airflow.apache.org/docs/apache-airflow/stable/installation/supported-versions.html).

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/pipeline/airbyteConnection.json)
you can find the structure to create a connection to Airbyte.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Airbyte:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

- 
- 
**connection**: Airflow metadata database connection. See
  these [docs](https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html)
  for supported backends.

In terms of `connection` we support the following selections:

- `backend`: Should not be used from the UI. This is only applicable when ingesting Airflow metadata locally by running
  the ingestion from a DAG. It will use the current Airflow SQLAlchemy connection to extract the data.
- `MySQL`, `Postgres`, and `SQLite`: Pass the required credentials to reach out each of these services. We will
  create a connection to the pointed database and read Airflow data from there.

**hostPort**: URL to the Airflow instance.


{% /codeInfo %}

{% codeInfo srNumber=1 %}

**numberOfStatus**: Number of status we want to look back to in every ingestion (e.g., Past executions from a DAG).



{% /codeInfo %}

{% codeInfo srNumber=1 %}

**connection**: Airflow metadata database connection. See
  these [docs](https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html)
  for supported backends.

In terms of `connection` we support the following selections:

- `backend`: Should not be used from the UI. This is only applicable when ingesting Airflow metadata locally by running
  the ingestion from a DAG. It will use the current Airflow SQLAlchemy connection to extract the data.
- `MySQL`, `Postgres`, and `SQLite`: Pass the required credentials to reach out each of these services. We will
  create a connection to the pointed database and read Airflow data from there.

{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: airflow
  serviceName: airflow_source
  serviceConnection:
    config:
      type: Airflow
```
```yaml {% srNumber=6 %}
      hostPort: http://localhost:8080
```
```yaml {% srNumber=6 %}
      numberOfStatus: 10
```
```yaml {% srNumber=6 %}
      # Connection needs to be one of Mysql, Postgres or Sqlite
      connection:
        type: Mysql
        username: airflow_user
        authType:
          password: airflow_pass
        databaseSchema: airflow_db
        hostPort: localhost:3306
        # #
        # type: Postgres
        # username: airflow_user
        # authType:
        #   password: airflow_pass
        # database: airflow_db
        # hostPort: localhost:3306
        # #
        # type: Sqlite
        # username: airflow_user
        # password: airflow_pass
        # database: airflow_db
        # hostPort: localhost:3306
        # databaseMode: ":memory:" (optional)
```

{% partial file="/v1.3/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}


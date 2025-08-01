---
title: Run the Airflow Connector Externally
description: Use YAML to configure Airflow pipeline metadata ingestion including DAGs, tasks, scheduling, and lineage mapping.
slug: /connectors/pipeline/airflow/yaml
---

{% connectorDetailsHeader
name="Airflow"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage", "Owners"]
unavailableFeatures=["Tags"]
/ %}

In this section, we provide guides and references to use the Airflow connector.

Configure and schedule Airflow metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.7/connectors/python-requirements.md" /%}

To run the Airflow ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[airflow]"
```

{% note %}

Note that this installs the same Airflow version that we ship in the Ingestion Container. If you are running
the ingestion from Airflow already, you **DON'T NEED** to install the `airflow` plugin.

Instead, just run `pip3 install "openmetadata-ingestion"`.

{% /note %}


**Note:** we only support officially supported Airflow versions. You can check the version list [here](https://airflow.apache.org/docs/apache-airflow/stable/installation/supported-versions.html).

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/pipeline/airflowConnection.json)
you can find the structure to create a connection to Airflow.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Airflow:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

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

{% partial file="/v1.7/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
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

{% partial file="/v1.7/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.7/connectors/yaml/ingestion-cli.md" /%}


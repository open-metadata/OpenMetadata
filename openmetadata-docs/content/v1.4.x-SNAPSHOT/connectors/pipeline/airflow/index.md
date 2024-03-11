---
title: Airflow
slug: /connectors/pipeline/airflow
---

{% connectorDetailsHeader
name="Airflow"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage", "Owners"]
unavailableFeatures=["Tags"]
/ %}

In this section, we provide guides and references to use the Airflow connector.

Configure and schedule Airflow metadata workflow from the OpenMetadata UI:

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/airflow/yaml"} /%}

## Requirements

{% note %}
We only support officially supported Airflow versions. 
You can check the version list [here](https://airflow.apache.org/docs/apache-airflow/stable/installation/supported-versions.html).
{% /note %}

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Airflow", 
    selectServicePath: "/images/v1.3/connectors/airflow/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/airflow/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/airflow/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: URL to the Airflow instance.
- **Number of Status**: Number of status we want to look back to in every ingestion (e.g., Past executions from a DAG).
- **Connection**: Airflow metadata database connection. See these [docs](https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html)
  for supported backends.

In terms of `connection` we support the following selections:

- `backend`: Should not be used from the UI. This is only applicable when ingesting Airflow metadata locally
    by running the ingestion from a DAG. It will use the current Airflow SQLAlchemy connection to extract the data.
- `MySQL`, `Postgres`, and `SQLite`: Pass the required credentials to reach out each of these services. We
    will create a connection to the pointed database and read Airflow data from there.

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}

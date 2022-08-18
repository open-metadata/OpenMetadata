---
title: Airflow
slug: /openmetadata/connectors/pipeline/airflow
---

# Airflow

In this section, we provide guides and references to use the Airflow connector.

Configure and schedule Airflow metadata workflow from the OpenMetadata UI:

If you don't want to use the OpenMetadata Ingestion container to configure the workflows via the UI, then you can check the following docs to
extract metadata directly from your Airflow instance or via the CLI:

<TileContainer>
<Tile
  icon="air"
  title="Ingest directly from your Airflow"
  text="Configure the ingestion with a DAG on your own Airflow instance"
  link={
    "/openmetadata/connectors/pipeline/airflow/gcs"
  }
  size="half"
/>
<Tile
  icon="account_tree"
  title="Ingest with the CLI"
  text="Run a one-time ingestion using the metadata CLI"
  link={
    "/openmetadata/connectors/pipeline/airflow/cli"
  }
  size="half"
/>
</TileContainer>


<Requirements />

<MetadataIngestionService connector="Airflow"/>

<h4>Connection Options</h4>

- **Host and Port**: URL to the Airflow instance.
- **Number of Status**: Number of status we want to look back to in every ingestion (e.g., Past executions from a DAG).
- **Connection**: Airflow metadata database connection. See these [docs](https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html)
  for supported backends.

In terms of `connection` we support the following selections:

- `backend`: Should not be used from the UI. This is only applicable when ingesting Airflow metadata locally
    by running the ingestion from a DAG. It will use the current Airflow SQLAlchemy connection to extract the data.
- `MySQL`, `Postgres`, `MSSQL` and `SQLite`: Pass the required credentials to reach out each of these services. We
    will create a connection to the pointed database and read Airflow data from there.

<IngestionScheduleAndDeploy />

<ConnectorOutro connector="Airflow" />

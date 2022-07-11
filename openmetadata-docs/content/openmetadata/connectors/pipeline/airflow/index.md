---
title: Airflow
slug: /openmetadata/connectors/pipeline/airflow
---

<ConnectorIntro service="pipeline" connector="Airflow"/>

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

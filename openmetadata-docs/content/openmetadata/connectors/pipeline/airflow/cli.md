---
title: Run Airflow Connector using the CLI
slug: /openmetadata/connectors/pipeline/airflow/cli
---

<ConnectorIntro connector="Airflow" goal="CLI"/>

<Requirements />

<MetadataIngestionServiceDev service="pipeline" connector="Airflow" goal="CLI"/>

<h4>Source Configuration - Service Connection</h4>

- **hostPort**: URL to the Airflow instance.
- **numberOfStatus**: Number of status we want to look back to in every ingestion (e.g., Past executions from a DAG).
- **connection**: Airflow metadata database connection. See
  these [docs](https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html)
  for supported backends.

In terms of `connection` we support the following selections:

- `backend`: Should not be used from the UI. This is only applicable when ingesting Airflow metadata locally by running
  the ingestion from a DAG. It will use the current Airflow SQLAlchemy connection to extract the data.
- `MySQL`, `Postgres`, `MSSQL` and `SQLite`: Pass the required credentials to reach out each of these services. We will
  create a connection to the pointed database and read Airflow data from there.

<MetadataIngestionConfig service="pipeline" connector="Airflow" goal="CLI" />

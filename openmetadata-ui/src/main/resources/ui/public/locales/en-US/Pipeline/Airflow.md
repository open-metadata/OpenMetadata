# Airflow

In this section, we provide guides and references to use the Airflow connector.

## Requirements

We support different approaches to extracting metadata from Airflow:
1. **Airflow Connector**: which we will configure in this section and requires access to the underlying database.
2. **Airflow Lineage Backend**: which can be configured in your Airflow instance. You can read more about the Lineage Backend [here](https://docs.open-metadata.org/connectors/pipeline/airflow/lineage-backend).
3. **Airflow Lineage Operator**: To send metadata directly from your Airflow DAGs. You can read more about the Lineage Operator [here](https://docs.open-metadata.org/connectors/pipeline/airflow/lineage-operator).

From the OpenMetadata UI, you have access to the strategy number 1.

You can find further information on the Airflow connector in the [docs](https://docs.open-metadata.org/connectors/pipeline/airflow).

## Connection Details

$$section
### Host and Port

Pipeline Service Management URI. This should be specified as a URI string in the format `scheme://hostname:port`. E.g., `http://localhost:8080`, `http://host.docker.internal:8080`.

$$

$$section
### Number Of Status

Number of past task status to read every time the ingestion runs. By default, we will pick up and update the last 10 runs.
$$

$$section
### Metadata Database Connection

Select your underlying database connection. We support the [official](https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html) backends from Airflow.

Note that the **Backend Connection** is only used to extract metadata from a DAG running directly in your instance, for example to get the metadata out of [GCS Composer](https://docs.open-metadata.org/connectors/pipeline/airflow/gcp).

$$

---

## MySQL Connection

If your Airflow is backed by a MySQL database, then you will need to fill in these details:

### Username & Password

Credentials with permissions to connect to the database. Read-only permissions are required.

### Host and Port

Host and port of the MySQL service. This should be specified as a string in the format `hostname:port`. E.g., `localhost:3306`, `host.docker.internal:3306`.

### Database Schema

MySQL schema that contains the Airflow tables.

### SSL CA $(id="sslCA")
Provide the path to SSL CA file, which needs to be local in the ingestion process.

### SSL Certificate $(id="sslCert")
Provide the path to SSL client certificate file (`ssl_cert`)

### SSL Key $(id="sslKey")
Provide the path to SSL key file (`ssl_key`)

---

## Postgres Connection

If your Airflow is backed by a Postgres database, then you will need to fill in these details:

### Username & Password

Credentials with permissions to connect to the database. Read-only permissions are required.

### Host and Port

Host and port of the Postgres service. E.g., `localhost:5432` or `host.docker.internal:5432`.

### Database

Postgres database that contains the Airflow tables.

### SSL Mode $(id="sslMode")

SSL Mode to connect to postgres database. E.g, `prefer`, `verify-ca` etc.

You can ignore the rest of the properties, since we won't ingest any database not policy tags.

---

## MSSQL Connection

If your Airflow is backed by a MSSQL database, then you will need to fill in these details:

### Username & Password

Credentials with permissions to connect to the database. Read-only permissions are required.

### Host and Port

Host and port of the Postgres service. E.g., `localhost:1433` or `host.docker.internal:1433`.


### Database

MSSQL database that contains the Airflow tables.

### URI String $(id="uriString")

Connection URI String to connect with MSSQL. It only works with `pyodbc` scheme. E.g., `DRIVER={ODBC Driver 17 for SQL Server};SERVER=server_name;DATABASE=db_name;UID=user_name;PWD=password`.
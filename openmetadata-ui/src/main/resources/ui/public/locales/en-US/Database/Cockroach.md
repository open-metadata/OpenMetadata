# Cockroach

In this section, we provide guides and references to use the Greenplum connector.

## Requirements

### Profiler & Data Quality

Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow) and data quality tests [here](https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality).

You can find further information on the Greenplum connector in the [docs](https://docs.open-metadata.org/connectors/database/greenplum).

## Connection Details

$$section
### Connection Scheme $(id="scheme")

SQLAlchemy driver scheme options.
$$

$$section
### Username $(id="username")

Username to connect to Postgres. This user should have privileges to read all the metadata in Postgres.
$$


$$section
### Auth Config $(id="authType")
There is one auth config:
- Basic Auth.

User can authenticate the Postgres Instance with auth type as `Basic Authentication` i.e. Password
$$

## Basic Auth
$$section
### Password $(id="password")

Password to connect to Postgres.
$$

$$section
### Host and Port $(id="hostPort")

This parameter specifies the host and port of the Postgres instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:5432`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:5432` as the value.
$$

$$section
### Database $(id="database")

Initial Postgres database to connect to. If you want to ingest all databases, set `ingestAllDatabases` to true.
$$

$$section
### SSL Mode $(id="sslMode")

SSL Mode to connect to postgres database. E.g, `prefer`, `verify-ca`, `allow` etc.
$$
$$note
if you are using `IAM auth`, select either `allow` (recommended) or other option based on your use case.
$$


$$section
### SSL CA $(id="caCertificate")
The CA certificate used for SSL validation (`sslrootcert`).
$$
$$note
Greenplum only needs CA Certificate
$$

$$section
### Ingest All Databases $(id="ingestAllDatabases")

If ticked, the workflow will be able to ingest all database in the cluster. If not ticked, the workflow will only ingest tables from the database set above.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

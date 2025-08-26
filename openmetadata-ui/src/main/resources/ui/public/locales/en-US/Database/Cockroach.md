# Cockroach

In this section, we provide guides and references to use the Cockroach connector.

## Requirements

### Profiler & Data Quality

Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

You can find further information on the Cockroach connector in the <a href="https://docs.open-metadata.org/connectors/database/cockroach" target="_blank">docs</a>.

## Connection Details

$$section
### Connection Scheme $(id="scheme")

SQLAlchemy driver scheme options.
$$

$$section
### Username $(id="username")

Username to connect to Cockroach. This user should have privileges to read all the metadata in Cockroach.
$$


$$section
### Auth Config $(id="authType")
There is one auth config:
- Basic Auth.

User can authenticate the Cockroach Instance with auth type as `Basic Authentication` i.e. Password
$$

## Basic Auth
$$section
### Password $(id="password")

Password to connect to Cockroach.
$$

$$section
### Host and Port $(id="hostPort")

This parameter specifies the host and port of the Cockroach instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:26257`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:26257` as the value.
$$

$$section
### Database $(id="database")

Initial Cockroach database to connect to. If you want to ingest all databases, set `ingestAllDatabases` to true.
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

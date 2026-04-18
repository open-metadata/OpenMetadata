# Supabase

In this section, we provide guides and references to use the Supabase connector.

## Requirements

### Profiler & Data Quality

Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

Supabase is a hosted Postgres platform. The connector reuses the PostgreSQL dialect and supports both direct database connections and PgBouncer pooler connections.

## Connection Details

$$section
### Connection Scheme $(id="scheme")

SQLAlchemy driver scheme options.
$$

$$section
### Username $(id="username")

Username to connect to Supabase. This user should have privileges to read all the metadata in Supabase. The default Supabase user is `postgres`.
$$

$$section
### Auth Config $(id="authType")
There is one auth config:
- Basic Auth.

User can authenticate the Supabase instance with auth type as `Basic Authentication` i.e. Password
$$

## Basic Auth
$$section
### Password $(id="password")

Password to connect to Supabase. This is the database password set in your Supabase project settings.
$$

$$section
### Host and Port $(id="hostPort")

This parameter specifies the host and port of the Supabase instance. This should be specified as a string in the format `hostname:port`.

- Direct connection: `db.<project-ref>.supabase.co:5432`
- PgBouncer pooler: `aws-0-<region>.pooler.supabase.com:6543`
$$

$$section
### Database $(id="database")

Initial Supabase database to connect to. Defaults to `postgres`. If you want to ingest all databases, set `ingestAllDatabases` to true.
$$

$$section
### SSL Mode $(id="sslMode")

SSL Mode to connect to Supabase. Supabase requires SSL — use `require` or higher. Options: `disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full`.
$$

$$section
### SSL Config $(id="sslConfig")

Client SSL certificate configuration. Required when SSL Mode is set to `verify-ca` or `verify-full`.
$$

$$section
### Ingest All Databases $(id="ingestAllDatabases")

If ticked, the workflow will be able to ingest all databases in the cluster. If not ticked, the workflow will only ingest tables from the database set above.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

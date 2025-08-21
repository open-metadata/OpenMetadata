# DB2

In this section, we provide guides and references to use the DB2 connector.

## Requirements

To create a new DB2 user please follow the guidelines mentioned <a href="https://www.ibm.com/docs/ko/samfess/8.2.0?topic=schema-creating-users-manually" target="_blank">here</a>

The user must have the below permissions to ingest the metadata:

- `SELECT` privilege on `SYSCAT.SCHEMATA` to fetch the metadata of schemas.
```sql
-- Grant SELECT on tables for schema metadata
GRANT SELECT ON SYSCAT.SCHEMATA TO USER_NAME;
```

- `SELECT` privilege on `SYSCAT.TABLES` to fetch the metadata of tables.
```sql
-- Grant SELECT on tables for table metadata
GRANT SELECT ON SYSCAT.TABLES TO USER_NAME;
```

- `SELECT` privilege on `SYSCAT.VIEWS` to fetch the metadata of views.
```sql
-- Grant SELECT on tables for view metadata
GRANT SELECT ON SYSCAT.VIEWS TO USER_NAME;
```

### Profiler & Data Quality

Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

You can find further information on the DB2 connector in the <a href="https://docs.open-metadata.org/connectors/database/db2" target="_blank">docs</a>.

## Connection Details


$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme options.

Note: In case you are using Db2 for IBM i, then from advanced config you can choose the `ibmi` scheme.
$$

$$section
### Username $(id="username")

Username to connect to DB2. This user should have privileges to read all the metadata in DB2.
$$

$$section
### Password $(id="password")

Password to connect to DB2.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the Db2 instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:8000`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:8000` as the value.
$$

$$section
### Database $(id="database")

Database name of the DB2 database to establish the connection.
$$


$$section
### License File Name $(id="licenseFileName")

License file name in case the license is required for connection.
$$


$$section
### License $(id="license")

Contents of your license file if applicable, make sure to replace new lines with `\n` before pasting it here.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

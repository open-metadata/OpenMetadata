# Db2

In this section, we provide guides and references to use the Db2 connector.

## Requirements

To create a new Db2 user please follow the guidelines mentioned [here](https://www.ibm.com/docs/ko/samfess/8.2.0?topic=schema-creating-users-manually)

Db2 user must have the below permissions to ingest the metadata:

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
Executing the profiler worflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](https://docs.open-metadata.org/connectors/ingestion/workflows/profiler) and data quality tests [here](https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality).
You can find further information on the DB2 connector in the [docs](https://docs.open-metadata.org/connectors/database/db2).

## Connection Details


$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
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

Enter the fully qualified hostname and port number for your DB2 deployment in the Host and Port field.
$$

$$section
### Database $(id="database")

Database name of the DB2 database to establish the connection.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

$$section
### Supports Database $(id="supportsDatabase")

The source service supports the database concept in its hierarchy.
$$
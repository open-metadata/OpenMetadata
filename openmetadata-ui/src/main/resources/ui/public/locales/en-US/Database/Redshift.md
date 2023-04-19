# Redshift
In this section, we provide guides and references to use the Redshift connector. You can view the full documentation for Redshift [here](https://docs.open-metadata.org/connectors/database/redshift).

## Requirements
Redshift user must grant `SELECT` privilege on `SVV_TABLE_INFO` to fetch the metadata of tables and views.

```sql
-- Create a new user
-- More details https://docs.aws.amazon.com/redshift/latest/dg/r_CREATE_USER.html
CREATE USER test_user with PASSWORD 'password';

-- Grant SELECT on table
GRANT SELECT ON TABLE svv_table_info to test_user;
```

### Profiler & Data Quality
Executing the profiler worflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](https://docs.open-metadata.org/connectors/ingestion/workflows/profiler) and data quality tests [here](https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality).

### Usage & Linegae
For the usage and lineage workflow, the user will need `SELECT` privilege on `STL_QUERY` table. You can find more information on the usage workflow [here](https://docs.open-metadata.org/connectors/ingestion/workflows/usage) and the lineage workflow [here](https://docs.open-metadata.org/connectors/ingestion/workflows/lineage).

## Connection Details

### Scheme $(id="scheme")
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value.

### Username $(id="username")
Username to connect to Redshift. This user should have access to `SVV_TABLE_INFO` to extract metadata. Other workflows may require different permissions -- refer to the section above for more information.

### Password $(id="password")
Password to connect to Redshift.

### Host Port $(id="hostPort")
Host and port of the Redshift service.

### Database $(id="database")

Initial Redshift database to connect to. If you want to ingest all databases, set `ingestAllDatabases` to true. This should be specified as a string in the format 'hostname:port'.
**Example**: `localhost:5439`, `host.docker.internal:5439`

### Ingest All Databases $(id="ingestAllDatabases")
If ticked, the workflow will be able to ingest all database in the cluster. If not ticked, the workflow will only ingest tables from the database set above.

### SSL Mode $(id="sslMode")
SSL Mode to connect to redshift database. E.g, prefer, verify-ca etc.

### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to service during the connection.

### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to service during connection.

# Presto
In this section, we provide guides and references to use the Presto connector. You can view the full documentation for Presto [here](https://docs.open-metadata.org/connectors/database/presto).

# Requirements
To extract metadata, the user needs to be able to perform `SHOW CATALOGS`, `SHOW TABLES`, and `SHOW COLUMNS FROM` on the catalogs/tables you wish to extract metadata from and have `SELECT` permission on the `INFORMATION_SCHEMA`.

### Profiler & Data Quality
Executing the profiler worflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](https://docs.open-metadata.org/connectors/ingestion/workflows/profiler) and data quality tests [here](https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality).

## Connection Details

### Scheme $(id="scheme")
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value.

### Username $(id="username")
Username to connect to Presto. This user should be able to perform `SHOW CATALOGS`, `SHOW TABLES`, and `SHOW COLUMNS FROM` and have `SELECT` permission on the `INFORMATION_SCHEMA`.

### Password $(id="password")
Password to connect to Presto.

### Host Port $(id="hostPort")
Host and port of the Presto service. This should be specified as a string in the format 'hostname:port'.
**Example**: `localhost:8080`, `host.docker.internal:8080`

### Database Schema $(id="databaseSchema")
This is an optional parameter. When set, the value will be used to restrict the metadata reading to a single database (corresponding to the value passed in this field). When left blank, OpenMetadata will scan all the databases.

### Catalog $(id="catalog")
Presto catalog name.

### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to service during the connection.

### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to service during connection.


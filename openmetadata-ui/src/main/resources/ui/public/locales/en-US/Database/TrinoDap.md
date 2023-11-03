# Trino

In this section, we provide guides and references to use the Trino connector. You can view the full documentation for Trino [here](https://docs.open-metadata.org/connectors/database/trino).

## Requirements
To extract metadata, the user needs to have `SELECT` permission on the following tables:
- `information_schema.schemata`
- `information_schema.columns`
- `information_schema.tables`
- `information_schema.views`
- `system.metadata.table_comments`

Access to resources will be based on the user access permission to access specific data sources. More information regarding access and security can be found in the Trino documentation [here](https://trino.io/docs/current/security.html).

### Profiler & Data Quality
Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](https://docs.open-metadata.org/connectors/ingestion/workflows/profiler) and data quality tests [here](https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality).

You can find further information on the Trino connector in the [docs](https://docs.open-metadata.org/connectors/database/trino).

## Connection Details

$$section
### Scheme $(id="scheme")
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value.
$$

$$section
### Username $(id="username")
Username to connect to Trino. This user should have `SELECT` permission on the `SYSTEM.METADATA` and `INFORMATION_SCHEMA` - see the section above for more details.
$$

$$section
### Password $(id="password")
Password to connect to Trino.
$$

$$section
### Host Port $(id="hostPort")
This parameter specifies the host and port of the Trino instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:8080`.

If your database service and Open Metadata are both running via docker locally, use `host.docker.internal:8080` as the value.
$$

$$section
### Catalog $(id="catalog")
Catalog of the data source. 
$$

$$section
### Database Schema $(id="databaseSchema")
This is an optional parameter. When set, the value will be used to restrict the metadata reading to a single database (corresponding to the value passed in this field). When left blank, OpenMetadata will scan all the databases.
$$

$$section
### Proxies $(id="proxies")
Proxies for the connection to Trino data source
$$

$$section
### Params $(id="params")
URL parameters for connection to the Trino data source
$$

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

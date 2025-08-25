# Presto

In this section, we provide guides and references to use the Presto connector.

## Requirements

To extract metadata, the user needs to be able to perform `SHOW CATALOGS`, `SHOW TABLES`, and `SHOW COLUMNS FROM` on the catalogs/tables you wish to extract metadata from and have `SELECT` permission on the `INFORMATION_SCHEMA`. Access to resources will be different based on the connector used. You can find more details in the Presto documentation website <a href="https://prestodb.io/docs/current/connector.html" target="_blank">here</a>. You can also get more information regarding system access control in Presto <a href="https://prestodb.io/docs/current/security/built-in-system-access-control.html" target="_blank">here</a>.

### Profiler & Data Quality

Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

You can find further information on the Presto connector in the <a href="https://docs.open-metadata.org/connectors/database/presto" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value.
$$

$$section
### Username $(id="username")
Username to connect to Presto. This user should be able to perform `SHOW CATALOGS`, `SHOW TABLES`, and `SHOW COLUMNS FROM` and have `SELECT` permission on the `INFORMATION_SCHEMA`.
$$

$$section
### Password $(id="password")
Password to connect to Presto.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the Presto instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:8080`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:8080` as the value.
$$

$$section
### Database Schema $(id="databaseSchema")
This is an optional parameter. When set, the value will be used to restrict the metadata reading to a single database (corresponding to the value passed in this field). When left blank, OpenMetadata will scan all the databases.
$$

$$section
### Catalog $(id="catalog")
Presto catalog name.
$$

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

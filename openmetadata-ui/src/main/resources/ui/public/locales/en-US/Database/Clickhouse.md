# ClickHouse

In this section, we provide guides and references to use the ClickHouse connector.

## Requirements

ClickHouse user must grant `SELECT` privilege on `system.*` and schema/tables to fetch the metadata of tables and views.

* Create a new user. Find mode details <a href="https://clickhouse.com/docs/en/sql-reference/statements/create/user" target="_blank">here</a>.

```sql
CREATE USER <username> IDENTIFIED WITH sha256_password BY <password>
```

* Grant Permissions. Find more details on permissions can be found <a href="https://clickhouse.com/docs/en/sql-reference/statements/grant" target="_blank">here</a>.

```sql
-- Grant SELECT and SHOW to that user
GRANT SELECT, SHOW ON system.* to <username>;
GRANT SELECT ON <schema_name>.* to <username>;
```

### Profiler & Data Quality

Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. The user should also be allowed to view information in `tables` for all objects in the database. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

### Usage & Lineage

For the Usage and Lineage workflows, the user will need `SELECT` privilege. You can find more information on the usage workflow <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/usage" target="_blank">here</a> and the lineage workflow <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/lineage" target="_blank">here</a>.

You can find further information on the ClickHouse connector in the <a href="https://docs.open-metadata.org/connectors/database/clickhouse" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")

There are 2 types of schemes that the user can choose from:

- **clickhouse+http**: Uses ClickHouse's HTTP interface for communication. Widely supported, but slower than native.
- **clickhouse+native**: Uses the native ClickHouse TCP protocol for communication. Faster than HTTP, but may require additional server-side configuration. Recommended for performance-critical applications.
$$

$$section
### Username $(id="username")

Username to connect to ClickHouse. This user should have privileges to read all the metadata in ClickHouse.
$$

$$section
### Password $(id="password")

Password to connect to ClickHouse.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the ClickHouse instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:3000`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:3000` as the value.
$$

$$section
### Database Name $(id="databaseName")

In OpenMetadata, the Database Service hierarchy works as follows:
```
Database Service > Database > Schema > Table
```
In the case of ClickHouse, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
$$

$$section
### Database Schema $(id="databaseSchema")

Schema of the data source. This is an optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
$$

$$section
### Duration $(id="duration")

The duration of an SQL connection in ClickHouse depends on the configuration of the connection and the workload being processed.

Connections are kept open for as long as needed to complete a query, but they can also be closed based on duration set.
$$

$$section
### Use HTTPS Protocol $(id="https")

Enable this flag when the when the Clickhouse instance is hosted via HTTPS protocol. This flag is useful when you are using `clickhouse+http` connection scheme.
$$

$$section
### Secure $(id="secure")

Establish secure connection with ClickHouse.

ClickHouse supports secure communication over SSL/TLS to protect data in transit, by checking this option, it establishes secure connection with ClickHouse. This flag is useful when you are using `clickhouse+native` connection scheme.
$$

$$section
### Keyfile $(id="keyfile")

The key file path is the location when ClickHouse looks for a file containing the private key needed for secure communication over SSL/TLS.

By default, ClickHouse will look for the key file in the `/etc/clickhouse-server directory`, with the file name `server.key`. However, this can be customized in the ClickHouse configuration file (`config.xml`).
$$

$$section
### Connection Options $(id="connectionOptions")

Enter the details for any additional connection options that can be sent to ClickHouse during the connection. These details must be added as Key-Value pairs.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Enter the details for any additional connection arguments such as security or protocol configs that can be sent to ClickHouse during the connection. These details must be added as Key-Value pairs.

In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

$$

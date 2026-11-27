# Doris

In this section, we provide guides and references to use the Doris connector.

## Requirements

You can find further information on the Doris connector in the <a href="https://docs.open-metadata.org/connectors/database/doris" target="_blank">docs</a>.

### Usage

The usage workflow reads the queries Doris 4.1 or later records in `__internal_schema.audit_log`. The table holds the SQL text of every user's queries; grant the user `SELECT_PRIV` on it:

```sql
GRANT SELECT_PRIV ON internal.__internal_schema.audit_log TO '<username>'@'%';
```

Doris records queries while `enable_audit_plugin` is `true`, the default since 3.1.2. A cluster upgraded from an earlier release keeps `false`; turn it on with `SET GLOBAL enable_audit_plugin = true`. You can find more information on the usage workflow <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/usage" target="_blank">here</a>.

### Profiler & Data Quality

For tables, the profiler reads `information_schema.tables.TABLE_ROWS` for `rowCount` instead of running `SELECT COUNT(*)`. Keep two Doris limitations in mind:

- For `UNIQUE` and `AGGREGATE` key tables, `TABLE_ROWS` includes rows that background compaction has not merged yet, so `rowCount` can temporarily exceed `SELECT COUNT(*)`.
- Newly loaded tables can report `0` in `TABLE_ROWS` for up to ~60 seconds after a load completes.

For views, Doris reports `-1` in `TABLE_ROWS`, so the profiler automatically falls back to `SELECT COUNT(*)`.

## Connection Details

$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
$$

$$section
### Username $(id="username")

Username to connect to Doris. This user should have privileges to read all the metadata in Doris.
$$

$$section
### Password $(id="password")

Password to connect to Doris.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the fe host and fe query port of the Doris instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:9030`.


$$

$$section
### Database Name $(id="databaseName")

In OpenMetadata, the Database Service hierarchy works as follows:

```
Database Service > Database > Schema > Table
```

In the case of Doris, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
$$

$$section
### Database Schema $(id="databaseSchema")
This is an optional parameter. When set, the value will be used to restrict the metadata reading to a single database (corresponding to the value passed in this field). When left blank, OpenMetadata will scan all the databases.
$$

$$section
### SSL CA $(id="caCertificate")
The CA certificate used for SSL validation (`ssl_ca`)
$$

$$section
### SSL Certificate $(id="sslCertificate")
The SSL certificate used for client authentication (`ssl_cert`)
$$

$$section
### SSL Key $(id="sslKey")
The private key associated with the SSL certificate (`ssl_key`)
$$

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to the service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to the service during connection.
$$

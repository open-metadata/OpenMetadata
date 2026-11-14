# Informix

In this section, we provide guides and references to use the Informix connector.

## Requirements

The connector reaches Informix over the IBM Informix JDBC driver. The driver is
already bundled in the ingestion image, so no separate client install is needed.

The user must have the below permissions to ingest the metadata:

- `CONNECT` privilege on each database you want to ingest.
```sql
-- Grant access to a database, from within that database
GRANT CONNECT TO user_name;
```

That is the whole requirement for metadata extraction. Unlike most databases,
Informix needs no `SELECT` grants on its system catalogue: `systables`,
`syscolumns`, `sysxtdtypes` and `sysprocedures` are readable by `public` on every
database, and Informix rejects any attempt to change that with
`511: Cannot modify system catalog`.

Enabling **Ingest All Databases** additionally reads the server's database list
from `sysmaster:sysdatabases`, which is likewise granted to `public`.

### Profiler & Data Quality

Executing the profiler workflow or data quality tests will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

Informix rejects its large-object types (`BYTE`, `TEXT`, `CLOB` and `BLOB`) in
most aggregate expressions, so the profiler skips those columns rather than
losing the whole table's metrics to a failed statement. Every other column in the
table is profiled as usual.

### Lineage & Usage

This connector does not support lineage or usage extraction, so those ingestion
pipelines are not offered for an Informix service.

Informix can produce the necessary query history -- `sysmaster:syssqltrace`
records statement text, and at `medium` tracing also the database and table list
-- but SQL tracing is disabled by default and has to be turned on per server by a
DBA (`task("set sql tracing on", ...)` from the `sysadmin` database). It is also a
fixed-size ring buffer that a busy server overwrites quickly, and statement text
is truncated to the configured trace size, which breaks SQL parsing for longer
queries.

Rather than offer pipelines that fail on any server without that configuration,
the capability is left undeclared. It can be enabled later if a lineage source is
implemented.

## Connection Details

$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
$$

$$section
### Username $(id="username")

Username to connect to Informix. This user should have privileges to read all the metadata in Informix.
$$

$$section
### Password $(id="password")

Password to connect to Informix.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the Informix instance, as a string in the format `hostname:port`. For example, `localhost:9088`.

This is the SQLI listener port, which is not the same as the DRDA port. If you are unsure which port to use, look up the entry for your server in the `sqlhosts` file.

If you are running the OpenMetadata ingestion in a container and Informix is on the host machine, use `host.docker.internal:9088` rather than `localhost:9088`.
$$

$$section
### Database $(id="database")

Database of the data source. This is the database the connection is opened against; to bring in the others on the same server, enable **Ingest All Databases**.
$$

$$section
### Server Name $(id="serverName")

The Informix server name, as defined in the `sqlhosts` file or in the `INFORMIXSERVER` environment variable. This is the name of the database server instance, not the hostname.

Informix requires it on every connection, so it cannot be left blank.

If you have shell access to the server, `onstat -g dis` lists it as `Server`, and the `sqlhosts` file maps each server name to the port it listens on -- the `onsoctcp` entry is the one this connector uses. Otherwise ask your DBA which `INFORMIXSERVER` value corresponds to the port above.
$$

$$section
### Ingest All Databases $(id="ingestAllDatabases")

When enabled, metadata is ingested from every database on the server rather than only the one named above. The list is read from `sysmaster:sysdatabases`, so the user needs `CONNECT` on `sysmaster` as well.

The server's own databases are skipped — `sysmaster`, `sysadmin`, `sysuser`, `sysutils`, and the ones that appear with Enterprise Replication, Change Data Capture and the Connection Manager. They hold several hundred internal tables between them, which would otherwise bury your own databases in the catalogue.

You can narrow the result further with the Database Filter Pattern in the ingestion configuration.
$$

$$section
### SSL Mode $(id="sslMode")

SSL Mode to connect to Informix.

- `disable` — no encryption.
- `allow` and `prefer` — the Informix JDBC driver has no opportunistic negotiation, so these connect without encryption and log a warning.
- `require` — encrypted, without verifying the server certificate.
- `verify-ca` and `verify-full` — not supported by this connector. It refuses to connect rather than silently downgrading to an unverified session, which would leave you believing the certificate had been checked.
$$

$$section
### SSL Config $(id="sslConfig")

SSL Configuration details. Provide the CA certificate used to validate the Informix server certificate, pasted in PEM format.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.

These become Informix JDBC connection properties. For example, `DB_LOCALE` for a database created with a non-default locale.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

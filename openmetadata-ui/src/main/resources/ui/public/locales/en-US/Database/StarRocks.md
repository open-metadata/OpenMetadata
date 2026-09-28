# StarRocks

In this section, we provide guides and references to use the StarRocks connector.

## Requirements

You can find further information on the StarRocks connector in the [docs](https://docs.open-metadata.org/connectors/database/starrocks).

## Table Types

Tables in an external catalog report their catalog type in `INFORMATION_SCHEMA.tables.ENGINE`, and that decides the ingested table type: `DELTALAKE` gives `DeltaLake`, `ICEBERG` gives `Iceberg`, `HIVE` and `JDBC` give `External`, and internal tables give `Regular`.

`ENGINE` describes the catalog a table is read through, not the table's storage format, so on a metastore shared by several catalogs a table takes the type of the catalog it is read through. A Hive table visible through a `deltalake` catalog is typed `DeltaLake`, and its columns cannot be read. Use one service per catalog, and exclude foreign schemas with the schema filter pattern.

Partitioned tables are ingested as `Partitioned`, which replaces `DeltaLake` and `Iceberg`.

An external catalog is selected per session, so reaching one needs `connectionArguments` with `init_command: SET CATALOG <catalog>`; leave **Database Schema** empty, because it is sent as the connection's database and the catalog's schemas are not visible until the catalog is set.

## Connection Details

$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
$$

$$section
### Username $(id="username")

Username to connect to StarRocks. This user should have privileges to read all the metadata in StarRocks.
$$

$$section
### Password $(id="password")

Password to connect to StarRocks.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the fe host and fe query port of the StarRocks instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:9030`.


$$

$$section
### Database Name $(id="databaseName")

In OpenMetadata, the Database Service hierarchy works as follows:

```
Database Service > Database > Schema > Table
```

In the case of StarRocks, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
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

# Mysql

In this section, we provide guides and references to use the Mysql connector.

# Requirements
To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with custom Airflow plugins to handle the workflow deployment.

Note that We support MySQL (version 8.0.0 or greater) and the user should have access to the `INFORMATION_SCHEMA` table.

You can find further information on the Athena connector in the [docs](https://docs.open-metadata.org/connectors/database/mysql).

## Connection Details

### Scheme $(id="scheme")

SQLAlchemy driver scheme options.

### Username $(id="username")

Username to connect to Mysql. This user should have privileges to read all the metadata in Mysql.

### Password $(id="password")

Password to connect to Mysql.

### Host Port $(id="hostPort")

Host and port of the Mysql service.

**Example**: `localhost:3306` or `host.docker.internal:3306`

### Database Name $(id="databaseName")

In OpenMetadata, the Database Service hierarchy works as follows:

```
Database Service > Database > Schema > Table
```

In the case of Mysql, we won't have a Database as such. If you'd like to see your data in a database
named something other than `default`, you can specify the name in this field.

### Database Schema $(id="databaseSchema")

In OpenMetadata, the Database Service hierarchy works as follows:

```
Database Service > Database > Schema > Table
```

In the case of MySQL, we won't have a DatabaseSchema as such. If you'd like to see your data in a databaseSchema named something other than `default`, you can specify the name in this field.

### Ssl CA $(id="sslCA")

Provide the path to ssl ca file
Provide the path to ssl client certificate file (ssl_cert)

### Ssl Cert $(id="sslCert")

Provide the path to ssl client certificate file (ssl_cert)

### Ssl Key $(id="sslKey")

Provide the path to ssl client certificate file (ssl_key)

### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
<!-- connectionOptions to be updated -->

### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
<!-- connectionArguments to be updated -->


# Superset

In this section, we provide guides and references to use the Superset connector.

# Requirements
<!-- to be updated -->
You can find further information on the Kafka connector in the [docs](https://docs.open-metadata.org/connectors/dashboard/superset).

## Connection Details

### Host Port $(id="hostPort")

Host and port of the MySQL service.
<!-- hostPort to be updated -->

### Connection $(id="connection")

Choose between API or database connection fetch metadata from superset.
<!-- connection to be updated -->

### Provider $(id="provider")

Authentication provider for the Superset service. For basic user/password authentication, the default value `db` can be used. This parameter is used internally to connect to Superset's REST API.
<!-- provider to be updated -->

### Username $(id="username")

Username to connect to MySQL. This user should have privileges to read all the metadata in Mysql.
<!-- username to be updated -->

### Password $(id="password")

Password to connect to MySQL.
<!-- password to be updated -->

### Connection $(id="connection")

Choose between API or database connection fetch metadata from superset.
<!-- connection to be updated -->

### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
<!-- scheme to be updated -->

### Username $(id="username")

Username to connect to MySQL. This user should have privileges to read all the metadata in Mysql.
<!-- username to be updated -->

### Password $(id="password")

Password to connect to MySQL.
<!-- password to be updated -->

### Host Port $(id="hostPort")

Host and port of the MySQL service.
<!-- hostPort to be updated -->

### Database $(id="database")

Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
<!-- database to be updated -->

### Ssl Mode $(id="sslMode")

SSL Mode to connect to postgres database. E.g, prefer, verify-ca etc.
<!-- sslMode to be updated -->

### Classification Name $(id="classificationName")

Custom OpenMetadata Classification name for Postgres policy tags.
<!-- classificationName to be updated -->

### Ingest All Databases $(id="ingestAllDatabases")

Ingest data from all databases in Postgres. You can use databaseFilterPattern on top of this.
<!-- ingestAllDatabases to be updated -->

### Connection Options $(id="connectionOptions")

Additional connection options that can be sent to service during the connection.
<!-- connectionOptions to be updated -->

### Connection Arguments $(id="connectionArguments")

connectionArguments
<!-- connectionArguments to be updated -->

### Supports Database $(id="supportsDatabase")

The source service supports the database concept in its hierarchy
<!-- supportsDatabase to be updated -->

### Connection $(id="connection")

Choose between API or database connection fetch metadata from superset.
<!-- connection to be updated -->

### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
<!-- scheme to be updated -->

### Username $(id="username")

Username to connect to MySQL. This user should have privileges to read all the metadata in Mysql.
<!-- username to be updated -->

### Password $(id="password")

Password to connect to MySQL.
<!-- password to be updated -->

### Host Port $(id="hostPort")

Host and port of the MySQL service.
<!-- hostPort to be updated -->

### Database Name $(id="databaseName")

Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
<!-- databaseName to be updated -->

### Database Schema $(id="databaseSchema")

databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
<!-- databaseSchema to be updated -->

### Ssl CA $(id="sslCA")

Provide the path to ssl ca file
<!-- sslCA to be updated -->

### Ssl Cert $(id="sslCert")

Provide the path to ssl client certificate file (ssl_cert)
<!-- sslCert to be updated -->

### Ssl Key $(id="sslKey")

Provide the path to ssl client certificate file (ssl_key)
<!-- sslKey to be updated -->

### Connection Options $(id="connectionOptions")

Additional connection options that can be sent to service during the connection.
<!-- connectionOptions to be updated -->

### Connection Arguments $(id="connectionArguments")

connectionArguments
<!-- connectionArguments to be updated -->

### Connection Options $(id="connectionOptions")

Additional connection options that can be sent to service during the connection.
<!-- connectionOptions to be updated -->


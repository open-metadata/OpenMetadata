# Doris

In this section, we provide guides and references to use the Doris connector.

## Requirements

You can find further information on the Doris connector in the [docs](https://docs.open-metadata.org/connectors/database/doris).

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
### SSL CA $(id="sslCA")
Provide the path to SSL CA file, which needs to be local in the ingestion process.
$$

$$section
### SSL Certificate $(id="sslCert")
Provide the path to SSL client certificate file (`ssl_cert`)
$$

$$section
### SSL Key $(id="sslKey")
Provide the path to SSL key file (`ssl_key`)
$$

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to the service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to the service during connection.

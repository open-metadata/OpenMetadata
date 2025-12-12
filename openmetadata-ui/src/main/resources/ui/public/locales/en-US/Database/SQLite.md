# SQLite

In this section, we provide guides and references to use the SQLite connector.

## Requirements

You can find further information on the SQLite connector in the <a href="https://docs.open-metadata.org/connectors/database/sqlite" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
$$

$$section
### Username $(id="username")

Username to connect to SQLite. Blank for in-memory database.
$$

$$section
### Password $(id="password")

Password to connect to SQLite. Blank for in-memory database.
$$

$$section
### Host Port $(id="hostPort")
This parameter specifies the host and port of the SQLite instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:3306`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:3306` as the value.

Keep it blank for in-memory databases.
$$

$$section
### Database $(id="database")

Database of the data source. This is an optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, the OpenMetadata Ingestion attempts to scan all the databases.
$$

$$section
### Database Mode $(id="databaseMode")

How to run the SQLite database. :memory: by default.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

# SQLite

In this section, we provide guides and references to use the SQLite connector.

# Requirements
You can find further information on the SQLite connector in the [docs](https://docs.open-metadata.org/connectors/database/sqlite).

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

Host and port of the SQLite service. Blank for in-memory database.

### Database $(id="database")
$$

$$section
Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
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

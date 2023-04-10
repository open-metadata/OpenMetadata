# SQLite

In this section, we provide guides and references to use the SQLite connector.

# Requirements
<!-- to be updated -->
You can find further information on the Kafka connector in the [docs](https://docs.open-metadata.org/connectors/database/sqlite).

## Connection Details

### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
<!-- scheme to be updated -->

### Username $(id="username")

Username to connect to SQLite. Blank for in-memory database.
<!-- username to be updated -->

### Password $(id="password")

Password to connect to SQLite. Blank for in-memory database.
<!-- password to be updated -->

### Host Port $(id="hostPort")

Host and port of the SQLite service. Blank for in-memory database.
<!-- hostPort to be updated -->

### Database $(id="database")

Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
<!-- database to be updated -->

### Database Mode $(id="databaseMode")

How to run the SQLite database. :memory: by default.
<!-- databaseMode to be updated -->

### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
<!-- connectionOptions to be updated -->

### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
<!-- connectionArguments to be updated -->


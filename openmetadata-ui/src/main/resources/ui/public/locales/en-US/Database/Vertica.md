# Vertica

In this section, we provide guides and references to use the Vertica connector.

# Requirements
<!-- to be updated -->
You can find further information on the Kafka connector in the [docs](https://docs.open-metadata.org/connectors/database/vertica).

## Connection Details

### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
<!-- scheme to be updated -->

### Username $(id="username")

Username to connect to Vertica. This user should have privileges to read all the metadata in Vertica.
<!-- username to be updated -->

### Password $(id="password")

Password to connect to Vertica.
<!-- password to be updated -->

### Host Port $(id="hostPort")

Host and port of the Vertica service.
<!-- hostPort to be updated -->

### Database $(id="database")

Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
<!-- database to be updated -->

### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
<!-- connectionOptions to be updated -->

### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
<!-- connectionArguments to be updated -->

### Supports Database $(id="supportsDatabase")

The source service supports the database concept in its hierarchy
<!-- supportsDatabase to be updated -->


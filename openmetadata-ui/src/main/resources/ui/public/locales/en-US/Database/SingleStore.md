# SingleStore

In this section, we provide guides and references to use the SingleStore connector.

# Requirements
<!-- to be updated -->
You can find further information on the Kafka connector in the [docs](https://docs.open-metadata.org/connectors/database/singlestore).

## Connection Details

### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
<!-- scheme to be updated -->

### Username $(id="username")

Username to connect to SingleStore. This user should have privileges to read all the metadata in MySQL.
<!-- username to be updated -->

### Password $(id="password")

Password to connect to SingleStore.
<!-- password to be updated -->

### Host Port $(id="hostPort")

Host and port of the SingleStore service.
<!-- hostPort to be updated -->

### Database Name $(id="databaseName")

Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
<!-- databaseName to be updated -->

### Database Schema $(id="databaseSchema")

databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
<!-- databaseSchema to be updated -->

### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
<!-- connectionOptions to be updated -->

### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
<!-- connectionArguments to be updated -->


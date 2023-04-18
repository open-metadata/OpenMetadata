# Trino

In this section, we provide guides and references to use the Trino connector.

# Requirements
<!-- to be updated -->
You can find further information on the Kafka connector in the [docs](https://docs.open-metadata.org/connectors/database/trino).

## Connection Details

$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
<!-- scheme to be updated -->
$$

$$section
### Username $(id="username")

Username to connect to Trino. This user should have privileges to read all the metadata in Trino.
<!-- username to be updated -->
$$

$$section
### Password $(id="password")

Password to connect to Trino.
<!-- password to be updated -->
$$

$$section
### Host Port $(id="hostPort")

Host and port of the Trino service.
<!-- hostPort to be updated -->
$$

$$section
### Catalog $(id="catalog")

Catalog of the data source.
<!-- catalog to be updated -->
$$

$$section
### Database Schema $(id="databaseSchema")

databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
<!-- databaseSchema to be updated -->
$$

$$section
### Proxies $(id="proxies")

Proxies for the connection to Trino data source
<!-- proxies to be updated -->
$$

$$section
### Params $(id="params")

URL parameters for connection to the Trino data source
<!-- params to be updated -->
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
<!-- connectionOptions to be updated -->
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
<!-- connectionArguments to be updated -->
$$

$$section
### Supports Database $(id="supportsDatabase")

The source service supports the database concept in its hierarchy
<!-- supportsDatabase to be updated -->
$$
# Databricks

In this section, we provide guides and references to use the Databricks connector.

# Requirements
<!-- to be updated -->
You can find further information on the Kafka connector in the [docs](https://docs.open-metadata.org/connectors/database/databricks).

## Connection Details


$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
<!-- scheme to be updated -->
$$

$$section
### Host Port $(id="hostPort")

Host and port of the Databricks service.
<!-- hostPort to be updated -->
$$

$$section
### Token $(id="token")

Generated Token to connect to Databricks.
<!-- token to be updated -->
$$

$$section
### Http Path $(id="httpPath")

Databricks compute resources URL.
<!-- httpPath to be updated -->
$$

$$section
### Catalog $(id="catalog")

Catalog of the data source(Example: hive_metastore). This is optional parameter, if you would like to restrict the metadata reading to a single catalog. When left blank, OpenMetadata Ingestion attempts to scan all the catalog.
<!-- catalog to be updated -->
$$

$$section
### Database Schema $(id="databaseSchema")

databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
<!-- databaseSchema to be updated -->
$$

$$section
### Connection Timeout $(id="connectionTimeout")

The maximum amount of time (in seconds) to wait for a successful connection to the data source. If the connection attempt takes longer than this timeout period, an error will be returned.
<!-- connectionTimeout to be updated -->
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
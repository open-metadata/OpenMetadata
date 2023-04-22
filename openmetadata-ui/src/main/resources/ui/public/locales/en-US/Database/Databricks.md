# Databricks

In this section, we provide guides and references to use the Databricks connector. You can view the full documentation for Databricks [here](https://docs.open-metadata.org/connectors/database/databricks).

## Requirements
You can find further information on the Databricks connector in the [docs](https://docs.open-metadata.org/connectors/database/databricks).
To learn more about the Databricks Connection Details(`hostPort`,`token`, `http_path`) information visit this [docs](https://docs.open-metadata.org/connectors/database/databricks/troubleshooting).
$$note
we have tested it out with Databricks version 11.3LTS runtime version. (runtime version must be 9 and above)
$$

### Usage & Lineage
$$note
To get Query Usage and Lineage details, need a Azure Databricks Premium account.
$$

## Connection Details
$$section
### Scheme $(id="scheme")
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value.
$$

$$section
### Host Port $(id="hostPort")
Host and port of the Databricks service. This should be specified as a string in the format 'hostname:port'.
**Example**: `adb-xyz.azuredatabricks.net:443`
$$

$$section
### Token $(id="token")
Generated Token to connect to Databricks.
**Example**: `dapw488e89a7176f7eb39bbc718617891564`
$$

$$section
### Http Path $(id="httpPath")
Databricks compute resources URL.
**Example**: `/sql/1.0/warehouses/xyz123`
$$

$$section
### Catalog $(id="catalog")
Catalog of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single catalog. When left blank, OpenMetadata Ingestion attempts to scan all the catalog.
**Example**: `hive_metastore`
$$

$$section
### Database Schema $(id="databaseSchema")
databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
**Example**: `default`
$$

$$section
### Connection Timeout $(id="connectionTimeout")
The maximum amount of time (in seconds) to wait for a successful connection to the data source. If the connection attempt takes longer than this timeout period, an error will be returned.
$$

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

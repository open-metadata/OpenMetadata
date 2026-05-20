# IOMETE

In this section, we provide guides and references to use the IOMETE connector.

## Requirements

The IOMETE user must have access to the lakehouse cluster and sufficient privileges to read metadata.

You can find further information on the IOMETE connector in the <a href="https://docs.open-metadata.org/connectors/database/iomete" target="_blank">docs</a>.

## Connection Details

$$section
### Host and Port $(id="hostPort")

Host of the IOMETE service. You can optionally include the port using the `host:port` format (e.g. `dev.iomete.cloud:443`). If no port is specified, port `443` is used by default.
$$

$$section
### Username $(id="username")

Username to connect to IOMETE. This user should have privileges to read all the metadata in IOMETE.
$$

$$section
### Password $(id="password")

Password to connect to IOMETE.
$$

$$section
### Cluster $(id="cluster")

IOMETE lakehouse cluster name to connect to. This is passed as the `cluster` query parameter in the connection URL.
$$

$$section
### Data Plane $(id="dataPlane")

IOMETE data plane name. This is passed as the `data_plane` query parameter in the connection URL (e.g. `default`).
$$

$$section
### Catalog $(id="catalog")

Catalog of the data source (e.g. `spark_catalog`). This is an optional parameter — if provided, metadata ingestion is restricted to this catalog. If left blank, OpenMetadata scans default catalog.
$$

$$section
### Database Schema $(id="databaseSchema")

IOMETE database (schema) to restrict metadata ingestion to (e.g. `default`, `finance_db`). This is an optional parameter — if left blank, OpenMetadata attempts to scan all schemas in the catalog.
$$

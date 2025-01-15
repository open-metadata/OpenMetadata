---
title: Connection Details
slug: /connectors/database/unity-catalog/connections
---

#### Connection Details

- **Host and Port**: Enter the fully qualified hostname and port number for your Databricks deployment in the Host and Port field.
- **Token**: Generated Token to connect to Databricks.
- **HTTP Path**: Databricks compute resources URL.
- **connectionTimeout**: The maximum amount of time (in seconds) to wait for a successful connection to the data source. If the connection attempt takes longer than this timeout period, an error will be returned.
- **Catalog**: Catalog of the data source(Example: hive_metastore). This is optional parameter, if you would like to restrict the metadata reading to a single catalog. When left blank, OpenMetadata Ingestion attempts to scan all the catalog.
- **DatabaseSchema**: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.

{% partial file="/v1.6/connectors/database/advanced-configuration.md" /%}
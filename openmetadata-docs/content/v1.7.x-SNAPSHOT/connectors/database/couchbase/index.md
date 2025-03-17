---
title: Couchbase
slug: /connectors/database/couchbase
---

{% connectorDetailsHeader
name="Couchbase"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Owners", "Tags", "Stored Procedures", "Query Usage", "Lineage", "Column-level Lineage", "Data Profiler", "Data Quality", "dbt"]
/ %}


In this section, we provide guides and references to use the Couchbase connector.

Configure and schedule Couchbase metadata workflows from the OpenMetadata UI:

- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/couchbase/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/couchbase/connections) user credentials with the Couchbase connector.

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Couchbase", 
    selectServicePath: "/images/v1.7/connectors/couchbase/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/couchbase/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/couchbase/service-connection.png",
} 
/%}

{% stepsContainer %}

{% extraContent parentTagName="stepsContainer" %}

#### Connection Options

- **Username**: Specify the User to connect to Clickhouse. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Clickhouse.
- **Host and Port**: Enter the fully qualified hostname and port number for your Clickhouse deployment in the Host and Port field.
- **Use HTTPS Protocol**: Enable this flag when the when the Clickhouse instance is hosted via HTTPS protocol. This flag is useful when you are using `clickhouse+http` connection scheme.
- **Secure Connection**: Establish secure connection with ClickHouse. ClickHouse supports secure communication over SSL/TLS to protect data in transit, by checking this option, it establishes secure connection with ClickHouse. This flag is useful when you are using `clickhouse+native` connection scheme.
- **Key File**: The key file path is the location when ClickHouse looks for a file containing the private key needed for secure communication over SSL/TLS. By default, ClickHouse will look for the key file in the `/etc/clickhouse-server directory`, with the file name `server.key`. However, this can be customized in the ClickHouse configuration file (`config.xml`). This flag is useful when you are using `clickhouse+native` connection scheme and the secure connection flag is enabled.

{% partial file="/v1.7/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}

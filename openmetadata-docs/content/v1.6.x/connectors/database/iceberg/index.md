---
title: Iceberg
slug: /connectors/database/iceberg
---


{% connectorDetailsHeader
name="Iceberg"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata", "Owners"]
unavailableFeatures=["Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt", "Tags", "Stored Procedures"]
/ %}


In this section, we provide guides and references to use the Iceberg connector.

Configure and schedule Iceberg metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Enable Security](#securing-rest-catalog-connection-with-ssl-in-openmetadata)

{% partial file="/v1.6/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/iceberg/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/iceberg/connections) user credentials with the Iceberg connector.

## Requirements

The requirements actually depend on the Catalog and the FileSystem used. In a nutshell, the used credentials must have access to reading the Catalog and the Metadata File.

### Glue Catalog

Must have `glue:GetDatabases`, and `glue:GetTables` permissions to be able to read the Catalog.

Must also have the `s3:GetObject` permission for the location of the Iceberg tables.

### DynamoDB Catalog

Must have `dynamodb:DescribeTable` and `dynamodb:GetItem` permissions on the Iceberg Catalog table.

Must also have the `s3:GetObject` permission for the location of the Iceberg tables.

### Hive / REST Catalog
It depends on where and how the Hive / Rest Catalog is setup and where the Iceberg files are stored.
## Metadata Ingestion

{% partial
  file="/v1.6/connectors/metadata-ingestion-ui.md"
  variables={
    connector: "Iceberg",
    selectServicePath: "/images/v1.6/connectors/iceberg/select-service.png",
    addNewServicePath: "/images/v1.6/connectors/iceberg/add-new-service.png",
    serviceConnectionPath: "/images/v1.6/connectors/iceberg/service-connection.png",
}
/%}

{% stepsContainer %}

{% partial file="/v1.6/connectors/test-connection.md" /%}

{% partial file="/v1.6/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.6/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Securing Rest Catalog Connection with SSL in OpenMetadata

When using `SSL` to establish secure connections between OpenMetadata and Rest Catalog, you can specify the `caCertificate` to provide the CA certificate used for SSL validation. Alternatively, if both client and server require mutual authentication, you'll need to use all three parameters: `ssl_key`, `ssl_cert`, and `ssl_ca`. In this case, `ssl_cert` is used for the client’s SSL certificate, `ssl_key` for the private key associated with the SSL certificate, and `ssl_ca` for the CA certificate to validate the server’s certificate.

{% image
  src="/images/v1.6/connectors/restcatalog_ssl.png"
  alt="SSL Configuration"
  height="450px"
  caption="SSL Configuration" /%}

{% partial file="/v1.6/connectors/troubleshooting.md" /%}

{% partial file="/v1.6/connectors/database/related.md" /%}

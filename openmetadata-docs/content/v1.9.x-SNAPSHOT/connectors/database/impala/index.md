---
title: Impala Connector | OpenMetadata SQL-on-Hadoop Integration
<<<<<<< HEAD
description: Connect Impala databases to OpenMetadata with our comprehensive connector guide. Step-by-step setup, configuration, and metadata extraction instructions.
=======
description: Connect Apache Impala to OpenMetadata seamlessly. Complete setup guide, configuration steps, and troubleshooting for database metadata integration.
>>>>>>> bd5955fca2 (Docs: SEO Description Updation (#22035))
slug: /connectors/database/impala
---

{% connectorDetailsHeader
name="Impala"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "dbt", "View Lineage", "View Column-level Lineage", "Sample Data"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Impala connector.

Configure and schedule Impala metadata and profiler workflows from the OpenMetadata UI:
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Lineage](/how-to-guides/data-lineage/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Enable Security](#securing-impala-connection-with-ssl-in-openmetadata)
- [Troubleshooting](/connectors/database/impala/troubleshooting)

{% partial file="/v1.9/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/impala/yaml"} /%}

## Metadata Ingestion

{% partial 
  file="/v1.9/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Impala", 
    selectServicePath: "/images/v1.9/connectors/impala/select-service.png",
    addNewServicePath: "/images/v1.9/connectors/impala/add-new-service.png",
    serviceConnectionPath: "/images/v1.9/connectors/impala/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **username**: Specify the User to connect to Impala. It should have enough privileges to read all the metadata.
- **password**: Password to connect to Impala.
- **hostPort**: Enter the fully qualified hostname and port number for your Impala deployment in the Host and Port field.
- **authMechanism**: This parameter specifies the authentication method to use when connecting to the Impala server. Possible values are `NOSASL`, `PLAIN`, `GSSAPI`, `LDAP`, `JWT`. If you are using Kerberos authentication, you should set auth to `GSSAPI`. 
- **kerberosServiceName**: This parameter specifies the Kerberos service name to use for authentication. This should only be specified if using Kerberos authentication.
- **databaseSchema**: Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **databaseName**: In OpenMetadata, the Database Service hierarchy works as follows:
`Database Service > Database > Schema > Table`. In the case of Impala, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
- **useSSL**: Establish secure connection with Impala. Enables SSL for the connector.
- **authOptions**: Enter the auth options string for impala connection.

{% partial file="/v1.9/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.9/connectors/test-connection.md" /%}

{% partial file="/v1.9/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.9/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Securing Impala Connection with SSL in OpenMetadata

To configure SSL for secure connections between OpenMetadata and an Impala database, add the key `use_ssl` with a value of `true` to the `connectionArguments` to enable SSL. Additionally, include the key `ca_cert` with the path to the CA certificate file as its value. Ensure that the certificate file is accessible by the server, and if deploying via Docker or Kubernetes, update the CA certificate in the OpenMetadata server to reflect these changes.

{% image
  src="/images/v1.9/connectors/ssl_Impala.png"
  alt="SSL Configuration"
  height="450px"
  caption="SSL Configuration" /%}

{% partial file="/v1.9/connectors/database/related.md" /%}

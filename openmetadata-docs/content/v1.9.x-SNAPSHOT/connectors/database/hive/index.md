---
title: Hive Connector | OpenMetadata Big Data Integration Guide
<<<<<<< HEAD
description: Connect Apache Hive to OpenMetadata with our comprehensive database connector guide. Learn setup, configuration, and metadata extraction in minutes.
=======
description: Connect Apache Hive to OpenMetadata with our comprehensive database connector guide. Setup instructions, configuration options, and metadata extraction steps.
>>>>>>> bd5955fca2 (Docs: SEO Description Updation (#22035))
slug: /connectors/database/hive
---

{% connectorDetailsHeader
name="Hive"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "View Lineage", "View Column-level Lineage", "dbt", "Sample Data"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures"]
/ %}


In this section, we provide guides and references to use the Hive connector.

Configure and schedule Hive metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Lineage](/how-to-guides/data-lineage/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Enable Security](#securing-hive-connection-with-ssl-in-openmetadata)
- [Troubleshooting](/connectors/database/hive/troubleshooting)

{% partial file="/v1.9/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/hive/yaml"} /%}

## Requirements

### Metadata

To extract metadata, the user used in the connection needs to be able to perform `SELECT`, `SHOW`, and `DESCRIBE` operations in the database/schema where the metadata needs to be extracted from.

### Profiler & Data Quality
Executing the profiler workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](/how-to-guides/data-quality-observability/profiler/workflow) and data quality tests [here](/how-to-guides/data-quality-observability/quality).

## Metadata Ingestion

{% partial 
  file="/v1.9/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Hive", 
    selectServicePath: "/images/v1.9/connectors/hive/select-service.png",
    addNewServicePath: "/images/v1.9/connectors/hive/add-new-service.png",
    serviceConnectionPath: "/images/v1.9/connectors/hive/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Specify the User to connect to Hive. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Hive.
- **Host and Port**: This parameter specifies the host and port of the Hive server instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `myhivehost:10000`.
- **Auth Options (Optional)**: The auth parameter specifies the authentication method to use when connecting to the Hive server. Possible values are `LDAP`, `NONE`, `CUSTOM`, or `KERBEROS`. If you are using Kerberos authentication, you should set auth to `KERBEROS`. If you are using custom authentication, you should set auth to `CUSTOM` and provide additional options in the `authOptions` parameter.
- **Kerberos Service Name**: This parameter specifies the Kerberos service name to use for authentication. This should only be specified if using Kerberos authentication. The default value is `hive`.
- **Database Schema**: Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **Database Name**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.


#### For MySQL Metastore Connection

You can also ingest the metadata using Mysql metastore. This step is optional if metastore details are not provided then we will query the hive server directly.

- **Username**: Specify the User to connect to MySQL Metastore. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to MySQL.
- **Host and Port**: Enter the fully qualified hostname and port number for your MySQL Metastore deployment in the Host and Port field in the format `hostname:port`.
- **databaseSchema**: Enter the database schema which is associated with the metastore.

{% partial file="/v1.9/connectors/database/advanced-configuration.md" /%}

#### For Postgres Metastore Connection

You can also ingest the metadata using Postgres metastore. This step is optional if metastore details are not provided then we will query the hive server directly.

- **Username**: Specify the User to connect to Postgres Metastore. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Postgres.
- **Host and Port**: Enter the fully qualified hostname and port number for your Postgres deployment in the Host and Port field in the format `hostname:port`.
- **Database**: Initial Postgres database to connect to. Specify the name of database associated with metastore instance.

{% partial file="/v1.9/connectors/database/advanced-configuration.md" /%}


{% partial file="/v1.9/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.9/connectors/test-connection.md" /%}

{% partial file="/v1.9/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.9/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Securing Hive Connection with SSL in OpenMetadata

To configure SSL for secure connections between OpenMetadata and a Hive database, you need to add `ssl_cert` as a key and the path to the CA certificate as its value under `connectionArguments`. Ensure that the certificate is accessible by the server. If you use a Docker or Kubernetes deployment, update the CA certificate in the Open Metadata server.

{% image
  src="/images/v1.9/connectors/ssl_argument.png"
  alt="SSL Configuration"
  height="450px"
  caption="SSL Configuration" /%}

{% partial file="/v1.9/connectors/database/related.md" /%}

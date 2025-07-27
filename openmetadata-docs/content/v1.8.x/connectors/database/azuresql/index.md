---
title: AzureSQL | OpenMetadata Connector Setup & Integration Guide
description: Learn how to connect Azure SQL databases to OpenMetadata with step-by-step setup guides, configuration options, and metadata extraction features.
slug: /connectors/database/azuresql
---

{% connectorDetailsHeader
name="AzureSQL"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Lineage", "Column-level Lineage", "Data Profiler", "Data Quality", "dbt", "Sample Data", "Auto-Classification"]
unavailableFeatures=["Stored Procedures", "Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the AzureSQL connector.

Configure and schedule AzureSQL metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
    - [Service Name](#service-name)
    - [Connection Options](#connection-options)
    - [Metadata Ingestion Options](#metadata-ingestion-options)
- [Data Lineage](/how-to-guides/data-lineage/workflow)
- [Troubleshooting](/connectors/database/azuresql/troubleshooting)
  - [Workflow Deployment Error](#workflow-deployment-error)
- [Related](#related)

{% partial file="/v1.8/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/azuresql/yaml"} /%}

## Requirements

Make sure if you have whitelisted ingestion container IP on Azure SQL firewall rules. Checkout [this](https://learn.microsoft.com/en-us/azure/azure-sql/database/firewall-configure?view=azuresql#use-the-azure-portal-to-manage-server-level-ip-firewall-rules) document on how to whitelist your IP using azure portal.

AzureSQL database user must grant `SELECT` privilege to fetch the metadata of tables and views.

```sql
-- Create a new user
-- More details https://learn.microsoft.com/en-us/sql/t-sql/statements/create-user-transact-sql?view=sql-server-ver16
CREATE USER Mary WITH PASSWORD = '********';
-- Grant SELECT on table
GRANT SELECT TO Mary;
```

## Metadata Ingestion

{% partial 
  file="/v1.8/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Azure SQL", 
    selectServicePath: "/images/v1.8/connectors/azuresql/select-service.png",
    addNewServicePath: "/images/v1.8/connectors/azuresql/add-new-service.png",
    serviceConnectionPath: "/images/v1.8/connectors/azuresql/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Options

- **Username**: Specify the User to connect to AzureSQL. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to AzureSQL.
- **Host and Port**: Enter the fully qualified hostname and port number for your AzureSQL deployment in the Host and Port field.
- **Database**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
- **Driver**: Connecting to AzureSQL requires ODBC driver to be installed. Specify ODBC driver name in the field.
You can download the ODBC driver from [here](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server?view=sql-server-ver16). In case of docker or kubernetes deployment this driver comes out of the box with version  `ODBC Driver 18 for SQL Server`.

**Authentication Mode**:

- **Authentication**:
   - The `authentication` parameter determines the method of authentication when connecting to AzureSQL using ODBC (Open Database Connectivity).
   - If you select **"Active Directory Password"**, you'll need to provide the password associated with your Azure Active Directory account.
   - Alternatively, if you choose **"Active Directory Integrated"**, the connection will use the credentials of the currently logged-in user. This mode ensures secure and seamless connections with AzureSQL.

- **Encrypt**:
   - The `encrypt` setting in the connection string pertains to data encryption during communication with AzureSQL.
   - When enabled, it ensures that data exchanged between your application and the database is encrypted, enhancing security.

- **Trust Server Certificate**:
   - The `trustServerCertificate` option also relates to security.
   - When set to true, your application will trust the server's SSL certificate without validation. Use this cautiously, as it bypasses certificate validation checks.

- **Connection Timeout**:
   - The `connectionTimeout` parameter specifies the maximum time (in seconds) that your application will wait while attempting to establish a connection to AzureSQL.
   - If the connection cannot be established within this timeframe, an error will be raised.

{% partial file="/v1.8/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.8/connectors/test-connection.md" /%}

{% partial file="/v1.8/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.8/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.8/connectors/database/related.md" /%}

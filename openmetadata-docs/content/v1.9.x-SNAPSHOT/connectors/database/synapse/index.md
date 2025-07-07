---
title: Connect Synapse | GetCollate Docs
description: Connect Azure Synapse to OpenMetadata with our comprehensive database connector guide. Configure metadata extraction, lineage tracking, and profiling in minutes.
slug: /connectors/database/synapse
collate: true
---

{% connectorDetailsHeader
name="Synapse"
stage="PROD"
platform="Collate"
availableFeatures=["Metadata", "Query Usage", "Lineage", "Column-level Lineage", "Data Profiler", "Data Quality", "Stored Procedures", "dbt", "Sample Data"]
unavailableFeatures=["Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the Synapse connector.

Configure and schedule Synapse metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
    - [Service Name](#service-name)
    - [Connection Options](#connection-options)
    - [Metadata Ingestion Options](#metadata-ingestion-options)
- [Troubleshooting](/connectors/database/synapse/troubleshooting)
  - [Workflow Deployment Error](#workflow-deployment-error)
- [Related](#related)

{% partial file="/v1.9/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/synapse/yaml"} /%}

## Requirements

Make sure if you have whitelisted ingestion container IP on Azure SQL firewall rules. Checkout [this](https://learn.microsoft.com/en-us/azure/azure-sql/database/firewall-configure?view=azuresql#use-the-azure-portal-to-manage-server-level-ip-firewall-rules) document on how to whitelist your IP using azure portal.

Synapse database user must grant `SELECT` privilege to fetch the metadata of tables and views.

```sql
-- Create a new user
-- More details https://learn.microsoft.com/en-us/sql/t-sql/statements/create-user-transact-sql?view=sql-server-ver16
CREATE USER Mary WITH PASSWORD = '********';
-- Grant SELECT on table
GRANT SELECT TO Mary;
```

## Metadata Ingestion

{% partial 
  file="/v1.9/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Synapse", 
    selectServicePath: "/images/v1.9/connectors/synapse/select-service.webp",
    addNewServicePath: "/images/v1.9/connectors/synapse/add-new-service.webp",
    serviceConnectionPath: "/images/v1.9/connectors/synapse/service-connection.webp",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Options

- **Username**: Specify the User to connect to Synapse. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Synapse.
- **Host and Port**: Enter the fully qualified hostname and port number for your Synapse deployment in the Host and Port field.
- **Database**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
- **Driver**: Connecting to Synapse requires ODBC driver to be installed. Specify ODBC driver name in the field.
You can download the ODBC driver from [here](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server?view=sql-server-ver16). In case of docker or kubernetes deployment this driver comes out of the box with version  `ODBC Driver 18 for SQL Server`.

**Authentication Mode**:

- **Authentication**:
   - The `authentication` parameter determines the method of authentication when connecting to Synapse using ODBC (Open Database Connectivity).
   - If you select **"Active Directory Password"**, you'll need to provide the password associated with your Azure Active Directory account.
   - Alternatively, if you choose **"Active Directory Integrated"**, the connection will use the credentials of the currently logged-in user. This mode ensures secure and seamless connections with Synapse.

- **Encrypt**:
   - The `encrypt` setting in the connection string pertains to data encryption during communication with Synapse.
   - When enabled, it ensures that data exchanged between your application and the database is encrypted, enhancing security.

- **Trust Server Certificate**:
   - The `trustServerCertificate` option also relates to security.
   - When set to true, your application will trust the server's SSL certificate without validation. Use this cautiously, as it bypasses certificate validation checks.

- **Connection Timeout**:
   - The `connectionTimeout` parameter specifies the maximum time (in seconds) that your application will wait while attempting to establish a connection to Synapse.
   - If the connection cannot be established within this timeframe, an error will be raised.

{% partial file="/v1.9/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.9/connectors/test-connection.md" /%}

{% partial file="/v1.9/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.9/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.9/connectors/database/related.md" /%}

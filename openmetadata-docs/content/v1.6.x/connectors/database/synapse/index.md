---
title: Synapse
slug: /connectors/database/synapse
collate: true
---

{% connectorDetailsHeader
name="Synapse"
stage="PROD"
platform="Collate"
availableFeatures=["Metadata", "Query Usage", "Lineage", "Column-level Lineage", "Data Profiler", "Data Quality", "Stored Procedures", "dbt"]
unavailableFeatures=["Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the Synapse connector.

Configure and schedule Synapse metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
    - [Service Name](#service-name)
    - [Connection Options](#connection-options)
    - [Metadata Ingestion Options](#metadata-ingestion-options)
- [Troubleshooting](#troubleshooting)
  - [Workflow Deployment Error](#workflow-deployment-error)
- [Related](#related)

{% partial file="/v1.6/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/synapse/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/synapse/connections) user credentials with the Synapse connector.

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
  file="/v1.6/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Synapse", 
    selectServicePath: "/images/v1.6/connectors/synapse/select-service.webp",
    addNewServicePath: "/images/v1.6/connectors/synapse/add-new-service.webp",
    serviceConnectionPath: "/images/v1.6/connectors/synapse/service-connection.webp",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.6/connectors/test-connection.md" /%}

{% partial file="/v1.6/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.6/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.6/connectors/troubleshooting.md" /%}

{% partial file="/v1.6/connectors/database/related.md" /%}

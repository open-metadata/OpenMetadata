---
title: SAP Hana
slug: /connectors/database/sap-hana
---

{% connectorDetailsHeader
name="SAP Hana"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt"]
unavailableFeatures=["Query Usage", "Stored Procedures", "Owners", "Tags"]
/ %}


In this section, we provide guides and references to use the SAP Hana connector.

Configure and schedule SAP Hana metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Lineage](/how-to-guides/data-lineage/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/sap-hana/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/sap-hana/connections) user credentials with the SAP-HANA connector.

## Requirements

{% note %}
The connector is compatible with HANA or HANA express versions since HANA SPS 2.
{% /note %}

### Metadata

To extract metadata the user used in the connection needs to have access to the `SYS` schema.

You can create a new user to run the ingestion with:

```SQL
CREATE USER openmetadata PASSWORD Password123;
```

And, if you have password policies forcing users to reset the password, you can disable that policy for this technical user with:

```SQL
ALTER USER openmetadata DISABLE PASSWORD LIFETIME;
```

Note that in order to get the metadata for **Calculation Views**, **Analytics Views** and **Attribute Views**, you need to have enough
permissions on the `_SYS_BIC` schema. You can grant the required permissions to the user by running the following SQL commands:

```SQL
GRANT SELECT ON SCHEMA _SYS_BIC TO <user_or_role>;
```

The same applies to the `_SYS_REPO` schema, required for lineage extraction.

### Profiler & Data Quality

Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. The user should also be allowed to view information in `tables` for all objects in the database. More information on the profiler workflow setup can be found [here](/how-to-guides/data-quality-observability/profiler/workflow) and data quality tests [here](/how-to-guides/data-quality-observability/quality).

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "SAP Hana", 
    selectServicePath: "/images/v1.7/connectors/sap-hana/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/sap-hana/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/sap-hana/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}

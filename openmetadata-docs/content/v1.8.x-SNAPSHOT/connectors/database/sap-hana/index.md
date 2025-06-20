---
title: SAP HANA Connector | OpenMetadata High-Performance DB
slug: /connectors/database/sap-hana
---

{% connectorDetailsHeader
name="SAP HANA"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt", "Sample Data"]
unavailableFeatures=["Query Usage", "Stored Procedures", "Owners", "Tags"]
/ %}


In this section, we provide guides and references to use the SAP HANA connector.

Configure and schedule SAP HANA metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Lineage](/how-to-guides/data-lineage/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Troubleshooting](/connectors/database/sap-hana/troubleshooting)

{% partial file="/v1.8/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/sap-hana/yaml"} /%}

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
  file="/v1.8/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "SAP HANA", 
    selectServicePath: "/images/v1.8/connectors/sap-hana/select-service.png",
    addNewServicePath: "/images/v1.8/connectors/sap-hana/add-new-service.png",
    serviceConnectionPath: "/images/v1.8/connectors/sap-hana/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

We support two possible connection types:
1. **SQL Connection**, where you will the username, password and host.
2. **HDB User Store** [connection](https://help.sap.com/docs/SAP_HANA_PLATFORM/b3ee5778bc2e4a089d3299b82ec762a7/dd95ac9dbb571014a7d7f0234d762fdb.html?version=2.0.05&locale=en-US). 
  Note that the HDB Store will need to be locally available to the instance running the ingestion process. 
  If you are unsure about this setting, you can run the ingestion process passing the usual SQL connection details.

**SQL Connection**

- **Host and Port**: Host and port of the SAP HANA service. This should be specified as a string in the format `hostname:port`. E.g., `localhost:39041`, `host.docker.internal:39041`.
- **Username**: Specify the User to connect to SAP HANA. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to SAP HANA.
- **database**: Optional parameter to connect to a specific database.
- **databaseSchema**: databaseSchema of the data source. This is an optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.

**HDB USet Store**

- **User Key**: HDB Store User Key generated from the command `hdbuserstore SET <KEY> <host:port> <USERNAME> <PASSWORD>`.

{% partial file="/v1.8/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.8/connectors/test-connection.md" /%}

{% partial file="/v1.8/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.8/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.8/connectors/database/related.md" /%}

---
title: Oracle
slug: /connectors/database/oracle
---

{% connectorDetailsHeader
name="Oracle"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Data Profiler", "Data Quality", "dbt", "Lineage", "Column-level Lineage", "Stored Procedures"]
unavailableFeatures=["Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the Oracle connector.

Configure and schedule Oracle metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/connectors/ingestion/workflows/profiler)
- [Data Quality](/connectors/ingestion/workflows/data-quality)
- [Lineage](/connectors/ingestion/lineage)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/oracle/yaml"} /%}

## Requirements

**Note**: To retrieve metadata from an Oracle database, we use the `python-oracledb` library, which provides support for versions 12c, 18c, 19c, and 21c.

To ingest metadata from oracle user must have `CREATE SESSION` privilege for the user.

```sql
-- CREATE USER
CREATE USER user_name IDENTIFIED BY admin_password;

-- CREATE ROLE
CREATE ROLE new_role;

-- GRANT ROLE TO USER 
GRANT new_role TO user_name;

-- GRANT CREATE SESSION PRIVILEGE TO USER
GRANT CREATE SESSION TO new_role;
```

With just these permissions, your user should be able to ingest the schemas, but not the tables inside them. To get
the tables, you should grant `SELECT` permissions to the tables you are interested in. E.g.,

```sql
SELECT ON ADMIN.EXAMPLE_TABLE TO new_role;
```

You can find further information [here](https://docs.oracle.com/javadb/10.8.3.0/ref/rrefsqljgrant.html). Note that
there is no routine out of the box in Oracle to grant SELECT to a full schema.

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Oracle", 
    selectServicePath: "/images/v1.3/connectors/oracle/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/oracle/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/oracle/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Specify the User to connect to Oracle. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Oracle.
- **Host and Port**: Enter the fully qualified hostname and port number for your Oracle deployment in the Host and Port field.
- **Database Name**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name. It is recommended to use the database name same as the SID, This ensures accurate results and proper identification of tables during profiling, data quality checks and dbt workflow.
- **Oracle Connection Type** : Select the Oracle Connection Type. The type can either be `Oracle Service Name` or `Database Schema`
  - **Oracle Service Name**: The Oracle Service name is the TNS alias that you give when you remotely connect to your database and this Service name is recorded in tnsnames.
  - **Database Schema**: The name of the database schema available in Oracle that you want to connect with.
- **Oracle instant client directory**: The directory pointing to where the `instantclient` binaries for Oracle are located. In the ingestion Docker image we 
    provide them by default at `/instantclient`. If this parameter is informed (it is by default), we will run the [thick oracle client](https://python-oracledb.readthedocs.io/en/latest/user_guide/initialization.html#initializing-python-oracledb).
    We are shipping the binaries for ARM and AMD architectures from [here](https://www.oracle.com/database/technologies/instant-client/linux-x86-64-downloads.html)
    and [here](https://www.oracle.com/database/technologies/instant-client/linux-arm-aarch64-downloads.html) for the instant client version 19.

{% partial file="/v1.3/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}

{% partial file="/v1.3/connectors/database/related.md" /%}

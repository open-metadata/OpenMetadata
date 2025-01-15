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
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [Lineage](/connectors/ingestion/lineage)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/oracle/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/oracle/connections) user credentials with the Oracle connector.

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

-- Grant CREATE SESSION Privilege.
--   This allows the role to connect.
GRANT CREATE SESSION TO new_role;

-- Grant SELECT_CATALOG_ROLE Privilege.
--   This allows the role ReadOnly Access to Data Dictionaries
GRANT SELECT_CATALOG_ROLE TO new_role;
```

If you don't want to create a role, and directly give permissions to the user, you can take a look at an example given below.

```sql
-- Create a New User
CREATE USER my_user IDENTIFIED by my_password;

-- Grant CREATE SESSION Privilege.
--   This allows the user to connect.
GRANT CREATE SESSION TO my_user;

-- Grant SELECT_CATALOG_ROLE Privilege.
--   This allows the user ReadOnly Access to Data Dictionaries
GRANT SELECT_CATALOG_ROLE to my_user;
```

**Note**: With just these permissions, your user should be able to ingest the metadata, but not the `Profiler & Data Quality`, you should grant `SELECT` permissions to the tables you are interested in for the `Profiler & Data Quality` features to work. 

```sql
-- If you are using a role and do not want to specify a specific table, but any
GRANT SELECT ANY TABLE TO new_role;

-- If you are not using a role, but directly giving permission to the user and do not want to specify a specific table, but any
GRANT SELECT ANY TABLE TO my_user;

-- if you are using role
GRANT SELECT ON ADMIN.EXAMPLE_TABLE TO new_role;

-- if you are not using role, but directly giving permission to the user
GRANT SELECT ON ADMIN.EXAMPLE_TABLE TO my_user;

-- if you are using role
GRANT SELECT ON {schema}.{table} TO new_role;

-- if you are not using role, but directly giving permission to the user
GRANT SELECT ON {schema}.{table} TO my_user;
```

You can find further information [here](https://docs.oracle.com/javadb/10.8.3.0/ref/rrefsqljgrant.html). Note that
there is no routine out of the box in Oracle to grant SELECT to a full schema.

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Oracle", 
    selectServicePath: "/images/v1.7/connectors/oracle/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/oracle/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/oracle/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}

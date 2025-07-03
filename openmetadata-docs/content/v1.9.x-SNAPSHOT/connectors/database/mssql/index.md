---
title: MSSQL Connector | OpenMetadata SQL Server Integration Guide
<<<<<<< HEAD
description: Connect Microsoft SQL Server to OpenMetadata with our comprehensive MSSQL connector guide. Easy setup, configuration steps, and metadata extraction.
=======
description: Connect your Microsoft SQL Server to OpenMetadata with our comprehensive MSSQL connector guide. Step-by-step setup, configuration, and metadata extraction.
>>>>>>> bd5955fca2 (Docs: SEO Description Updation (#22035))
slug: /connectors/database/mssql
---

{% connectorDetailsHeader
name="MSSQL"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Data Profiler", "Data Quality", "dbt", "Lineage", "Column-level Lineage", "Stored Procedures", "Sample Data", "Reverse Metadata (Collate Only)"]
unavailableFeatures=["Owners", "Tags", "SSIS packages"]
/ %}

In this section, we provide guides and references to use the MSSQL connector.

Configure and schedule MSSQL metadata and profiler workflows from the OpenMetadata UI:

- [Remote-Connection](#for-remote-connection)
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Query Usage](/connectors/ingestion/workflows/usage)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [Lineage](/connectors/ingestion/lineage)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Troubleshooting](/connectors/database/mssql/troubleshooting)
{% collateContent %}
- [Reverse Metadata](#reverse-metadata)
{% /collateContent %}

{% partial file="/v1.9/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/mssql/yaml"} /%}

## Requirements

MSSQL User must grant `SELECT` privilege to fetch the metadata of tables and views.

```sql
-- Create a new user
-- More details https://learn.microsoft.com/en-us/sql/t-sql/statements/create-user-transact-sql?view=sql-server-ver16
CREATE USER Mary WITH PASSWORD = '********';
-- Grant SELECT on table
GRANT SELECT TO Mary;
```

### Usage & Lineage consideration

To perform the query analysis for Usage and Lineage computation, we fetch the query logs from `sys.dm_exec_cached_plans`, `sys.dm_exec_query_stats` &  `sys.dm_exec_sql_text` system tables. To access these tables your user must have `VIEW SERVER STATE` privilege.

```sql
GRANT VIEW SERVER STATE TO YourUser;
```

### For Remote Connection

#### 1. SQL Server running

Make sure the SQL server that you are trying to connect is in running state.

#### 2. Allow remote connection on MSSMS(Microsoft SQL Server Management Studio)

This step allow the sql server to accept remote connection request.

{% image
src="/images/v1.9/connectors/mssql/remote-connection.png"
alt="Remote Connection"
caption="Rm"
/%}

#### 3. Configure Windows Firewall 

If you are using SQL server on windows, you must configure the firewall on the computer running SQL Server to allow access.

**Step 1**: On the Start menu, select Run, type WF.msc, and then select OK.

**Step 2**: In the Windows Firewall with Advanced Security, in the left pane, right-click Inbound Rules, and then select New Rule in the action pane.

**Step 3**: In the Rule Type dialog box, select Port, and then select Next.

**Step 4**: In the Protocol and Ports dialog box, select TCP. Select Specific local ports, and then type the port number of the instance of the Database Engine, such as 1433 for the default instance. Select Next.

**Step 5**: In the Action dialog box, select Allow the connection, and then select Next.

**Step 6**: In the Profile dialog box, select any profiles that describe the computer connection environment when you want to connect to the Database Engine, and then select Next.

**Step 7**: In the Name dialog box, type a name and description for this rule, and then select Finish.

For details step please refer to this [link](https://docs.microsoft.com/en-us/sql/database-engine/configure-windows/configure-a-windows-firewall-for-database-engine-access?view=sql-server-ver15).


## Metadata Ingestion

{% partial 
  file="/v1.9/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "MSSQL", 
    selectServicePath: "/images/v1.9/connectors/mssql/select-service.png",
    addNewServicePath: "/images/v1.9/connectors/mssql/add-new-service.png",
    serviceConnectionPath: "/images/v1.9/connectors/mssql/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Connection Scheme**: Defines how to connect to MSSQL. We support `mssql+pytds`, `mssql+pyodbc`, and `mssql+pymssql`. (If you are using windows authentication from a linux deployment please use pymssql)
- **Username**: Specify the User to connect to MSSQL. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to MSSQL.
- **Host and Port**: Enter the fully qualified hostname and port number for your MSSQL deployment in the Host and Port field.
- **URI String**: In case of a `pyodbc` connection.
- **Database**: The initial database to establish a connection to the data source.
- **Ingest All Databases**: If you need to ingest multiple databases - aside from the initial one above - you can enable this option.

{% partial file="/v1.9/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.9/connectors/test-connection.md" /%}

{% partial file="/v1.9/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.9/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% collateContent %}
{% partial file="/v1.9/connectors/database/mssql/reverse-metadata.md" /%}
{% /collateContent %}

{% partial file="/v1.9/connectors/database/related.md" /%}

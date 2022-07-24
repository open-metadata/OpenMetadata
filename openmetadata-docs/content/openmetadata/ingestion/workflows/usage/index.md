---
title: Usage Workflow
slug: /openmetadata/ingestion/workflows/usage
---

# Usage Workflow
Learn how to configure the Usage workflow from the UI to ingest Query history and Lineage data from your data sources.

This workflow is available ONLY for the following connectors:
- [BigQuery](/openmetadata/connectors/database/bigquery)
- [Snowflake](/openmetadata/connectors/database/snowflake)
- [MSSQL](/openmetadata/connectors/database/mssql)
- [Redshift](/openmetadata/connectors/database/redshift)
- [Clickhouse](/openmetadata/connectors/database/clickhouse)

## UI Configuration

Once the metadata ingestion runs correctly and we are able to explore the service Entities, we can add Query Usage and Entity Lineage information.

This will populate the Queries and Lineage tab from the Table Entity Page.

<Image src="/images/openmetadata/ingestion/workflows/usage/table-entity-page.png" alt="table-entity-page" caption="Table Entity Page"/>

We can create a workflow that will obtain the query log and table creation information from the underlying database and feed it to OpenMetadata. The Usage Ingestion will be in charge of obtaining this data.

### 1. Add a Usage Ingestion

From the Service Page, go to the Ingestions tab to add a new ingestion and click on Add Usage Ingestion.

<Image src="/images/openmetadata/ingestion/workflows/usage/add-ingestion.png" alt="add-ingestion" caption="Add Ingestion"/>

### 2. Configure the Usage Ingestion

Here you can enter the Usage Ingestion details:

<Image src="/images/openmetadata/ingestion/workflows/usage/configure-usage-ingestion.png" alt="configure-usage-ingestion" caption="Configure the Usage Ingestion"/>

<Collapse title="Usage Options">

**Query Log Duration**

Specify the duration in days for which the profiler should capture usage data from the query logs. For example, if you specify 2 as the value for the duration, the data profiler will capture usage information for 48 hours prior to when the ingestion workflow is run.

**Stage File Location**

Mention the absolute file path of the temporary file name to store the query logs before processing.

**Result Limit**

Set the limit for the query log results to be run at a time.
</Collapse>

### 3. Schedule and Deploy
After clicking Next, you will be redirected to the Scheduling form. This will be the same as the Metadata Ingestion. Select your desired schedule and click on Deploy to find the usage pipeline being added to the Service Ingestions.

<Image src="/images/openmetadata/ingestion/workflows/usage/scheule-and-deploy.png" alt="schedule-and-deploy" caption="View Service Ingestion pipelines"/>
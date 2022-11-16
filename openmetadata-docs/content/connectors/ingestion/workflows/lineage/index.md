---
title: Lineage Workflow
slug: /connectors/ingestion/workflows/lineage
---

# Lineage Workflow
Learn how to configure the Lineage workflow from the UI to ingest Lineage data from your data sources.

This workflow is available ONLY for the following connectors:
- [BigQuery](/connectors/database/bigquery)
- [Snowflake](/connectors/database/snowflake)
- [MSSQL](/connectors/database/mssql)
- [Redshift](/connectors/database/redshift)
- [Clickhouse](/connectors/database/clickhouse)
- [Postgres](/connectors/database/postgres)
- [Databricks](/connectors/database/databricks)

If your database service is not yet supported, you can use this same workflow by providing a Query Log file!

Learn how to do so 👇

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    bold="Lineage Workflow through Query Logs"
    icon="add_moderator"
    href="/connectors/ingestion/workflows/lineage/lineage-workflow-query-logs"
  >
    Configure the lineage workflow by providing a Query Log file.
  </InlineCallout>
</InlineCalloutContainer>

## UI Configuration

Once the metadata ingestion runs correctly and we are able to explore the service Entities, we can add Entity Lineage information.

This will populate the Lineage tab from the Table Entity Page.

<Image src="/images/openmetadata/ingestion/workflows/lineage/table-entity-page.png" alt="table-entity-page" caption="Table Entity Page"/>

We can create a workflow that will obtain the query log and table creation information from the underlying database and feed it to OpenMetadata. The Lineage Ingestion will be in charge of obtaining this data.

### 1. Add a Lineage Ingestion

From the Service Page, go to the Ingestions tab to add a new ingestion and click on Add Lineage Ingestion.

<Image src="/images/openmetadata/ingestion/workflows/lineage/add-ingestion.png" alt="add-ingestion" caption="Add Ingestion"/>

### 2. Configure the Lineage Ingestion

Here you can enter the Lineage Ingestion details:

<Image src="/images/openmetadata/ingestion/workflows/lineage/configure-lineage-ingestion.png" alt="configure-lineage-ingestion" caption="Configure the Lineage Ingestion"/>

<Collapse title="Lineage Options">

**Query Log Duration**

Specify the duration in days for which the profiler should capture lineage data from the query logs. For example, if you specify 2 as the value for the duration, the data profiler will capture lineage information for 48 hours prior to when the ingestion workflow is run.

**Result Limit**

Set the limit for the query log results to be run at a time.
</Collapse>

### 3. Schedule and Deploy
After clicking Next, you will be redirected to the Scheduling form. This will be the same as the Metadata Ingestion. Select your desired schedule and click on Deploy to find the lineage pipeline being added to the Service Ingestions.

<Image src="/images/openmetadata/ingestion/workflows/lineage/scheule-and-deploy.png" alt="schedule-and-deploy" caption="View Service Ingestion pipelines"/>
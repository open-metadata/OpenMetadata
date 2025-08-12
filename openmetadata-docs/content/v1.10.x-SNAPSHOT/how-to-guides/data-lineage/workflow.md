---
title: How to Deploy a Lineage Workflow
description: Build data lineage using workflows to extract upstream and downstream dependencies.
slug: /how-to-guides/data-lineage/workflow
---

# How to Deploy a Lineage Workflow

Lineage data can be ingested from your data sources right from the OpenMetadata UI. Currently, the lineage workflow is supported for a limited set of connectors, like [BigQuery](/connectors/database/bigquery), [Snowflake](/connectors/database/snowflake), [MSSQL](/connectors/database/mssql), [Redshift](/connectors/database/redshift), [Clickhouse](/connectors/database/clickhouse), [PostgreSQL](/connectors/database/postgres), [Databricks](/connectors/database/databricks).

{% note noteType="Tip" %} **Tip:** Trace the upstream and downstream dependencies with Lineage. {% /note %}

## View Lineage from Metadata Ingestion
Once the metadata ingestion runs correctly, and we are able to explore the service Entities, we can add the view lineage information for the data assets. This will populate the Lineage tab in the data asset page. During the Metadata Ingestion workflow we differentiate if a Table is a View. For those sources, where we can obtain the query that generates the View, we bring in the view lineage along with the metadata. After all Tables have been ingested in the workflow, it's time to parse all the queries generating Views. During the query parsing, we will obtain the source and target tables, search if the Tables exist in OpenMetadata, and finally create the lineage relationship between the involved Entities.

If the database has views, then the view lineage would be generated automatically, along with the column-level lineage. In such a case, the table type is **View** as shown in the example below.
 {% image
 src="/images/v1.10/how-to-guides/lineage/view.png"
 alt="View Lineage through Metadata Ingestion"
 caption="View Lineage through Metadata Ingestion"
 /%}

## Lineage Agent from UI
Apart from the Metadata ingestion, we can create a workflow that will obtain the query log and table creation information from the underlying database and feed it to OpenMetadata. The Lineage Agent will be in charge of obtaining this data. The metadata ingestion will only bring in the View lineage queries, whereas the Lineage Agent workflow will be bring in all those queries that can be used to generate lineage information.

### 1. Add a Lineage Agent

Navigate to **Settings >> Services >> Databases**. Select the required service
 {% image
 src="/images/v1.10/how-to-guides/lineage/wkf1.png"
 alt="Select a Service"
 caption="Select a Service"
 /%}

 {% image
 src="/images/v1.10/how-to-guides/lineage/wkf1.1.png"
 alt="Click on Databases"
 caption="Click on Databases"
 /%}

 {% image
 src="/images/v1.10/how-to-guides/lineage/wkf1.2.png"
 alt="Select the Database"
 caption="Select the Database"
 /%}

Go the the **Ingestions** tab. Click on **Add Ingestion** and select **Add Lineage Agent**.
 {% image
 src="/images/v1.10/how-to-guides/lineage/wkf2.png"
 alt="Add a Lineage Agent"
 caption="Add a Lineage Agent"
 /%}

### 2. Configure the Lineage Agent

Here you can enter the Lineage Agent details:
 {% image
 src="/images/v1.10/how-to-guides/lineage/wkf3.png"
 alt="Configure the Lineage Agent"
 caption="Configure the Lineage Agent"
 /%}

### Lineage Options

**Query Log Duration:** Specify the duration in days for which the profiler should capture lineage data from the query logs. For example, if you specify 2 as the value for the duration, the data profiler will capture lineage information for 2 **days** or 48 hours prior to when the ingestion workflow is run.

**Parsing Timeout Limit:** Specify the timeout limit for parsing the sql queries to perform the lineage analysis. This must be specified in **seconds**.

**Result Limit:** Set the limit for the query log results to be run at a time. This is the **number of rows**.

**Filter Condition:** We execute a query on query history table of the respective data source to perform the query analysis and extract the lineage and usage information. This field will be useful when you want to restrict some queries from being part of this analysis. In this field you can specify a sql condition that will be applied on the query history result set. You can check more about [Usage Query Filtering here](/connectors/ingestion/workflows/usage/filter-query-set).

### 3. Schedule and Deploy

After clicking Next, you will be redirected to the Scheduling form. This will be the same as the Metadata Ingestion. Select your desired schedule and click on Deploy to find the lineage pipeline being added to the Service Ingestions.
 {% image
 src="/images/v1.10/how-to-guides/lineage/wkf4.png"
 alt="Schedule and Deploy the Lineage Agent"
 caption="Schedule and Deploy the Lineage Agent"
 /%}

## Run Lineage Workflow Externally

{% partial file="/v1.10/connectors/yaml/lineage.md" variables={connector: "bigquery"} /%}

## dbt Ingestion

We can also generate lineage through [dbt ingestion](/connectors/ingestion/workflows/dbt/configure-dbt-workflow-from-ui). The dbt workflow can fetch queries that carry lineage information. For a dbt ingestion pipeline, the path to the Catalog and Manifest files must be specified. We also fetch the column level lineage through dbt.

You can learn more about [lineage ingestion here](/connectors/ingestion/lineage).

## Query Logs using CSV File

Lineage ingestion is supported for a few connectors as mentioned earlier. For the unsupported connectors, you can set up [Lineage Workflows using Query Logs](/connectors/ingestion/workflows/lineage/lineage-workflow-query-logs) using a CSV file.

## Manual Lineage

Lineage can also be added and edited manually in OpenMetadata. Refer for more information on [adding lineage manually](/how-to-guides/data-lineage/manual).

{%inlineCallout
  color="violet-70"
  bold="Explore the Lineage View"
  icon="MdArrowForward"
  href="/how-to-guides/data-lineage/explore"%}
  Explore the rich lineage view in OpenMetadata.
{%/inlineCallout%}

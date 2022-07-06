---
description: >-
  Learn how to configure the Usage workflow from the UI to ingest Query history
  and Lineage data from your data sources.
---

# Usage Workflow

This workflow is available ONLY for the following connectors:

* [BigQuery](../integrations/connectors/bigquery/)
* [Snowflake](../integrations/connectors/snowflake/)
* [MSSQL](broken-reference)
* [Redshift](../integrations/connectors/redshift/)
* [Clickhouse](../docs/data-lineage/broken-reference/)

## UI Configuration

Once the metadata ingestion runs correctly and we are able to explore the service Entities, we can add Query Usage and Entity Lineage information.

This will populate the _Queries_ and _Lineage_ tab from the Table Entity Page.

![Table Entity Page](<../.gitbook/assets/image (1) (1) (1).png>)

We can create a workflow that will obtain the query log and table creation information from the underlying database and feed it to OpenMetadata. The Usage Ingestion will be in charge of obtaining this data.

### 1. Add a Usage Ingestion

From the Service Page, go to the _Ingestions_ tab to add a new ingestion and click on _Add Usage Ingestion_.

![Add Ingestion](<../.gitbook/assets/image (9) (2) (1).png>)

### 2. Configure the Usage Ingestion

Here you can enter the Usage Ingestion details:

![Configure the Usage Ingestion](<../.gitbook/assets/image (252).png>)

<details>

<summary>Usage Options</summary>

**Query Log Duration**

Specify the duration in days for which the profiler should capture usage data from the query logs. For example, if you specify 2 as the value for the duration, the data profiler will capture usage information for 48 hours prior to when the ingestion workflow is run.

**Stage File Location**

Mention the absolute file path of the temporary file name to store the query logs before processing.

**Result Limit**

Set the limit for the query log results to be run at a time.

</details>

### 3. Schedule and Deploy

After clicking _Next_, you will be redirected to the Scheduling form. This will be the same as the Metadata Ingestion. Select your desired schedule and click on Deploy to find the usage pipeline being added to the Service Ingestions.

![View Service Ingestion pipelines](<../.gitbook/assets/image (255).png>)

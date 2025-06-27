---
title: Lineage Workflow | OpenMetadata Data Lineage Guide
description: Discover how to set up data lineage workflows in OpenMetadata. Learn to track data flow, configure connectors, and visualize dependencies across your data pipeline.
slug: /connectors/ingestion/workflows/lineage
---

# Lineage Workflow

Learn how to configure the Lineage workflow from the UI to ingest Lineage data from your data sources.

{% note %}

Checkout the documentation of the connector you are using to know if it supports automated lineage workflow.

{% \note %}

If your database service is not yet supported, you can use this same workflow by providing a Query Log file!

Learn how to do so 👇

{%inlineCalloutContainer%}

{%inlineCallout
  bold="Lineage Workflow through Query Logs"
  icon="add_moderator"
  href="/connectors/ingestion/workflows/lineage/lineage-workflow-query-logs"%}
Configure the lineage workflow by providing a Query Log file.
{%/inlineCallout%}

{%/inlineCalloutContainer%}

## UI Configuration

Once the metadata ingestion runs correctly and we are able to explore the service Entities, we can add Entity Lineage information.

This will populate the Lineage tab from the Table Entity Page.

{% image
  src="/images/v1.9/features/ingestion/workflows/lineage/table-entity-page.png"
  alt="table-entity-page"
  caption="Table Entity Page"
 /%}


We can create a workflow that will obtain the query log and table creation information from the underlying database and feed it to OpenMetadata. The Lineage Ingestion will be in charge of obtaining this data.

### 1. Add a Lineage Ingestion

From the Service Page, go to the Ingestions tab to add a new ingestion and click on Add Lineage Ingestion.

{% image
  src="/images/v1.9/features/ingestion/workflows/lineage/add-ingestion.png"
  alt="add-ingestion"
  caption="Add Ingestion"
 /%}

### 2. Configure the Lineage Ingestion

Here you can enter the Lineage Ingestion details:

{% image
  src="/images/v1.9/features/ingestion/workflows/lineage/configure-lineage-ingestion.png"
  alt="configure-lineage-ingestion"
  caption="Configure the Lineage Ingestion"
 /%}

### Lineage Options

**Query Log Duration**

Specify the duration in days for which the lineage should capture lineage data from the query logs. For example, if you specify 2 as the value for the duration, the data lineage will capture lineage information for 48 hours prior to when the ingestion workflow is run.

**Result Limit**

Set the limit for the query log results to be run at a time.


### 3. Schedule and Deploy

After clicking Next, you will be redirected to the Scheduling form. This will be the same as the Metadata Ingestion. Select your desired schedule and click on Deploy to find the lineage pipeline being added to the Service Ingestions.

{% image
  src="/images/v1.9/features/ingestion/workflows/lineage/scheule-and-deploy.png"
  alt="schedule-and-deploy"
  caption="View Service Ingestion pipelines"
 /%}

## YAML Configuration

In the [connectors](/connectors) section we showcase how to run the metadata ingestion from a JSON/YAML file using the Airflow SDK or the CLI via metadata ingest. Running a lineage workflow is also possible using a JSON/YAML configuration file.

This is a good option if you wish to execute your workflow via the Airflow SDK or using the CLI; if you use the CLI a lineage workflow can be triggered with the command `metadata ingest -c FILENAME.yaml`. The `serviceConnection` config will be specific to your connector (you can find more information in the [connectors](/connectors) section), though the sourceConfig for the lineage will be similar across all connectors.

{% partial file="/v1.9/connectors/yaml/lineage.md" variables={connector: "bigquery"} /%}

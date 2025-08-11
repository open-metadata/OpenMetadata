---
title: Metadata Ingestion Best Practices
description: Discover OpenMetadata data ingestion best practices to optimize your metadata collection, improve performance, and ensure reliable data connectivity.
slug: /connectors/ingestion/best-practices
---

# Best Practices for Metadata Ingestion

In this section we are going to present some guidelines that can be useful when preparing metadata ingestion both
from the UI or via any custom orchestration system.

{% note %}
We will use the generic terms from Airflow, as the most common used tool, but the underlying ideas can be applied anywhere.
{% /note %}

## Generic Practices

- **DAGs should not have any retry**: If the workflow is marked as failed due to any error (unexpected exception,
    connectivity issues, individual assets’ errors,...) there is usually no point on running automatic retries. For 
    heavy workflows failing in the middle of processing, it will just incur in extra costs. 
    
    Note that for internal communications between the Ingestion Workflow and the OpenMetadata APIs, we already have an 
    internal retry in place in case of intermittent networking issues.
- **DAGs should not have a catch-up**: Any ingestion will be based on the current state of data and metadata. If old 
    runs were skipped for any reason, there is no point in triggering past executions as they won’t be adding any value.
    Just the single, most recent run will already be providing all the information available.
- **Be mindful of enabled DEBUG logs**: When configuring the ingestion YAML you have the option to control the logging 
    level. Keeping it as INFO (default) is the usual best bet. Only use DEBUG logs when testing out ingestion for the first time
- **Test the ingestions using the CLI if you will be building a DAG**: When preparing the first ingestion processes, 
    it is ok to try different configurations (debug logs, enable views, filtering of assets,...). The fastest and 
    easiest way to test the ingestion process that will end up on a DAG is using the CLI (example). Playing with the 
    CLI will help you find the right YAML configuration fast. Note that for OpenMetadata, the process that gets
    triggered from the CLI, is the same as the one that will eventually run in your DAGs. If you have the possibility to 
    test the CLI first, it will give you fast feedback and will help you isolate your tests.

## Metadata Ingestion
- **Apply the right filters**: For example, there is usually no business-related information on schemas such as 
    `INFORMATION_SCHEMA`. You can use OpenMetadata filtering logic on databases, services and tables to opt in/out specific assets.

## Profiler Ingestion
- **On filters, scheduling and asset importance**: While OpenMetadata provides sampling and multi-threading, profiling
   can be a costly and time-consuming process. Then it is important to know which data assets are business critical.
  - **Deploy multiple profiler ingestions for the same service**: For a given service, prepare different ingestion
      pipelines, each of them attacking a specific set of assets based on input filters. You can then schedule more 
      important assets to be profiled more often, while keeping the rest of profiles to be executed either on demand, or with lower cadence.
- **Apply the right sampling**: Important tables can hold higher sampling, while the rest of assets might be good enough with smaller %.

## Usage & Lineage Ingestion
- **Schedule and log duration should match**: The Log Duration configuration parameter specifies how many days in the 
    past we are going to look for query history data. If we schedule the workflows to run daily, there is no need to
    look for the past week, as we will be re-analysing data that won’t change.


# OpenMetadata Ingestion Troubleshooting

Here we will discuss different errors that you might encounter when running a workflow:

- **Connection errors**: When deploying ingestions from the OpenMetadata UI you have the possibility to test the 
    connection when configuring the service. This connection test happens at the Airflow host configured with OpenMetadata.
    If instead, you are running your ingestion workflows from any external system, you’ll need to validate that the host
    where the ingestion runs has the proper network settings to reach both the source system and OpenMetadata.
- **Processing Errors**: During the workflow process you might see logs like `Cannot ingest X due to Y` or similar statements.
    They appear for specific assets being ingested, and the origin can be different:
  - Missing permissions on a specific table or tag (e.g., due to BigQuery policies),
  - Internal errors when processing specific assets or translating them to the OpenMetadata standard. 
  In these cases, you can reach out to the OpenMetadata team. The workflow itself will continue, and the OpenMetadata
  team can help analyse the root cause and provide a fix.
- **Workflow breaking exceptions**: In rare circumstances there can be exceptions that break the overall workflow processing.
    The goal of the Ingestion Framework is to be as robust as possible and continue even for specific assets failures 
    (see point above). If there is a scenario not contemplated by the current code, the OpenMetadata team will apply the 
    highest priority to fix the issue and allow the workflow to run end to end.

---
title: Metadata Ingestion - Incremental Extraction
slug: /connectors/ingestion/workflows/metadata/incremental-extraction
---

# Metadata Ingestion - Incremental Extraction

The default Metadata Ingestion roughly follows these steps:

1. Fetch all the information from the Source.
2. Compare the information with the OpenMetadata information to update it properly.
3. Compare the information with the OpenMetadata information to delete entities that were deleted.

While on one hand this is a great simple way of doing things that works for most use cases since at every ingestion pipeline run we get the whole Source state, on other hand this is fetching and comparing a lot of data without need since if there were no structural changes we already know there is nothing to update on OpenMetadata.

We implemented the Incremental Extraction feature to improve the performance by diminishing the extraction and comparison of uneeded data.

How this is done depends a lot on the Source itself, but the general idea is to follow these steps:

1. Fetch the last successful pipeline run.
2. Add a small safety margin.
3. Get all the structural changes since then.
4. Flag deleted entities.
5. Fetch/Compare only the entities with structural changes.
6. Delete entities flagged for deletion.


## Feature available for

### Databases

{% connectorsListContainer %}

{% connectorInfoCard name="BigQuery" stage="BETA" href="/connectors/ingestion/workflows/metadata/incremental-extraction/bigquery" platform="OpenMetadata" / %}
{% connectorInfoCard name="Redshift" stage="BETA" href="/connectors/ingestion/workflows/metadata/incremental-extraction/redshift" platform="OpenMetadata" / %}
{% connectorInfoCard name="Snowflake" stage="BETA" href="/connectors/ingestion/workflows/metadata/incremental-extraction/snowflake" platform="OpenMetadata" / %}

{% /connectorsListContainer %}

<!-- [**BigQuery**](/connectors/ingestion/workflows/metadata/incremental-extraction/bigquery) -->
<!-- [**Redshift**](/connectors/ingestion/workflows/metadata/incremental-extraction/redshift) -->
<!-- [**Snowflake**](/connectors/ingestion/workflows/metadata/incremental-extraction/snowflake) -->

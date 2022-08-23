---
title: Lineage Ingestion
slug: /openmetadata/ingestion/lineage
---

# Lineage Ingestion

A large subset of connectors distributed with OpenMetadata include support for lineage ingestion. Lineage ingestion processes 
queries to determine upstream and downstream entities for data assets. Lineage is published to the OpenMetadata catalog when metadata is ingested.

Using the OpenMetadata user interface and API, you may trace the path of data across Tables, Pipelines, and Dashboards.

![gif](/images/openmetadata/ingestion/lineage/lineage-ingestion.gif)

Lineage ingestion is specific to the type of the Entity that we are processing. We are going to explain
the ingestion process for the supported services.

## Database Services

Here we have 3 lineage sources, divided in different workflows, but mostly built around a **Query Parser**.

### View Lineage

During the Metadata Ingestion workflow we differentiate if a Table is a View. For those sources where we can
obtain the query that generates the View (e.g., Snowflake allows us to pick up the View query from the DDL).

After all Tables have been ingested in the workflow, it's time to [parse](https://sqllineage.readthedocs.io/en/latest/) 
all the queries generating Views. During the query parsing, we will obtain the source and target tables, search if the
Tables exist in OpenMetadata, and finally create the lineage relationship between the involved Entities.

Let's go over this process with an example. Suppose have the following DDL:

```sql
CREATE OR REPLACE VIEW schema.my_view
AS SELECT ... FROM schema.table_a JOIN another_schema.table_b;
```

![queyr-parser](/images/openmetadata/ingestion/lineage/query-parser.png)

### DBT

### Query Log

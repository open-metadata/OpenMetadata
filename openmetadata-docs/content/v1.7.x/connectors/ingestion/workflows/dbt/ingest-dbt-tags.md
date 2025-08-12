---
title: Ingest Tags from dbt | OpenMetadata Metadata Tagging Guide
description: Ingest dbt tags to enhance metadata with labels that support classification, governance, and searchability.
slug: /connectors/ingestion/workflows/dbt/ingest-dbt-tags
---

# Ingest Tags from dbt

Ingest the table-level tags from `manifest.json` and column-level tags from `catalog.json` file

Follow the link [here](https://docs.getdbt.com/reference/resource-configs/tags) to add the tags to your dbt project.

## Requirements

{% note %}

For dbt tags, if the tag is not already present it will be created under tag category `DBTTags` in OpenMetadata

{% /note %}

### 1. Table-Level Tags information in manifest.json file
Openmetadata fetches the table-level tags information from the `manifest.json` file. Below is a sample `manifest.json` file node containing tags information under `node_name->tags`.

```json
"model.jaffle_shop.customers": {
  "raw_sql": "sample_raw_sql",
  "compiled": true,
  "resource_type": "model",
  "depends_on": {},
  "database": "dev",
  "schema": "dbt_jaffle",
  "tags": [
    "model_tag_one",
    "model_tag_two"
  ],
}
```



### 2. Column-Level Tags information in manifest.json file
Openmetadata fetches the column-level tags information from the `manifest.json` file. Below is a sample `manifest.json` file node containing tags information under `node_name->columns->column_name->tags`.

```json
    "model.jaffle_shop.customers": {
      "database": "dev",
      "schema": "dbt_jaffle",
      "unique_id": "model.jaffle_shop.customers",
      "name": "customers",
      "alias": "customers",
      "columns": {
        "first_order": {
          "name": "first_order",
          "description": "Date (UTC) of a customer's first order",
          "meta": {},
          "data_type": null,
          "quote": null,
          "tags": [
            "tags_column_one"
          ]
        },
      },
    },
```

### 3. Viewing the tags on tables and columns
Table and Column level tags ingested from dbt can be viewed on the node in OpenMetadata

{% image
  src="/images/v1.7/features/ingestion/workflows/dbt/dbt-features/dbt-tags.png"
  alt="dbt_tags"
  caption="dbt tags"
 /%}

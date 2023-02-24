---
title: Ingest Lineage from dbt
slug: /connectors/ingestion/workflows/dbt/ingest-dbt-lineage
---

# Ingest Lineage from dbt

Ingest the lineage information from dbt `manifest.json` file into OpenMetadata.

OpenMetadata exctracts the lineage information from the `depends_on` and `compiled_query/compiled_code` keys from the manifest file.

### 1. Lineage information from dbt "depends_on" key
Openmetadata fetches the lineage information from the `manifest.json` file. Below is a sample `manifest.json` file node containing lineage information under `node_name->depends_on->nodes`.

```json
"model.jaffle_shop.customers": {
  "compiled": true,
  "resource_type": "model",
  "depends_on": {
      "macros": [],
      "nodes": [
          "model.jaffle_shop.stg_customers",
          "model.jaffle_shop.stg_orders",
          "model.jaffle_shop.stg_payments"
      ]
  }
}
```

For the above case the lineage will be created as shown in below:
<Image src="/images/openmetadata/ingestion/workflows/dbt/dbt-lineage-customers.webp" alt="dbt-lineage-customers" caption="dbt Lineage"/>

### 2. Lineage information from dbt queries
Openmetadata fetches the dbt query information from the `manifest.json` file. 

Below is a sample `manifest.json` file node containing dbt query information under `node_name->compiled_code` or `node_name->compiled_sql`. 

```json
"model.jaffle_shop.customers": {
  "compiled": true,
  "resource_type": "model",
  "compiled_code": "Query for the model"
}
```

The query from dbt will be parsed by the Lineage parser to extract source and target tables to create the lineage.

The lineage may not be created if the lineage parser is not able to parse the query. Please check the logs for any errors in this case.

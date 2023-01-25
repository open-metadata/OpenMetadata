---
title: dbt Troubleshooting
slug: /connectors/ingestion/workflows/dbt/dbt-troubleshooting
---

# Troubleshooting

### 1. dbt tab not displaying in the UI

After the dbt workflow is finished, check the logs to see if the dbt files were successfuly validated or not. Any missing keys in the manifest.json or catalog.json files will displayed in the logs and those keys are needed to be added.

The dbt workflow requires the below keys to be present in the node of a manifest.json file:
- resource_type (compulsory)
- alias/name (any one of them compulsory)
- schema (compulsory)
- database (compulsory)
- description (required if description needs to be updated)
- compiled_code/compiled_sql (required if the dbt model query is to be shown in dbt tab and for query lineage)
- depends_on (required if lineage information needs to exctracted)
- columns (required if column description is to be processed)

<Note>

The `name/alias, schema and database` values from dbt manifest.json should match values of the `name, schema and database` of the table/view ingested in OpenMetadata.

dbt will only be processed if these values match

</Note>

Below is a sample manifest.json node for reference:
```json
"model.jaffle_shop.customers": {
    "resource_type": "model",
    "depends_on": {
        "nodes": [
            "model.jaffle_shop.stg_customers",
            "model.jaffle_shop.stg_orders",
            "model.jaffle_shop.stg_payments"
        ]
    },
    "database": "dev",
    "schema": "dbt_jaffle",
    "name": "customers",
    "alias": "customers",
    "description": "sample description",
    "columns": {
        "customer_id": {
            "name": "customer_id",
            "description": "This is a unique identifier for a customer",
            "meta": {},
            "data_type": null,
            "quote": null,
            "tags": []
        },
        "first_name": {
            "name": "first_name",
            "description": "Customer's first name. PII.",
            "meta": {},
            "data_type": null,
            "quote": null,
            "tags": []
        }
    },
    "compiled_code": "sample query",
}
```

### 2. Lineage not getting displayed from dbt
Follow to docs [here](/connectors/ingestion/workflows/dbt/ingest-dbt-lineage) to see if necessary details are present in the manifest.json file.

Search for the following string `Processing DBT lineage for` in the dbt workflow logs and see if any errors are causing the lineage creation to fail.


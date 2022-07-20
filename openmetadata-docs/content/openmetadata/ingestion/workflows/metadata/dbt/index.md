---
title: DBT Integration
slug: /openmetadata/ingestion/workflows/metadata/dbt
---

# DBT Integration

### What is DBT?

A DBT model provides transformation logic that creates a table from raw data.

DBT (data build tool) enables analytics engineers to transform data in their warehouses by simply writing select statements. DBT handles turning these select statements into tables [tables](https://docs.getdbt.com/terms/table) and [views](https://docs.getdbt.com/terms/view).

DBT does the T in [ELT](https://docs.getdbt.com/terms/elt) (Extract, Load, Transform) processes – it doesn’t extract or load data, but it’s extremely good at transforming data that’s already loaded into your warehouse.

For information regarding setting up a DBT project and creating models please refer to the official DBT documentation [here](https://docs.getdbt.com/docs/introduction).

### DBT Integration in Openmetadata

OpenMetadata includes an integration for DBT that enables you to see what models are being used to generate tables.

Openmetadata parses the [manifest](https://docs.getdbt.com/reference/artifacts/manifest-json) and [catalog](https://docs.getdbt.com/reference/artifacts/catalog-json) json files and shows the queries from which the models are being generated.

Metadata regarding the tables and views generated via DBT is also ingested and can be seen.

![gif](/images/openmetadata/ingestion/workflows/metadata/dbt-integration.gif)
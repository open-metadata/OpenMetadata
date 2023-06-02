---
title: Ingest Descriptions from dbt
slug: /connectors/ingestion/workflows/dbt/ingest-dbt-descriptions
---

# Ingest Descriptions from dbt

Ingest the descriptions from dbt `manifest.json` or `catalog.json` file into OpenMetadata tables and columns.

{% note %}
By default descriptions from `manifest.json` will be imported. Descriptions from `catalog.json` will only be updated if `catalog.json` file is passed.
{% /note %}


## Overriding the existing table and column descriptions

When the `Update Descriptions` toggle is enabled during the configuration of dbt ingestion, existing descriptions of tables and columns will be overwritten with the dbt descriptions.

If toggle is disabled during the configuration of dbt ingestion, dbt descriptions will only be updated for tables and columns in OpenMetadata that currently have no descriptions. Existing descriptions will remain unchanged and will not be overwritten with dbt descriptions.

{% image
  src="/images/v1.1.0-snapshot/features/ingestion/workflows/dbt/dbt-features/dbt-update-descriptions.png"
  alt="update-dbt-descriptions"
  caption="Update dbt Descriptions"
 /%}



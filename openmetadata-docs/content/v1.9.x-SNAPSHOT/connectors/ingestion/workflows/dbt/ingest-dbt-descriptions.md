---
title: Ingest Descriptions from dbt
slug: /connectors/ingestion/workflows/dbt/ingest-dbt-descriptions
---

# Ingest Descriptions from dbt

Ingest the descriptions from dbt `manifest.json` or `catalog.json` file into OpenMetadata tables and columns.

{% note %}
By default descriptions from `manifest.json` will be imported. Descriptions from `catalog.json` will only be updated if `catalog.json` file is passed.

If only the `manifest.json` file is passed, descriptions from the `manifest.json` will be updated.

If the `manifest.json` and `catalog.json` both are passed, descriptions from the `catalog.json` will be updated.
{% /note %}


## Overriding the existing table and column descriptions

To establish a unified and reliable system for descriptions, a single source of truth is necessary. It either is directly OpenMetadata, if individuals want to go there and keep updating, or if they prefer to keep it centralized in dbt, then we can always rely on that directly.

When the `Update Descriptions` toggle is enabled during the configuration of dbt ingestion, existing descriptions of tables and columns will be overwritten with the dbt descriptions.

If toggle is disabled during the configuration of dbt ingestion, dbt descriptions will only be updated for tables and columns in OpenMetadata that currently have no descriptions. Existing descriptions will remain unchanged and will not be overwritten with dbt descriptions.

{% image
  src="/images/v1.9/features/ingestion/workflows/dbt/dbt-features/dbt-update-descriptions.webp"
  alt="update-dbt-descriptions"
  caption="Update dbt Descriptions"
 /%}



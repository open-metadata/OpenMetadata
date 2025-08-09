---
title: dbtLocalConfig
slug: /main-concepts/metadata-standard/schemas/metadataingestion/dbtconfig/dbtlocalconfig
---

# DBT Local Config

*DBT Catalog, Manifest and Run Results file path config.*

## Properties

- **`dbtConfigType`** *(string)*: dbt Configuration type. Must be one of: `['local']`. Default: `local`.
- **`dbtCatalogFilePath`** *(string)*: DBT catalog file path to extract dbt models with their column schemas.
- **`dbtManifestFilePath`** *(string)*: DBT manifest file path to extract dbt models and associate with tables.
- **`dbtRunResultsFilePath`** *(string)*: DBT run results file path to extract the test results information.
- **`dbtSourcesFilePath`** *(string)*: DBT sources file path to extract the freshness test result.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.

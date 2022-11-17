---
title: dbtLocalConfig
slug: /main-concepts/metadata-standard/schemas/metadataingestion/dbtconfig/dbtlocalconfig
---

# DBT Local Config

*DBT Catalog, Manifest and Run Results file path config.*

## Properties

- **`dbtCatalogFilePath`** *(string)*: DBT catalog file path to extract dbt models with their column schemas.
- **`dbtManifestFilePath`** *(string)*: DBT manifest file path to extract dbt models and associate with tables.
- **`dbtRunResultsFilePath`** *(string)*: DBT run results file path to extract the test results information.
- **`dbtUpdateDescriptions`** *(boolean)*: Optional configuration to update the description from DBT or not. Default: `False`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.

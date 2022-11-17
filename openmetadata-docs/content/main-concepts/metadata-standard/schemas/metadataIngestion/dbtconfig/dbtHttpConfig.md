---
title: dbtHttpConfig
slug: /main-concepts/metadata-standard/schemas/metadataingestion/dbtconfig/dbthttpconfig
---

# DBT HTTP Config

*DBT Catalog, Manifest and Run Results HTTP path configuration.*

## Properties

- **`dbtCatalogHttpPath`** *(string)*: DBT catalog http file path to extract dbt models with their column schemas.
- **`dbtManifestHttpPath`** *(string)*: DBT manifest http file path to extract dbt models and associate with tables.
- **`dbtRunResultsHttpPath`** *(string)*: DBT run results http file path to extract the test results information.
- **`dbtUpdateDescriptions`** *(boolean)*: Optional configuration to update the description from DBT or not. Default: `False`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.

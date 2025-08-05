---
title: dbtHttpConfig | OpenMetadata dbt HTTP Config
description: Capture DBT HTTP configuration for ingesting DBT files from public or private HTTP sources.
slug: /main-concepts/metadata-standard/schemas/metadataingestion/dbtconfig/dbthttpconfig
---

# DBT HTTP Config

*DBT Catalog, Manifest and Run Results HTTP path configuration.*

## Properties

- **`dbtConfigType`** *(string)*: dbt Configuration type. Must be one of: `["http"]`. Default: `"http"`.
- **`dbtCatalogHttpPath`** *(string)*: DBT catalog http file path to extract dbt models with their column schemas.
- **`dbtManifestHttpPath`** *(string)*: DBT manifest http file path to extract dbt models and associate with tables.
- **`dbtRunResultsHttpPath`** *(string)*: DBT run results http file path to extract the test results information.
- **`dbtSourcesHttpPath`** *(string)*: DBT sources http file path to extract freshness test results information.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.

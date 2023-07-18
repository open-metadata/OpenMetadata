---
title: dashboardServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/dashboardservicemetadatapipeline
---

# DashboardServiceMetadataPipeline

*DashboardService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/dashboardMetadataConfigType*. Default: `DashboardMetadata`.
- **`dashboardFilterPattern`**: Regex to only fetch tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`dbServiceNames`** *(string)*: Database Service Name for creation of lineage.
## Definitions

- **`dashboardMetadataConfigType`** *(string)*: Dashboard Source Config Metadata Pipeline type. Must be one of: `['DashboardMetadata']`. Default: `DashboardMetadata`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.

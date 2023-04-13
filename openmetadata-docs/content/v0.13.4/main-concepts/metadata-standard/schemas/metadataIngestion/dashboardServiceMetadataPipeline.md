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
- **`dbServiceNames`** *(array)*: List of Database Service Name for creation of lineage.
- **`overrideOwner`** *(boolean)*: Enabling this flag will override current owner with new owner from the source,if that is fetched during metadata ingestion. Kindly make to keep it enabled, to get the owner, for first time metadata ingestion. Default: `false`.
- **`markDeletedDashboards`** *(boolean)*: Optional configuration to soft delete dashboards in OpenMetadata if the source dashboards are deleted. Also, if the dashboard is deleted, all the associated entities like lineage, etc., with that dashboard will be deleted. Default: `True`.
- **`includeTags`** *(boolean)*: Optional configuration to toggle the tags ingestion. Default: `True`.
## Definitions

- **`dashboardMetadataConfigType`** *(string)*: Dashboard Source Config Metadata Pipeline type. Must be one of: `['DashboardMetadata']`. Default: `DashboardMetadata`.


Documentation file automatically generated at 2023-04-13 23:17:03.893190.

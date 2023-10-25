---
title: dashboardServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/dashboardservicemetadatapipeline
---

# DashboardServiceMetadataPipeline

*DashboardService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/dashboardMetadataConfigType*. Default: `DashboardMetadata`.
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`dbServiceNames`** *(array)*: List of Database Service Names for creation of lineage.
- **`includeOwners`** *(boolean)*: Enabling a flag will replace the current owner with a new owner from the source during metadata ingestion, if the current owner is null. It is recommended to keep the flag enabled to obtain the owner information during the first metadata ingestion. Default: `false`.
- **`markDeletedDashboards`** *(boolean)*: Optional configuration to soft delete dashboards in OpenMetadata if the source dashboards are deleted. Also, if the dashboard is deleted, all the associated entities like lineage, etc., with that dashboard will be deleted. Default: `True`.
- **`includeTags`** *(boolean)*: Optional configuration to toggle the tags ingestion. Default: `True`.
- **`includeDataModels`** *(boolean)*: Optional configuration to toggle the ingestion of data models. Default: `True`.
## Definitions

- **`dashboardMetadataConfigType`** *(string)*: Dashboard Source Config Metadata Pipeline type. Must be one of: `['DashboardMetadata']`. Default: `DashboardMetadata`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.

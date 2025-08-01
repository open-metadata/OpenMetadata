---
title: dashboardServiceMetadataPipeline
description: Connect Dashboardservicemetadatapipeline to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations
slug: /main-concepts/metadata-standard/schemas/metadataingestion/dashboardservicemetadatapipeline
---

# DashboardServiceMetadataPipeline

*DashboardService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/dashboardMetadataConfigType](#definitions/dashboardMetadataConfigType)*. Default: `"DashboardMetadata"`.
- **`lineageInformation`** *(object)*: Details required to generate Lineage.
  - **`dbServicePrefixes`** *(array)*: List of Database Service Prefixes for creation of lineage.
    - **Items** *(string)*
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`projectFilterPattern`**: Regex to exclude or include projects that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`includeOwners`** *(boolean)*: Enabling a flag will replace the current owner with a new owner from the source during metadata ingestion, if the current owner is null. It is recommended to keep the flag enabled to obtain the owner information during the first metadata ingestion. Default: `false`.
- **`markDeletedDashboards`** *(boolean)*: Optional configuration to soft delete dashboards in OpenMetadata if the source dashboards are deleted. Also, if the dashboard is deleted, all the associated entities like lineage, etc., with that dashboard will be deleted. Default: `true`.
- **`markDeletedDataModels`** *(boolean)*: Optional configuration to soft delete data models in OpenMetadata if the source data models are deleted. Also, if the data models is deleted, all the associated entities like lineage, etc., with that data models will be deleted. Default: `true`.
- **`includeTags`** *(boolean)*: Optional configuration to toggle the tags ingestion. Default: `true`.
- **`includeDataModels`** *(boolean)*: Optional configuration to toggle the ingestion of data models. Default: `true`.
- **`includeDraftDashboard`** *(boolean)*: Optional Configuration to include/exclude draft dashboards. By default it will include draft dashboards. Default: `true`.
- **`overrideMetadata`** *(boolean)*: Set the 'Override Metadata' toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source. If the toggle is set to true, the metadata fetched from the source will override the existing metadata in the OpenMetadata server. If the toggle is set to false, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. This is applicable for fields like description, tags, owner and displayName. Default: `false`.
- **`overrideLineage`** *(boolean)*: Set the 'Override Lineage' toggle to control whether to override the existing lineage. Default: `false`.
## Definitions

- **`dashboardMetadataConfigType`** *(string)*: Dashboard Source Config Metadata Pipeline type. Must be one of: `["DashboardMetadata"]`. Default: `"DashboardMetadata"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.

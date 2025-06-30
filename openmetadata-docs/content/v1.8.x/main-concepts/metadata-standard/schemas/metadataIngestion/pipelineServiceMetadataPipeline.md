---
title: pipelineServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/pipelineservicemetadatapipeline
---

# PipelineServiceMetadataPipeline

*PipelineService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/pipelineMetadataConfigType](#definitions/pipelineMetadataConfigType)*. Default: `"PipelineMetadata"`.
- **`includeLineage`** *(boolean)*: Optional configuration to turn off fetching lineage from pipelines. Default: `true`.
- **`includeOwners`** *(boolean)*: Set the 'Include Owners' toggle to control whether to include owners to the ingested entity if the owner email matches with a user stored in the OM server as part of metadata ingestion. If the ingested entity already exists and has an owner, the owner will not be overwritten. Default: `true`.
- **`pipelineFilterPattern`**: Regex exclude pipelines. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`lineageInformation`** *(object)*: Details required to generate Lineage.
  - **`dbServiceNames`** *(array)*: List of Database Service Names for creation of lineage.
    - **Items** *(string)*
  - **`storageServiceNames`** *(array)*: List of Storage Service Names for creation of lineage.
    - **Items** *(string)*
- **`overrideLineage`** *(boolean)*: Set the 'Override Lineage' toggle to control whether to override the existing lineage. Default: `false`.
- **`markDeletedPipelines`** *(boolean)*: Optional configuration to soft delete Pipelines in OpenMetadata if the source Pipelines are deleted. Also, if the Pipeline is deleted, all the associated entities like lineage, etc., with that Pipeline will be deleted. Default: `true`.
- **`includeTags`** *(boolean)*: Optional configuration to toggle the tags ingestion. Default: `true`.
- **`includeUnDeployedPipelines`** *(boolean)*: Optional configuration to toggle whether the un-deployed pipelines should be ingested or not. If set to false, only deployed pipelines will be ingested. Default: `true`.
- **`overrideMetadata`** *(boolean)*: Set the 'Override Metadata' toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source. If the toggle is set to true, the metadata fetched from the source will override the existing metadata in the OpenMetadata server. If the toggle is set to false, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. This is applicable for fields like description, tags, owner and displayName. Default: `false`.
## Definitions

- **`pipelineMetadataConfigType`** *(string)*: Pipeline Source Config Metadata Pipeline type. Must be one of: `["PipelineMetadata"]`. Default: `"PipelineMetadata"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.

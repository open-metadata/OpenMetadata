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
- **`dbServiceNames`** *(array)*: List of Database Service Names for creation of lineage.
  - **Items** *(string)*
- **`markDeletedPipelines`** *(boolean)*: Optional configuration to soft delete Pipelines in OpenMetadata if the source Pipelines are deleted. Also, if the Pipeline is deleted, all the associated entities like lineage, etc., with that Pipeline will be deleted. Default: `true`.
- **`includeTags`** *(boolean)*: Optional configuration to toggle the tags ingestion. Default: `true`.
## Definitions

- <a id="definitions/pipelineMetadataConfigType"></a>**`pipelineMetadataConfigType`** *(string)*: Pipeline Source Config Metadata Pipeline type. Must be one of: `["PipelineMetadata"]`. Default: `"PipelineMetadata"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.

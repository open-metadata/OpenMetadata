---
title: pipelineServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/pipelineservicemetadatapipeline
---

# PipelineServiceMetadataPipeline

*PipelineService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/pipelineMetadataConfigType*. Default: `PipelineMetadata`.
- **`includeLineage`** *(boolean)*: Optional configuration to turn off fetching lineage from pipelines. Default: `True`.
- **`pipelineFilterPattern`**: Regex exclude pipelines. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`markDeletedPipelines`** *(boolean)*: Optional configuration to soft delete Pipelines in OpenMetadata if the source Pipelines are deleted. Also, if the Pipeline is deleted, all the associated entities like lineage, etc., with that Pipeline will be deleted. Default: `True`.
- **`includeTags`** *(boolean)*: Optional configuration to toggle the tags ingestion. Default: `True`.
## Definitions

- **`pipelineMetadataConfigType`** *(string)*: Pipeline Source Config Metadata Pipeline type. Must be one of: `['PipelineMetadata']`. Default: `PipelineMetadata`.


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
